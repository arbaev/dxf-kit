import { describe, it, expect } from "vitest";

const EPSILON = 1e-10;

/**
 * Compute ellipse sweep angle using the same logic as useDXFGeometry.ts.
 * DXF ELLIPSE arcs are always CCW; when start > end, wrap through 2π.
 */
function computeEllipseSweep(
  startAngle: number,
  endAngle: number,
): { isFullEllipse: boolean; sweepAngle: number } {
  const isFullEllipse =
    Math.abs(endAngle - startAngle - 2 * Math.PI) < EPSILON ||
    Math.abs(endAngle - startAngle) < EPSILON;

  if (isFullEllipse) {
    return { isFullEllipse: true, sweepAngle: 2 * Math.PI };
  }

  let sweepAngle = endAngle - startAngle;
  if (sweepAngle < 0) sweepAngle += 2 * Math.PI;

  return { isFullEllipse: false, sweepAngle };
}

describe("Ellipse sweep angle computation", () => {
  it("full ellipse: 0 → 2π", () => {
    const r = computeEllipseSweep(0, 2 * Math.PI);
    expect(r.isFullEllipse).toBe(true);
    expect(r.sweepAngle).toBeCloseTo(2 * Math.PI, 10);
  });

  it("full ellipse: 0 → 0", () => {
    const r = computeEllipseSweep(0, 0);
    expect(r.isFullEllipse).toBe(true);
    expect(r.sweepAngle).toBeCloseTo(2 * Math.PI, 10);
  });

  it("full ellipse: π → π (equal non-zero angles)", () => {
    const r = computeEllipseSweep(Math.PI, Math.PI);
    expect(r.isFullEllipse).toBe(true);
    expect(r.sweepAngle).toBeCloseTo(2 * Math.PI, 10);
  });

  it("normal arc: 90° → 270° (π/2 → 3π/2)", () => {
    const r = computeEllipseSweep(Math.PI / 2, (3 * Math.PI) / 2);
    expect(r.isFullEllipse).toBe(false);
    expect(r.sweepAngle).toBeCloseTo(Math.PI, 10);
  });

  it("crossing 0: 270° → 90° (3π/2 → π/2)", () => {
    const r = computeEllipseSweep((3 * Math.PI) / 2, Math.PI / 2);
    expect(r.isFullEllipse).toBe(false);
    expect(r.sweepAngle).toBeCloseTo(Math.PI, 10);
  });

  it("crossing 0: 350° → 10° (6.109 → 0.175)", () => {
    const start = (350 * Math.PI) / 180;
    const end = (10 * Math.PI) / 180;
    const r = computeEllipseSweep(start, end);
    expect(r.isFullEllipse).toBe(false);
    expect(r.sweepAngle).toBeCloseTo((20 * Math.PI) / 180, 6);
  });

  it("crossing 0: 100° → 80° (1.745 → 1.396)", () => {
    const start = (100 * Math.PI) / 180;
    const end = (80 * Math.PI) / 180;
    const r = computeEllipseSweep(start, end);
    expect(r.isFullEllipse).toBe(false);
    // CCW sweep from 100° through 360° to 80° = 340°
    expect(r.sweepAngle).toBeCloseTo((340 * Math.PI) / 180, 6);
  });

  it("crossing 0: 315° → 135° (5.498 → 2.356)", () => {
    const start = (315 * Math.PI) / 180;
    const end = (135 * Math.PI) / 180;
    const r = computeEllipseSweep(start, end);
    expect(r.isFullEllipse).toBe(false);
    // CCW sweep from 315° through 360° to 135° = 180°
    expect(r.sweepAngle).toBeCloseTo(Math.PI, 6);
  });

  it("small arc: 80° → 100°", () => {
    const start = (80 * Math.PI) / 180;
    const end = (100 * Math.PI) / 180;
    const r = computeEllipseSweep(start, end);
    expect(r.isFullEllipse).toBe(false);
    expect(r.sweepAngle).toBeCloseTo((20 * Math.PI) / 180, 6);
  });
});
