/**
 * Display format for the angle-measurement label. Angles are dimensionless, so
 * (unlike linear / area units) this never goes through `$INSUNITS`.
 *
 * - `"deg"` — decimal degrees, e.g. `123.4°` (default).
 * - `"rad"` — radians, e.g. `2.150 rad`.
 * - `"dms"` — degrees-minutes-seconds, e.g. `123°30'15"`.
 *
 * Defined here (rather than in each wrapper) because the angle-measurement
 * controller depends on it; `dxf-vuer` / `dxf-react` re-export this name from
 * their own `types` modules so their public API stays stable.
 */
export type AngleUnits = "deg" | "rad" | "dms";
