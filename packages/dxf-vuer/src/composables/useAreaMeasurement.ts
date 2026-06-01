import { ref, shallowRef } from "vue";
import {
  createAreaMeasurementController,
  formatAreaValue,
  type AreaMeasureResult,
  type AreaMeasureState,
  type AreaMeasureCallbacks,
  type AreaUnitScales,
} from "dxf-interaction";

export { formatAreaValue };
export type { AreaMeasureResult, AreaMeasureState, AreaMeasureCallbacks, AreaUnitScales };

const emptyState = (): AreaMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
  originSnap: false,
});

/**
 * Vue binding for the polygon area-measurement tool. The state machine lives in
 * `dxf-interaction`; this composable mirrors its state into a `shallowRef` and
 * exposes `isActive` as a `Ref` for API compatibility.
 */
export function useAreaMeasurement() {
  const state = shallowRef<AreaMeasureState>(emptyState());
  const isActive = ref(false);
  const controller = createAreaMeasurementController((s) => {
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
    setUnits: controller.setUnits,
    setColor: controller.setColor,
    clear: controller.clear,
    dispose: controller.dispose,
  };
}
