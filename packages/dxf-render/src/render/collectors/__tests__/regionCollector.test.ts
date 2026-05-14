import { describe, it, expect } from "vitest";
import { collectRegion } from "../regionCollector";
import { MaterialCacheStore } from "../../materialCache";
import type { CollectEntityParams } from "../../blockTemplateCache";
import type { DxfRegionEntity, DxfLayer } from "@/types/dxf";
import type { RenderContext } from "../../primitives";

class MockCollector {
  lineFromPoints: { layer: string; color: string; count: number }[] = [];
  lineSegments: { layer: string; color: string; len: number }[] = [];

  addLineFromPoints(layer: string, color: string, pts: { x: number; y: number; z: number }[]): void {
    this.lineFromPoints.push({ layer, color, count: pts.length });
  }
  addLineSegments(layer: string, color: string, data: number[]): void {
    this.lineSegments.push({ layer, color, len: data.length });
  }
  addLinetypeDots(): void { /* not used in these tests */ }
}

function makeCtx(): RenderContext {
  return {
    layers: {
      Profil: { name: "Profil", visible: true, frozen: false, colorIndex: 3, color: 0x00ff00 } as DxfLayer,
    },
    lineTypes: {},
    globalLtScale: 1,
    headerLtScale: 1,
    materials: new MaterialCacheStore(),
    defaultTextHeight: 2.5,
  } as RenderContext;
}

function makeParams(entity: DxfRegionEntity, collector: MockCollector): CollectEntityParams {
  return {
    entity,
    colorCtx: makeCtx(),
    collector: collector as unknown as CollectEntityParams["collector"],
    layer: entity.layer ?? "0",
  };
}

describe("collectRegion", () => {
  it("returns false for non-REGION entity", () => {
    const collector = new MockCollector();
    const params = makeParams({ type: "HATCH" } as unknown as DxfRegionEntity, collector);
    expect(collectRegion(params)).toBe(false);
  });

  it("returns false when contourBoundary is missing", () => {
    const collector = new MockCollector();
    const region: DxfRegionEntity = { type: "REGION", layer: "Profil" } as DxfRegionEntity;
    expect(collectRegion(makeParams(region, collector))).toBe(false);
    expect(collector.lineFromPoints).toHaveLength(0);
  });

  it("emits a line from boundary edges", () => {
    const collector = new MockCollector();
    const region: DxfRegionEntity = {
      type: "REGION",
      layer: "Profil",
      handle: "151",
      contourBoundary: [{
        edges: [
          { type: "line", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
          { type: "line", start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
        ],
      }],
    } as DxfRegionEntity;

    expect(collectRegion(makeParams(region, collector))).toBe(true);
    expect(collector.lineFromPoints).toHaveLength(1);
    expect(collector.lineFromPoints[0].layer).toBe("Profil");
    expect(collector.lineFromPoints[0].count).toBe(3); // start, end1=start2, end2
  });

  it("emits one line per boundary path", () => {
    const collector = new MockCollector();
    const region: DxfRegionEntity = {
      type: "REGION",
      layer: "Profil",
      handle: "151",
      contourBoundary: [
        { edges: [{ type: "line", start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }] },
        { edges: [{ type: "line", start: { x: 5, y: 5 }, end: { x: 6, y: 5 } }] },
      ],
    } as DxfRegionEntity;

    expect(collectRegion(makeParams(region, collector))).toBe(true);
    expect(collector.lineFromPoints).toHaveLength(2);
  });
});
