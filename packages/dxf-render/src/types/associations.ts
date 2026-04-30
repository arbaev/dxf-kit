/**
 * Kinds of associations that can be derived strictly from DXF data:
 *
 * - `mleader`       — MULTILEADER entity with inline contextData text
 * - `leader`        — legacy LEADER entity linked to a TEXT/MTEXT via code 340
 * - `block-attribs` — INSERT with one or more ATTRIB entities attached
 * - `dimension`     — DIMENSION primary, plus its anchor block when present
 * - `group`         — ACAD_GROUP from the OBJECTS section (currently not parsed)
 */
export type AssociationKind =
  | "mleader"
  | "leader"
  | "block-attribs"
  | "dimension"
  | "group";

/**
 * How the association was sourced from DXF:
 *
 * - `inline`     — the associated text/data lives inside the primary entity itself
 *                  (MULTILEADER context data, DIMENSION text override)
 * - `handle-ref` — the primary entity stores explicit handle references (LEADER 340)
 * - `attribs`    — ATTRIB array attached to an INSERT (codes 0/ATTRIB inside INSERT)
 * - `group-dict` — ACAD_GROUP dictionary entry (TODO: not yet parsed)
 */
export type AssociationSource =
  | "inline"
  | "handle-ref"
  | "attribs"
  | "group-dict";

export interface EntityAssociation {
  /** Stable id, e.g. `${kind}:${primary}` */
  id: string;
  kind: AssociationKind;
  /** Handle of the primary/owning entity */
  primary: string;
  /** Handles of all related entities, including primary itself */
  members: string[];
  /** Extracted display text, when available */
  text?: string;
  source: AssociationSource;
}
