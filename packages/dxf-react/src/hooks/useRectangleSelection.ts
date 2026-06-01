import { useRef, useState } from "react";
import {
  createRectangleSelectionController,
  resolveSelectionMode,
  normaliseScreenRect,
  buildWorldRect,
  type RectSelectionMode,
  type RectSelectionResolvedMode,
  type RectSelectionModifier,
  type RectSelectionCallbacks,
  type RectScreenRect,
  type OrbitLikeControls,
  type RectSelectionController,
} from "dxf-interaction";

// Re-export pure helpers + types so dxf-react's public surface is unchanged.
export { resolveSelectionMode, normaliseScreenRect, buildWorldRect };
export type {
  RectSelectionMode,
  RectSelectionResolvedMode,
  RectSelectionModifier,
  RectSelectionCallbacks,
  RectScreenRect,
  OrbitLikeControls,
  RectSelectionController,
};

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
 * React hook over `createRectangleSelectionController`. Returns a STABLE object
 * reference (see `useMeasurement` for why) whose `screenRect` is a live
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
