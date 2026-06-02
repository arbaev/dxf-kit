export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Units displayed on the rulers.
 *
 * - `"dxf-units"` — raw DXF values, no conversion (badge: "—").
 * - `"mm"` — converts via `$INSUNITS`; when the file is Unitless ($INSUNITS=0)
 *   the raw values are treated as millimeters 1:1.
 * - `"inch"` — same conversion path as `"mm"`, then divided by 25.4.
 */
export type RulerUnits = "dxf-units" | "mm" | "inch";

/**
 * Active measurement tool. The tools are mutually exclusive — switching modes
 * resets the previously active tool's in-flight draft.
 *
 * - `"none"` — no measurement tool active (default).
 * - `"distance"` — two-point linear ruler.
 * - `"area"` — N-point polygon area + perimeter.
 * - `"angle"` — three-point angle (vertex + two rays).
 */
export type MeasureMode = "none" | "distance" | "area" | "angle";

/**
 * Square units for the area-measurement label.
 *
 * - `"auto"` — inherit from `rulerUnits` (`mm` → `mm²`, `inch` → `in²`,
 *   `dxf-units` → no suffix).
 * - `"mm²"` / `"m²"` / `"in²"` / `"ft²"` — explicit square units; converted via
 *   `$INSUNITS` (millimetre-equivalent for unitless files), then squared.
 */
export type AreaUnits = "auto" | "mm²" | "m²" | "in²" | "ft²";

// `AngleUnits` is owned by dxf-interaction (the angle-measurement controller
// depends on it); re-exported here so the public type name stays stable.
export type { AngleUnits } from "dxf-interaction";

/**
 * The loading phases reported via the `loadingPhase` property while a DXF loads.
 * (In Vue/React this was a scoped slot prop; a Web Component surfaces it as a
 * readable property + the matching state — consumers project their own UI.)
 */
export type LoadingPhase = "" | "fetching" | "parsing" | "rendering";
