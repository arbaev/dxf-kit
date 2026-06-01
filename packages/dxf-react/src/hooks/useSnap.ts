import { useRef } from "react";
import { createSnapController, type SnapController } from "dxf-interaction";

export type { SnapController };

/** React hook over `createSnapController`. Returns a stable controller. */
export function useSnap(): SnapController {
  const ref = useRef<SnapController | null>(null);
  if (ref.current === null) {
    ref.current = createSnapController();
  }
  return ref.current;
}
