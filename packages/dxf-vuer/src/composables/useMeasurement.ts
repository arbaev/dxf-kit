import { ref, shallowRef } from "vue";
import {
  createMeasurementController,
  formatMeasureValue,
  type MeasureKind,
  type MeasureUnits,
  type MeasureState,
  type MeasureResult,
  type MeasureCallbacks,
} from "dxf-interaction";

// Re-export the formatter + types so dxf-vuer's public surface is unchanged
// (the drag-state machine now lives in dxf-interaction; this is the Vue shell).
export { formatMeasureValue };
export type { MeasureKind, MeasureUnits, MeasureState, MeasureResult, MeasureCallbacks };

/**
 * Vue binding for the linear (distance) measurement tool. The state machine
 * lives in `dxf-interaction`; this composable mirrors the controller's state
 * into a `shallowRef` (consumed by `useMeasureLabels`) and exposes `isActive`
 * as a `Ref` for API compatibility.
 */
export function useMeasurement() {
  const state = shallowRef<MeasureState>({ points: [], hoverWorld: null });
  const isActive = ref(false);
  const controller = createMeasurementController((s) => {
    state.value = s;
  });
  const setEnabled = (on: boolean): void => {
    isActive.value = on;
    controller.setEnabled(on);
  };
  return {
    state,
    isActive,
    attach: controller.attach,
    detach: controller.detach,
    setEnabled,
    setUnitsScale: controller.setUnitsScale,
    setColor: controller.setColor,
    clear: controller.clear,
    dispose: controller.dispose,
  };
}
