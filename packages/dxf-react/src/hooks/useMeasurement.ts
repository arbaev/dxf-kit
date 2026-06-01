import { useRef, useState } from "react";
import {
  createMeasurementController,
  formatMeasureValue,
  type MeasureKind,
  type MeasureUnits,
  type MeasureState,
  type MeasureResult,
  type MeasureCallbacks,
  type MeasurementController,
} from "dxf-interaction";

// Re-export the formatter + types so dxf-react's public surface is unchanged
// (the engine logic now lives in dxf-interaction; this file is the React shell).
export { formatMeasureValue };
export type { MeasureKind, MeasureUnits, MeasureState, MeasureResult, MeasureCallbacks };

export interface UseMeasurementResult {
  /** Reactive measurement state (consumed by `useMeasureLabels`). */
  state: MeasureState;
  attach: MeasurementController["attach"];
  detach: MeasurementController["detach"];
  setEnabled: MeasurementController["setEnabled"];
  setUnitsScale: MeasurementController["setUnitsScale"];
  setColor: MeasurementController["setColor"];
  clear: MeasurementController["clear"];
  dispose: MeasurementController["dispose"];
}

/**
 * React hook for the linear (distance) measurement tool. Returns a STABLE
 * object reference (created once); `state` is a live property the controller
 * updates, paired with a `forceRender` so consumers re-render. A stable
 * reference is essential — the viewer lists this object in effect dependency
 * arrays, so a fresh object each render would re-run the mount effect (and
 * re-init Three.js) on every render.
 */
export function useMeasurement(): UseMeasurementResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseMeasurementResult | null>(null);
  if (ref.current === null) {
    const result = { state: { points: [], hoverWorld: null } } as unknown as UseMeasurementResult;
    const controller = createMeasurementController((state) => {
      result.state = state;
      forceRender((v) => v + 1);
    });
    result.attach = controller.attach;
    result.detach = controller.detach;
    result.setEnabled = controller.setEnabled;
    result.setUnitsScale = controller.setUnitsScale;
    result.setColor = controller.setColor;
    result.clear = controller.clear;
    result.dispose = controller.dispose;
    ref.current = result;
  }
  return ref.current;
}
