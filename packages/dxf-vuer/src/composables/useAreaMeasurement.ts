import { ref, shallowRef } from "vue";
import * as THREE from "three";
import {
  measureArea,
  measurePerimeter,
  polygonSelfIntersects,
  type MeasurePoint,
} from "dxf-render";

/**
 * Minimal shape of the MapControls/OrbitControls instance we need: we steal
 * the LEFT mouse button binding while measuring so left-clicks don't start
 * a pan drag. Middle/right buttons and wheel-zoom stay untouched.
 */
interface ControlsLike {
  mouseButtons: { LEFT: unknown; MIDDLE: unknown; RIGHT: unknown };
}

/**
 * Result of a completed (closed) area measurement. Emitted via `onResult`
 * once the polygon is closed (double-click, click on the first vertex, or
 * Enter — all require at least 3 vertices).
 */
export interface AreaMeasureResult {
  /** Closed polygon vertices in DXF world coordinates (first vertex not repeated). */
  points: MeasurePoint[];
  /** Raw polygon area in DXF world units² (Shoelace, absolute). */
  areaRaw: number;
  /** Area scaled to the displayed units (`areaRaw * areaScale`). */
  area: number;
  /** Raw closed perimeter in DXF world units. */
  perimeterRaw: number;
  /** Perimeter scaled to the displayed units (`perimeterRaw * perimeterScale`). */
  perimeter: number;
  /** Area unit suffix label that was active, e.g. `"m²"` / `"mm²"` / `""` (dxf-units). */
  areaUnits: string;
  /** Length unit suffix label for the perimeter, e.g. `"m"` / `"mm"` / `""`. */
  lengthUnits: string;
  /** True when the polygon boundary crosses itself (algebraic area still reported). */
  selfIntersecting: boolean;
}

/** Resolved unit scales + labels driving the displayed area / perimeter values. */
export interface AreaUnitScales {
  /** Multiplier applied to the raw Shoelace area (square of the linear factor). */
  areaScale: number;
  /** Multiplier applied to the raw perimeter (linear factor). */
  perimeterScale: number;
  /** Area unit suffix, e.g. `"m²"` / `"mm²"` / `"in²"` / `"ft²"` / `""`. */
  areaLabel: string;
  /** Length unit suffix for the perimeter, e.g. `"m"` / `"mm"` / `"in"` / `"ft"` / `""`. */
  lengthLabel: string;
}

export interface AreaMeasureState {
  /** Committed polygon vertices in DXF world coords (no origin offset). */
  points: MeasurePoint[];
  /** Live cursor position in DXF world coords while drafting (null once closed). */
  hoverWorld: MeasurePoint | null;
  /** True once the polygon has been closed and a result emitted. */
  closed: boolean;
  /** True when the cursor is within snap radius of the first vertex (≥3 points, drafting). */
  originSnap: boolean;
}

export interface AreaMeasureCallbacks {
  /** Fired when the polygon is closed — the measurement is complete. */
  onResult?: (result: AreaMeasureResult) => void;
  /** Fired whenever the internal state changes (point added/removed, hover, reset). */
  onChange?: (state: AreaMeasureState) => void;
  /** Fired when Esc aborts an in-flight measurement OR `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
}

/** Pixel distance threshold above which a mousedown→mouseup is treated as pan, not click. */
const CLICK_DISTANCE_THRESHOLD = 4;
/** Max gap (ms) between two clicks to count as a double-click that closes the polygon. */
const DBLCLICK_MS = 350;
/** Max screen-pixel gap between two clicks to count as a double-click. */
const DBLCLICK_DISTANCE = 6;
/** Screen-pixel radius around the first vertex within which a click closes the polygon. */
const ORIGIN_SNAP_RADIUS = 12;

const emptyState = (): AreaMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
  originSnap: false,
});

/**
 * Tells whether an event target is a text-entry control, so global key
 * handlers (Enter / Backspace) don't hijack typing in the host page.
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
 * N-point polygon area-measurement tool (AutoCAD-style).
 *
 * Flow (states keyed by committed-vertex count):
 *   - `empty`  → click adds the first vertex.
 *   - `one`    → a preview line follows the cursor.
 *   - `two`    → a preview triangle (2 committed + cursor); the perimeter is
 *                live but the area is held at `—` until a real polygon exists.
 *   - `three+` → the polygon grows; area + perimeter update live (Shoelace)
 *                including the cursor as the next candidate vertex.
 *   - `closed` → the polygon is finalized; outline + fill + label persist
 *                until the next click starts a fresh measurement.
 *
 * Closing (only at ≥3 vertices): double-click, a click on the first vertex
 * (snap-highlighted), or the Enter key. Esc aborts; Backspace removes the
 * last placed vertex.
 *
 * Owns a Three.js overlay group (renderOrder=999, depthTest=false) with a
 * `LineLoop` outline, a translucent `Mesh` fill, vertex `Points` markers, and
 * a larger origin-snap marker. Independent of picking — needs only a camera,
 * the scene root, and a `getOriginOffset()` callback.
 */
export function useAreaMeasurement() {
  const state = shallowRef<AreaMeasureState>(emptyState());
  const isActive = ref(false);

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let controls: ControlsLike | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRender: (() => void) | null = null;
  let callbacks: AreaMeasureCallbacks = {};
  let scales: AreaUnitScales = { areaScale: 1, perimeterScale: 1, areaLabel: "", lengthLabel: "" };
  let savedLeftButton: unknown = undefined;

  // Three.js overlay
  let overlayGroup: THREE.Group | null = null;
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let fillMaterial: THREE.MeshBasicMaterial | null = null;
  let markerMaterial: THREE.PointsMaterial | null = null;
  let originMaterial: THREE.PointsMaterial | null = null;
  let outlineLoop: THREE.LineLoop | null = null;
  let fillMesh: THREE.Mesh | null = null;
  let markerPoints: THREE.Points | null = null;
  let originMarker: THREE.Points | null = null;
  let color = "#ff6b1a";

  // Pointer tracking — distinguish click from pan, and detect double-clicks.
  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownButton = -1;
  let lastCommitTime = 0;
  let lastCommitX = 0;
  let lastCommitY = 0;

  const ensureOverlay = (): void => {
    if (!scene || overlayGroup) return;

    overlayGroup = new THREE.Group();
    overlayGroup.name = "dxf-area-measurement-overlay";
    overlayGroup.renderOrder = 999;
    scene.add(overlayGroup);

    const c = new THREE.Color(color);
    fillMaterial = new THREE.MeshBasicMaterial({
      color: c.clone(),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
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
    originMaterial = new THREE.PointsMaterial({
      color: c.clone(),
      size: 16,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.6,
    });

    // Fill first so the translucent mesh sits under the outline / markers.
    fillMesh = new THREE.Mesh(new THREE.BufferGeometry(), fillMaterial);
    fillMesh.visible = false;
    overlayGroup.add(fillMesh);

    const outlineGeom = new THREE.BufferGeometry();
    outlineGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    outlineGeom.setDrawRange(0, 0);
    outlineLoop = new THREE.LineLoop(outlineGeom, lineMaterial);
    outlineLoop.visible = false;
    overlayGroup.add(outlineLoop);

    const markerGeom = new THREE.BufferGeometry();
    markerGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    markerGeom.setDrawRange(0, 0);
    markerPoints = new THREE.Points(markerGeom, markerMaterial);
    markerPoints.visible = false;
    overlayGroup.add(markerPoints);

    const originGeom = new THREE.BufferGeometry();
    originGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    originGeom.setDrawRange(0, 0);
    originMarker = new THREE.Points(originGeom, originMaterial);
    originMarker.visible = false;
    overlayGroup.add(originMarker);
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
   * The polygon currently shown: committed vertices, plus the live cursor
   * point as a candidate next vertex while drafting.
   */
  const displayPolygon = (): MeasurePoint[] => {
    const s = state.value;
    if (s.closed) return s.points;
    return s.hoverWorld ? [...s.points, s.hoverWorld] : s.points;
  };

  const refreshOverlay = (): void => {
    ensureOverlay();
    if (!outlineLoop || !fillMesh || !markerPoints || !originMarker) return;

    const offset = getOriginOffsetFn();
    const committed = state.value.points;
    const display = displayPolygon();

    // Outline (LineLoop auto-closes last → first)
    if (display.length >= 2) {
      const arr = ensurePositionCapacity(outlineLoop.geometry, display.length);
      for (let i = 0; i < display.length; i++) {
        arr[i * 3] = display[i].x - offset.x;
        arr[i * 3 + 1] = display[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = outlineLoop.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      outlineLoop.geometry.setDrawRange(0, display.length);
      outlineLoop.geometry.computeBoundingSphere();
      outlineLoop.visible = true;
    } else {
      outlineLoop.visible = false;
    }

    // Fill — triangulate the display polygon (≥3 vertices)
    if (display.length >= 3) {
      const contour = display.map((p) => new THREE.Vector2(p.x - offset.x, p.y - offset.y));
      let faces: number[][] = [];
      try {
        faces = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch {
        faces = [];
      }
      if (faces.length > 0) {
        const positions = new Float32Array(contour.length * 3);
        for (let i = 0; i < contour.length; i++) {
          positions[i * 3] = contour[i].x;
          positions[i * 3 + 1] = contour[i].y;
          positions[i * 3 + 2] = 0;
        }
        const indices = new Uint16Array(faces.length * 3);
        for (let f = 0; f < faces.length; f++) {
          indices[f * 3] = faces[f][0];
          indices[f * 3 + 1] = faces[f][1];
          indices[f * 3 + 2] = faces[f][2];
        }
        fillMesh.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        fillMesh.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        fillMesh.geometry.computeBoundingSphere();
        fillMesh.visible = true;
      } else {
        fillMesh.visible = false;
      }
    } else {
      fillMesh.visible = false;
    }

    // Vertex markers (committed only)
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

    // Origin-snap cue — larger marker on the first vertex when snapping is active
    if (state.value.originSnap && committed.length >= 1) {
      const arr = originMarker.geometry.getAttribute("position") as THREE.BufferAttribute;
      const oArr = arr.array as Float32Array;
      oArr[0] = committed[0].x - offset.x;
      oArr[1] = committed[0].y - offset.y;
      oArr[2] = 0;
      arr.needsUpdate = true;
      originMarker.geometry.setDrawRange(0, 1);
      originMarker.visible = true;
    } else {
      originMarker.visible = false;
    }
  };

  const disposeOverlay = (): void => {
    if (!scene || !overlayGroup) return;
    scene.remove(overlayGroup);
    outlineLoop?.geometry.dispose();
    fillMesh?.geometry.dispose();
    markerPoints?.geometry.dispose();
    originMarker?.geometry.dispose();
    lineMaterial?.dispose();
    fillMaterial?.dispose();
    markerMaterial?.dispose();
    originMaterial?.dispose();
    overlayGroup = null;
    outlineLoop = null;
    fillMesh = null;
    markerPoints = null;
    originMarker = null;
    lineMaterial = null;
    fillMaterial = null;
    markerMaterial = null;
    originMaterial = null;
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

  /** Project a world point to client (page) pixel coordinates. */
  const worldToScreen = (p: MeasurePoint): { x: number; y: number } | null => {
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    const offset = getOriginOffsetFn();
    const v = new THREE.Vector3(p.x - offset.x, p.y - offset.y, 0).project(camera);
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((-v.y + 1) / 2) * rect.height,
    };
  };

  const emitChange = (): void => {
    callbacks.onChange?.(state.value);
    refreshOverlay();
    requestRender?.();
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = state.value.points.length > 0;
    state.value = emptyState();
    emitChange();
    if (notify && hadDraft) callbacks.onCancel?.();
  };

  const closePolygon = (): void => {
    const pts = state.value.points;
    if (pts.length < 3) return;
    state.value = { points: pts, hoverWorld: null, closed: true, originSnap: false };
    emitChange();
    const areaRaw = measureArea(pts);
    const perimeterRaw = measurePerimeter(pts);
    callbacks.onResult?.({
      points: pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
      areaRaw,
      area: areaRaw * scales.areaScale,
      perimeterRaw,
      perimeter: perimeterRaw * scales.perimeterScale,
      areaUnits: scales.areaLabel,
      lengthUnits: scales.lengthLabel,
      selfIntersecting: polygonSelfIntersects(pts),
    });
  };

  const addPoint = (world: MeasurePoint): void => {
    if (state.value.closed) {
      // A completed polygon is still visible — start a fresh measurement.
      state.value = { points: [world], hoverWorld: world, closed: false, originSnap: false };
    } else {
      state.value = {
        points: [...state.value.points, world],
        hoverWorld: world,
        closed: false,
        originSnap: false,
      };
    }
    emitChange();
  };

  const popPoint = (): void => {
    if (state.value.closed || state.value.points.length === 0) return;
    const next = state.value.points.slice(0, -1);
    state.value = { points: next, hoverWorld: state.value.hoverWorld, closed: false, originSnap: false };
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

    const now = performance.now();
    const isSecondTap =
      now - lastCommitTime < DBLCLICK_MS &&
      Math.hypot(e.clientX - lastCommitX, e.clientY - lastCommitY) < DBLCLICK_DISTANCE;

    if (!state.value.closed) {
      // Double-click finishes the polygon (the 2nd tap is a near-duplicate,
      // not a new vertex). The first tap already committed its point.
      if (isSecondTap && state.value.points.length >= 3) {
        closePolygon();
        return;
      }
      // Clicking the first vertex (snap-highlighted) closes the loop.
      if (state.value.originSnap && state.value.points.length >= 3) {
        closePolygon();
        return;
      }
    }

    addPoint(world);
    lastCommitTime = now;
    lastCommitX = e.clientX;
    lastCommitY = e.clientY;
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (state.value.closed) return;
    const committed = state.value.points;
    if (committed.length < 1) return;
    const world = screenToWorld(e.clientX, e.clientY);
    if (!world) return;

    // Detect proximity to the first vertex (≥3 committed → closable).
    let originSnap = false;
    if (committed.length >= 3) {
      const originScreen = worldToScreen(committed[0]);
      if (originScreen) {
        originSnap =
          Math.hypot(e.clientX - originScreen.x, e.clientY - originScreen.y) <= ORIGIN_SNAP_RADIUS;
      }
    }
    state.value = { points: committed, hoverWorld: world, closed: false, originSnap };
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
    if (e.key === "Enter") {
      if (isTypingTarget(e.target)) return;
      if (!state.value.closed && state.value.points.length >= 3) {
        e.preventDefault();
        closePolygon();
      }
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

  const handleDblClick = (e: MouseEvent): void => {
    // The actual close is driven by the second pointerup (see handlePointerUp);
    // here we only suppress the browser's text-selection default.
    if (isActive.value) e.preventDefault();
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
    cbs?: AreaMeasureCallbacks,
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
    canvas.addEventListener("dblclick", handleDblClick, { capture: true });
    window.addEventListener("keydown", handleKeyDown);
  };

  const detach = (): void => {
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown, { capture: true } as EventListenerOptions);
      canvas.removeEventListener("pointerup", handlePointerUp, { capture: true } as EventListenerOptions);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("dblclick", handleDblClick, { capture: true } as EventListenerOptions);
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

  const setUnits = (next: AreaUnitScales): void => {
    scales = next;
  };

  const setColor = (newColor: string): void => {
    color = newColor;
    const c = new THREE.Color(newColor);
    lineMaterial?.color.set(c);
    fillMaterial?.color.set(c);
    markerMaterial?.color.set(c);
    originMaterial?.color.set(c);
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
 * Format an area or perimeter value into a short string with a unit suffix.
 *
 * Two decimals below 100, one decimal at/above 100 — the same trade-off the
 * ruler and distance labels use. `unit` is appended verbatim (`"m²"`, `"mm"`,
 * …); pass `""` for raw DXF units (no suffix). Pure / framework-agnostic.
 */
export function formatAreaValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  return unit ? `${fixed} ${unit}` : fixed;
}
