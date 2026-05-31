import { useRef, useState } from "react";
import * as THREE from "three";
import {
  findEntriesInRect,
  CLICK_DISTANCE_THRESHOLD_PX,
  type PickingEntry,
  type PickingIndex,
  type WorldRect,
} from "dxf-render";

/**
 * Auto: drag direction decides — left→right = window, right→left = crossing
 * (AutoCAD convention). The other two values lock the semantic regardless of
 * direction.
 */
export type RectSelectionMode = "auto" | "window" | "crossing";

/** Resolved mode emitted on `onStart` / `onSelect`. Never "auto". */
export type RectSelectionResolvedMode = "window" | "crossing";

export type RectSelectionModifier = "shift" | "ctrl" | "alt";

export interface RectScreenRect {
  /** Canvas-relative x of the rectangle's top-left corner */
  x: number;
  /** Canvas-relative y of the rectangle's top-left corner */
  y: number;
  width: number;
  height: number;
  mode: RectSelectionResolvedMode;
}

/**
 * Minimal shape of the Three.js MapControls/OrbitControls object we need —
 * just the `enabled` flag.
 */
export interface OrbitLikeControls {
  enabled: boolean;
}

export interface RectSelectionCallbacks {
  /** Fired after the drag distance exceeded the threshold. `mode` is resolved. */
  onStart?: (mode: RectSelectionResolvedMode) => void;
  /** Final entry list at pointerup. Empty array is valid (drag over empty space). */
  onSelect?: (entries: PickingEntry[], mode: RectSelectionResolvedMode) => void;
  /** Fired after `onSelect` or `onCancel`. Always paired with `onStart`. */
  onEnd?: () => void;
  /** Fired when the drag was aborted (Esc) — no `onSelect` preceded this. */
  onCancel?: () => void;
}

/**
 * Resolve the final selection mode given the user-supplied option and the
 * drag direction. Pure — exported for testing.
 */
export function resolveSelectionMode(
  option: RectSelectionMode,
  start: { x: number; y: number },
  end: { x: number; y: number },
): RectSelectionResolvedMode {
  if (option === "window") return "window";
  if (option === "crossing") return "crossing";
  return end.x >= start.x ? "window" : "crossing";
}

/**
 * Normalise two screen-space points into a positive-extent rectangle relative
 * to the canvas. Pure — exported for testing.
 */
export function normaliseScreenRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  canvasRect: { left: number; top: number },
  mode: RectSelectionResolvedMode,
): RectScreenRect {
  return {
    x: Math.min(start.x, end.x) - canvasRect.left,
    y: Math.min(start.y, end.y) - canvasRect.top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    mode,
  };
}

/**
 * Build a world-space rectangle from two screen points. Pure — exported for
 * testing.
 */
export function buildWorldRect(
  startWorld: { x: number; y: number },
  endWorld: { x: number; y: number },
): WorldRect {
  return {
    minX: Math.min(startWorld.x, endWorld.x),
    minY: Math.min(startWorld.y, endWorld.y),
    maxX: Math.max(startWorld.x, endWorld.x),
    maxY: Math.max(startWorld.y, endWorld.y),
  };
}

export interface RectSelectionController {
  attach: (
    canvasEl: HTMLCanvasElement,
    cameraRef: THREE.Camera,
    controlsRef: OrbitLikeControls | null,
    cbs: RectSelectionCallbacks,
  ) => void;
  detach: () => void;
  installRectData: (index: PickingIndex, offset: { x: number; y: number; z?: number }) => void;
  removeRectData: () => void;
  setEnabled: (value: boolean) => void;
  setModifier: (key: RectSelectionModifier) => void;
  setMode: (mode: RectSelectionMode) => void;
  setVisibleLayers: (layers: Set<string> | null) => void;
}

/**
 * Drag-state machine for rectangle (window/crossing) selection. `screenRect` is
 * mirrored to React state (the consumer renders the overlay div); `isDragging`
 * stays internal.
 */
function createRectangleSelectionController(
  setScreenRect: (rect: RectScreenRect | null) => void,
): RectSelectionController {
  let canvas: HTMLCanvasElement | null = null;
  let camera: THREE.Camera | null = null;
  let controls: OrbitLikeControls | null = null;

  let pickingIndex: PickingIndex | null = null;
  let originOffset: { x: number; y: number; z?: number } = { x: 0, y: 0, z: 0 };
  let visibleLayers: Set<string> | null = null;

  let modifier: RectSelectionModifier = "shift";
  let modeOption: RectSelectionMode = "auto";
  let enabled = false;
  let isDragging = false;

  let callbacks: RectSelectionCallbacks = {};

  let startScreen: { x: number; y: number } | null = null;
  let modifierHeld = false;
  let savedControlsEnabled: boolean | null = null;

  const matchModifier = (e: PointerEvent | MouseEvent): boolean => {
    if (modifier === "shift") return e.shiftKey;
    if (modifier === "ctrl") return e.ctrlKey || e.metaKey;
    if (modifier === "alt") return e.altKey;
    return false;
  };

  const isModifierKey = (e: KeyboardEvent): boolean => {
    if (modifier === "shift") return e.key === "Shift";
    if (modifier === "ctrl") return e.key === "Control" || e.key === "Meta";
    if (modifier === "alt") return e.key === "Alt";
    return false;
  };

  const computeWorldPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!canvas || !camera) return null;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const v = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
    return { x: v.x + originOffset.x, y: v.y + originOffset.y };
  };

  const setCursor = (on: boolean): void => {
    if (!canvas) return;
    canvas.style.cursor = on ? "crosshair" : "";
  };

  const acquireControls = (): void => {
    if (savedControlsEnabled !== null || !controls) return;
    savedControlsEnabled = controls.enabled;
    controls.enabled = false;
  };

  const releaseControlsIfIdle = (): void => {
    if (savedControlsEnabled === null) return;
    if (modifierHeld || startScreen) return;
    if (controls) controls.enabled = savedControlsEnabled;
    savedControlsEnabled = null;
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (!enabled) return;
    if (e.key === "Escape" && startScreen) {
      cancel();
      return;
    }
    if (!isModifierKey(e)) return;
    if (modifierHeld) return;
    modifierHeld = true;
    setCursor(true);
    acquireControls();
  };

  const handleKeyUp = (e: KeyboardEvent): void => {
    if (!enabled) return;
    if (!isModifierKey(e)) return;
    if (!modifierHeld) return;
    modifierHeld = false;
    setCursor(false);
    releaseControlsIfIdle();
  };

  const handlePointerDown = (e: PointerEvent): void => {
    if (!enabled) return;
    if (e.button !== 0) return;
    if (!matchModifier(e)) return;
    startScreen = { x: e.clientX, y: e.clientY };
    acquireControls();
    // Deliberately NOT stopping propagation — `usePicking` shares the same 4px
    // click threshold, so any drag long enough for us to act on also suppresses
    // picking's own click. Letting picking see pointerdown keeps its mousedown
    // coords in sync with the matching pointerup.
  };

  const updateScreenRect = (endX: number, endY: number): void => {
    if (!startScreen || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mode = resolveSelectionMode(modeOption, startScreen, { x: endX, y: endY });
    setScreenRect(
      normaliseScreenRect(startScreen, { x: endX, y: endY }, { left: rect.left, top: rect.top }, mode),
    );
  };

  const handlePointerMove = (e: PointerEvent): void => {
    if (!enabled || !startScreen) return;
    const dx = e.clientX - startScreen.x;
    const dy = e.clientY - startScreen.y;
    if (!isDragging && Math.hypot(dx, dy) < CLICK_DISTANCE_THRESHOLD_PX) return;
    if (!isDragging) {
      isDragging = true;
      const mode = resolveSelectionMode(modeOption, startScreen, { x: e.clientX, y: e.clientY });
      callbacks.onStart?.(mode);
    }
    updateScreenRect(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (!enabled || !startScreen) return;
    if (!isDragging) {
      // Threshold not reached — treat as not-our-gesture, drop silently.
      finishDrag();
      return;
    }
    const startWorld = computeWorldPoint(startScreen.x, startScreen.y);
    const endWorld = computeWorldPoint(e.clientX, e.clientY);
    if (!startWorld || !endWorld) {
      finishDrag();
      return;
    }
    const mode = resolveSelectionMode(modeOption, startScreen, { x: e.clientX, y: e.clientY });
    const found = pickingIndex
      ? findEntriesInRect(pickingIndex, buildWorldRect(startWorld, endWorld), { mode })
      : [];
    // Exclude entries on hidden/frozen layers — they aren't visible to select.
    const entries = visibleLayers === null ? found : found.filter((en) => visibleLayers!.has(en.layer));
    callbacks.onSelect?.(entries, mode);
    callbacks.onEnd?.();
    finishDrag();
  };

  const cancel = (): void => {
    if (!startScreen) return;
    callbacks.onCancel?.();
    callbacks.onEnd?.();
    finishDrag();
  };

  const finishDrag = (): void => {
    startScreen = null;
    isDragging = false;
    setScreenRect(null);
    releaseControlsIfIdle();
  };

  const attach = (
    canvasEl: HTMLCanvasElement,
    cameraRef: THREE.Camera,
    controlsRef: OrbitLikeControls | null,
    cbs: RectSelectionCallbacks,
  ): void => {
    canvas = canvasEl;
    camera = cameraRef;
    controls = controlsRef;
    callbacks = cbs;
    enabled = true;

    canvas.addEventListener("pointerdown", handlePointerDown);
    // window-level move/up so a drag that leaves the canvas still finishes.
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
  };

  const detach = (): void => {
    enabled = false;
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      setCursor(false);
    }
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    modifierHeld = false;
    finishDrag();
    canvas = null;
    camera = null;
    controls = null;
    callbacks = {};
  };

  const installRectData = (
    index: PickingIndex,
    offset: { x: number; y: number; z?: number },
  ): void => {
    pickingIndex = index;
    originOffset = offset;
  };

  const removeRectData = (): void => {
    pickingIndex = null;
    finishDrag();
  };

  const setEnabled = (value: boolean): void => {
    enabled = value;
    if (!value) {
      modifierHeld = false;
      setCursor(false);
      finishDrag();
    }
  };

  const setModifier = (key: RectSelectionModifier): void => {
    modifier = key;
    modifierHeld = false;
    setCursor(false);
  };

  const setMode = (mode: RectSelectionMode): void => {
    modeOption = mode;
  };

  const setVisibleLayers = (layers: Set<string> | null): void => {
    visibleLayers = layers;
  };

  return {
    attach,
    detach,
    installRectData,
    removeRectData,
    setEnabled,
    setModifier,
    setMode,
    setVisibleLayers,
  };
}

export interface UseRectangleSelectionResult {
  /** Reactive drag rectangle for the overlay div (`null` when idle). */
  screenRect: RectScreenRect | null;
  attach: RectSelectionController["attach"];
  detach: RectSelectionController["detach"];
  installRectData: RectSelectionController["installRectData"];
  removeRectData: RectSelectionController["removeRectData"];
  setEnabled: RectSelectionController["setEnabled"];
  setModifier: RectSelectionController["setModifier"];
  setMode: RectSelectionController["setMode"];
  setVisibleLayers: RectSelectionController["setVisibleLayers"];
}

/**
 * React hook over {@link createRectangleSelectionController}. Returns a STABLE
 * object reference (see `useMeasurement` for why) whose `screenRect` is a live
 * property the controller updates, paired with a `forceRender`.
 */
export function useRectangleSelection(): UseRectangleSelectionResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseRectangleSelectionResult | null>(null);
  if (ref.current === null) {
    const result = { screenRect: null } as unknown as UseRectangleSelectionResult;
    const controller = createRectangleSelectionController((rect) => {
      result.screenRect = rect;
      forceRender((v) => v + 1);
    });
    result.attach = controller.attach;
    result.detach = controller.detach;
    result.installRectData = controller.installRectData;
    result.removeRectData = controller.removeRectData;
    result.setEnabled = controller.setEnabled;
    result.setModifier = controller.setModifier;
    result.setMode = controller.setMode;
    result.setVisibleLayers = controller.setVisibleLayers;
    ref.current = result;
  }
  return ref.current;
}
