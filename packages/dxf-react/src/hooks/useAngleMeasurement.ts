import { useRef, useState } from "react";
import {
  createAngleMeasurementController,
  formatAngleValue,
  type AngleMeasureResult,
  type AngleMeasureState,
  type AngleMeasureCallbacks,
  type AngleMeasurementController,
} from "dxf-interaction";

export { formatAngleValue };
export type { AngleMeasureResult, AngleMeasureState, AngleMeasureCallbacks };

const emptyState = (): AngleMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
});

export interface UseAngleMeasurementResult {
  /** Reactive angle-measurement state (consumed by `useMeasureLabels`). */
  state: AngleMeasureState;
  attach: AngleMeasurementController["attach"];
  detach: AngleMeasurementController["detach"];
  setEnabled: AngleMeasurementController["setEnabled"];
  setUnits: AngleMeasurementController["setUnits"];
  setColor: AngleMeasurementController["setColor"];
  clear: AngleMeasurementController["clear"];
  dispose: AngleMeasurementController["dispose"];
}

/**
 * React hook for the 3-point angle-measurement tool. Returns a STABLE object
 * reference (see `useMeasurement` for why); `state` is a live property updated
 * by the controller, paired with a `forceRender`.
 */
export function useAngleMeasurement(): UseAngleMeasurementResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseAngleMeasurementResult | null>(null);
  if (ref.current === null) {
    const result = { state: emptyState() } as unknown as UseAngleMeasurementResult;
    const controller = createAngleMeasurementController((state) => {
      result.state = state;
      forceRender((v) => v + 1);
    });
    result.attach = controller.attach;
    result.detach = controller.detach;
    result.setEnabled = controller.setEnabled;
    result.setUnits = controller.setUnits;
    result.setColor = controller.setColor;
    result.clear = controller.clear;
    result.dispose = controller.dispose;
    ref.current = result;
  }
  return ref.current;
}
