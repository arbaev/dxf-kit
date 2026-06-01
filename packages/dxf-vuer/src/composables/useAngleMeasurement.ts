import { ref, shallowRef } from "vue";
import {
  createAngleMeasurementController,
  formatAngleValue,
  type AngleMeasureResult,
  type AngleMeasureState,
  type AngleMeasureCallbacks,
} from "dxf-interaction";

export { formatAngleValue };
export type { AngleMeasureResult, AngleMeasureState, AngleMeasureCallbacks };

const emptyState = (): AngleMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
});

/**
 * Vue binding for the 3-point angle-measurement tool. The state machine lives in
 * `dxf-interaction`; this composable mirrors its state into a `shallowRef` and
 * exposes `isActive` as a `Ref` for API compatibility.
 */
export function useAngleMeasurement() {
  const state = shallowRef<AngleMeasureState>(emptyState());
  const isActive = ref(false);
  const controller = createAngleMeasurementController((s) => {
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
