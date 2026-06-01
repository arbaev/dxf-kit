import { describe, it, expect } from "vitest";
import {
  resolveSelectionMode,
  normaliseScreenRect,
  buildWorldRect,
} from "../rectangleSelection";

describe("resolveSelectionMode", () => {
  it("returns 'window' when locked regardless of direction", () => {
    expect(resolveSelectionMode("window", { x: 0, y: 0 }, { x: 100, y: 0 })).toBe("window");
    expect(resolveSelectionMode("window", { x: 100, y: 0 }, { x: 0, y: 0 })).toBe("window");
  });

  it("returns 'crossing' when locked regardless of direction", () => {
    expect(resolveSelectionMode("crossing", { x: 0, y: 0 }, { x: 100, y: 0 })).toBe("crossing");
    expect(resolveSelectionMode("crossing", { x: 100, y: 0 }, { x: 0, y: 0 })).toBe("crossing");
  });

  describe("auto mode (AutoCAD convention)", () => {
    it("returns 'window' when dragging left to right", () => {
      expect(resolveSelectionMode("auto", { x: 10, y: 0 }, { x: 100, y: 50 })).toBe("window");
    });

    it("returns 'crossing' when dragging right to left", () => {
      expect(resolveSelectionMode("auto", { x: 100, y: 0 }, { x: 10, y: 50 })).toBe("crossing");
    });

    it("returns 'window' when endX equals startX (zero horizontal drag)", () => {
      expect(resolveSelectionMode("auto", { x: 50, y: 0 }, { x: 50, y: 50 })).toBe("window");
    });

    it("ignores vertical component — only X direction matters", () => {
      expect(resolveSelectionMode("auto", { x: 0, y: 100 }, { x: 50, y: 0 })).toBe("window");
      expect(resolveSelectionMode("auto", { x: 50, y: 100 }, { x: 0, y: 0 })).toBe("crossing");
    });
  });
});

describe("normaliseScreenRect", () => {
  const canvasRect = { left: 20, top: 30 };

  it("normalises a forward drag (top-left to bottom-right)", () => {
    const r = normaliseScreenRect({ x: 100, y: 50 }, { x: 200, y: 150 }, canvasRect, "window");
    expect(r.x).toBe(100 - 20);
    expect(r.y).toBe(50 - 30);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.mode).toBe("window");
  });

  it("normalises a backward drag (bottom-right to top-left)", () => {
    const r = normaliseScreenRect({ x: 200, y: 150 }, { x: 100, y: 50 }, canvasRect, "crossing");
    expect(r.x).toBe(100 - 20);
    expect(r.y).toBe(50 - 30);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.mode).toBe("crossing");
  });

  it("handles mixed direction (x reversed, y forward)", () => {
    const r = normaliseScreenRect({ x: 200, y: 50 }, { x: 100, y: 150 }, canvasRect, "crossing");
    expect(r.x).toBe(80);
    expect(r.y).toBe(20);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
  });

  it("produces zero-extent rect for identical points", () => {
    const r = normaliseScreenRect({ x: 100, y: 100 }, { x: 100, y: 100 }, canvasRect, "window");
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
});

describe("buildWorldRect", () => {
  it("normalises start/end world points into a positive-extent rect", () => {
    const r = buildWorldRect({ x: 100, y: 200 }, { x: 50, y: 250 });
    expect(r.minX).toBe(50);
    expect(r.minY).toBe(200);
    expect(r.maxX).toBe(100);
    expect(r.maxY).toBe(250);
  });

  it("handles forward drag", () => {
    const r = buildWorldRect({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(r.minX).toBe(0);
    expect(r.minY).toBe(0);
    expect(r.maxX).toBe(100);
    expect(r.maxY).toBe(100);
  });

  it("supports negative world coordinates", () => {
    const r = buildWorldRect({ x: -50, y: -100 }, { x: -10, y: -50 });
    expect(r.minX).toBe(-50);
    expect(r.minY).toBe(-100);
    expect(r.maxX).toBe(-10);
    expect(r.maxY).toBe(-50);
  });
});
