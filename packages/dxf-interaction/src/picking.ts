import * as THREE from "three";
import {
  buildPickingIndex,
  createPickingGroup,
  disposePickingGroup,
  setPickingGroupDebug,
  buildEntityIndex,
  buildAssociations,
  extractEntityText,
  CLICK_DISTANCE_THRESHOLD_PX,
  type DxfData,
  type DxfEntity,
  type PickingEntry,
  type PickingIndex,
  type EntityAssociation,
} from "dxf-render";

/**
 * Picking event payload — emitted on hover and click.
 */
export interface PickingEvent {
  /** Original DXF handle. May be shared between INSERT instances of the same block. */
  handle: string;
  /** Unique pick id within the index. Distinguishes which INSERT instance was hit. */
  pickId?: string;
  type: string;
  layer: string;
  text?: string;
  /** The raw parsed DXF entity (useful for advanced consumers) */
  entity?: DxfEntity;
  /** First association this entity participates in, if any (MLEADER, LEADER+TEXT, INSERT+ATTRIB, DIMENSION) */
  association?: EntityAssociation;
}

/** Hover throttle: at most one raycast per frame */
const HOVER_THROTTLE_MS = 16;

export interface PickingController {
  installPickingData: (
    dxf: DxfData,
    scene: THREE.Scene,
    originOffset: { x: number; y: number; z: number },
  ) => void;
  removePickingData: (scene: THREE.Scene | null) => void;
  attach: (
    canvasEl: HTMLCanvasElement,
    cameraRef: THREE.Camera,
    callbacks: { onHover?: (e: PickingEvent | null) => void; onClick?: (e: PickingEvent) => void },
  ) => void;
  detach: () => void;
  setEnabled: (value: boolean) => void;
  setVisibleLayers: (layers: Set<string> | null) => void;
  getPickingEntries: (handle: string) => PickingEntry[];
  getPickingEntryById: (id: string) => PickingEntry | undefined;
  getPickingIndex: () => PickingIndex | null;
  getEntityIndex: () => Map<string, DxfEntity> | null;
  getAssociations: () => EntityAssociation[];
  findAssociationsByHandle: (handle: string) => EntityAssociation[];
  getPickingGroup: () => THREE.Group | null;
  setDebug: (on: boolean) => void;
  buildEventForEntry: (entry: PickingEntry) => PickingEvent;
}

/**
 * Plain picking controller. Hover/click are consumed via callbacks, not via a
 * rendered value — so picking needs no React state and stays a pure imperative
 * controller.
 */
export function createPickingController(): PickingController {
  let pickingGroup: THREE.Group | null = null;
  let entityIndex: Map<string, DxfEntity> | null = null;
  let pickingIndex: PickingIndex | null = null;
  let associations: EntityAssociation[] = [];
  let associationsByHandle: Map<string, EntityAssociation[]> = new Map();

  let canvas: HTMLCanvasElement | null = null;
  let camera: THREE.Camera | null = null;
  let onHoverCb: ((e: PickingEvent | null) => void) | null = null;
  let onClickCb: ((e: PickingEvent) => void) | null = null;
  // Set of layer names currently visible. `null` = no filtering (pick anything).
  // The raycaster in three.js 0.182 ignores `mesh.visible`, so we must filter
  // hits by layer here rather than toggling the picking meshes' visibility.
  let visibleLayers: Set<string> | null = null;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let lastHoverHandle: string | null = null;
  let lastHoverTime = 0;
  let mouseDownX = 0;
  let mouseDownY = 0;
  let enabled = false;

  const installPickingData = (
    dxf: DxfData,
    scene: THREE.Scene,
    originOffset: { x: number; y: number; z: number },
  ): void => {
    removePickingData(scene);
    pickingIndex = buildPickingIndex(dxf);
    entityIndex = buildEntityIndex(dxf);
    associations = buildAssociations(dxf);
    associationsByHandle = indexAssociationsByHandle(associations);
    pickingGroup = createPickingGroup(pickingIndex, originOffset);
    scene.add(pickingGroup);
    // Force matrixWorld computation now — without this, raycasts before the
    // first render miss every mesh (their matrixWorld is still identity).
    pickingGroup.updateMatrixWorld(true);
  };

  const removePickingData = (scene: THREE.Scene | null): void => {
    const group = pickingGroup;
    if (group) {
      if (scene) scene.remove(group);
      disposePickingGroup(group);
      pickingGroup = null;
    }
    pickingIndex = null;
    entityIndex = null;
    associations = [];
    associationsByHandle = new Map();
    lastHoverHandle = null;
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!enabled || !pickingGroup || !canvas || !camera) return;
    const now = performance.now();
    if (now - lastHoverTime < HOVER_THROTTLE_MS) return;
    lastHoverTime = now;

    const event = pickAtClientXY(e.clientX, e.clientY);
    const newHandle = event?.handle ?? null;
    if (newHandle === lastHoverHandle) return;
    lastHoverHandle = newHandle;
    onHoverCb?.(event);
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!enabled) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!enabled || !onClickCb) return;
    const dx = e.clientX - mouseDownX;
    const dy = e.clientY - mouseDownY;
    if (Math.hypot(dx, dy) > CLICK_DISTANCE_THRESHOLD_PX) return;
    const event = pickAtClientXY(e.clientX, e.clientY);
    if (event) onClickCb(event);
  };

  const handlePointerLeave = () => {
    if (!enabled) return;
    if (lastHoverHandle !== null) {
      lastHoverHandle = null;
      onHoverCb?.(null);
    }
  };

  const pickAtClientXY = (clientX: number, clientY: number): PickingEvent | null => {
    if (!pickingGroup || !canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Force-intersect the invisible picking group (raycaster skips invisible by default)
    const wasVisible = pickingGroup.visible;
    pickingGroup.visible = true;
    const hits = raycaster.intersectObject(pickingGroup, true);
    pickingGroup.visible = wasVisible;

    if (hits.length === 0) return null;

    // Drop hits on hidden/frozen layers — entities you can't see shouldn't be
    // pickable. `visibleLayers === null` means no layer state yet (pick all).
    const candidates =
      visibleLayers === null
        ? hits
        : hits.filter((h) => {
            const layerName = h.object.userData.layerName as string | undefined;
            return layerName === undefined || visibleLayers!.has(layerName);
          });
    if (candidates.length === 0) return null;

    // Choose the most specific hit: lowest type-priority number wins (foreground
    // entities like text/dimension/leader beat background polylines and hatches),
    // and within the same priority the smallest bbox wins.
    let best = candidates[0];
    let bestPriority = typePriorityOf(best.object);
    let bestSize = bboxSizeOf(best.object);
    for (let i = 1; i < candidates.length; i++) {
      const obj = candidates[i].object;
      const pr = typePriorityOf(obj);
      const sz = bboxSizeOf(obj);
      if (pr < bestPriority || (pr === bestPriority && sz < bestSize)) {
        best = candidates[i];
        bestPriority = pr;
        bestSize = sz;
      }
    }

    const pickId = best.object.userData.pickId as string | undefined;
    const handle = best.object.userData.handle as string | undefined;
    const type = best.object.userData.dxfType as string | undefined;
    const layer = best.object.userData.layerName as string | undefined;
    if (!handle || !type) return null;

    const entity = entityIndex?.get(handle);
    const association = associationsByHandle.get(handle)?.[0];
    return {
      handle,
      pickId,
      type,
      layer: layer ?? "0",
      text: association?.text ?? (entity ? extractEntityText(entity) : undefined),
      entity,
      association,
    };
  };

  const attach = (
    canvasEl: HTMLCanvasElement,
    cameraRef: THREE.Camera,
    callbacks: {
      onHover?: (e: PickingEvent | null) => void;
      onClick?: (e: PickingEvent) => void;
    },
  ) => {
    canvas = canvasEl;
    camera = cameraRef;
    onHoverCb = callbacks.onHover ?? null;
    onClickCb = callbacks.onClick ?? null;
    enabled = true;
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerLeave);
  };

  const detach = () => {
    enabled = false;
    if (canvas) {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    }
    canvas = null;
    camera = null;
    onHoverCb = null;
    onClickCb = null;
  };

  const setEnabled = (value: boolean) => {
    enabled = value;
  };

  const setVisibleLayers = (layers: Set<string> | null): void => {
    visibleLayers = layers;
  };

  const buildEventForEntry = (entry: PickingEntry): PickingEvent => {
    const entity = entityIndex?.get(entry.handle);
    const association = associationsByHandle.get(entry.handle)?.[0];
    return {
      handle: entry.handle,
      pickId: entry.id,
      type: entry.type,
      layer: entry.layer,
      text: association?.text ?? (entity ? extractEntityText(entity) : undefined),
      entity,
      association,
    };
  };

  const getPickingEntries = (handle: string) => pickingIndex?.byHandle.get(handle) ?? [];
  const getPickingEntryById = (id: string) => pickingIndex?.byId.get(id);
  const getPickingIndex = (): PickingIndex | null => pickingIndex;
  const getEntityIndex = (): Map<string, DxfEntity> | null => entityIndex;
  const getAssociations = (): EntityAssociation[] => associations;
  const findAssociationsByHandle = (handle: string): EntityAssociation[] =>
    associationsByHandle.get(handle) ?? [];
  const getPickingGroup = () => pickingGroup;
  const setDebug = (on: boolean): void => {
    if (pickingGroup) setPickingGroupDebug(pickingGroup, on);
  };

  return {
    installPickingData,
    removePickingData,
    attach,
    detach,
    setEnabled,
    setVisibleLayers,
    getPickingEntries,
    getPickingEntryById,
    getPickingIndex,
    getEntityIndex,
    getAssociations,
    findAssociationsByHandle,
    getPickingGroup,
    setDebug,
    buildEventForEntry,
  };
}

function indexAssociationsByHandle(
  associations: EntityAssociation[],
): Map<string, EntityAssociation[]> {
  const map = new Map<string, EntityAssociation[]>();
  for (const a of associations) {
    for (const m of a.members) {
      const list = map.get(m);
      if (list) list.push(a);
      else map.set(m, [a]);
    }
  }
  return map;
}

function bboxSizeOf(obj: THREE.Object3D): number {
  const mesh = obj as THREE.Mesh;
  if (!mesh.geometry?.boundingBox) {
    mesh.geometry?.computeBoundingBox();
  }
  const bb = mesh.geometry?.boundingBox;
  if (!bb) return Infinity;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  const sz = bb.max.z - bb.min.z;
  return sx * sy + sx * sz + sy * sz;
}

/**
 * Lower number = higher precedence when multiple entities overlap under the cursor.
 * Foreground annotations (text, dimensions, leaders) beat geometric primitives,
 * which in turn beat polylines/splines, which beat fills and aggregate INSERTs.
 */
function typePriorityOf(obj: THREE.Object3D): number {
  const t = obj.userData.dxfType as string | undefined;
  switch (t) {
    case "TEXT":
    case "MTEXT":
    case "ATTRIB":
    case "ATTDEF":
    case "DIMENSION":
    case "LEADER":
    case "MULTILEADER":
    case "MLEADER":
      return 1;
    case "LINE":
    case "CIRCLE":
    case "ARC":
    case "ELLIPSE":
    case "POINT":
    case "XLINE":
    case "RAY":
      return 2;
    case "POLYLINE":
    case "LWPOLYLINE":
    case "SPLINE":
    case "MLINE":
      return 3;
    case "SOLID":
    case "3DFACE":
      return 4;
    case "HATCH":
    case "INSERT":
      return 5;
    default:
      return 3;
  }
}
