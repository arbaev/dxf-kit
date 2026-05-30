import { describe, it, expect } from "vitest";
import { formatAngleValue } from "../useAngleMeasurement";

describe("formatAngleValue", () => {
  describe("degrees", () => {
    it("uses one decimal and a degree sign", () => {
      expect(formatAngleValue(123.45, "deg")).toBe("123.5°");
      expect(formatAngleValue(0, "deg")).toBe("0.0°");
      expect(formatAngleValue(90, "deg")).toBe("90.0°");
    });

    it("renders reflex angles (> 180°) verbatim", () => {
      expect(formatAngleValue(270.0, "deg")).toBe("270.0°");
      expect(formatAngleValue(359.9, "deg")).toBe("359.9°");
    });
  });

  describe("radians", () => {
    it("converts from degrees with three decimals", () => {
      expect(formatAngleValue(180, "rad")).toBe("3.142 rad");
      expect(formatAngleValue(90, "rad")).toBe("1.571 rad");
      expect(formatAngleValue(0, "rad")).toBe("0.000 rad");
    });
  });

  describe("degrees-minutes-seconds", () => {
    it("decomposes a whole degree", () => {
      expect(formatAngleValue(90, "dms")).toBe(`90°00'00"`);
    });

    it("decomposes fractional degrees and zero-pads", () => {
      // 30.5° = 30°30'00"
      expect(formatAngleValue(30.5, "dms")).toBe(`30°30'00"`);
      // 12.5125° = 12°30'45"
      expect(formatAngleValue(12.5125, "dms")).toBe(`12°30'45"`);
    });

    it("carries seconds/minutes that round up to 60", () => {
      // 0.99999° rounds to 1°00'00" (seconds carry into minutes into degrees)
      expect(formatAngleValue(0.999999, "dms")).toBe(`1°00'00"`);
    });

    it("keeps a sign for negative angles", () => {
      expect(formatAngleValue(-45.25, "dms")).toBe(`-45°15'00"`);
    });
  });

  describe("invalid inputs", () => {
    it("returns em-dash for NaN", () => {
      expect(formatAngleValue(NaN, "deg")).toBe("—");
      expect(formatAngleValue(NaN, "rad")).toBe("—");
      expect(formatAngleValue(NaN, "dms")).toBe("—");
    });

    it("returns em-dash for Infinity", () => {
      expect(formatAngleValue(Infinity, "deg")).toBe("—");
      expect(formatAngleValue(-Infinity, "dms")).toBe("—");
    });
  });
});
