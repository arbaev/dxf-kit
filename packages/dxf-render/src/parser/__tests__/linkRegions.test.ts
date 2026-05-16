import { describe, it, expect } from "vitest";
import { linkRegionsToHatchBoundaries } from "../linkRegions";
import type { DxfEntity, DxfHatchEntity, DxfRegionEntity } from "@/types/dxf";

function makeHatch(handle: string, sourceHandles: string[]): DxfHatchEntity {
  return {
    type: "HATCH",
    handle,
    patternName: "ANSI31",
    solid: false,
    boundaryPaths: [{
      edges: [{ type: "line", start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }],
      sourceObjectHandles: sourceHandles,
    }],
    extrusionDirection: { x: 0, y: 0, z: 1 },
  } as DxfHatchEntity;
}

function makeRegion(handle: string, layer = "Profil"): DxfRegionEntity {
  return { type: "REGION", handle, layer } as DxfRegionEntity;
}

describe("linkRegionsToHatchBoundaries", () => {
  it("attaches HATCH boundary to a REGION referenced as source object", () => {
    const region = makeRegion("151");
    const hatch = makeHatch("150", ["151"]);
    const entities: DxfEntity[] = [region, hatch];

    linkRegionsToHatchBoundaries(entities);

    expect(region.contourBoundary).toBeDefined();
    expect(region.contourBoundary).toHaveLength(1);
    expect(region.contourBoundary![0].edges).toHaveLength(1);
    expect(region.contourExtrusionDirection).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("matches REGION handle case-insensitively", () => {
    const region = makeRegion("abc");
    const hatch = makeHatch("150", ["ABC"]);
    linkRegionsToHatchBoundaries([region, hatch]);
    expect(region.contourBoundary).toBeDefined();
  });

  it("leaves REGION untouched when no HATCH references it", () => {
    const region = makeRegion("151");
    const hatch = makeHatch("150", ["999"]);
    linkRegionsToHatchBoundaries([region, hatch]);
    expect(region.contourBoundary).toBeUndefined();
    expect(region.contourExtrusionDirection).toBeUndefined();
  });

  it("filters boundary paths so REGION only gets paths that list its handle", () => {
    const region = makeRegion("151");
    const hatch: DxfHatchEntity = {
      type: "HATCH",
      handle: "150",
      patternName: "ANSI31",
      solid: false,
      boundaryPaths: [
        {
          edges: [{ type: "line", start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
          sourceObjectHandles: ["151"],
        },
        {
          edges: [{ type: "line", start: { x: 5, y: 5 }, end: { x: 6, y: 5 } }],
          sourceObjectHandles: ["OTHER"],
        },
      ],
    } as DxfHatchEntity;

    linkRegionsToHatchBoundaries([region, hatch]);

    expect(region.contourBoundary).toHaveLength(1);
    expect(region.contourBoundary![0].edges![0]).toMatchObject({
      type: "line",
      end: { x: 1, y: 0 },
    });
  });

  it("works when REGION is parsed before the HATCH that references it", () => {
    // Parser order is file order; REGION may appear earlier.
    const region = makeRegion("151");
    const hatch = makeHatch("150", ["151"]);
    linkRegionsToHatchBoundaries([region, hatch]);
    expect(region.contourBoundary).toBeDefined();
  });

  it("is a no-op on empty array", () => {
    expect(() => linkRegionsToHatchBoundaries([])).not.toThrow();
  });

  it("is a no-op when there are no HATCH entities", () => {
    const region = makeRegion("151");
    linkRegionsToHatchBoundaries([region]);
    expect(region.contourBoundary).toBeUndefined();
  });
});
