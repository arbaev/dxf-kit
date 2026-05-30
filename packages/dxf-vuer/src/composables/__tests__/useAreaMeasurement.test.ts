import { describe, it, expect } from "vitest";
import { formatAreaValue } from "../useAreaMeasurement";

describe("formatAreaValue", () => {
  describe("with a unit suffix", () => {
    it("uses two decimals for small values", () => {
      expect(formatAreaValue(12.345, "m²")).toBe("12.35 m²");
      expect(formatAreaValue(0.5, "m²")).toBe("0.50 m²");
    });

    it("uses one decimal for values >= 100", () => {
      expect(formatAreaValue(123.456, "m²")).toBe("123.5 m²");
      expect(formatAreaValue(100, "mm²")).toBe("100.0 mm²");
    });

    it("appends the suffix verbatim (length units too)", () => {
      expect(formatAreaValue(45.67, "m")).toBe("45.67 m");
      expect(formatAreaValue(12.3, "ft")).toBe("12.30 ft");
    });

    it("handles zero", () => {
      expect(formatAreaValue(0, "m²")).toBe("0.00 m²");
    });

    it("handles negative values by magnitude", () => {
      expect(formatAreaValue(-150, "in²")).toBe("-150.0 in²");
    });
  });

  describe("without a unit suffix (raw dxf-units)", () => {
    it("omits the suffix", () => {
      expect(formatAreaValue(42.5, "")).toBe("42.50");
      expect(formatAreaValue(500, "")).toBe("500.0");
    });
  });

  describe("invalid inputs", () => {
    it("returns em-dash for NaN", () => {
      expect(formatAreaValue(NaN, "m²")).toBe("—");
    });

    it("returns em-dash for Infinity", () => {
      expect(formatAreaValue(Infinity, "m²")).toBe("—");
      expect(formatAreaValue(-Infinity, "ft²")).toBe("—");
    });
  });
});
