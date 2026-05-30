import { computed, type Ref } from "vue";
import { getUnitsToMmFactor, type DxfData } from "dxf-render";
import type { RulerUnits, AreaUnits } from "../types";
import type { MeasureUnits } from "./useMeasurement";
import type { AreaUnitScales } from "./useAreaMeasurement";

/**
 * Derives the `$INSUNITS`-based scale factors and unit labels shared by the
 * rulers and the three measurement tools. Pure reactive derivation — no DOM,
 * no Three.js — so a React / Lit port can reuse the same conversion chain.
 *
 * Inputs are passed as getters / a ref so the computeds track the host's props
 * and the active DXF reactively.
 */
export function useViewerUnits(opts: {
  /** The currently displayed DXF (prop data or the last loaded file). */
  activeDxf: Ref<DxfData | null>;
  rulerUnits: () => RulerUnits;
  /** Per-prop override for the distance label units; falls back to `rulerUnits`. */
  measureUnits: () => RulerUnits | undefined;
  measureAreaUnits: () => AreaUnits;
}) {
  // Scale factor applied to world coords to produce the value rendered on rulers.
  // "dxf-units" — no conversion. "mm"/"inch" — go through $INSUNITS; when the file
  // is Unitless ($INSUNITS=0) we treat one DXF unit as one millimetre 1:1.
  const rulerUnitsScale = computed<number>(() => {
    if (opts.rulerUnits() === "dxf-units") return 1;
    const insUnits = opts.activeDxf.value?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
    return opts.rulerUnits() === "inch" ? toMm / 25.4 : toMm;
  });

  const rulerUnitsLabel = computed<string>(() => {
    const u = opts.rulerUnits();
    if (u === "mm") return "mm";
    if (u === "inch") return "in";
    return "—";
  });

  // Units the measurement label renders in. Defaults to `rulerUnits` (so a single
  // "switch units" control governs both surfaces), can be overridden per-prop.
  const currentMeasureUnits = computed<MeasureUnits>(
    () => opts.measureUnits() ?? opts.rulerUnits(),
  );

  // Same conversion chain as `rulerUnitsScale`, but driven by `currentMeasureUnits`
  // so the label respects the prop override.
  const measureUnitsScale = computed<number>(() => {
    const units = currentMeasureUnits.value;
    if (units === "dxf-units") return 1;
    const insUnits = opts.activeDxf.value?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
    return units === "inch" ? toMm / 25.4 : toMm;
  });

  // Resolve the area-measurement units into scale factors + suffix labels.
  // `'auto'` mirrors `rulerUnits`; explicit square units (`m²`, `ft²`, …) convert
  // through `$INSUNITS`. Area scales with the square of the linear factor, the
  // perimeter with the linear factor itself.
  const areaUnitScales = computed<AreaUnitScales>(() => {
    const insUnits = opts.activeDxf.value?.header?.$INSUNITS ?? 0;
    const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
    let target: AreaUnits | "dxf" = opts.measureAreaUnits() ?? "auto";
    if (target === "auto") {
      target =
        opts.rulerUnits() === "mm" ? "mm²" : opts.rulerUnits() === "inch" ? "in²" : "dxf";
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
  });

  return {
    rulerUnitsScale,
    rulerUnitsLabel,
    currentMeasureUnits,
    measureUnitsScale,
    areaUnitScales,
  };
}
