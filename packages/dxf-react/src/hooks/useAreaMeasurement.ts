import { useRef, useState } from "react";
import {
  createAreaMeasurementController,
  formatAreaValue,
  type AreaMeasureResult,
  type AreaMeasureState,
  type AreaMeasureCallbacks,
  type AreaUnitScales,
  type AreaMeasurementController,
} from "dxf-interaction";

export { formatAreaValue };
export type { AreaMeasureResult, AreaMeasureState, AreaMeasureCallbacks, AreaUnitScales };

const emptyState = (): AreaMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
  originSnap: false,
});

export interface UseAreaMeasurementResult {
  /** Reactive area-measurement state (consumed by `useMeasureLabels`). */
  state: AreaMeasureState;
  attach: AreaMeasurementController["attach"];
  detach: AreaMeasurementController["detach"];
  setEnabled: AreaMeasurementController["setEnabled"];
  setUnits: AreaMeasurementController["setUnits"];
  setColor: AreaMeasurementController["setColor"];
  clear: AreaMeasurementController["clear"];
  dispose: AreaMeasurementController["dispose"];
}

/**
 * React hook for the polygon area-measurement tool. Returns a STABLE object
 * reference (see `useMeasurement` for why); `state` is a live property updated
 * by the controller, paired with a `forceRender`.
 */
export function useAreaMeasurement(): UseAreaMeasurementResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseAreaMeasurementResult | null>(null);
  if (ref.current === null) {
    const result = { state: emptyState() } as unknown as UseAreaMeasurementResult;
    const controller = createAreaMeasurementController((state) => {
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
