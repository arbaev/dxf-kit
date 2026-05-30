import { ref, shallowRef } from "vue";
import * as THREE from "three";
import { measureDirectedAngle, toDegrees, type MeasurePoint } from "dxf-render";
import type { AngleUnits } from "../types";

/**
 * Minimal shape of the MapControls/OrbitControls instance we need: we steal
 * the LEFT mouse button binding while measuring so left-clicks don't start
 * a pan drag. Middle/right buttons and wheel-zoom stay untouched.
 */
interface ControlsLike {
  mouseButtons: { LEFT: unknown; MIDDLE: unknown; RIGHT: unknown };
}

/**
 * Result of a completed (3-point) angle measurement. Emitted via `onResult`
 * once the third click locks the second ray.
 */
export interface AngleMeasureResult {
  /** Apex of the angle (first click) in DXF world coordinates. */
  vertex: MeasurePoint;
  /** End of the first ray (second click). */
  p1: MeasurePoint;
  /** End of the second ray (third click). */
  p2: MeasurePoint;
  /** Directed angle swept CCW from ray `vertex→p1` to `vertex→p2`, radians `[0, 2π)`. */
  radians: number;
  /** The same angle in degrees `[0, 360)`. */
  degrees: number;
  /** True when the measured angle is reflex (> 180°). */
  reflex: boolean;
  /** The display-unit mode active at the moment of measurement. */
  units: AngleUnits;
}

export interface AngleMeasureState {
  /** 0–3 committed points: `[vertex]`, `[vertex, p1]`, or `[vertex, p1, p2]`. */
  points: MeasurePoint[];
  /** Live cursor position in DXF world coords while drafting (null once closed). */
  hoverWorld: MeasurePoint | null;
  /** True once the third point is placed and a result emitted. */
  closed: boolean;
}

export interface AngleMeasureCallbacks {
  /** Fired when the third point is placed — the measurement is complete. */
  onResult?: (result: AngleMeasureResult) => void;
  /** Fired whenever the internal state changes (point added/removed, hover, reset). */
  onChange?: (state: AngleMeasureState) => void;
  /** Fired when Esc aborts an in-flight measurement OR `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
}

/** Pixel distance threshold above which a mousedown→mouseup is treated as pan, not click. */
const CLICK_DISTANCE_THRESHOLD = 4;
/** Arc radius as a fraction of the shorter ray length. */
const ARC_RADIUS_FRACTION = 0.4;
/** Lower / upper clamp for the arc radius, in screen pixels. */
const ARC_MIN_PX = 24;
const ARC_MAX_PX = 80;
/** Segments used to approximate a full turn of the arc polyline. */
const ARC_SEGMENTS_PER_TURN = 64;

const emptyState = (): AngleMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
});

/**
 * Tells whether an event target is a text-entry control, so global key
 * handlers (Backspace) don't hijack typing in the host page.
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

/**
 * 3-point angle-measurement tool (AutoCAD-style).
 *
 * Flow (states keyed by committed-point count):
 *   - `empty` → click places the vertex (apex).
 *   - `one`   → a preview ray follows the cursor (the first ray).
 *   - `two`   → vertex + first ray locked; the second ray + arc + label follow
 *               the cursor. The directed CCW angle updates live, so moving the
 *               cursor past the first ray flips between `α` and `360° − α`.
 *   - `closed`→ the third click locks the second ray; rays + arc + label persist
 *               until the next click starts a fresh measurement.
 *
 * Esc aborts; Backspace removes the last placed point.
 *
 * Owns a Three.js overlay group (renderOrder=999, depthTest=false) with two
 * ray segments (`THREE.Line` polyline `[p1, vertex, p2]`), a directed-arc
 * `THREE.Line`, and vertex `Points` markers. Independent of picking — needs
 * only a camera, the scene root, and a `getOriginOffset()` callback.
 */
export function useAngleMeasurement() {
  const state = shallowRef<AngleMeasureState>(emptyState());
  const isActive = ref(false);

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let controls: ControlsLike | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRender: (() => void) | null = null;
  let callbacks: AngleMeasureCallbacks = {};
  let units: AngleUnits = "deg";
  let savedLeftButton: unknown = undefined;

  // Three.js overlay
  let overlayGroup: THREE.Group | null = null;
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let markerMaterial: THREE.PointsMaterial | null = null;
  let rayLine: THREE.Line | null = null;
  let arcLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;
  let color = "#ff6b1a";

  // Pointer tracking — distinguish click from pan.
  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownButton = -1;

  const ensureOverlay = (): void => {
    if (!scene || overlayGroup) return;

    overlayGroup = new THREE.Group();
    overlayGroup.name = "dxf-angle-measurement-overlay";
    overlayGroup.renderOrder = 999;
    scene.add(overlayGroup);

    const c = new THREE.Color(color);
    lineMaterial = new THREE.LineBasicMaterial({
      color: c.clone(),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    });
    markerMaterial = new THREE.PointsMaterial({
      color: c.clone(),
      size: 8,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
    });

    // Two ray segments share a single 3-vertex polyline [p1, vertex, p2].
    const rayGeom = new THREE.BufferGeometry();
    rayGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    rayGeom.setDrawRange(0, 0);
    rayLine = new THREE.Line(rayGeom, lineMaterial);
    rayLine.visible = false;
    overlayGroup.add(rayLine);

    const arcGeom = new THREE.BufferGeometry();
    arcGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array((ARC_SEGMENTS_PER_TURN + 1) * 3), 3),
    );
    arcGeom.setDrawRange(0, 0);
    arcLine = new THREE.Line(arcGeom, lineMaterial);
    arcLine.visible = false;
    overlayGroup.add(arcLine);

    const markerGeom = new THREE.BufferGeometry();
    markerGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    markerGeom.setDrawRange(0, 0);
    markerPoints = new THREE.Points(markerGeom, markerMaterial);
    markerPoints.visible = false;
    overlayGroup.add(markerPoints);
  };

  /**
   * Grow a geometry's `position` attribute to hold at least `vertexCount`
   * vertices, reusing the existing buffer when it is already large enough.
   * Returns the (possibly new) Float32Array backing the attribute.
   */
  const ensurePositionCapacity = (
    geom: THREE.BufferGeometry,
    vertexCount: number,
  ): Float32Array => {
    let attr = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!attr || attr.array.length < vertexCount * 3) {
      const arr = new Float32Array(Math.max(vertexCount, 4) * 3);
      attr = new THREE.BufferAttribute(arr, 3);
      geom.setAttribute("position", attr);
    }
    return attr.array as Float32Array;
  };

  /**
   * Resolve the vertex and the two ray endpoints currently shown: committed
   * points, with the live cursor standing in for the not-yet-placed ray.
   */
  const displayRays = (): {
    vertex: MeasurePoint | null;
    r1: MeasurePoint | null;
    r2: MeasurePoint | null;
  } => {
    const s = state.value;
    const pts = s.points;
    if (pts.length === 1) {
      return { vertex: pts[0], r1: s.closed ? null : s.hoverWorld, r2: null };
    }
    if (pts.length === 2) {
      return { vertex: pts[0], r1: pts[1], r2: s.closed ? null : s.hoverWorld };
    }
    if (pts.length >= 3) {
      return { vertex: pts[0], r1: pts[1], r2: pts[2] };
    }
    return { vertex: null, r1: null, r2: null };
  };

  /** World units spanned by one screen pixel (used to clamp the arc radius). */
  const worldPerPixel = (): number => {
    if (!canvas || !camera) return 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return 1;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const a = screenToWorld(cx, cy);
    const b = screenToWorld(cx + 1, cy);
    if (!a || !b) return 1;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return d > 0 ? d : 1;
  };

  const refreshOverlay = (): void => {
    ensureOverlay();
    if (!rayLine || !arcLine || !markerPoints) return;

    const offset = getOriginOffsetFn();
    const committed = state.value.points;
    const { vertex, r1, r2 } = displayRays();

    // Ray polyline: [r1, vertex, r2], skipping endpoints that aren't set yet.
    const rayPts: MeasurePoint[] = [];
    if (vertex) {
      if (r1) rayPts.push(r1);
      rayPts.push(vertex);
      if (r2) rayPts.push(r2);
    }
    if (rayPts.length >= 2) {
      const arr = ensurePositionCapacity(rayLine.geometry, rayPts.length);
      for (let i = 0; i < rayPts.length; i++) {
        arr[i * 3] = rayPts[i].x - offset.x;
        arr[i * 3 + 1] = rayPts[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = rayLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      rayLine.geometry.setDrawRange(0, rayPts.length);
      rayLine.geometry.computeBoundingSphere();
      rayLine.visible = true;
    } else {
      rayLine.visible = false;
    }

    // Directed arc between the two rays (needs both rays present).
    if (vertex && r1 && r2) {
      const len1 = Math.hypot(r1.x - vertex.x, r1.y - vertex.y);
      const len2 = Math.hypot(r2.x - vertex.x, r2.y - vertex.y);
      const minRay = Math.min(len1, len2);
      const directed = measureDirectedAngle(vertex, r1, r2);
      if (minRay > 0 && directed > 0) {
        const wpp = worldPerPixel();
        let radius = ARC_RADIUS_FRACTION * minRay;
        radius = Math.max(ARC_MIN_PX * wpp, Math.min(radius, ARC_MAX_PX * wpp));
        // Never let the arc overshoot the shorter ray.
        radius = Math.min(radius, minRay * 0.9);
        const a1 = Math.atan2(r1.y - vertex.y, r1.x - vertex.x);
        const segs = Math.max(2, Math.ceil((directed / (Math.PI * 2)) * ARC_SEGMENTS_PER_TURN));
        const arr = ensurePositionCapacity(arcLine.geometry, segs + 1);
        for (let i = 0; i <= segs; i++) {
          const ang = a1 + directed * (i / segs);
          arr[i * 3] = vertex.x + radius * Math.cos(ang) - offset.x;
          arr[i * 3 + 1] = vertex.y + radius * Math.sin(ang) - offset.y;
          arr[i * 3 + 2] = 0;
        }
        const attr = arcLine.geometry.getAttribute("position") as THREE.BufferAttribute;
        attr.needsUpdate = true;
        arcLine.geometry.setDrawRange(0, segs + 1);
        arcLine.geometry.computeBoundingSphere();
        arcLine.visible = true;
      } else {
        arcLine.visible = false;
      }
    } else {
      arcLine.visible = false;
    }

    // Vertex markers (committed only).
    if (committed.length >= 1) {
      const arr = ensurePositionCapacity(markerPoints.geometry, committed.length);
      for (let i = 0; i < committed.length; i++) {
        arr[i * 3] = committed[i].x - offset.x;
        arr[i * 3 + 1] = committed[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = markerPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      markerPoints.geometry.setDrawRange(0, committed.length);
      markerPoints.visible = true;
    } else {
      markerPoints.visible = false;
    }
  };

  const disposeOverlay = (): void => {
    if (!scene || !overlayGroup) return;
    scene.remove(overlayGroup);
    rayLine?.geometry.dispose();
    arcLine?.geometry.dispose();
    markerPoints?.geometry.dispose();
    lineMaterial?.dispose();
    markerMaterial?.dispose();
    overlayGroup = null;
    rayLine = null;
    arcLine = null;
    markerPoints = null;
    lineMaterial = null;
    markerMaterial = null;
  };

  const setCursor = (on: boolean): void => {
    if (!canvas) return;
    canvas.style.cursor = on ? "crosshair" : "";
  };

  const screenToWorld = (clientX: number, clientY: number): MeasurePoint | null => {
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const v = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
    const offset = getOriginOffsetFn();
    return { x: v.x + offset.x, y: v.y + offset.y, z: 0 };
  };

  const emitChange = (): void => {
    callbacks.onChange?.(state.value);
    refreshOverlay();
    requestRender?.();
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = state.value.points.length > 0 && !state.value.closed;
    state.value = emptyState();
    emitChange();
    if (notify && hadDraft) callbacks.onCancel?.();
  };

  const closeAngle = (): void => {
    const pts = state.value.points;
    if (pts.length < 3) return;
    state.value = { points: pts, hoverWorld: null, closed: true };
    emitChange();
    const [v, p1, p2] = pts;
    const radians = measureDirectedAngle(v, p1, p2);
    const degrees = toDegrees(radians);
    callbacks.onResult?.({
      vertex: { x: v.x, y: v.y, z: v.z ?? 0 },
      p1: { x: p1.x, y: p1.y, z: p1.z ?? 0 },
      p2: { x: p2.x, y: p2.y, z: p2.z ?? 0 },
      radians,
      degrees,
      reflex: degrees > 180,
      units,
    });
  };

  const addPoint = (world: MeasurePoint): void => {
    state.value = {
      points: [...state.value.points, world],
      hoverWorld: world,
      closed: false,
    };
    emitChange();
  };

  const popPoint = (): void => {
    if (state.value.closed || state.value.points.length === 0) return;
    const next = state.value.points.slice(0, -1);
    state.value = { points: next, hoverWorld: state.value.hoverWorld, closed: false };
    emitChange();
  };

  // Pointer handlers — capture phase, so we run before picking / rect selection.
  const handlePointerDown = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (e.button !== 0) {
      // Reserve middle/right for pan; suppress default (Firefox autoscroll).
      e.preventDefault();
      return;
    }
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownButton = e.button;
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (mouseDownButton !== 0) return;
    mouseDownButton = -1;
    const dx = e.clientX - mouseDownX;
    const dy = e.clientY - mouseDownY;
    if (Math.hypot(dx, dy) >= CLICK_DISTANCE_THRESHOLD) return; // pan, not a click
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    e.stopPropagation();

    if (state.value.closed) {
      // A completed angle is still visible — start fresh with this as the apex.
      state.value = { points: [world], hoverWorld: world, closed: false };
      emitChange();
      return;
    }

    addPoint(world);
    // The third point completes the angle.
    if (state.value.points.length >= 3) closeAngle();
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (state.value.closed) return;
    if (state.value.points.length < 1) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    state.value = { points: state.value.points, hoverWorld: world, closed: false };
    emitChange();
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!isActive.value) return;
    if (e.key === "Escape") {
      if (state.value.points.length > 0 || state.value.closed) {
        e.preventDefault();
        e.stopPropagation();
      }
      resetState(true);
      return;
    }
    if (e.key === "Backspace") {
      if (isTypingTarget(e.target)) return;
      if (!state.value.closed && state.value.points.length >= 1) {
        e.preventDefault();
        popPoint();
      }
    }
  };

  /**
   * Wire up DOM listeners and grab references to the scene/camera. Pairs with
   * `detach()`. `getOriginOffset` is read on every projection so it tracks the
   * loaded DXF; `requestRender` is called after each state change.
   */
  const attach = (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    controlsRef: ControlsLike | null,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRenderFn: () => void,
    cbs?: AngleMeasureCallbacks,
  ): void => {
    detach();
    canvas = canvasEl;
    scene = sceneRef;
    camera = cameraRef;
    controls = controlsRef;
    getOriginOffsetFn = getOriginOffset;
    requestRender = requestRenderFn;
    callbacks = cbs ?? {};

    canvas.addEventListener("pointerdown", handlePointerDown, { capture: true });
    canvas.addEventListener("pointerup", handlePointerUp, { capture: true });
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("keydown", handleKeyDown);
  };

  const detach = (): void => {
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown, { capture: true } as EventListenerOptions);
      canvas.removeEventListener("pointerup", handlePointerUp, { capture: true } as EventListenerOptions);
      canvas.removeEventListener("pointermove", handlePointerMove);
      setCursor(false);
    }
    window.removeEventListener("keydown", handleKeyDown);
    releaseLeftButton();
    canvas = null;
    camera = null;
    scene = null;
    controls = null;
    callbacks = {};
    requestRender = null;
    isActive.value = false;
  };

  /** Steal the LEFT mouse button so left-click+drag doesn't pan while measuring. */
  const acquireLeftButton = (): void => {
    if (!controls || savedLeftButton !== undefined) return;
    savedLeftButton = controls.mouseButtons.LEFT;
    controls.mouseButtons.LEFT = null;
  };

  const releaseLeftButton = (): void => {
    if (!controls || savedLeftButton === undefined) return;
    controls.mouseButtons.LEFT = savedLeftButton;
    savedLeftButton = undefined;
  };

  const setEnabled = (on: boolean): void => {
    if (isActive.value === on) return;
    isActive.value = on;
    setCursor(on);
    if (on) {
      ensureOverlay();
      acquireLeftButton();
    } else {
      releaseLeftButton();
      resetState(true);
    }
  };

  const setUnits = (next: AngleUnits): void => {
    units = next;
  };

  const setColor = (newColor: string): void => {
    color = newColor;
    const c = new THREE.Color(newColor);
    lineMaterial?.color.set(c);
    markerMaterial?.color.set(c);
    requestRender?.();
  };

  /** Manually clear any in-flight or completed measurement without firing `onCancel`. */
  const clear = (): void => {
    state.value = emptyState();
    emitChange();
  };

  const dispose = (): void => {
    detach();
    disposeOverlay();
  };

  return {
    state,
    isActive,
    attach,
    detach,
    setEnabled,
    setUnits,
    setColor,
    clear,
    dispose,
  };
}

/**
 * Format an angle value (given in degrees) into a short string for the
 * requested unit mode. Pure / framework-agnostic — exported for tests and
 * custom UI.
 *
 * - `"deg"` → `"123.4°"` (one decimal)
 * - `"rad"` → `"2.150 rad"` (three decimals)
 * - `"dms"` → `"123°30'15\""` (degrees-minutes-seconds, zero-padded)
 *
 * Returns an em-dash for non-finite input.
 */
export function formatAngleValue(degrees: number, units: AngleUnits): string {
  if (!Number.isFinite(degrees)) return "—";
  if (units === "rad") {
    const rad = (degrees * Math.PI) / 180;
    return `${rad.toFixed(3)} rad`;
  }
  if (units === "dms") {
    const sign = degrees < 0 ? "-" : "";
    const total = Math.abs(degrees);
    let d = Math.floor(total);
    let m = Math.floor((total - d) * 60);
    let s = Math.round(((total - d) * 60 - m) * 60);
    if (s === 60) {
      s = 0;
      m += 1;
    }
    if (m === 60) {
      m = 0;
      d += 1;
    }
    return `${sign}${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`;
  }
  return `${degrees.toFixed(1)}°`;
}
