import { ref } from "vue";
import type { SnapType } from "dxf-render";
import { createSnapController } from "dxf-interaction";

/**
 * Vue binding for the geometry-snap controller. The snap math + marker overlay
 * live in `dxf-interaction`; this composable mirrors the active snap type into a
 * reactive `ref` via the controller's `onSnapChange` callback.
 */
export function useSnap() {
  const current = ref<SnapType | null>(null);
  const controller = createSnapController((type) => {
    current.value = type;
  });
  return {
    current,
    ...controller,
  };
}
