import * as THREE from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";

export interface KeyboardNavigationHandlers {
  /** Returns the orthographic camera, or null if scene not initialised. */
  getCamera: () => THREE.OrthographicCamera | null;
  /** Returns MapControls so we can update target + emit change events. */
  getControls: () => MapControls | null;
  /** Reset camera to its saved fit-to-view state. */
  resetView: () => void;
  /** Trigger a render after we mutate the camera. */
  render: () => void;
}

/**
 * Step (in viewport-fraction) for arrow-key pan. 5% of the visible width/height
 * per keypress feels close to a slow trackpad swipe — small enough to be precise,
 * large enough to be noticeable on hold-repeat.
 */
const PAN_STEP_RATIO = 0.05;

/** Multiplier per `+` / `-` press. Mirrors a single mouse-wheel notch. */
const ZOOM_STEP = 1.2;

/**
 * Wire arrow-keys / +/- / 0 to pan, zoom and reset on a focused canvas.
 *
 * The canvas must be focusable (tabindex >= 0) for keydown events to reach it;
 * the caller is responsible for setting that on the element it passes to `attach`.
 */
export function useKeyboardNavigation(handlers: KeyboardNavigationHandlers) {
  let target: HTMLElement | null = null;
  let enabled = true;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled) return;
    // Don't steal keystrokes from form inputs nested over the canvas
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

    const camera = handlers.getCamera();
    const controls = handlers.getControls();
    if (!camera || !controls) return;

    switch (e.key) {
      case "ArrowLeft":
        pan(camera, controls, -PAN_STEP_RATIO, 0);
        break;
      case "ArrowRight":
        pan(camera, controls, PAN_STEP_RATIO, 0);
        break;
      case "ArrowUp":
        pan(camera, controls, 0, PAN_STEP_RATIO);
        break;
      case "ArrowDown":
        pan(camera, controls, 0, -PAN_STEP_RATIO);
        break;
      case "+":
      case "=":
        zoomBy(camera, controls, ZOOM_STEP);
        break;
      case "-":
      case "_":
        zoomBy(camera, controls, 1 / ZOOM_STEP);
        break;
      case "0":
        handlers.resetView();
        return;
      default:
        return;
    }
    e.preventDefault();
    handlers.render();
  };

  const pan = (
    camera: THREE.OrthographicCamera,
    controls: MapControls,
    fx: number,
    fy: number,
  ) => {
    const width = (camera.right - camera.left) / camera.zoom;
    const height = (camera.top - camera.bottom) / camera.zoom;
    const dx = width * fx;
    const dy = height * fy;
    camera.position.x += dx;
    camera.position.y += dy;
    controls.target.x += dx;
    controls.target.y += dy;
    controls.update();
  };

  const zoomBy = (
    camera: THREE.OrthographicCamera,
    controls: MapControls,
    factor: number,
  ) => {
    const next = camera.zoom * factor;
    const min = controls.minZoom ?? 0.00001;
    const max = controls.maxZoom ?? 1000;
    camera.zoom = Math.min(max, Math.max(min, next));
    camera.updateProjectionMatrix();
    controls.update();
  };

  const attach = (element: HTMLElement) => {
    detach();
    target = element;
    if (target.tabIndex < 0) target.tabIndex = 0;
    target.addEventListener("keydown", onKeyDown);
  };

  const detach = () => {
    if (target) {
      target.removeEventListener("keydown", onKeyDown);
      target = null;
    }
  };

  const setEnabled = (v: boolean) => {
    enabled = v;
  };

  return { attach, detach, setEnabled };
}
