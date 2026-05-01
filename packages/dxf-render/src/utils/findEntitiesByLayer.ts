import type { DxfData } from "@/types/dxf";
import { buildEntityIndex } from "./entityIndex";

export interface FindEntitiesByLayerOptions {
  /** Match exact case. Default: true (DXF layer names are case-sensitive). */
  caseSensitive?: boolean;
}

/**
 * Find handles of all entities that belong to a given layer.
 * Walks the same flat index as `findEntitiesByText` — top-level entities,
 * ATTRIBs attached to INSERTs, and entities inside blocks.
 *
 * Returns an empty array for empty/whitespace `layerName`.
 */
export function findEntitiesByLayer(
  dxf: DxfData,
  layerName: string,
  options?: FindEntitiesByLayerOptions,
): string[] {
  const trimmed = layerName?.trim();
  if (!trimmed) return [];

  const caseSensitive = options?.caseSensitive ?? true;
  const target = caseSensitive ? trimmed : trimmed.toLowerCase();

  const index = buildEntityIndex(dxf);
  const out: string[] = [];
  for (const [handle, entity] of index) {
    const layer = entity.layer;
    if (!layer) continue;
    const cmp = caseSensitive ? layer : layer.toLowerCase();
    if (cmp === target) out.push(handle);
  }
  return out;
}
