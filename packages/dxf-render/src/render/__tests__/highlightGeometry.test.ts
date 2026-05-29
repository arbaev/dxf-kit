import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { buildHighlightGeometry } from "../highlightGeometry";
import type {
  DxfLineEntity,
  DxfCircleEntity,
  DxfArcEntity,
  DxfEllipseEntity,
  DxfPolylineEntity,
  DxfSplineEntity,
  DxfSolidEntity,
  Dxf3DFaceEntity,
  DxfHatchEntity,
  DxfRegionEntity,
  DxfMlineEntity,
  DxfLeaderEntity,
  DxfMLeaderEntity,
  DxfTextEntity,
  DxfMTextEntity,
  DxfAttribEntity,
  DxfDimensionEntity,
  DxfXlineEntity,
  DxfPointEntity,
  DxfInsertEntity,
} from "@/types/dxf";

describe("buildHighlightGeometry", () => {
  describe("LINE", () => {
    it("returns two-point polyline", () => {
      const e: DxfLineEntity = {
        type: "LINE",
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 5 }],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(false);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0]).toHaveLength(2);
      expect(g.polylines[0][0].x).toBe(0);
      expect(g.polylines[0][1].x).toBe(10);
    });

    it("applies worldMatrix to vertices", () => {
      const e: DxfLineEntity = {
        type: "LINE",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      };
      const m = new THREE.Matrix4().makeTranslation(5, 10, 0);
      const g = buildHighlightGeometry(e, m);
      expect(g.polylines[0][0].x).toBe(5);
      expect(g.polylines[0][0].y).toBe(10);
      expect(g.polylines[0][1].x).toBe(6);
      expect(g.polylines[0][1].y).toBe(10);
    });
  });

  describe("CIRCLE", () => {
    it("returns a closed circle polyline", () => {
      const e: DxfCircleEntity = {
        type: "CIRCLE",
        center: { x: 0, y: 0 },
        radius: 5,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(false);
      expect(g.polylines).toHaveLength(1);
      // 64 segments produces 65 points (closed at first==last)
      expect(g.polylines[0].length).toBeGreaterThan(60);
      // All points lie on the radius
      for (const p of g.polylines[0]) {
        expect(Math.hypot(p.x, p.y)).toBeCloseTo(5, 4);
      }
    });
  });

  describe("ARC", () => {
    it("returns an arc polyline starting at startAngle and ending at endAngle", () => {
      const e: DxfArcEntity = {
        type: "ARC",
        center: { x: 0, y: 0 },
        radius: 1,
        startAngle: 0,
        endAngle: Math.PI / 2,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      const pts = g.polylines[0];
      expect(pts[0].x).toBeCloseTo(1, 4);
      expect(pts[0].y).toBeCloseTo(0, 4);
      expect(pts[pts.length - 1].x).toBeCloseTo(0, 4);
      expect(pts[pts.length - 1].y).toBeCloseTo(1, 4);
    });
  });

  describe("ELLIPSE", () => {
    it("returns a full-ellipse polyline", () => {
      const e: DxfEllipseEntity = {
        type: "ELLIPSE",
        center: { x: 0, y: 0 },
        majorAxisEndPoint: { x: 4, y: 0 },
        axisRatio: 0.5,
        startAngle: 0,
        endAngle: 2 * Math.PI,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0].length).toBeGreaterThan(60);
    });
  });

  describe("POLYLINE / LWPOLYLINE", () => {
    it("traces straight vertex chain", () => {
      const e: DxfPolylineEntity = {
        type: "LWPOLYLINE",
        vertices: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0].length).toBe(3);
    });

    it("expands bulge arcs into multi-point segments", () => {
      const e: DxfPolylineEntity = {
        type: "LWPOLYLINE",
        vertices: [
          { x: 0, y: 0, bulge: 1 }, // semicircle to next vertex
          { x: 2, y: 0 },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      // Bulge=1 (180°) tesselates into more than 2 points
      expect(g.polylines[0].length).toBeGreaterThan(2);
    });
  });

  describe("SPLINE", () => {
    it("tessellates fit points when no control points are present", () => {
      const e: DxfSplineEntity = {
        type: "SPLINE",
        fitPoints: [
          { x: 0, y: 0 },
          { x: 1, y: 2 },
          { x: 3, y: 1 },
          { x: 4, y: 3 },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0].length).toBeGreaterThan(4);
    });
  });

  describe("SOLID", () => {
    it("returns a closed quadrilateral outline", () => {
      const e: DxfSolidEntity = {
        type: "SOLID",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      // 4 corners + closing point
      expect(g.polylines[0]).toHaveLength(5);
      const first = g.polylines[0][0];
      const last = g.polylines[0][4];
      expect(last.x).toBe(first.x);
      expect(last.y).toBe(first.y);
    });
  });

  describe("3DFACE", () => {
    it("returns a closed contour", () => {
      const e: Dxf3DFaceEntity = {
        type: "3DFACE",
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0]).toHaveLength(5);
    });
  });

  describe("HATCH", () => {
    it("traces boundary paths as polylines", () => {
      const e: DxfHatchEntity = {
        type: "HATCH",
        patternName: "SOLID",
        solidFill: true,
        associativity: 0,
        boundaryPaths: [
          {
            pathTypeFlag: 1,
            polylineVertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            sourceObjectHandles: [],
          },
        ],
        hatchStyle: 0,
        patternType: 0,
        definitionLines: [],
        seedPoints: [],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0].length).toBeGreaterThan(2);
    });

    it("returns one polyline per boundary path", () => {
      const e: DxfHatchEntity = {
        type: "HATCH",
        patternName: "SOLID",
        solidFill: true,
        associativity: 0,
        boundaryPaths: [
          {
            pathTypeFlag: 1,
            polylineVertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
            sourceObjectHandles: [],
          },
          {
            pathTypeFlag: 1,
            polylineVertices: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 5, y: 6 }],
            sourceObjectHandles: [],
          },
        ],
        hatchStyle: 0,
        patternType: 0,
        definitionLines: [],
        seedPoints: [],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(2);
    });
  });

  describe("REGION", () => {
    it("traces contourBoundary borrowed from HATCH", () => {
      const e: DxfRegionEntity = {
        type: "REGION",
        contourBoundary: [
          {
            pathTypeFlag: 1,
            polylineVertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
            sourceObjectHandles: [],
          },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
    });

    it("falls back when no contourBoundary present", () => {
      const e: DxfRegionEntity = { type: "REGION" };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });
  });

  describe("MLINE", () => {
    it("traces centerline through vertices", () => {
      const e: DxfMlineEntity = {
        type: "MLINE",
        scale: 1,
        justification: 0,
        flags: 0,
        numVertices: 3,
        numElements: 2,
        vertices: [
          { x: 0, y: 0, z: 0, direction: { x: 1, y: 0, z: 0 }, miter: { x: 0, y: 1, z: 0 }, elementParams: [] },
          { x: 5, y: 0, z: 0, direction: { x: 1, y: 0, z: 0 }, miter: { x: 0, y: 1, z: 0 }, elementParams: [] },
          { x: 5, y: 5, z: 0, direction: { x: 0, y: 1, z: 0 }, miter: { x: -1, y: 0, z: 0 }, elementParams: [] },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0]).toHaveLength(3);
    });
  });

  describe("LEADER", () => {
    it("traces vertex chain", () => {
      const e: DxfLeaderEntity = {
        type: "LEADER",
        vertices: [{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 }],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(1);
      expect(g.polylines[0]).toHaveLength(3);
    });
  });

  describe("MULTILEADER", () => {
    it("emits one polyline per leader line", () => {
      const e: DxfMLeaderEntity = {
        type: "MULTILEADER",
        leaders: [
          {
            lines: [
              { vertices: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
              { vertices: [{ x: 5, y: 5 }, { x: 10, y: 5 }] },
            ],
          },
        ],
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.polylines).toHaveLength(2);
    });
  });

  describe("fallback types", () => {
    it("TEXT falls back to bbox", () => {
      const e: DxfTextEntity = {
        type: "TEXT",
        text: "hello",
        position: { x: 0, y: 0 },
        height: 1,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
      expect(g.polylines).toEqual([]);
    });

    it("MTEXT falls back to bbox", () => {
      const e: DxfMTextEntity = {
        type: "MTEXT",
        text: "x",
        position: { x: 0, y: 0 },
        textHeight: 1,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });

    it("ATTRIB falls back to bbox", () => {
      const e: DxfAttribEntity = {
        type: "ATTRIB",
        tag: "TAG",
        text: "value",
        startPoint: { x: 0, y: 0 },
        textHeight: 1,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });

    it("DIMENSION falls back to bbox", () => {
      const e: DxfDimensionEntity = {
        type: "DIMENSION",
        anchorPoint: { x: 0, y: 0 },
        styleName: "STANDARD",
        dimensionType: 0,
        attachmentPoint: 5,
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });

    it("POINT falls back to bbox", () => {
      const e: DxfPointEntity = {
        type: "POINT",
        position: { x: 0, y: 0 },
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });

    it("INSERT falls back (caller expands via childIds)", () => {
      const e: DxfInsertEntity = {
        type: "INSERT",
        name: "BLK",
        position: { x: 0, y: 0 },
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(true);
    });
  });

  describe("skipped types", () => {
    it("XLINE returns empty polylines and no fallback", () => {
      const e: DxfXlineEntity = {
        type: "XLINE",
        basePoint: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(false);
      expect(g.polylines).toEqual([]);
    });

    it("RAY returns empty polylines and no fallback", () => {
      const e: DxfXlineEntity = {
        type: "RAY",
        basePoint: { x: 0, y: 0 },
        direction: { x: 1, y: 0 },
      };
      const g = buildHighlightGeometry(e, null);
      expect(g.fallbackToBBox).toBe(false);
      expect(g.polylines).toEqual([]);
    });
  });
});
