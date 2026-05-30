import { ref } from "vue";
import * as THREE from "three";
import {
  findSnapPoint,
  type PickingIndex,
  type DxfEntity,
  type MeasurePoint,
  type SnapType,
  type SnapResult,
} from "dxf-render";

/**
 * Geometry-snap controller shared by the measurement tools (distance / area /
 * angle). It turns a raw cursor world position into a "snapped" one when the
 * cursor is near a characteristic point of nearby geometry — endpoint,
 * midpoint, center, quadrant or node — and draws an AutoCAD-style marker glyph
 * under the cursor.
 *
 * Pure snap math lives in `dxf-render` (`findSnapPoint` / `getEntitySnapPoints`);
 * this composable only adapts it to the live scene: it converts a pixel
 * aperture to a world tolerance (the camera is orthographic, so this is a
 * constant scale) and owns the Three.js overlay marker.
 *
 * It is driven by the measurement composables via the `snap` callback they
 * accept: on every pointer move/click they call `resolve(rawWorld, x, y)`,
 * which both returns the (possibly snapped) point and updates the marker.
 */

/** Aperture radius in screen pixels — how close the cursor must be to snap. */
const DEFAULT_TOLERANCE_PX = 12;
/** On-screen marker glyph size in pixels. */
const MARKER_PX = 11;

const ALL_TYPES: readonly SnapType[] = [
  "endpoint",
  "midpoint",
  "center",
  "quadrant",
  "node",
];

export function useSnap() {
  /** The kind of snap currently shown under the cursor, or `null`. */
  const current = ref<SnapType | null>(null);

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRender: (() => void) | null = null;

  let pickingIndex: PickingIndex | null = null;
  let entityIndex: Map<string, DxfEntity> | null = null;
  let enabled = false;
  let tolerancePx = DEFAULT_TOLERANCE_PX;
  let color = "#ff6b1a";
  // Set of visible layer names; `null` = no filtering (snap on any layer).
  let visibleLayers: Set<string> | null = null;

  // Overlay: one parent group, one child glyph per snap type (only one visible).
  let overlayGroup: THREE.Group | null = null;
  let material: THREE.LineBasicMaterial | null = null;
  const glyphs = new Map<SnapType, THREE.Object3D>();

  // Memo to skip recomputation when the query point hasn't changed (clicks
  // reuse the last move's coordinates, so this also keeps clicks accurate).
  let lastQueryX = Number.NaN;
  let lastQueryY = Number.NaN;
  let lastSnap: SnapResult | null = null;
  let computed = false;

  const buildGlyphs = (): void => {
    if (!scene || overlayGroup) return;
    overlayGroup = new THREE.Group();
    overlayGroup.name = "dxf-snap-overlay";
    overlayGroup.renderOrder = 1000; // above measurement overlays (999)
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
    const obj = type === "node"
      ? new THREE.LineSegments(geom, material)
      : new THREE.LineLoop(geom, material);
    obj.visible = false;
    obj.renderOrder = 1000;
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
    if (current.value === null && (!overlayGroup || !overlayGroup.visible)) return;
    if (overlayGroup) overlayGroup.visible = false;
    current.value = null;
    requestRender?.();
  };

  const showMarker = (snap: SnapResult, wpp: number): void => {
    buildGlyphs();
    if (!overlayGroup) return;
    const offset = getOriginOffsetFn();
    overlayGroup.position.set(snap.point.x - offset.x, snap.point.y - offset.y, 0);
    const s = wpp * MARKER_PX;
    overlayGroup.scale.set(s, s, 1);
    for (const [type, obj] of glyphs) obj.visible = type === snap.type;
    overlayGroup.visible = true;
    current.value = snap.type;
    requestRender?.();
  };

  /**
   * Resolve a raw cursor world position to a possibly-snapped one and update
   * the marker. Returns `rawWorld` unchanged when snapping is off, has no data,
   * or nothing is in range.
   */
  const resolve = (
    rawWorld: MeasurePoint,
    _clientX: number,
    _clientY: number,
  ): MeasurePoint => {
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

  const setData = (
    pi: PickingIndex | null,
    ei: Map<string, DxfEntity> | null,
  ): void => {
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

  /**
   * Restrict snapping to entities on visible layers. Pass the set of currently
   * visible layer names, or `null` to snap on every layer. Invalidates the memo
   * so the next `resolve` recomputes against the new set.
   */
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
    current.value = null;
  };

  return {
    current,
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
  return loop([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
}

function triangleLoop(): THREE.BufferGeometry {
  return loop([[0, 0.6], [-0.55, -0.4], [0.55, -0.4]]);
}

function diamondLoop(): THREE.BufferGeometry {
  return loop([[0.6, 0], [0, 0.6], [-0.6, 0], [0, -0.6]]);
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
  return loop([[-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5]]);
}
