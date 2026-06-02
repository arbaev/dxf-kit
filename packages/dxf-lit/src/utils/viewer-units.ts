import { getUnitsToMmFactor, type DxfData } from "dxf-render";
import type { MeasureUnits, AreaUnitScales } from "dxf-interaction";
import type { RulerUnits, AreaUnits } from "../types";

export interface ViewerUnits {
  rulerUnitsScale: number;
  rulerUnitsLabel: string;
  currentMeasureUnits: MeasureUnits;
  measureUnitsScale: number;
  areaUnitScales: AreaUnitScales;
}

/**
 * Derive the `$INSUNITS`-based scale factors and unit labels shared by the
 * rulers and the three measurement tools. Pure derivation — ported from
 * dxf-react's `useViewerUnits` without the `useMemo` wrappers (the Lit element
 * calls this in a getter that runs each render).
 */
export function computeViewerUnits(opts: {
  /** The currently displayed DXF (prop data or the last loaded file). */
  activeDxf: DxfData | null;
  rulerUnits: RulerUnits;
  /** Per-prop override for the distance label units; falls back to `rulerUnits`. */
  measureUnits: RulerUnits | undefined;
  measureAreaUnits: AreaUnits;
}): ViewerUnits {
  const { activeDxf, rulerUnits, measureUnits, measureAreaUnits } = opts;

  const insUnits = activeDxf?.header?.$INSUNITS ?? 0;
  const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;

  // Scale factor applied to world coords to produce the value rendered on rulers.
  const rulerUnitsScale =
    rulerUnits === "dxf-units" ? 1 : rulerUnits === "inch" ? toMm / 25.4 : toMm;

  const rulerUnitsLabel = rulerUnits === "mm" ? "mm" : rulerUnits === "inch" ? "in" : "—";

  // Units the measurement label renders in. Defaults to `rulerUnits`.
  const currentMeasureUnits: MeasureUnits = measureUnits ?? rulerUnits;
  const measureUnitsScale =
    currentMeasureUnits === "dxf-units"
      ? 1
      : currentMeasureUnits === "inch"
        ? toMm / 25.4
        : toMm;

  // Resolve the area-measurement units into scale factors + suffix labels.
  let target: AreaUnits | "dxf" = measureAreaUnits ?? "auto";
  if (target === "auto") {
    target = rulerUnits === "mm" ? "mm²" : rulerUnits === "inch" ? "in²" : "dxf";
  }
  let lin: number;
  let areaLabel: string;
  let lengthLabel: string;
  switch (target) {
    case "mm²": lin = toMm; areaLabel = "mm²"; lengthLabel = "mm"; break;
    case "m²": lin = toMm / 1000; areaLabel = "m²"; lengthLabel = "m"; break;
    case "in²": lin = toMm / 25.4; areaLabel = "in²"; lengthLabel = "in"; break;
    case "ft²": lin = toMm / 304.8; areaLabel = "ft²"; lengthLabel = "ft"; break;
    default: lin = 1; areaLabel = ""; lengthLabel = ""; break; // dxf-units
  }
  const areaUnitScales: AreaUnitScales = {
    areaScale: lin * lin,
    perimeterScale: lin,
    areaLabel,
    lengthLabel,
  };

  return { rulerUnitsScale, rulerUnitsLabel, currentMeasureUnits, measureUnitsScale, areaUnitScales };
}
