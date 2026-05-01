import type * as THREE from "three";
import type { PickingIndex } from "@/render/pickingIndex";
import { getZoomBox, type GetZoomBoxOptions } from "./getZoomBox";

export interface GetZoomBoxForLayerOptions extends GetZoomBoxOptions {
  /** Match exact case. Default: true (DXF layer names are case-sensitive). */
  caseSensitive?: boolean;
}

/**
 * Pure helper: build the bounding box that fits all picking entries on a given layer.
 * Returns `null` when no entries match.
 *
 * Layer matching is case-sensitive by default (DXF layer names are case-sensitive
 * per spec). Pass `{ caseSensitive: false }` for forgiving lookups.
 */
export function getZoomBoxForLayer(
  pickingIndex: PickingIndex,
  layerName: string,
  options?: GetZoomBoxForLayerOptions,
): THREE.Box3 | null {
  if (!layerName) return null;
  const caseSensitive = options?.caseSensitive ?? true;
  const target = caseSensitive ? layerName : layerName.toLowerCase();

  const handles: string[] = [];
  for (const entry of pickingIndex.entries) {
    const layer = caseSensitive ? entry.layer : entry.layer.toLowerCase();
    if (layer === target) handles.push(entry.handle);
  }

  if (handles.length === 0) return null;
  return getZoomBox(pickingIndex, handles, options);
}
