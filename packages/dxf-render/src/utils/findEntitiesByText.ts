import type { DxfData } from "@/types/dxf";
import { buildEntityIndex, extractEntityText } from "./entityIndex";

export interface FindEntitiesByTextOptions {
  /** Match exact case. Default: false (case-insensitive). */
  caseSensitive?: boolean;
  /** Treat `query` as a regular expression source. Default: false (substring match). */
  regex?: boolean;
}

/**
 * Find handles of entities whose displayable text matches `query`.
 * Searches TEXT, MTEXT, ATTRIB, ATTDEF, DIMENSION, and MULTILEADER text
 * across top-level entities, ATTRIBs attached to INSERTs, and entities
 * inside blocks.
 *
 * Returns an empty array for empty/whitespace queries. Handles are returned
 * in the iteration order of `buildEntityIndex(dxf)`.
 */
export function findEntitiesByText(
  dxf: DxfData,
  query: string,
  options?: FindEntitiesByTextOptions,
): string[] {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const matcher = buildMatcher(trimmed, options);
  const index = buildEntityIndex(dxf);
  const out: string[] = [];
  for (const [handle, entity] of index) {
    const text = extractEntityText(entity);
    if (text && matcher(text)) out.push(handle);
  }
  return out;
}

function buildMatcher(
  query: string,
  options?: FindEntitiesByTextOptions,
): (text: string) => boolean {
  if (options?.regex) {
    const re = new RegExp(query, options.caseSensitive ? "" : "i");
    return (s) => re.test(s);
  }
  if (options?.caseSensitive) {
    return (s) => s.includes(query);
  }
  const lower = query.toLowerCase();
  return (s) => s.toLowerCase().includes(lower);
}
