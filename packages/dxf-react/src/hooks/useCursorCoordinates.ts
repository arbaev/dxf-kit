import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import * as THREE from "three";

export interface UseCursorCoordinatesOptions {
  getContainer: () => HTMLElement | null;
  getCamera: () => THREE.Camera | null;
  getOriginOffset: () => { x: number; y: number; z: number };
  /** True when coordinates or rulers are shown (so we skip the math otherwise). */
  isTracking: boolean;
}

/**
 * Tracks the cursor's DXF world coordinates over the canvas — feeding the
 * coordinates overlay and the ruler cursor marker. Only computes while tracking
 * is requested.
 */
export function useCursorCoordinates(opts: UseCursorCoordinatesOptions) {
  const [cursorX, setCursorX] = useState(0);
  const [cursorY, setCursorY] = useState(0);
  const [isCursorVisible, setIsCursorVisible] = useState(false);

  const optsRef = useRef(opts);
  optsRef.current = opts;

  const handleMouseMove = useCallback((e: ReactMouseEvent): void => {
    const o = optsRef.current;
    if (!o.isTracking) return;
    const container = o.getContainer();
    const camera = o.getCamera();
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);

    // Add back origin offset to display original DXF coordinates.
    const offset = o.getOriginOffset();
    setCursorX(worldPos.x + offset.x);
    setCursorY(worldPos.y + offset.y);
    setIsCursorVisible(true);
  }, []);

  const handleMouseLeave = useCallback((): void => {
    setIsCursorVisible(false);
  }, []);

  const cursorWorld = useMemo(() => ({ x: cursorX, y: cursorY }), [cursorX, cursorY]);

  return { cursorX, cursorY, isCursorVisible, cursorWorld, handleMouseMove, handleMouseLeave };
}
