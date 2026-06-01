import { createHighlightController } from "dxf-interaction";

/**
 * Vue binding for the highlight-overlay controller. It has no reactive surface
 * (pure Three.js), so this is a direct pass-through to `dxf-interaction`.
 */
export function useHighlight() {
  return createHighlightController();
}
