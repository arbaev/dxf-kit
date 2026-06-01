import { ref, shallowRef } from "vue";
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
} from "dxf-interaction";

// Re-export pure helpers + types so dxf-vuer's public surface is unchanged.
export { resolveSelectionMode, normaliseScreenRect, buildWorldRect };
export type {
  RectSelectionMode,
  RectSelectionResolvedMode,
  RectSelectionModifier,
  RectSelectionCallbacks,
  RectScreenRect,
  OrbitLikeControls,
};

/**
 * Vue binding for rectangle (window/crossing) selection. The drag-state machine
 * lives in `dxf-interaction`; this composable mirrors the drag rectangle into a
 * `shallowRef` and derives `isDragging` from it (non-null rect ⟺ active drag).
 */
export function useRectangleSelection() {
  const screenRect = shallowRef<RectScreenRect | null>(null);
  const isDragging = ref(false);
  const controller = createRectangleSelectionController((rect) => {
    screenRect.value = rect;
    isDragging.value = rect !== null;
  });
  return {
    isDragging,
    screenRect,
    ...controller,
  };
}
