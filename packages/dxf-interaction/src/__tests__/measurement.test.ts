import { describe, it, expect } from "vitest";
import { formatMeasureValue } from "../measurement";

describe("formatMeasureValue", () => {
  describe("mm units", () => {
    it("uses two decimals for small values", () => {
      expect(formatMeasureValue(12.345, "mm")).toBe("12.35 mm");
      expect(formatMeasureValue(0.5, "mm")).toBe("0.50 mm");
    });

    it("uses one decimal for values >= 100", () => {
      expect(formatMeasureValue(123.456, "mm")).toBe("123.5 mm");
      expect(formatMeasureValue(100, "mm")).toBe("100.0 mm");
    });

    it("handles zero", () => {
      expect(formatMeasureValue(0, "mm")).toBe("0.00 mm");
    });

    it("handles negative values by magnitude", () => {
      expect(formatMeasureValue(-150, "mm")).toBe("-150.0 mm");
    });
  });

  describe("inch units", () => {
    it("formats with 'in' suffix", () => {
      expect(formatMeasureValue(1.5, "inch")).toBe("1.50 in");
      expect(formatMeasureValue(120.5, "inch")).toBe("120.5 in");
    });
  });

  describe("dxf-units (raw)", () => {
    it("omits any unit suffix", () => {
      expect(formatMeasureValue(42.5, "dxf-units")).toBe("42.50");
      expect(formatMeasureValue(500, "dxf-units")).toBe("500.0");
    });
  });

  describe("invalid inputs", () => {
    it("returns em-dash for NaN", () => {
      expect(formatMeasureValue(NaN, "mm")).toBe("—");
    });

    it("returns em-dash for Infinity", () => {
      expect(formatMeasureValue(Infinity, "mm")).toBe("—");
      expect(formatMeasureValue(-Infinity, "inch")).toBe("—");
    });
  });
});
