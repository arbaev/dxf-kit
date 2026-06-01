import * as THREE from "three";
import { CLICK_DISTANCE_THRESHOLD_PX, type MeasurePoint } from "dxf-render";

/**
 * Shared foundation for the canvas pointer tools (distance / area / angle
 * measurement). It owns the capture-phase pointer pipeline, the click-vs-pan
 * threshold, the LEFT-mouse steal/restore, the overlay-group lifecycle, and
 * screen↔world projection.
 *
 * This is a plain factory (`createPointerTool`), not a hook: it has no reactive
 * surface of its own (the `isActive` flag is internal), so the measurement hooks
 * instantiate it inside their controllers. The pure projection/geometry helpers
 * are exported standalone for tests and reuse.
 */

/** A 2D viewport rectangle (the subset of `DOMRect` these helpers read). */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Minimal shape of the MapControls/OrbitControls instance we need: we steal
 * the LEFT mouse button binding while measuring so left-clicks don't start
 * a pan drag. Middle/right buttons and wheel-zoom stay untouched.
 */
export interface ControlsLike {
  mouseButtons: { LEFT: unknown; MIDDLE: unknown; RIGHT: unknown };
}

type SnapResolver = (
  rawWorld: MeasurePoint,
  clientX: number,
  clientY: number,
) => MeasurePoint;

/** Callback subset the base itself relies on; tool callback types satisfy this structurally. */
export interface PointerToolBaseCallbacks {
  snap?: SnapResolver;
}

const ZERO_OFFSET = { x: 0, y: 0 } as const;

/**
 * Project a screen-space pointer position into DXF world coordinates, adding
 * `originOffset` back so the result lives in the same world space as
 * `MeasureResult` points and the cursor-coordinates overlay. Pure.
 */
export function screenToWorldPoint(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  camera: THREE.Camera,
  offset: { x: number; y: number },
): MeasurePoint {
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  const v = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
  return { x: v.x + offset.x, y: v.y + offset.y, z: 0 };
}

/** Project a world point to client (page) pixel coordinates. Pure. */
export function worldToScreenPoint(
  p: MeasurePoint,
  rect: ViewportRect,
  camera: THREE.Camera,
  offset: { x: number; y: number },
): { x: number; y: number } {
  const v = new THREE.Vector3(p.x - offset.x, p.y - offset.y, 0).project(camera);
  return {
    x: rect.left + ((v.x + 1) / 2) * rect.width,
    y: rect.top + ((-v.y + 1) / 2) * rect.height,
  };
}

/**
 * World distance covered by one screen pixel at the viewport centre — constant
 * for an orthographic camera, so it works as a pixel→world scale anywhere.
 * Offset-invariant (it measures a delta). Pure.
 */
export function worldPerPixel(rect: ViewportRect, camera: THREE.Camera): number {
  if (rect.width === 0) return 1;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const a = screenToWorldPoint(cx, cy, rect, camera, ZERO_OFFSET);
  const b = screenToWorldPoint(cx + 1, cy, rect, camera, ZERO_OFFSET);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d > 0 ? d : 1;
}

/**
 * Grow a geometry's `position` attribute to hold at least `vertexCount`
 * vertices, reusing the existing buffer when it is already large enough.
 * Returns the (possibly new) Float32Array backing the attribute. Pure.
 */
export function ensurePositionCapacity(
  geom: THREE.BufferGeometry,
  vertexCount: number,
): Float32Array {
  let attr = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!attr || attr.array.length < vertexCount * 3) {
    const arr = new Float32Array(Math.max(vertexCount, 4) * 3);
    attr = new THREE.BufferAttribute(arr, 3);
    geom.setAttribute("position", attr);
  }
  return attr.array as Float32Array;
}

/**
 * True when a mousedown→mouseup moved far enough to count as a pan/drag rather
 * than a click. Shared by every pointer tool so the click/pan boundary is
 * identical across the stack. Pure.
 */
export function isPanGesture(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= CLICK_DISTANCE_THRESHOLD_PX;
}

/**
 * Whether an event target is a text-entry control, so global key handlers
 * (Enter / Backspace) don't hijack typing in the host page. Pure.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Tool-specific behaviour injected into the shared pointer pipeline. Everything
 * here runs only while the tool is active; the base handles activation,
 * pan-vs-click, the LEFT-button steal and the overlay group.
 */
export interface PointerToolHooks {
  /** Debug name for the overlay group. */
  overlayName: string;
  /** Build the tool's overlay children into the shared group (called once, lazily). */
  buildOverlay: (group: THREE.Group, color: string) => void;
  /** Dispose the tool's overlay geometries + materials and null its refs. */
  disposeOverlay: () => void;
  /** Push a new colour into the tool's materials. */
  applyColor: (color: string) => void;
  /** A committed left-click (already past the pan threshold). `raw` is the screen→world point, NOT yet snapped. */
  onCommit: (raw: MeasurePoint, ev: PointerEvent) => void;
  /** A pointer move. `world` is already snap-resolved; `ev` carries the raw screen coords. */
  onMove: (world: MeasurePoint, ev: PointerEvent) => void;
  /** Key handling while active (Esc / Enter / Backspace) — the tool preventDefaults as needed. */
  onKeyDown?: (ev: KeyboardEvent) => void;
  /** Abort/reset the tool's state. `notify` → fire the tool's onCancel when a draft existed. */
  reset: (notify: boolean) => void;
  /** Optional extra listener wiring (e.g. the area tool's `dblclick`). */
  onAttach?: (canvas: HTMLCanvasElement) => void;
  onDetach?: (canvas: HTMLCanvasElement) => void;
}

export interface PointerTool<C extends PointerToolBaseCallbacks> {
  /** Whether the tool is currently active (mode on). */
  isActive: () => boolean;
  configure: (h: PointerToolHooks) => void;
  attach: (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    controlsRef: ControlsLike | null,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRender: () => void,
    cbs?: C,
  ) => void;
  detach: () => void;
  setEnabled: (on: boolean) => void;
  setColor: (newColor: string) => void;
  dispose: () => void;
  ensureOverlay: () => void;
  screenToWorld: (clientX: number, clientY: number) => MeasurePoint | null;
  worldToScreen: (p: MeasurePoint) => { x: number; y: number } | null;
  worldPerPixel: () => number;
  applySnap: (raw: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
  getOffset: () => { x: number; y: number; z: number };
  getCallbacks: () => C;
  render: () => void;
}

/**
 * Create a pointer-tool foundation. Call {@link PointerTool.configure} once with
 * the tool's hooks, then expose the base's `attach` / `detach` / `setEnabled` /
 * `setColor` / `dispose` from the tool.
 */
export function createPointerTool<C extends PointerToolBaseCallbacks>(): PointerTool<C> {
  let active = false;
  let hooks: PointerToolHooks | null = null;

  let canvas: HTMLCanvasElement | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let controls: ControlsLike | null = null;
  let getOriginOffsetFn: () => { x: number; y: number; z: number } = () => ({ x: 0, y: 0, z: 0 });
  let requestRenderFn: (() => void) | null = null;
  let callbacks: C = {} as C;
  let color = "#ff6b1a";
  /** Snapshot of `controls.mouseButtons.LEFT`; `undefined` means "not stolen". */
  let savedLeftButton: unknown = undefined;
  let overlayGroup: THREE.Group | null = null;

  // Pointer tracking — distinguish click from pan.
  let mouseDownX = 0;
  let mouseDownY = 0;
  let mouseDownButton = -1;

  const setCursor = (on: boolean): void => {
    if (!canvas) return;
    canvas.style.cursor = on ? "crosshair" : "";
  };

  const screenToWorld = (clientX: number, clientY: number): MeasurePoint | null => {
    if (!canvas || !camera) return null;
    return screenToWorldPoint(
      clientX,
      clientY,
      canvas.getBoundingClientRect(),
      camera,
      getOriginOffsetFn(),
    );
  };

  const worldToScreen = (p: MeasurePoint): { x: number; y: number } | null => {
    if (!canvas || !camera) return null;
    return worldToScreenPoint(p, canvas.getBoundingClientRect(), camera, getOriginOffsetFn());
  };

  const worldPerPixelLive = (): number => {
    if (!canvas || !camera) return 1;
    return worldPerPixel(canvas.getBoundingClientRect(), camera);
  };

  const applySnap = (raw: MeasurePoint, clientX: number, clientY: number): MeasurePoint =>
    callbacks.snap ? callbacks.snap(raw, clientX, clientY) : raw;

  const render = (): void => {
    requestRenderFn?.();
  };

  const ensureOverlay = (): void => {
    if (!scene || overlayGroup) return;
    overlayGroup = new THREE.Group();
    overlayGroup.name = hooks?.overlayName ?? "dxf-pointer-tool-overlay";
    overlayGroup.renderOrder = 999;
    scene.add(overlayGroup);
    hooks?.buildOverlay(overlayGroup, color);
  };

  const disposeOverlay = (): void => {
    if (!scene || !overlayGroup) return;
    scene.remove(overlayGroup);
    hooks?.disposeOverlay();
    overlayGroup = null;
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

  // Pointer handlers — capture phase, so the tool runs before picking / rect selection.
  const handlePointerDown = (e: PointerEvent): void => {
    if (!active) return;
    if (e.button !== 0) {
      // Reserve middle/right for pan; suppress default (Firefox autoscroll). We
      // do NOT stopPropagation — MapControls still needs the event to pan.
      e.preventDefault();
      return;
    }
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownButton = e.button;
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (!active) return;
    if (mouseDownButton !== 0) return;
    mouseDownButton = -1;
    if (isPanGesture(e.clientX - mouseDownX, e.clientY - mouseDownY)) return; // pan
    const raw = screenToWorld(e.clientX, e.clientY);
    if (!raw) return;
    // We acted on this click; suppress downstream handlers (picking, etc.).
    e.stopPropagation();
    hooks?.onCommit(raw, e);
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!active) return;
    const raw = screenToWorld(e.clientX, e.clientY);
    if (!raw) return;
    // Snap on every move so the marker tracks geometry in all states.
    const world = applySnap(raw, e.clientX, e.clientY);
    hooks?.onMove(world, e);
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!active) return;
    hooks?.onKeyDown?.(e);
  };

  const attach = (
    canvasEl: HTMLCanvasElement,
    sceneRef: THREE.Scene,
    cameraRef: THREE.Camera,
    controlsRef: ControlsLike | null,
    getOriginOffset: () => { x: number; y: number; z: number },
    requestRender: () => void,
    cbs?: C,
  ): void => {
    detach();
    canvas = canvasEl;
    scene = sceneRef;
    camera = cameraRef;
    controls = controlsRef;
    getOriginOffsetFn = getOriginOffset;
    requestRenderFn = requestRender;
    callbacks = cbs ?? ({} as C);

    // capture:true → run before usePicking / useRectangleSelection
    canvas.addEventListener("pointerdown", handlePointerDown, { capture: true });
    canvas.addEventListener("pointerup", handlePointerUp, { capture: true });
    canvas.addEventListener("pointermove", handlePointerMove);
    hooks?.onAttach?.(canvas);
    window.addEventListener("keydown", handleKeyDown);
  };

  const detach = (): void => {
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown, {
        capture: true,
      } as EventListenerOptions);
      canvas.removeEventListener("pointerup", handlePointerUp, {
        capture: true,
      } as EventListenerOptions);
      canvas.removeEventListener("pointermove", handlePointerMove);
      hooks?.onDetach?.(canvas);
      setCursor(false);
    }
    window.removeEventListener("keydown", handleKeyDown);
    releaseLeftButton();
    canvas = null;
    camera = null;
    scene = null;
    controls = null;
    callbacks = {} as C;
    requestRenderFn = null;
    active = false;
  };

  const setEnabled = (on: boolean): void => {
    if (active === on) return;
    active = on;
    setCursor(on);
    if (on) {
      ensureOverlay();
      acquireLeftButton();
    } else {
      releaseLeftButton();
      // Leaving the mode aborts any half-finished measurement.
      hooks?.reset(true);
    }
  };

  const setColor = (newColor: string): void => {
    color = newColor;
    hooks?.applyColor(newColor);
    render();
  };

  const dispose = (): void => {
    detach();
    disposeOverlay();
  };

  return {
    isActive: (): boolean => active,
    configure(h: PointerToolHooks): void {
      hooks = h;
    },
    attach,
    detach,
    setEnabled,
    setColor,
    dispose,
    ensureOverlay,
    screenToWorld,
    worldToScreen,
    worldPerPixel: worldPerPixelLive,
    applySnap,
    getOffset: (): { x: number; y: number; z: number } => getOriginOffsetFn(),
    getCallbacks: (): C => callbacks,
    render,
  };
}
