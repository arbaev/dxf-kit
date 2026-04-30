import type { DxfData, DxfEntity } from "@/types/dxf";
import type { EntityAssociation } from "@/types/associations";
import { buildEntityIndex, extractEntityText } from "./entityIndex";

/**
 * Pure function: derive `EntityAssociation[]` strictly from parsed DXF data.
 *
 * Covered sources (no geometric heuristics):
 *
 * - MULTILEADER → `mleader` (inline contextData text)
 * - LEADER     → `leader`  (handle-ref via code 340 to TEXT/MTEXT)
 * - INSERT     → `block-attribs` (ATTRIB array attached to the insert)
 * - DIMENSION  → `dimension` (inline text/measurement on the entity itself)
 *
 * TODO: ACAD_GROUP entries from the OBJECTS section — the section is not yet
 * parsed; once it is, emit `group` associations from each ACAD_GROUP record.
 */
export function buildAssociations(dxf: DxfData): EntityAssociation[] {
  const out: EntityAssociation[] = [];
  const index = buildEntityIndex(dxf);

  for (const entity of dxf.entities ?? []) {
    const primary = normalizeHandle(entity.handle);
    if (!primary) continue;

    switch (entity.type) {
      case "MULTILEADER":
      case "MLEADER": {
        const text = (entity as { text?: string }).text;
        if (text) {
          out.push({
            id: `mleader:${primary}`,
            kind: "mleader",
            primary,
            members: [primary],
            text,
            source: "inline",
          });
        }
        break;
      }

      case "LEADER": {
        const handleRef = normalizeHandle(
          (entity as { annotationHandle?: string }).annotationHandle,
        );
        const target = handleRef ? index.get(handleRef) : undefined;
        if (handleRef && target) {
          out.push({
            id: `leader:${primary}`,
            kind: "leader",
            primary,
            members: [primary, handleRef],
            text: extractEntityText(target),
            source: "handle-ref",
          });
        }
        break;
      }

      case "INSERT": {
        const attribs = (entity as { attribs?: DxfEntity[] }).attribs ?? [];
        const memberHandles: string[] = [primary];
        const texts: string[] = [];
        for (const attrib of attribs) {
          const h = normalizeHandle(attrib.handle);
          if (h) memberHandles.push(h);
          const t = extractEntityText(attrib);
          if (t) texts.push(t);
        }
        if (memberHandles.length > 1) {
          out.push({
            id: `block-attribs:${primary}`,
            kind: "block-attribs",
            primary,
            members: memberHandles,
            text: texts.length > 0 ? texts.join(" ") : undefined,
            source: "attribs",
          });
        }
        break;
      }

      case "DIMENSION": {
        const text = extractEntityText(entity);
        const measurement = (entity as { actualMeasurement?: number }).actualMeasurement;
        const display =
          text && text.length > 0 && text !== "<>"
            ? text
            : measurement != null
              ? String(measurement)
              : undefined;
        out.push({
          id: `dimension:${primary}`,
          kind: "dimension",
          primary,
          members: [primary],
          text: display,
          source: "inline",
        });
        break;
      }
    }
  }

  return out;
}

function normalizeHandle(handle: string | number | undefined): string | null {
  if (handle == null) return null;
  return typeof handle === "string" ? handle : handle.toString(16).toUpperCase();
}
