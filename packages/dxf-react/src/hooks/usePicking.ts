import { useRef } from "react";
import { createPickingController, type PickingController } from "dxf-interaction";

export type { PickingEvent } from "dxf-interaction";
export type { PickingController };

/** React hook over `createPickingController`. Returns a stable controller. */
export function usePicking(): PickingController {
  const ref = useRef<PickingController | null>(null);
  if (ref.current === null) {
    ref.current = createPickingController();
  }
  return ref.current;
}
