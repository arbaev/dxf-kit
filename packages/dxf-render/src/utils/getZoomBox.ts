import * as THREE from "three";
import type { PickingIndex } from "@/render/pickingIndex";

export interface GetZoomBoxOptions {
  /**
   * If the renderer applied an origin offset to the scene (`createThreeObjectsFromDXF`
   * returns one for large GIS coordinates), pass it here so the resulting Box3 lands
   * in the same scene-space the camera sees.
   */
  originOffset?: { x: number; y: number; z?: number };

  /**
   * Padding fraction of the union's larger side that is added on every axis.
   * `0.2` (default) gives a comfortable 20% breathing room around the entities.
   */
  paddingRatio?: number;
}

/**
 * Pure helper: build the bounding box that should be passed to `fitCameraToBox()`
 * to focus the camera on a set of DXF entities identified by handle.
 *
 * Steps:
 *   1. Look up world-space bboxes from `pickingIndex.byHandle` (one or more per handle —
 *      e.g. INSERT array instances yield multiple entries).
 *   2. Union them.
 *   3. Translate by `-originOffset` so the box is in scene-space.
 *   4. Expand by `paddingRatio * max(width, height)`.
 *
 * Returns `null` when no handles resolved to entries (e.g. all unknown, or only
 * XLINE/RAY which are excluded from the picking index).
 */
export function getZoomBox(
  pickingIndex: PickingIndex,
  handles: string[],
  options?: GetZoomBoxOptions,
): THREE.Box3 | null {
  if (!handles || handles.length === 0) return null;

  const oo = options?.originOffset;
  const negOffset = new THREE.Vector3(-(oo?.x ?? 0), -(oo?.y ?? 0), -(oo?.z ?? 0));

  const union = new THREE.Box3();
  let any = false;
  for (const handle of handles) {
    const entries = pickingIndex.byHandle.get(handle);
    if (!entries) continue;
    for (const entry of entries) {
      union.union(entry.bbox.clone().translate(negOffset));
      any = true;
    }
  }
  if (!any || union.isEmpty()) return null;

  const padRatio = options?.paddingRatio ?? 0.2;
  const size = union.getSize(new THREE.Vector3());
  const pad = Math.max(size.x, size.y, 1) * padRatio;
  union.expandByScalar(pad);

  return union;
}
