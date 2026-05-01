import type { DxfData } from "@/types/dxf";
import { buildEntityIndex } from "./entityIndex";

/**
 * Find handles of all entities matching the given DXF type (or any of the given types).
 * Walks top-level entities, ATTRIBs attached to INSERTs, and entities inside blocks
 * (same coverage as `findEntitiesByText` / `findEntitiesByLayer`).
 *
 * Type matching is uppercase (DXF entity types are always uppercase per spec, but
 * inputs are normalized to be forgiving).
 *
 * Returns an empty array for empty type input.
 */
export function findEntitiesByType(
  dxf: DxfData,
  type: string | readonly string[],
): string[] {
  const types = Array.isArray(type) ? type : [type as string];
  const wanted = new Set<string>();
  for (const t of types) {
    if (t && typeof t === "string") {
      const trimmed = t.trim();
      if (trimmed) wanted.add(trimmed.toUpperCase());
    }
  }
  if (wanted.size === 0) return [];

  const index = buildEntityIndex(dxf);
  const out: string[] = [];
  for (const [handle, entity] of index) {
    if (wanted.has(entity.type)) out.push(handle);
  }
  return out;
}
