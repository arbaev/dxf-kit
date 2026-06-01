import { useRef } from "react";
import { createHighlightController, type HighlightController } from "dxf-interaction";

export type { HighlightController };

/** React hook over `createHighlightController`. Returns a stable controller. */
export function useHighlight(): HighlightController {
  const ref = useRef<HighlightController | null>(null);
  if (ref.current === null) {
    ref.current = createHighlightController();
  }
  return ref.current;
}
