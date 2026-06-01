import { shallowRef } from "vue";
import {
  createPickingController,
  type PickingController,
  type PickingEvent,
} from "dxf-interaction";

export type { PickingEvent };

/**
 * Vue binding for the picking controller. The raycasting lives in
 * `dxf-interaction`; this composable mirrors hover into a reactive `shallowRef`
 * (via the `onHover` callback) and resets it whenever picking data is swapped.
 */
export function usePicking() {
  const hovered = shallowRef<PickingEvent | null>(null);
  const controller = createPickingController();

  const attach: PickingController["attach"] = (canvasEl, cameraRef, callbacks) =>
    controller.attach(canvasEl, cameraRef, {
      onClick: callbacks.onClick,
      onHover: (e) => {
        hovered.value = e;
        callbacks.onHover?.(e);
      },
    });

  const installPickingData: PickingController["installPickingData"] = (dxf, scene, offset) => {
    controller.installPickingData(dxf, scene, offset);
    hovered.value = null;
  };

  const removePickingData: PickingController["removePickingData"] = (scene) => {
    controller.removePickingData(scene);
    hovered.value = null;
  };

  return {
    hovered,
    ...controller,
    attach,
    installPickingData,
    removePickingData,
  };
}
