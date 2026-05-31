import { useMemo } from "react";
import { getUnitsToMmFactor, type DxfData } from "dxf-render";
import type { RulerUnits, AreaUnits } from "../types";
import type { MeasureUnits } from "./useMeasurement";
import type { AreaUnitScales } from "./useAreaMeasurement";

/**
 * Derives the `$INSUNITS`-based scale factors and unit labels shared by the
 * rulers and the three measurement tools. Pure derivation via `useMemo`. Inputs
 * are passed as plain values; the hook re-runs each render and the memos track
 * them.
 */
export function useViewerUnits(opts: {
  /** The currently displayed DXF (prop data or the last loaded file). */
  activeDxf: DxfData | null;
  rulerUnits: RulerUnits;
  /** Per-prop override for the distance label units; falls back to `rulerUnits`. */
  measureUnits: RulerUnits | undefined;
  measureAreaUnits: AreaUnits;
}) {
  const { activeDxf, rulerUnits, measureUnits, measureAreaUnits } = opts;

  // Scale factor applied to world coords to produce the value rendered on rulers.
  // "dxf-units" — no conversion. "mm"/"inch" — go through $INSUNITS; when the file
  // is Unitless ($INSUNITS=0) we treat one DXF unit as one millimetre 1:1.
  const rulerUnitsScale = useMemo<number>(() => {
    if (rulerUnits === "dxf-units") return 1;
    const insUnits = activeDxf?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
    return rulerUnits === "inch" ? toMm / 25.4 : toMm;
  }, [rulerUnits, activeDxf]);

  const rulerUnitsLabel = useMemo<string>(() => {
    if (rulerUnits === "mm") return "mm";
    if (rulerUnits === "inch") return "in";
    return "—";
  }, [rulerUnits]);

  // Units the measurement label renders in. Defaults to `rulerUnits`.
  const currentMeasureUnits = useMemo<MeasureUnits>(
    () => measureUnits ?? rulerUnits,
    [measureUnits, rulerUnits],
  );

  const measureUnitsScale = useMemo<number>(() => {
    const units = currentMeasureUnits;
    if (units === "dxf-units") return 1;
    const insUnits = activeDxf?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
    return units === "inch" ? toMm / 25.4 : toMm;
  }, [currentMeasureUnits, activeDxf]);

  // Resolve the area-measurement units into scale factors + suffix labels.
  const areaUnitScales = useMemo<AreaUnitScales>(() => {
    const insUnits = activeDxf?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
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
    return { areaScale: lin * lin, perimeterScale: lin, areaLabel, lengthLabel };
  }, [activeDxf, measureAreaUnits, rulerUnits]);

  return {
    rulerUnitsScale,
    rulerUnitsLabel,
    currentMeasureUnits,
    measureUnitsScale,
    areaUnitScales,
  };
}
