import { describe, it, expect } from "vitest";
import { getCustomGlyph, hasCustomGlyph } from "../customGlyphs";

describe("customGlyphs", () => {
  describe("registry", () => {
    it("has custom glyph for U+2300 (⌀ DIAMETER SIGN)", () => {
      expect(hasCustomGlyph("\u2300")).toBe(true);
    });

    it("has custom glyph for U+2205 (∅ EMPTY SET)", () => {
      expect(hasCustomGlyph("\u2205")).toBe(true);
    });

    it("returns null for unregistered characters", () => {
      expect(getCustomGlyph("A")).toBeNull();
      expect(hasCustomGlyph("A")).toBe(false);
    });
  });

  describe("diameter glyph (U+2300)", () => {
    const glyph = getCustomGlyph("\u2300")!;

    it("returns non-null GlyphData", () => {
      expect(glyph).not.toBeNull();
    });

    it("has valid positions (triplets of x, y, z)", () => {
      expect(glyph.positions.length).toBeGreaterThan(0);
      expect(glyph.positions.length % 3).toBe(0);
    });

    it("has valid indices (triplets for triangles)", () => {
      expect(glyph.indices.length).toBeGreaterThan(0);
      expect(glyph.indices.length % 3).toBe(0);
    });

    it("all indices are within vertex count range", () => {
      const vertexCount = glyph.positions.length / 3;
      for (const idx of glyph.indices) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(vertexCount);
      }
    });

    it("all z-coordinates are 0 (2D glyph)", () => {
      for (let i = 2; i < glyph.positions.length; i += 3) {
        expect(glyph.positions[i]).toBe(0);
      }
    });

    it("has positive advance width", () => {
      expect(glyph.advance).toBeGreaterThan(0);
      // Should be approximately 0.73 (like font's 'O')
      expect(glyph.advance).toBeCloseTo(0.73, 1);
    });

    it("has valid bounds within normalized range", () => {
      expect(glyph.bounds.xMin).toBeLessThan(glyph.bounds.xMax);
      expect(glyph.bounds.yMin).toBeLessThan(glyph.bounds.yMax);
      // Glyph should be within [0, advance] x [0, ~0.7] roughly
      expect(glyph.bounds.xMin).toBeGreaterThanOrEqual(-0.1);
      expect(glyph.bounds.xMax).toBeLessThanOrEqual(0.85);
      expect(glyph.bounds.yMin).toBeGreaterThanOrEqual(-0.1);
      expect(glyph.bounds.yMax).toBeLessThanOrEqual(0.85);
    });
  });

  describe("U+2205 (∅) is same shape as U+2300 (⌀)", () => {
    it("produces identical advance width", () => {
      const d1 = getCustomGlyph("\u2300")!;
      const d2 = getCustomGlyph("\u2205")!;
      expect(d1.advance).toBe(d2.advance);
    });

    it("produces same number of vertices and indices", () => {
      const d1 = getCustomGlyph("\u2300")!;
      const d2 = getCustomGlyph("\u2205")!;
      expect(d1.positions.length).toBe(d2.positions.length);
      expect(d1.indices.length).toBe(d2.indices.length);
    });
  });
});
