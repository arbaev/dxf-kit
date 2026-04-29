import type { DxfData, DxfEntity, DxfBlock } from "@/types/dxf";
import { isInsertEntity } from "@/types/dxf";

/**
 * Build a flat handle → DxfEntity map covering top-level entities,
 * entities inside blocks, and ATTRIBs attached to INSERTs.
 *
 * Used for O(1) lookup when a picking event needs to resolve an
 * entity's full data (text content, layer, type, raw fields) by handle.
 */
export function buildEntityIndex(dxf: DxfData): Map<string, DxfEntity> {
  const map = new Map<string, DxfEntity>();

  for (const entity of dxf.entities ?? []) {
    addEntity(entity, map);
    if (isInsertEntity(entity) && entity.attribs) {
      for (const attrib of entity.attribs) {
        addEntity(attrib as unknown as DxfEntity, map);
      }
    }
  }

  if (dxf.blocks) {
    for (const block of Object.values(dxf.blocks) as DxfBlock[]) {
      for (const entity of block.entities ?? []) {
        addEntity(entity, map);
      }
    }
  }

  return map;
}

function addEntity(entity: DxfEntity, map: Map<string, DxfEntity>): void {
  const handle = normalizeHandle(entity.handle);
  if (handle && !map.has(handle)) {
    map.set(handle, entity);
  }
}

function normalizeHandle(handle: string | number | undefined): string | null {
  if (handle == null) return null;
  return typeof handle === "string" ? handle : handle.toString(16).toUpperCase();
}

/**
 * Extract a human-readable text representation from an entity, if any.
 * Returns the TEXT/MTEXT contents, ATTRIB value, DIMENSION text, or
 * MULTILEADER inline text. Used to populate the `text` field of
 * picking events.
 */
export function extractEntityText(entity: DxfEntity): string | undefined {
  switch (entity.type) {
    case "TEXT":
    case "MTEXT":
      return (entity as { text?: string }).text;
    case "ATTRIB":
    case "ATTDEF":
      return (entity as { text?: string; tag?: string }).text
        ?? (entity as { tag?: string }).tag;
    case "DIMENSION":
      return (entity as { text?: string }).text;
    case "MULTILEADER":
    case "MLEADER":
      return (entity as { text?: string }).text;
    default:
      return undefined;
  }
}
