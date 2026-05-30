import { ref, shallowRef } from "vue";
import * as THREE from "three";
import { measureDistance, type MeasurePoint } from "dxf-render";

/**
 * Minimal shape of the MapControls/OrbitControls instance we need: we steal
 * the LEFT mouse button binding while measuring so left-clicks don't start
 * a pan drag. Middle/right buttons and wheel-zoom stay untouched.
 */
interface ControlsLike {
  mouseButtons: { LEFT: unknown; MIDDLE: unknown; RIGHT: unknown };
}

/**
 * Kind of measurement currently supported. The state machine is designed so
 * that future `"area"` and `"angle"` can be added without breaking the API.
 */
export type MeasureKind = "distance";

/**
 * Result of a completed measurement. Emitted via `onResult` once enough
 * clicks have been collected (2 for distance, N+close for area, 3 for angle).
 */
export interface MeasureResult {
  kind: MeasureKind;
  p1: MeasurePoint;
  p2: MeasurePoint;
  /** Raw value in DXF world units (Euclidean distance). */
  valueRaw: number;
  /** Value scaled to the displayed units (`valueRaw * unitsScale`). */
  value: number;
  /** The units label that was active at the moment of measurement. */
  units: MeasureUnits;
}

/** Display units. Matches `RulerUnits` from `dxf-vuer/types`. */
export type MeasureUnits = "dxf-units" | "mm" | "inch";

export interface MeasureState {
  /** 0, 1, or 2 placed points. Stored in DXF world coordinates (no offset). */
  points: MeasurePoint[];
  /** Live cursor position in DXF world coords (set while a measurement is in-flight). */
  hoverWorld: MeasurePoint | null;
}

export interface MeasureCallbacks {
  /** Fired after the second click — the measurement is complete. */
  onResult?: (result: MeasureResult) => void;
  /** Fired whenever the internal state changes (point added, hover updated, reset). */
  onChange?: (state: MeasureState) => void;
  /** Fired when Esc is pressed mid-measurement OR when `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
  /**
   * Optional geometry-snap resolver. Maps a raw world point + screen coords to
   * a possibly-snapped world point and drives the snap marker. Called on every
   * pointer move (so the marker tracks geometry) and on click (so the placed
   * point snaps). When omitted, points land exactly under the cursor.
   */
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

/** Pixel distance threshold above which a mousedown→mouseup is treated as pan, not click. */
const CLICK_DISTANCE_THRESHOLD = 4;

/**
 * Drag-state machine for the AutoCAD-style linear measurement tool.
 *
 * Flow:
 *   1. `setEnabled(true)` flips the canvas cursor to crosshair and the
 *      tool starts intercepting clicks (capture-phase pointerdown).
 *   2. First click adds point A; subsequent pointermove events update
 *      `hoverWorld` so the consumer can render a live preview line.
 *   3. Second click adds point B; `onResult` fires, state resets to empty,
 *      ready for the next measurement.
 *   4. Esc cancels an in-flight measurement (clears point A, fires `onCancel`).
 *   5. `setEnabled(false)` also clears state and fires `onCancel` if there
 *      was a draft.
 *
 * The composable owns a small Three.js overlay group (renderOrder=999,
 * depthTest=false) containing one `THREE.Points` for the placed markers
 * and one `THREE.Line` for the live segment.
 *
 * It does NOT depend on picking — only on a camera, the scene root, and
 * a `getOriginOffset()` callback (so it can apply the same scene-space
 * subtraction that the renderer does).
 */
export function useMeasurement() {
  const state = shallowRef<MeasureState>({ points: [], hoverWorld: null });
  const isActive = ref(false);

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let controls: ControlsLike | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRender: (() => void) | null = null;
  let callbacks: MeasureCallbacks = {};
  let unitsScale = 1;
  let unitsLabel: MeasureUnits = "dxf-units";
  /**
   * Snapshot of `controls.mouseButtons.LEFT` taken when measure mode turns on,
   * restored on toggle-off. `undefined` means "we have not stolen it".
   */
  let savedLeftButton: unknown = undefined;

  // Three.js overlay
  let overlayGroup: THREE.Group | null = null;
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let pointsMaterial: THREE.PointsMaterial | null = null;
  let segmentLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;
  let color = "#ff6b1a";

  // Pointer tracking — to distinguish click from pan
  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownButton = -1;

  const ensureOverlay = (): void => {
    if (!scene || overlayGroup) return;

    overlayGroup = new THREE.Group();
    overlayGroup.name = "dxf-measurement-overlay";
    overlayGroup.renderOrder = 999;
    scene.add(overlayGroup);

    lineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    });
    pointsMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size: 8,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
    });

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    segmentLine = new THREE.Line(lineGeom, lineMaterial);
    segmentLine.visible = false;
    overlayGroup.add(segmentLine);

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    pointsGeom.setDrawRange(0, 0);
    markerPoints = new THREE.Points(pointsGeom, pointsMaterial);
    markerPoints.visible = false;
    overlayGroup.add(markerPoints);
  };

  /**
   * Update the Three.js overlay geometry to match `state`. Caller is
   * responsible for triggering a render (we do that via `requestRender`).
   */
  const refreshOverlay = (): void => {
    ensureOverlay();
    if (!segmentLine || !markerPoints) return;

    const offset = getOriginOffsetFn();
    const pts = state.value.points;
    const previewTo = pts.length === 1 ? state.value.hoverWorld : null;

    // Markers — one per placed point (scene-space)
    const markerAttr = markerPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const markerArr = markerAttr.array as Float32Array;
    if (pts.length === 0) {
      markerPoints.visible = false;
      markerPoints.geometry.setDrawRange(0, 0);
    } else {
      for (let i = 0; i < pts.length; i++) {
        markerArr[i * 3 + 0] = pts[i].x - offset.x;
        markerArr[i * 3 + 1] = pts[i].y - offset.y;
        markerArr[i * 3 + 2] = 0;
      }
      markerAttr.needsUpdate = true;
      markerPoints.geometry.setDrawRange(0, pts.length);
      markerPoints.visible = true;
    }

    // Live segment
    const a = pts[0];
    const b = pts[1] ?? previewTo ?? null;
    if (a && b) {
      const segAttr = segmentLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      const segArr = segAttr.array as Float32Array;
      segArr[0] = a.x - offset.x;
      segArr[1] = a.y - offset.y;
      segArr[2] = 0;
      segArr[3] = b.x - offset.x;
      segArr[4] = b.y - offset.y;
      segArr[5] = 0;
      segAttr.needsUpdate = true;
      segmentLine.geometry.computeBoundingSphere();
      segmentLine.visible = true;
    } else {
      segmentLine.visible = false;
    }
  };

  const disposeOverlay = (): void => {
    if (!scene || !overlayGroup) return;
    scene.remove(overlayGroup);
    segmentLine?.geometry.dispose();
    markerPoints?.geometry.dispose();
    lineMaterial?.dispose();
    pointsMaterial?.dispose();
    overlayGroup = null;
    segmentLine = null;
    markerPoints = null;
    lineMaterial = null;
    pointsMaterial = null;
  };

  const setCursor = (on: boolean): void => {
    if (!canvas) return;
    canvas.style.cursor = on ? "crosshair" : "";
  };

  /**
   * Project a screen-space pointer position into DXF world coordinates,
   * adding `originOffset` back so the result matches the same world space
   * `MeasureResult.p1/p2` and the cursor-coords overlay live in.
   */
  const screenToWorld = (
    clientX: number,
    clientY: number,
  ): MeasurePoint | null => {
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
    const hadDraft = state.value.points.length > 0;
    state.value = { points: [], hoverWorld: null };
    emitChange();
    if (notify && hadDraft) callbacks.onCancel?.();
  };

  const addPoint = (world: MeasurePoint): void => {
    const pts = state.value.points;
    if (pts.length === 0) {
      state.value = { points: [world], hoverWorld: world };
      emitChange();
      return;
    }
    if (pts.length === 1) {
      const a = pts[0];
      const b = world;
      const valueRaw = measureDistance(a, b);
      // Settle the second point and keep it visible — the line + label
      // stay on canvas until the user starts a new measurement (next click)
      // or explicitly clears via Esc / the toolbar toggle.
      state.value = { points: [a, b], hoverWorld: null };
      emitChange();
      callbacks.onResult?.({
        kind: "distance",
        p1: a,
        p2: b,
        valueRaw,
        value: valueRaw * unitsScale,
        units: unitsLabel,
      });
      return;
    }
    // pts.length === 2 — a completed measurement is still visible. The new
    // click starts a fresh one with the clicked location as the new A.
    state.value = { points: [world], hoverWorld: world };
    emitChange();
  };

  // Pointer handlers — capture phase, so we run before picking / rect selection.
  const handlePointerDown = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (e.button !== 0) {
      // Middle/right buttons are reserved for MapControls (pan). Suppress the
      // browser's default action so middle-click doesn't trigger Firefox's
      // autoscroll mode (which hijacks the cursor and breaks pan). We do NOT
      // call stopPropagation — MapControls still needs to see the event to
      // start its pan state.
      e.preventDefault();
      return;
    }
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownButton = e.button;
    // Don't stop propagation here — let pan still work. We commit on
    // pointerup only if the drag was short enough.
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (!isActive.value) return;
    if (mouseDownButton !== 0) return;
    mouseDownButton = -1;
    const dx = e.clientX - mouseDownX;
    const dy = e.clientY - mouseDownY;
    if (Math.hypot(dx, dy) >= CLICK_DISTANCE_THRESHOLD) return; // pan
    const raw = screenToWorld(e.clientX, e.clientY);
    if (!raw) return;
    // We acted on this click; suppress downstream handlers (picking, etc.)
    e.stopPropagation();
    const world = callbacks.snap ? callbacks.snap(raw, e.clientX, e.clientY) : raw;
    addPoint(world);
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!isActive.value) return;
    const raw = screenToWorld(e.clientX, e.clientY);
    if (!raw) return;
    // Run snap on every move so the marker tracks geometry even when there is
    // no live preview line yet (zero/two placed points).
    const world = callbacks.snap ? callbacks.snap(raw, e.clientX, e.clientY) : raw;
    // Only the "one placed point, awaiting the second" state needs a live
    // preview. With zero points there's nothing to preview yet; with two
    // points the measurement is settled and waits for the next click.
    if (state.value.points.length !== 1) return;
    state.value = { points: state.value.points, hoverWorld: world };
    emitChange();
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!isActive.value) return;
    if (e.key === "Escape") {
      if (state.value.points.length > 0) {
        e.preventDefault();
        e.stopPropagation();
      }
      resetState(true);
    }
  };

  /**
   * Wire up DOM listeners and grab references to the scene/camera. Call
   * once during component mount; pair with `detach()` on unmount.
   *
   * `getOriginOffset` must return the renderer's current originOffset —
   * it's read on every screen-to-world projection so it stays in sync
   * with the loaded DXF.
   *
   * `requestRender` is the renderer's manual render trigger; called after
   * every state change so the overlay reflects clicks and hover movement
   * immediately (without waiting for OrbitControls to fire `change`).
   */
  const attach = (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    controlsRef: ControlsLike | null,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRenderFn: () => void,
    cbs?: MeasureCallbacks,
  ): void => {
    detach();
    canvas = canvasEl;
    scene = sceneRef;
    camera = cameraRef;
    controls = controlsRef;
    getOriginOffsetFn = getOriginOffset;
    requestRender = requestRenderFn;
    callbacks = cbs ?? {};

    // capture:true → run before usePicking / useRectangleSelection
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

  /**
   * Steal the LEFT mouse button from MapControls so left-click+drag doesn't
   * pan during measurement. The original value is snapshotted into
   * `savedLeftButton` and restored by `releaseLeftButton()`.
   */
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
      // Leaving the mode aborts any half-finished measurement.
      resetState(true);
    }
  };

  const setUnitsScale = (scale: number, label: MeasureUnits): void => {
    unitsScale = scale;
    unitsLabel = label;
  };

  const setColor = (newColor: string): void => {
    color = newColor;
    lineMaterial?.color.set(newColor);
    pointsMaterial?.color.set(newColor);
    requestRender?.();
  };

  /** Manually clear any in-flight measurement without firing `onCancel`. */
  const clear = (): void => {
    state.value = { points: [], hoverWorld: null };
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
    setUnitsScale,
    setColor,
    clear,
    dispose,
  };
}

/**
 * Format a measurement value into a short, human-friendly string.
 *
 * Uses two decimal places for small values and one decimal for values
 * over 100 — same trade-off the ruler labels make. Pure / framework-
 * agnostic — exported so tests and custom UI can reuse it.
 */
export function formatMeasureValue(value: number, units: MeasureUnits): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  if (units === "mm") return `${fixed} mm`;
  if (units === "inch") return `${fixed} in`;
  return fixed;
}
