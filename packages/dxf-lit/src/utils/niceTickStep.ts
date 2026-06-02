/**
 * "Nice" tick-step calculation and tick-label formatting for rulers.
 *
 * Pure UI math — lives in dxf-react because rulers are a viewer-layer concern,
 * not a DXF-parsing or scene-rendering concern.
 */

/**
 * Returns a "nice" tick step (a multiple of 1, 2, or 5 times a power of 10)
 * such that ticks placed at that step appear roughly `targetSpacingPx` pixels apart
 * inside a viewport of size `viewportPx` showing `worldRange` world-units.
 *
 * Always returns a positive finite value. Returns 1 for degenerate inputs.
 */
export function niceTickStep(
  worldRange: number,
  viewportPx: number,
  targetSpacingPx: number,
): number {
  if (!Number.isFinite(worldRange) || !Number.isFinite(viewportPx) || !Number.isFinite(targetSpacingPx)) {
    return 1;
  }
  const absRange = Math.abs(worldRange);
  if (absRange === 0 || viewportPx <= 0 || targetSpacingPx <= 0) return 1;

  const raw = absRange * (targetSpacingPx / viewportPx);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;

  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else nice = 10;

  return nice * mag;
}

/**
 * Formats a tick value for display on a ruler.
 *
 * The formatting precision is derived from `step` — values are rounded
 * to the number of fractional digits implied by the step's magnitude.
 * Trailing zeros are trimmed. Very large or very small numbers fall back
 * to scientific notation to keep labels compact.
 *
 * Examples:
 *   formatTickLabel(0, 10)        → "0"
 *   formatTickLabel(150, 10)      → "150"
 *   formatTickLabel(0.25, 0.1)    → "0.3"
 *   formatTickLabel(0.25, 0.05)   → "0.25"
 *   formatTickLabel(1_000_000, 100_000) → "1e+6"
 *   formatTickLabel(-0, 1)        → "0"  (no negative-zero rendering)
 */
export function formatTickLabel(value: number, step: number): string {
  if (!Number.isFinite(value)) return "";
  if (Object.is(value, -0)) value = 0;

  const absStep = Math.abs(step) || 1;
  // Snap value to step grid to avoid float dust (e.g. 0.1 + 0.2 = 0.30000000000000004).
  const snapped = Math.round(value / absStep) * absStep;
  const absVal = Math.abs(snapped);

  // Use scientific notation for very large or very small magnitudes.
  if (absVal !== 0 && (absVal >= 1e6 || absVal < 1e-3)) {
    return snapped.toExponential(1).replace(/\.0e/, "e").replace("e+", "e+").replace("e-", "e-");
  }

  // Number of fractional digits implied by step.
  const decimals = absStep >= 1 ? 0 : Math.min(10, Math.ceil(-Math.log10(absStep)));
  let str = snapped.toFixed(decimals);

  // Strip trailing zeros and a trailing dot.
  if (decimals > 0) {
    str = str.replace(/\.?0+$/, "");
  }
  // Avoid "-0" output after rounding.
  if (str === "-0") str = "0";
  return str;
}
