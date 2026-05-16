import { describe, it, expect, beforeAll } from "vitest";
import { collectAttdefEntity } from "../textCollector";
import { GeometryCollector } from "../../mergeCollectors";
import { MaterialCacheStore } from "../../materialCache";
import { loadDefaultFont } from "../../text/fontManager";
import { clearGlyphCache } from "../../text/glyphCache";
import type { Font } from "opentype.js";
import type { RenderContext } from "../../primitives";
import type { DxfAttdefEntity, DxfLayer } from "@/types/dxf";

let font: Font;

beforeAll(() => {
  clearGlyphCache();
  font = loadDefaultFont();
});

function makeCtx(): RenderContext {
  return {
    layers: {
      "0": { name: "0", visible: true, frozen: false, colorIndex: 7, color: 0xffffff } as DxfLayer,
    },
    lineTypes: {},
    globalLtScale: 1,
    headerLtScale: 1,
    materials: new MaterialCacheStore(),
    font,
    defaultTextHeight: 2.5,
  } as RenderContext;
}

/** Compute the X bounding box of all triangulated text-glyph vertices stored in the overlay mesh buffer. */
function meshXBounds(collector: GeometryCollector): { xMin: number; xMax: number } {
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const arr of collector.overlayVertices.values()) {
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr.at(i);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
    }
  }
  return { xMin, xMax };
}

describe("ATTDEF FIT/ALIGNED — building1.dxf _AXISO axis markers", () => {
  // Reproduces the bug from building1.dxf handle 473: ATTRIB inside the _AXISO
  // block (axis-marker circles around handle 46D) had horizontalJustification=5
  // (FIT) with startPoint and endPoint straddling the circle centre. Before the
  // fix, renderAttribs / collectAttdefEntity used endPoint as the position and
  // dropped the second alignment point, so the text rendered LEFT-aligned at the
  // right edge of the circle and the digit "3"/"A" hung outside the marker.

  it("FIT: text is centered between startPoint and endPoint, not anchored at endPoint", () => {
    const entity: DxfAttdefEntity = {
      type: "ATTDEF",
      handle: "T1",
      layer: "0",
      text: "3",
      tag: "A",
      startPoint: { x: -50, y: 0, z: 0 },
      endPoint: { x: 50, y: 0, z: 0 },
      textHeight: 20,
      horizontalJustification: 5, // FIT
      scale: 1,
      textStyle: "STANDARD",
    } as DxfAttdefEntity;

    const collector = new GeometryCollector();
    collectAttdefEntity(entity, makeCtx(), collector, "0");

    const b = meshXBounds(collector);
    expect(b.xMin).not.toBe(Infinity);
    // Text should span the FIT range [-50, 50], i.e. roughly symmetric around 0.
    expect(b.xMin).toBeGreaterThanOrEqual(-55);
    expect(b.xMax).toBeLessThanOrEqual(55);
    const center = (b.xMin + b.xMax) / 2;
    expect(Math.abs(center)).toBeLessThan(5);
  });

  it("ALIGNED: text is centered between startPoint and endPoint", () => {
    const entity: DxfAttdefEntity = {
      type: "ATTDEF",
      handle: "T2",
      layer: "0",
      text: "3",
      tag: "A",
      startPoint: { x: -30, y: 0, z: 0 },
      endPoint: { x: 30, y: 0, z: 0 },
      textHeight: 20,
      horizontalJustification: 3, // ALIGNED
      scale: 1,
      textStyle: "STANDARD",
    } as DxfAttdefEntity;

    const collector = new GeometryCollector();
    collectAttdefEntity(entity, makeCtx(), collector, "0");

    const b = meshXBounds(collector);
    expect(b.xMin).not.toBe(Infinity);
    const center = (b.xMin + b.xMax) / 2;
    expect(Math.abs(center)).toBeLessThan(5);
    expect(b.xMin).toBeGreaterThanOrEqual(-35);
    expect(b.xMax).toBeLessThanOrEqual(35);
  });

  it("RIGHT (non-FIT/ALIGNED): keeps existing behavior — text anchored at endPoint", () => {
    const entity: DxfAttdefEntity = {
      type: "ATTDEF",
      handle: "T3",
      layer: "0",
      text: "3",
      tag: "A",
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 100, y: 0, z: 0 },
      textHeight: 20,
      horizontalJustification: 2, // RIGHT
      scale: 1,
      textStyle: "STANDARD",
    } as DxfAttdefEntity;

    const collector = new GeometryCollector();
    collectAttdefEntity(entity, makeCtx(), collector, "0");

    const b = meshXBounds(collector);
    expect(b.xMin).not.toBe(Infinity);
    // RIGHT anchors text so the rightmost glyph edge sits at endPoint.x = 100.
    expect(b.xMax).toBeGreaterThan(95);
    expect(b.xMax).toBeLessThan(105);
  });
});
