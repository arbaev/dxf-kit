import { describe, it, expect, beforeAll } from "vitest";
import { collectDimensionEntity } from "../dimensionCollector";
import { MaterialCacheStore } from "../../materialCache";
import { ACI7_COLOR } from "@/utils/colorResolver";
import { loadDefaultFont } from "../../text/fontManager";
import { clearGlyphCache } from "../../text/glyphCache";
import { DEFAULT_DIM_VARS } from "../../dimensions";
import type { Font } from "opentype.js";
import type { DxfDimensionEntity, DxfData, DxfLayer, DxfDimStyle } from "@/types/dxf";
import type { RenderContext } from "../../primitives";

let font: Font;

class MockCollector {
  meshes: { layer: string; color: string }[] = [];
  lines: { layer: string; color: string }[] = [];

  addMesh(layer: string, color: string, vertices: number[], indices: number[]): void {
    if (vertices.length < 9 || indices.length < 3) return;
    this.meshes.push({ layer, color });
  }
  addOverlayMesh(layer: string, color: string, vertices: number[], indices: number[]): void {
    if (vertices.length < 9 || indices.length < 3) return;
    this.meshes.push({ layer, color });
  }
  addLineSegments(layer: string, color: string, _data: number[]): void {
    this.lines.push({ layer, color });
  }
}

function makeContext(opts: {
  layers?: Record<string, DxfLayer>;
  dimStyles?: Record<string, DxfDimStyle>;
} = {}): RenderContext {
  return {
    layers: opts.layers ?? {},
    lineTypes: {},
    globalLtScale: 1,
    headerLtScale: 1,
    materials: new MaterialCacheStore(),
    font,
    defaultTextHeight: 2.5,
    dimVars: DEFAULT_DIM_VARS,
    dimStyles: opts.dimStyles,
  } as RenderContext;
}

function makeRotatedDim(overrides: Partial<DxfDimensionEntity> = {}): DxfDimensionEntity {
  return {
    type: "DIMENSION",
    handle: "DEADBEEF",
    layer: "Kote",
    dimensionType: 0,
    actualMeasurement: 60.5,
    anchorPoint: { x: 0, y: 0, z: 0 },
    middleOfText: { x: 0, y: 5, z: 0 },
    linearOrAngularPoint1: { x: -5, y: 10, z: 0 },
    linearOrAngularPoint2: { x: -5, y: 0, z: 0 },
    angle: 90,
    styleName: "stil1",
    ...overrides,
  } as DxfDimensionEntity;
}

beforeAll(() => {
  clearGlyphCache();
  font = loadDefaultFont();
});

describe("collectDimensionEntity — DIMCLRT theme-adaptive", () => {
  it("emits ACI7_COLOR sentinel for the text when DIMSTYLE has DIMCLRT=7", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        stil1: { name: "stil1", dimclrt: 7 } as DxfDimStyle,
      },
    });

    collectDimensionEntity(makeRotatedDim(), {} as DxfData, ctx, collector as any, "Kote");

    // Text overlay mesh must carry the theme-adaptive sentinel, not a literal "#ffffff"
    expect(collector.meshes.length).toBeGreaterThan(0);
    expect(collector.meshes.some((m) => m.color === ACI7_COLOR)).toBe(true);
    expect(collector.meshes.every((m) => m.color !== "#ffffff")).toBe(true);
  });

  it("emits gray sentinel for DIMCLRT=250", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        stil1: { name: "stil1", dimclrt: 250 } as DxfDimStyle,
      },
    });

    collectDimensionEntity(makeRotatedDim(), {} as DxfData, ctx, collector as any, "Kote");

    expect(collector.meshes.some((m) => m.color === "\0ACI250")).toBe(true);
  });

  it("emits literal hex for chromatic DIMCLRT (e.g. red = 1)", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        stil1: { name: "stil1", dimclrt: 1 } as DxfDimStyle,
      },
    });

    collectDimensionEntity(makeRotatedDim(), {} as DxfData, ctx, collector as any, "Kote");

    // ACI 1 is red — literal hex, not a sentinel
    expect(collector.meshes.some((m) => /^#[0-9a-f]{6}$/.test(m.color))).toBe(true);
    expect(collector.meshes.every((m) => m.color.charCodeAt(0) !== 0 || m.color !== "\0ACI7")).toBe(true);
  });
});
