import { useRef } from "react";
import * as THREE from "three";
import {
  findSnapPoint,
  SNAP_TOLERANCE_PX,
  SNAP_MARKER_PX,
  SNAP_OVERLAY_RENDER_ORDER,
  type PickingIndex,
  type DxfEntity,
  type MeasurePoint,
  type SnapType,
  type SnapResult,
} from "dxf-render";

/**
 * Geometry-snap controller shared by the measurement tools. Turns a raw cursor
 * world position into a "snapped" one near a characteristic point of nearby
 * geometry and draws an AutoCAD-style marker glyph. The current snap-type is
 * kept internal here (the marker is a Three.js overlay; nothing renders the
 * value).
 */

const ALL_TYPES: readonly SnapType[] = ["endpoint", "midpoint", "center", "quadrant", "node"];

export interface SnapController {
  attach: (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRenderFn: () => void,
  ) => void;
  setData: (pi: PickingIndex | null, ei: Map<string, DxfEntity> | null) => void;
  setEnabled: (on: boolean) => void;
  setColor: (newColor: string) => void;
  setTolerance: (px: number) => void;
  setVisibleLayers: (layers: Set<string> | null) => void;
  resolve: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
  clear: () => void;
  dispose: () => void;
}

function createSnapController(): SnapController {
  /** The kind of snap currently shown under the cursor, or `null`. */
  let current: SnapType | null = null;

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRender: (() => void) | null = null;

  let pickingIndex: PickingIndex | null = null;
  let entityIndex: Map<string, DxfEntity> | null = null;
  let enabled = false;
  let tolerancePx = SNAP_TOLERANCE_PX;
  let color = "#ff6b1a";
  // Set of visible layer names; `null` = no filtering (snap on any layer).
  let visibleLayers: Set<string> | null = null;

  // Overlay: one parent group, one child glyph per snap type (only one visible).
  let overlayGroup: THREE.Group | null = null;
  let material: THREE.LineBasicMaterial | null = null;
  const glyphs = new Map<SnapType, THREE.Object3D>();

  // Memo to skip recomputation when the query point hasn't changed.
  let lastQueryX = Number.NaN;
  let lastQueryY = Number.NaN;
  let lastSnap: SnapResult | null = null;
  let computed = false;

  const buildGlyphs = (): void => {
    if (!scene || overlayGroup) return;
    overlayGroup = new THREE.Group();
    overlayGroup.name = "dxf-snap-overlay";
    overlayGroup.renderOrder = SNAP_OVERLAY_RENDER_ORDER; // above measurement overlays
    overlayGroup.visible = false;
    scene.add(overlayGroup);

    material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
    });

    addGlyph("endpoint", squareLoop());
    addGlyph("midpoint", triangleLoop());
    addGlyph("center", circleLoop());
    addGlyph("quadrant", diamondLoop());
    addGlyph("node", crossSegments());
  };

  const addGlyph = (type: SnapType, geom: THREE.BufferGeometry): void => {
    if (!overlayGroup || !material) return;
    const obj =
      type === "node"
        ? new THREE.LineSegments(geom, material)
        : new THREE.LineLoop(geom, material);
    obj.visible = false;
    obj.renderOrder = SNAP_OVERLAY_RENDER_ORDER;
    overlayGroup.add(obj);
    glyphs.set(type, obj);
  };

  /** World distance covered by one screen pixel (constant for an ortho camera). */
  const worldPerPixel = (): number => {
    if (!canvas || !camera) return 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return 1;
    const a = new THREE.Vector3(0, 0, 0).unproject(camera);
    const b = new THREE.Vector3(2 / rect.width, 0, 0).unproject(camera);
    const d = a.distanceTo(b);
    return d > 0 && Number.isFinite(d) ? d : 1;
  };

  const hideMarker = (): void => {
    if (current === null && (!overlayGroup || !overlayGroup.visible)) return;
    if (overlayGroup) overlayGroup.visible = false;
    current = null;
    requestRender?.();
  };

  const showMarker = (snap: SnapResult, wpp: number): void => {
    buildGlyphs();
    if (!overlayGroup) return;
    const offset = getOriginOffsetFn();
    overlayGroup.position.set(snap.point.x - offset.x, snap.point.y - offset.y, 0);
    const s = wpp * SNAP_MARKER_PX;
    overlayGroup.scale.set(s, s, 1);
    for (const [type, obj] of glyphs) obj.visible = type === snap.type;
    overlayGroup.visible = true;
    current = snap.type;
    requestRender?.();
  };

  const resolve = (rawWorld: MeasurePoint, _clientX: number, _clientY: number): MeasurePoint => {
    if (!enabled || !pickingIndex || !entityIndex) {
      hideMarker();
      return rawWorld;
    }
    // Reuse the last result when the query point is identical (e.g. the click
    // following the last move) — same input, same snap.
    if (computed && rawWorld.x === lastQueryX && rawWorld.y === lastQueryY) {
      return lastSnap ? lastSnap.point : rawWorld;
    }
    lastQueryX = rawWorld.x;
    lastQueryY = rawWorld.y;
    computed = true;

    const wpp = worldPerPixel();
    const tol = wpp * tolerancePx;
    const snap = findSnapPoint(pickingIndex, entityIndex, rawWorld, tol, {
      types: ALL_TYPES,
      visibleLayers,
    });
    lastSnap = snap;
    if (snap) {
      showMarker(snap, wpp);
      return snap.point;
    }
    hideMarker();
    return rawWorld;
  };

  const attach = (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRenderFn: () => void,
  ): void => {
    canvas = canvasEl;
    scene = sceneRef;
    camera = cameraRef;
    getOriginOffsetFn = getOriginOffset;
    requestRender = requestRenderFn;
    buildGlyphs();
  };

  const setData = (pi: PickingIndex | null, ei: Map<string, DxfEntity> | null): void => {
    pickingIndex = pi;
    entityIndex = ei;
    invalidate();
  };

  const setEnabled = (on: boolean): void => {
    if (enabled === on) return;
    enabled = on;
    if (!on) hideMarker();
    invalidate();
  };

  const setColor = (newColor: string): void => {
    color = newColor;
    material?.color.set(newColor);
    requestRender?.();
  };

  const setTolerance = (px: number): void => {
    if (Number.isFinite(px) && px > 0) tolerancePx = px;
  };

  const setVisibleLayers = (layers: Set<string> | null): void => {
    visibleLayers = layers;
    invalidate();
  };

  /** Drop the memo so the next `resolve` recomputes. */
  const invalidate = (): void => {
    lastQueryX = Number.NaN;
    lastQueryY = Number.NaN;
    lastSnap = null;
    computed = false;
  };

  const clear = (): void => {
    hideMarker();
    invalidate();
  };

  const dispose = (): void => {
    if (scene && overlayGroup) scene.remove(overlayGroup);
    for (const obj of glyphs.values()) {
      (obj as THREE.Line).geometry?.dispose();
    }
    glyphs.clear();
    material?.dispose();
    overlayGroup = null;
    material = null;
    canvas = null;
    scene = null;
    camera = null;
    requestRender = null;
    pickingIndex = null;
    entityIndex = null;
    enabled = false;
    current = null;
  };

  return {
    attach,
    setData,
    setEnabled,
    setColor,
    setTolerance,
    setVisibleLayers,
    resolve,
    clear,
    dispose,
  };
}

/** React hook over {@link createSnapController}. Returns a stable controller. */
export function useSnap(): SnapController {
  const ref = useRef<SnapController | null>(null);
  if (ref.current === null) {
    ref.current = createSnapController();
  }
  return ref.current;
}

// ─── Unit glyph geometries (centered at origin, scaled to pixels at runtime) ──

function loop(points: Array<[number, number]>): THREE.BufferGeometry {
  const arr = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    arr[i * 3] = points[i][0];
    arr[i * 3 + 1] = points[i][1];
    arr[i * 3 + 2] = 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return g;
}

function squareLoop(): THREE.BufferGeometry {
  return loop([
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ]);
}

function triangleLoop(): THREE.BufferGeometry {
  return loop([
    [0, 0.6],
    [-0.55, -0.4],
    [0.55, -0.4],
  ]);
}

function diamondLoop(): THREE.BufferGeometry {
  return loop([
    [0.6, 0],
    [0, 0.6],
    [-0.6, 0],
    [0, -0.6],
  ]);
}

function circleLoop(): THREE.BufferGeometry {
  const n = 24;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * 0.55, Math.sin(a) * 0.55]);
  }
  return loop(pts);
}

function crossSegments(): THREE.BufferGeometry {
  // Two diagonals (an "X"), drawn as independent segments.
  return loop([
    [-0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
    [0.5, -0.5],
  ]);
}
