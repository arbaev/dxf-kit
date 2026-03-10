import { describe, it, expect } from "vitest";
import { getInsUnitsScale } from "../insUnitsScale";

describe("getInsUnitsScale", () => {
  it("returns 1 when drawing units are Unitless (0)", () => {
    expect(getInsUnitsScale(0, 4)).toBe(1);
  });

  it("returns 1 when block units are Unitless (0)", () => {
    expect(getInsUnitsScale(4, 0)).toBe(1);
  });

  it("returns 1 when both are Unitless", () => {
    expect(getInsUnitsScale(0, 0)).toBe(1);
  });

  it("returns 1 when units are equal", () => {
    expect(getInsUnitsScale(4, 4)).toBe(1); // mm → mm
    expect(getInsUnitsScale(1, 1)).toBe(1); // inches → inches
  });

  it("converts inches block into mm drawing", () => {
    // Block in inches (1), drawing in mm (4): 25.4 / 1 = 25.4
    expect(getInsUnitsScale(4, 1)).toBeCloseTo(25.4);
  });

  it("converts mm block into inches drawing", () => {
    // Block in mm (4), drawing in inches (1): 1 / 25.4
    expect(getInsUnitsScale(1, 4)).toBeCloseTo(1 / 25.4);
  });

  it("converts meters block into mm drawing", () => {
    // Block in meters (6), drawing in mm (4): 1000 / 1 = 1000
    expect(getInsUnitsScale(4, 6)).toBe(1000);
  });

  it("converts feet block into meters drawing", () => {
    // Block in feet (2), drawing in meters (6): 304.8 / 1000
    expect(getInsUnitsScale(6, 2)).toBeCloseTo(0.3048);
  });

  it("converts cm block into meters drawing", () => {
    // Block in cm (5), drawing in meters (6): 10 / 1000 = 0.01
    expect(getInsUnitsScale(6, 5)).toBeCloseTo(0.01);
  });

  it("returns 1 for out-of-range drawing units", () => {
    expect(getInsUnitsScale(99, 4)).toBe(1);
    expect(getInsUnitsScale(-1, 4)).toBe(1);
  });

  it("returns 1 for out-of-range block units", () => {
    expect(getInsUnitsScale(4, 99)).toBe(1);
    expect(getInsUnitsScale(4, -1)).toBe(1);
  });
});
