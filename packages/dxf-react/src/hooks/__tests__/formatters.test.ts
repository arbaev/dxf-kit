import { describe, it, expect } from "vitest";
import { formatMeasureValue } from "../useMeasurement";
import { formatAreaValue } from "../useAreaMeasurement";
import { formatAngleValue } from "../useAngleMeasurement";

describe("formatMeasureValue", () => {
  it("uses 2 decimals below 100 and 1 decimal at/above 100", () => {
    expect(formatMeasureValue(12.345, "dxf-units")).toBe("12.35");
    expect(formatMeasureValue(123.45, "dxf-units")).toBe("123.5");
  });

  it("appends the unit suffix for mm / inch", () => {
    expect(formatMeasureValue(10, "mm")).toBe("10.00 mm");
    expect(formatMeasureValue(10, "inch")).toBe("10.00 in");
  });

  it("returns an em-dash for non-finite values", () => {
    expect(formatMeasureValue(NaN, "mm")).toBe("—");
    expect(formatMeasureValue(Infinity, "mm")).toBe("—");
  });
});

describe("formatAreaValue", () => {
  it("appends the unit suffix when present, omits it otherwise", () => {
    expect(formatAreaValue(12.34, "m²")).toBe("12.34 m²");
    expect(formatAreaValue(12.34, "")).toBe("12.34");
  });

  it("uses 1 decimal at/above 100", () => {
    expect(formatAreaValue(250.5, "mm²")).toBe("250.5 mm²");
  });

  it("returns an em-dash for non-finite values", () => {
    expect(formatAreaValue(NaN, "m²")).toBe("—");
  });
});

describe("formatAngleValue", () => {
  it("formats degrees with one decimal", () => {
    expect(formatAngleValue(123.45, "deg")).toBe("123.5°");
  });

  it("formats radians with three decimals", () => {
    expect(formatAngleValue(180, "rad")).toBe(`${Math.PI.toFixed(3)} rad`);
  });

  it("formats degrees-minutes-seconds", () => {
    expect(formatAngleValue(123.5, "dms")).toBe("123°30'00\"");
  });

  it("returns an em-dash for non-finite values", () => {
    expect(formatAngleValue(NaN, "deg")).toBe("—");
  });
});
