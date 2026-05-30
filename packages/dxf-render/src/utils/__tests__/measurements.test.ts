import { describe, it, expect } from "vitest";
import {
  measureDistance,
  measureArea,
  measureSignedArea,
  measurePerimeter,
  polygonSelfIntersects,
  measureAngle,
  measureDirectedAngle,
  toDegrees,
  toRadians,
  type MeasurePoint,
} from "../measurements";

describe("measureDistance", () => {
  it("returns 0 for identical points", () => {
    expect(measureDistance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(measureDistance({ x: 5, y: 7, z: 3 }, { x: 5, y: 7, z: 3 })).toBe(0);
  });

  it("computes 2D distance (3-4-5 triangle)", () => {
    expect(measureDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("computes 3D distance (1-2-2 → 3)", () => {
    expect(measureDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 })).toBe(3);
  });

  it("treats missing z as 0 (mixed 2D/3D inputs)", () => {
    expect(measureDistance({ x: 0, y: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
    expect(measureDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("is symmetric", () => {
    const a: MeasurePoint = { x: 1.5, y: -2.5, z: 0.5 };
    const b: MeasurePoint = { x: -3, y: 7.25, z: 4 };
    expect(measureDistance(a, b)).toBeCloseTo(measureDistance(b, a));
  });

  it("handles negative coordinates", () => {
    expect(measureDistance({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });

  it("returns 0 for non-finite coordinates", () => {
    expect(measureDistance({ x: NaN, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(measureDistance({ x: 0, y: 0 }, { x: Infinity, y: 0 })).toBe(0);
  });
});

describe("measureSignedArea", () => {
  it("returns 0 for fewer than 3 points", () => {
    expect(measureSignedArea([])).toBe(0);
    expect(measureSignedArea([{ x: 0, y: 0 }])).toBe(0);
    expect(measureSignedArea([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(0);
  });

  it("returns positive area for CCW triangle", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(measureSignedArea(tri)).toBe(6);
  });

  it("returns negative area for CW triangle", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 4, y: 0 },
    ];
    expect(measureSignedArea(tri)).toBe(-6);
  });

  it("computes square area (CCW)", () => {
    const sq: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(measureSignedArea(sq)).toBe(4);
  });

  it("returns 0 for collinear points", () => {
    const line: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(measureSignedArea(line)).toBe(0);
  });

  it("ignores z coordinate", () => {
    const tri2D: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    const tri3D: MeasurePoint[] = [
      { x: 0, y: 0, z: 100 },
      { x: 4, y: 0, z: -50 },
      { x: 0, y: 3, z: 7 },
    ];
    expect(measureSignedArea(tri3D)).toBe(measureSignedArea(tri2D));
  });

  it("yields the same value whether the polygon is open or closed", () => {
    const open: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    const closed: MeasurePoint[] = [...open, { x: 0, y: 0 }];
    // Closed form has 4 vertices but the duplicated edge contributes 0,
    // and the wrap-around (last → first) is also 0 since they coincide.
    expect(measureSignedArea(closed)).toBe(measureSignedArea(open));
  });

  it("returns 0 for non-finite coordinates", () => {
    const bad: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: NaN, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(measureSignedArea(bad)).toBe(0);
  });
});

describe("measureArea", () => {
  it("returns 0 for degenerate inputs", () => {
    expect(measureArea([])).toBe(0);
    expect(measureArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  it("returns absolute value of signed area (CCW)", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(measureArea(tri)).toBe(6);
  });

  it("returns absolute value of signed area (CW)", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 4, y: 0 },
    ];
    expect(measureArea(tri)).toBe(6);
  });

  it("computes a 10x10 square", () => {
    const sq: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(measureArea(sq)).toBe(100);
  });

  it("computes a non-convex (L-shape) polygon area", () => {
    // L-shape: 3x3 square with a 1x1 notch in the top-right corner.
    // Expected area = 9 - 1 = 8.
    const lshape: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(measureArea(lshape)).toBe(8);
  });
});

describe("measurePerimeter", () => {
  it("returns 0 for fewer than 2 points", () => {
    expect(measurePerimeter([])).toBe(0);
    expect(measurePerimeter([{ x: 0, y: 0 }])).toBe(0);
  });

  it("computes the closed perimeter of a 3-4-5 right triangle", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ];
    // edges: 3 + 4 + 5 (hypotenuse) = 12
    expect(measurePerimeter(tri)).toBe(12);
  });

  it("computes the perimeter of a 10x10 square", () => {
    const sq: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(measurePerimeter(sq)).toBe(40);
  });

  it("includes the closing edge (open input)", () => {
    const tri: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ];
    // Passing the polygon explicitly closed adds a zero-length edge only.
    const closed: MeasurePoint[] = [...tri, { x: 0, y: 0 }];
    expect(measurePerimeter(closed)).toBe(measurePerimeter(tri));
  });

  it("returns twice the segment length for 2 points", () => {
    expect(measurePerimeter([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(10);
  });

  it("returns 0 for non-finite coordinates", () => {
    const bad: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: NaN, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(measurePerimeter(bad)).toBe(0);
  });
});

describe("polygonSelfIntersects", () => {
  it("returns false for fewer than 4 vertices", () => {
    expect(polygonSelfIntersects([])).toBe(false);
    expect(polygonSelfIntersects([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(false);
    expect(
      polygonSelfIntersects([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ]),
    ).toBe(false);
  });

  it("returns false for a convex quadrilateral (square)", () => {
    const sq: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(polygonSelfIntersects(sq)).toBe(false);
  });

  it("returns false for a concave (non-convex) polygon", () => {
    const lshape: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 0, y: 3 },
    ];
    expect(polygonSelfIntersects(lshape)).toBe(false);
  });

  it("detects the classic bow-tie / hourglass crossing", () => {
    // Vertices ordered so edges (0→1) and (2→3) cross in the middle.
    const bowtie: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(polygonSelfIntersects(bowtie)).toBe(true);
  });

  it("does not flag a polygon that merely touches at a shared vertex", () => {
    // A normal polygon — adjacent edges share endpoints but never cross.
    const pentagon: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 3 },
      { x: 2, y: 5 },
      { x: -1, y: 3 },
    ];
    expect(polygonSelfIntersects(pentagon)).toBe(false);
  });

  it("returns false for non-finite coordinates", () => {
    const bad: MeasurePoint[] = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: NaN, y: 0 },
      { x: 0, y: 2 },
    ];
    expect(polygonSelfIntersects(bad)).toBe(false);
  });
});

describe("measureAngle", () => {
  it("returns 90° (π/2) for perpendicular rays", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 1, y: 0 };
    const p2: MeasurePoint = { x: 0, y: 1 };
    expect(measureAngle(vertex, p1, p2)).toBeCloseTo(Math.PI / 2);
  });

  it("returns 0 for coincident rays", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 5, y: 0 };
    const p2: MeasurePoint = { x: 10, y: 0 };
    expect(measureAngle(vertex, p1, p2)).toBe(0);
  });

  it("returns π for opposite rays", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 1, y: 0 };
    const p2: MeasurePoint = { x: -1, y: 0 };
    expect(measureAngle(vertex, p1, p2)).toBeCloseTo(Math.PI);
  });

  it("returns 60° for an equilateral triangle vertex", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 1, y: 0 };
    const p2: MeasurePoint = { x: 0.5, y: Math.sqrt(3) / 2 };
    expect(measureAngle(vertex, p1, p2)).toBeCloseTo(Math.PI / 3);
  });

  it("is unsigned (order of p1/p2 doesn't matter)", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 1, y: 0 };
    const p2: MeasurePoint = { x: 0, y: 1 };
    expect(measureAngle(vertex, p1, p2)).toBeCloseTo(
      measureAngle(vertex, p2, p1),
    );
  });

  it("returns 0 when vertex coincides with p1 or p2", () => {
    const v: MeasurePoint = { x: 5, y: 5 };
    expect(measureAngle(v, v, { x: 10, y: 10 })).toBe(0);
    expect(measureAngle(v, { x: 10, y: 10 }, v)).toBe(0);
  });

  it("handles 3D vectors", () => {
    const vertex: MeasurePoint = { x: 0, y: 0, z: 0 };
    const p1: MeasurePoint = { x: 1, y: 0, z: 0 };
    const p2: MeasurePoint = { x: 0, y: 0, z: 1 };
    expect(measureAngle(vertex, p1, p2)).toBeCloseTo(Math.PI / 2);
  });

  it("survives floating-point noise that would push acos out of domain", () => {
    // Nearly-coincident rays with tiny fp error in the inputs.
    const vertex: MeasurePoint = { x: 0, y: 0 };
    const p1: MeasurePoint = { x: 1, y: 0 };
    const p2: MeasurePoint = { x: 1 + 1e-16, y: 0 };
    const a = measureAngle(vertex, p1, p2);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeCloseTo(0);
  });

  it("returns 0 for non-finite coordinates", () => {
    const vertex: MeasurePoint = { x: 0, y: 0 };
    expect(measureAngle(vertex, { x: NaN, y: 0 }, { x: 0, y: 1 })).toBe(0);
  });
});

describe("toDegrees / toRadians", () => {
  it("toDegrees of standard angles", () => {
    expect(toDegrees(0)).toBe(0);
    expect(toDegrees(Math.PI)).toBeCloseTo(180);
    expect(toDegrees(Math.PI / 2)).toBeCloseTo(90);
    expect(toDegrees(Math.PI / 4)).toBeCloseTo(45);
  });

  it("toRadians of standard angles", () => {
    expect(toRadians(0)).toBe(0);
    expect(toRadians(180)).toBeCloseTo(Math.PI);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
    expect(toRadians(45)).toBeCloseTo(Math.PI / 4);
  });

  it("round-trip: toDegrees(toRadians(x)) === x", () => {
    for (const d of [0, 30, 45, 90, 135, 180, 270, 359.999]) {
      expect(toDegrees(toRadians(d))).toBeCloseTo(d);
    }
  });
});
