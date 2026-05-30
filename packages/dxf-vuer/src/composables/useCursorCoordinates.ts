import { ref, computed } from "vue";
import * as THREE from "three";

/**
 * Tracks the cursor's DXF world coordinates over the canvas — feeding the
 * coordinates overlay and the ruler cursor marker. Only computes while tracking
 * is requested (the `showCoordinates` or `showRulers` props).
 */
export function useCursorCoordinates(opts: {
  getContainer: () => HTMLElement | null;
  getCamera: () => THREE.Camera | null;
  getOriginOffset: () => { x: number; y: number; z: number };
  /** True when coordinates or rulers are shown (so we skip the math otherwise). */
  isTracking: () => boolean;
}) {
  const cursorX = ref(0);
  const cursorY = ref(0);
  const isCursorVisible = ref(false);

  const handleMouseMove = (e: MouseEvent): void => {
    if (!opts.isTracking()) return;
    const container = opts.getContainer();
    const camera = opts.getCamera();
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);

    // Add back origin offset to display original DXF coordinates
    const offset = opts.getOriginOffset();
    cursorX.value = worldPos.x + offset.x;
    cursorY.value = worldPos.y + offset.y;
    isCursorVisible.value = true;
  };

  const handleMouseLeave = (): void => {
    isCursorVisible.value = false;
  };

  const cursorWorld = computed(() => ({ x: cursorX.value, y: cursorY.value }));

  return { cursorX, cursorY, isCursorVisible, cursorWorld, handleMouseMove, handleMouseLeave };
}
