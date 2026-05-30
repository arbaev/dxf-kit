import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getEntitySnapPoints, findSnapPoint, type SnapType } from "../snapPoints";
import { buildPickingIndex } from "../pickingIndex";
import { buildEntityIndex } from "@/utils/entityIndex";
import type {
  DxfData,
  DxfLineEntity,
  DxfCircleEntity,
  DxfArcEntity,
  DxfEllipseEntity,
  DxfPolylineEntity,
  DxfSplineEntity,
  DxfSolidEntity,
  DxfPointEntity,
  DxfTextEntity,
  DxfInsertEntity,
  DxfBlock,
} from "@/types/dxf";

/** Collect snap-point types into a sorted array for order-independent assertions. */
function types(entity: Parameters<typeof getEntitySnapPoints>[0]): SnapType[] {
  return getEntitySnapPoints(entity, null)
    .map((s) => s.type)
    .sort();
}

/** Find a snap point of a given type with coordinates close to (x, y). */
function hasPoint(
  pts: ReturnType<typeof getEntitySnapPoints>,
  type: SnapType,
  x: number,
  y: number,
): boolean {
  return pts.some(
    (p) =>
      p.type === type &&
      Math.abs(p.point.x - x) < 1e-6 &&
      Math.abs(p.point.y - y) < 1e-6,
  );
}

describe("getEntitySnapPoints", () => {
  it("LINE → two endpoints and a midpoint", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    };
    const pts = getEntitySnapPoints(line, null);
    expect(pts).toHaveLength(3);
    expect(hasPoint(pts, "endpoint", 0, 0)).toBe(true);
    expect(hasPoint(pts, "endpoint", 10, 0)).toBe(true);
    expect(hasPoint(pts, "midpoint", 5, 0)).toBe(true);
  });

  it("CIRCLE → center and four quadrants (no endpoints)", () => {
    const circle: DxfCircleEntity = {
      type: "CIRCLE",
      center: { x: 5, y: 5 },
      radius: 3,
    };
    const pts = getEntitySnapPoints(circle, null);
    expect(hasPoint(pts, "center", 5, 5)).toBe(true);
    expect(hasPoint(pts, "quadrant", 8, 5)).toBe(true);
    expect(hasPoint(pts, "quadrant", 5, 8)).toBe(true);
    expect(hasPoint(pts, "quadrant", 2, 5)).toBe(true);
    expect(hasPoint(pts, "quadrant", 5, 2)).toBe(true);
    expect(pts.filter((p) => p.type === "quadrant")).toHaveLength(4);
    expect(pts.some((p) => p.type === "endpoint")).toBe(false);
  });

  it("ARC (0 → π/2) → center, two endpoints, midpoint, no interior quadrant", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
    };
    const pts = getEntitySnapPoints(arc, null);
    expect(hasPoint(pts, "center", 0, 0)).toBe(true);
    expect(hasPoint(pts, "endpoint", 10, 0)).toBe(true); // start
    expect(hasPoint(pts, "endpoint", 0, 10)).toBe(true); // end
    // midpoint at 45°
    const mid = 10 / Math.SQRT2;
    expect(hasPoint(pts, "midpoint", mid, mid)).toBe(true);
    // No cardinal lies strictly inside (0, π/2)
    expect(pts.some((p) => p.type === "quadrant")).toBe(false);
  });

  it("ARC (−π/4 → π/4) → quadrant at 0° (the crossed cardinal)", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: -Math.PI / 4,
      endAngle: Math.PI / 4,
    };
    const pts = getEntitySnapPoints(arc, null);
    expect(hasPoint(pts, "quadrant", 10, 0)).toBe(true);
  });

  it("ELLIPSE (full) → center and four axis tips", () => {
    const ellipse: DxfEllipseEntity = {
      type: "ELLIPSE",
      center: { x: 0, y: 0 },
      majorAxisEndPoint: { x: 4, y: 0 },
      axisRatio: 0.5,
      startAngle: 0,
      endAngle: Math.PI * 2,
    };
    const pts = getEntitySnapPoints(ellipse, null);
    expect(hasPoint(pts, "center", 0, 0)).toBe(true);
    expect(hasPoint(pts, "quadrant", 4, 0)).toBe(true); // major +
    expect(hasPoint(pts, "quadrant", -4, 0)).toBe(true); // major −
    expect(hasPoint(pts, "quadrant", 0, 2)).toBe(true); // minor + (ratio 0.5)
    expect(hasPoint(pts, "quadrant", 0, -2)).toBe(true); // minor −
  });

  it("POLYLINE → vertex endpoints + straight-segment midpoints; bulge segment has no midpoint", () => {
    const pl: DxfPolylineEntity = {
      type: "LWPOLYLINE",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0, bulge: 1 }, // segment 1→2 is an arc
        { x: 10, y: 10 },
      ],
    };
    const pts = getEntitySnapPoints(pl, null);
    expect(hasPoint(pts, "endpoint", 0, 0)).toBe(true);
    expect(hasPoint(pts, "endpoint", 10, 0)).toBe(true);
    expect(hasPoint(pts, "endpoint", 10, 10)).toBe(true);
    // straight segment 0→1 midpoint
    expect(hasPoint(pts, "midpoint", 5, 0)).toBe(true);
    // bulge segment 1→2 contributes no midpoint
    expect(hasPoint(pts, "midpoint", 10, 5)).toBe(false);
    expect(pts.filter((p) => p.type === "midpoint")).toHaveLength(1);
  });

  it("POLYLINE closed → adds closing-segment midpoint", () => {
    const pl: DxfPolylineEntity = {
      type: "LWPOLYLINE",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      shape: true, // closed polyline
    };
    const pts = getEntitySnapPoints(pl, null);
    // closing segment 3→0 midpoint
    expect(hasPoint(pts, "midpoint", 0, 5)).toBe(true);
    expect(pts.filter((p) => p.type === "midpoint")).toHaveLength(4);
  });

  it("SPLINE → endpoints from fit points when present", () => {
    const spline: DxfSplineEntity = {
      type: "SPLINE",
      fitPoints: [{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 12, y: 3 }],
      controlPoints: [{ x: 0, y: 0 }, { x: 6, y: 12 }, { x: 12, y: 3 }],
    };
    const pts = getEntitySnapPoints(spline, null);
    expect(pts).toHaveLength(2);
    expect(hasPoint(pts, "endpoint", 0, 0)).toBe(true);
    expect(hasPoint(pts, "endpoint", 12, 3)).toBe(true);
  });

  it("SOLID → four corner endpoints", () => {
    const solid: DxfSolidEntity = {
      type: "SOLID",
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 2 },
        { x: 2, y: 2 },
      ],
    };
    const pts = getEntitySnapPoints(solid, null);
    expect(pts.every((p) => p.type === "endpoint")).toBe(true);
    expect(pts).toHaveLength(4);
  });

  it("POINT → single node", () => {
    const point: DxfPointEntity = {
      type: "POINT",
      position: { x: 7, y: 8 },
    };
    const pts = getEntitySnapPoints(point, null);
    expect(pts).toHaveLength(1);
    expect(hasPoint(pts, "node", 7, 8)).toBe(true);
  });

  it("TEXT → no snap points", () => {
    const text: DxfTextEntity = {
      type: "TEXT",
      text: "hello",
      position: { x: 0, y: 0 },
      height: 2,
    };
    expect(getEntitySnapPoints(text, null)).toHaveLength(0);
  });

  it("applies the world matrix to every point", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    };
    const m = new THREE.Matrix4().makeTranslation(100, 50, 0);
    const pts = getEntitySnapPoints(line, m);
    expect(hasPoint(pts, "endpoint", 100, 50)).toBe(true);
    expect(hasPoint(pts, "endpoint", 110, 50)).toBe(true);
    expect(hasPoint(pts, "midpoint", 105, 50)).toBe(true);
  });

  it("(LINE types) returns exactly endpoint/midpoint", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    };
    expect(types(line)).toEqual(["endpoint", "endpoint", "midpoint"]);
  });
});

describe("findSnapPoint", () => {
  const line: DxfLineEntity = {
    type: "LINE",
    handle: "1",
    layer: "0",
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  };
  const circle: DxfCircleEntity = {
    type: "CIRCLE",
    handle: "2",
    layer: "0",
    center: { x: 50, y: 50 },
    radius: 5,
  };
  const dxf: DxfData = { entities: [line, circle] };
  const pickingIndex = buildPickingIndex(dxf);
  const entityIndex = buildEntityIndex(dxf);

  it("snaps to the nearest endpoint within tolerance", () => {
    const r = findSnapPoint(pickingIndex, entityIndex, { x: 0.3, y: 0.3 }, 1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe("endpoint");
    expect(r!.handle).toBe("1");
    expect(r!.point.x).toBeCloseTo(0);
    expect(r!.point.y).toBeCloseTo(0);
  });

  it("returns null when nothing is in range", () => {
    const r = findSnapPoint(pickingIndex, entityIndex, { x: 100, y: 100 }, 1);
    expect(r).toBeNull();
  });

  it("snaps to a circle center", () => {
    const r = findSnapPoint(pickingIndex, entityIndex, { x: 50.4, y: 50.2 }, 1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe("center");
    expect(r!.handle).toBe("2");
  });

  it("endpoint beats midpoint when both fall inside the aperture", () => {
    // Cursor near the midpoint (5,0) but the endpoint (10,0)/(0,0) are far;
    // place a short line so both an endpoint and the midpoint are within tol.
    const shortLine: DxfLineEntity = {
      type: "LINE",
      handle: "9",
      layer: "0",
      vertices: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    };
    const d: DxfData = { entities: [shortLine] };
    const pi = buildPickingIndex(d);
    const ei = buildEntityIndex(d);
    // (0.9, 0): distance to endpoint (0,0)=0.9, to midpoint (1,0)=0.1.
    // Midpoint is nearer, but endpoint has higher priority → endpoint wins.
    const r = findSnapPoint(pi, ei, { x: 0.9, y: 0 }, 2);
    expect(r!.type).toBe("endpoint");
  });

  it("respects the options.types filter", () => {
    const r = findSnapPoint(pickingIndex, entityIndex, { x: 50.4, y: 50.2 }, 1, {
      types: ["endpoint", "midpoint"],
    });
    // The only thing near (50.4,50.2) is the circle center → filtered out.
    expect(r).toBeNull();
  });

  it("honors the world matrix of INSERT instances", () => {
    // A block with one line, inserted at (100, 0).
    const block: DxfBlock = {
      name: "BLK",
      entities: [
        {
          type: "LINE",
          handle: "A",
          layer: "0",
          vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
        } as DxfLineEntity,
      ],
    } as DxfBlock;
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      layer: "0",
      name: "BLK",
      position: { x: 100, y: 0 },
    };
    const d: DxfData = { entities: [insert], blocks: { BLK: block } };
    const pi = buildPickingIndex(d);
    const ei = buildEntityIndex(d);
    // The line's endpoint should appear at (104, 0) in world coords.
    const r = findSnapPoint(pi, ei, { x: 104.1, y: 0 }, 1);
    expect(r).not.toBeNull();
    expect(r!.type).toBe("endpoint");
    expect(r!.point.x).toBeCloseTo(104);
  });

  it("ignores zero/negative tolerance", () => {
    expect(findSnapPoint(pickingIndex, entityIndex, { x: 0, y: 0 }, 0)).toBeNull();
    expect(findSnapPoint(pickingIndex, entityIndex, { x: 0, y: 0 }, -1)).toBeNull();
  });
});
