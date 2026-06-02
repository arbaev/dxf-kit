import { describe, it, expect } from "vitest";
import { niceTickStep, formatTickLabel } from "../niceTickStep";

describe("niceTickStep", () => {
  it("returns a step from the 1/2/5 series", () => {
    // 1000 units across 1000 px, target ~100 px spacing → raw = 100 → nice 100
    expect(niceTickStep(1000, 1000, 100)).toBe(100);
  });

  it("rounds raw=70 down to 50 (nice from the 5-decade)", () => {
    // raw = 700 * (100 / 1000) = 70 → norm 7 → nice 5
    expect(niceTickStep(700, 1000, 100)).toBe(50);
  });

  it("rounds raw=2.5 up via the 2-decade", () => {
    // raw = 25 * (100 / 1000) = 2.5 → norm 2.5 → nice 2
    expect(niceTickStep(25, 1000, 100)).toBe(2);
  });

  it("picks 1 for raw just above a decade boundary", () => {
    // raw = 11 * (100 / 1000) = 1.1 → norm 1.1 → nice 1
    expect(niceTickStep(11, 1000, 100)).toBe(1);
  });

  it("picks 10 (i.e. carries into next decade) when norm ≥ 7.5", () => {
    // raw = 80 * (100/1000) = 8 → norm 8 → nice 10
    expect(niceTickStep(80, 1000, 100)).toBe(10);
  });

  it("works for tiny world ranges", () => {
    // raw = 0.005 * (100/1000) = 0.0005 → norm 5 → nice 5e-4
    expect(niceTickStep(0.005, 1000, 100)).toBeCloseTo(0.0005, 10);
  });

  it("works for huge world ranges", () => {
    // raw = 5_000_000 * (100/1000) = 500_000 → norm 5 → nice 500_000
    expect(niceTickStep(5_000_000, 1000, 100)).toBe(500_000);
  });

  it("treats negative worldRange as its absolute value", () => {
    expect(niceTickStep(-1000, 1000, 100)).toBe(100);
  });

  it("returns 1 for zero range", () => {
    expect(niceTickStep(0, 1000, 100)).toBe(1);
  });

  it("returns 1 for zero viewport", () => {
    expect(niceTickStep(1000, 0, 100)).toBe(1);
  });

  it("returns 1 for non-finite inputs", () => {
    expect(niceTickStep(Infinity, 1000, 100)).toBe(1);
    expect(niceTickStep(1000, NaN, 100)).toBe(1);
    expect(niceTickStep(1000, 1000, -50)).toBe(1);
  });

  it("respects targetSpacingPx — larger spacing yields larger step", () => {
    const a = niceTickStep(1000, 1000, 50);
    const b = niceTickStep(1000, 1000, 150);
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe("formatTickLabel", () => {
  it("formats integers without decimals", () => {
    expect(formatTickLabel(150, 10)).toBe("150");
    expect(formatTickLabel(0, 10)).toBe("0");
    expect(formatTickLabel(-25, 5)).toBe("-25");
  });

  it("formats fractions with precision derived from step", () => {
    expect(formatTickLabel(0.5, 0.1)).toBe("0.5");
    expect(formatTickLabel(0.25, 0.05)).toBe("0.25");
    expect(formatTickLabel(0.123, 0.001)).toBe("0.123");
  });

  it("snaps to step grid (no float dust)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 — must still print "0.3"
    expect(formatTickLabel(0.1 + 0.2, 0.1)).toBe("0.3");
  });

  it("trims trailing zeros", () => {
    expect(formatTickLabel(1.5, 0.5)).toBe("1.5"); // not "1.50"
    expect(formatTickLabel(1, 0.5)).toBe("1");
  });

  it("renders -0 as 0", () => {
    expect(formatTickLabel(-0, 10)).toBe("0");
  });

  it("uses scientific notation for very large values", () => {
    const out = formatTickLabel(1_000_000, 100_000);
    expect(out).toMatch(/e\+?\d/);
  });

  it("uses scientific notation for very small values", () => {
    const out = formatTickLabel(0.0001, 0.00001);
    expect(out).toMatch(/e-?\d/);
  });

  it("returns empty string for non-finite values", () => {
    expect(formatTickLabel(NaN, 1)).toBe("");
    expect(formatTickLabel(Infinity, 1)).toBe("");
  });
});
