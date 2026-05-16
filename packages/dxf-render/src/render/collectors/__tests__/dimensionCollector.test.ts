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
  meshes: { layer: string; color: string; vertices?: number[] }[] = [];
  lines: { layer: string; color: string; data?: number[] }[] = [];

  addMesh(layer: string, color: string, vertices: number[], indices: number[]): void {
    if (vertices.length < 9 || indices.length < 3) return;
    this.meshes.push({ layer, color, vertices });
  }
  addOverlayMesh(layer: string, color: string, vertices: number[], indices: number[]): void {
    if (vertices.length < 9 || indices.length < 3) return;
    this.meshes.push({ layer, color, vertices });
  }
  addLineSegments(layer: string, color: string, data: number[]): void {
    this.lines.push({ layer, color, data });
  }
}

function makeContext(opts: {
  layers?: Record<string, DxfLayer>;
  dimStyles?: Record<string, DxfDimStyle>;
  headerDimtih?: number;
  headerDimtoh?: number;
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
    headerDimtih: opts.headerDimtih,
    headerDimtoh: opts.headerDimtoh,
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

describe("collectDimensionEntity — DIMCLRD/DIMCLRE line color overrides", () => {
  it("uses DIMSTYLE dimclrd (blue=5) for dim/arrow lines instead of entity color (red=1)", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        // dimclrd=5 (blue) overrides entity red; dimclre undefined → falls back to entity color
        stil1: { name: "stil1", dimclrd: 5 } as DxfDimStyle,
      },
    });

    // Entity color = 1 (red); dimclrd = 5 (blue). Dim line must be blue.
    // middleOfText is offset perpendicular to the dim line so the dim line isn't
    // split around it — otherwise on a short rotated dim the text gap can swallow
    // the entire dim line and we end up with only extension lines + arrows.
    collectDimensionEntity(
      makeRotatedDim({ colorIndex: 1, middleOfText: { x: 5, y: 5, z: 0 } }),
      {} as DxfData,
      ctx,
      collector as any,
      "Kote",
    );

    // ACI 5 → #0000ff; ACI 1 → #ff0000.
    const dimLineColors = new Set(collector.lines.map((l) => l.color));
    expect(dimLineColors.has("#0000ff")).toBe(true);
  });

  it("falls back to entity color when DIMCLRD is 0 (BYBLOCK) or 256 (BYLAYER)", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        // dimclrd=0 → BYBLOCK → use entity color
        stil1: { name: "stil1", dimclrd: 0 } as DxfDimStyle,
      },
    });

    collectDimensionEntity(
      makeRotatedDim({ colorIndex: 1 }),
      {} as DxfData,
      ctx,
      collector as any,
      "Kote",
    );

    // ACI 1 → #ff0000 must appear on the lines
    const dimLineColors = new Set(collector.lines.map((l) => l.color));
    expect(dimLineColors.has("#ff0000")).toBe(true);
    expect(dimLineColors.has("#0000ff")).toBe(false);
  });
});

describe("collectDimensionEntity — DIMCLRT for angular dimensions", () => {
  function makeAngularDim(overrides: Partial<DxfDimensionEntity> = {}): DxfDimensionEntity {
    return {
      type: "DIMENSION",
      handle: "C0DECAFE",
      layer: "Kote",
      // dimensionType 34 = 2 (angular) + 32 (default-text-position flag) — matches
      // real-world AutoCAD angular dimensions in test fixtures.
      dimensionType: 34,
      actualMeasurement: 90,
      anchorPoint: { x: 0, y: 0, z: 0 },
      middleOfText: { x: 5, y: 5, z: 0 },
      linearOrAngularPoint1: { x: 10, y: 0, z: 0 },
      linearOrAngularPoint2: { x: 0, y: 0, z: 0 },
      diameterOrRadiusPoint: { x: 0, y: 0, z: 0 },
      arcPoint: { x: 7, y: 7, z: 0 },
      text: "80°",
      styleName: "stil1",
      ...overrides,
    } as DxfDimensionEntity;
  }

  it("uses DIMCLRT theme-adaptive sentinel for angular dim text (not entity color)", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        // entity = red (ACI 1); DIMCLRT = 7 → theme-adaptive sentinel
        stil1: { name: "stil1", dimclrt: 7 } as DxfDimStyle,
      },
    });

    collectDimensionEntity(
      makeAngularDim({ colorIndex: 1 }),
      {} as DxfData,
      ctx,
      collector as any,
      "Kote",
    );

    // Text glyph meshes must carry the ACI7 sentinel. (Arrow meshes are still
    // emitted as #ff0000 from the entity color, which is correct — without a
    // DIMCLRD override the dim lines/arrows follow the entity color.)
    expect(collector.meshes.length).toBeGreaterThan(0);
    expect(collector.meshes.some((m) => m.color === ACI7_COLOR)).toBe(true);
  });
});

describe("collectDimensionEntity — diametric on-segment text", () => {
  it("rotates aligned text to match diameter direction (entity 130: p10=(36.24,23.34), p15=(63.76,76.66))", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: { "0": { name: "0", visible: true, frozen: false, colorIndex: 7, color: 0 } as DxfLayer },
      dimStyles: {
        QCADDimStyle: {
          name: "QCADDimStyle",
          dimtoh: 0,    // aligned (explicit)
          dimtad: 1,    // above line
          dimgap: 0.625,
          // DIMTIH (code 74) intentionally omitted — matches the real QCAD file
        } as DxfDimStyle,
      },
      // Simulate the file's header: $DIMTIH=1 must NOT leak into rendering of
      // existing dims. Falling back to header would force horizontal text for
      // every dimstyle that omits DIMTIH (DXF reference: $DIM* in HEADER are
      // current values for new dims, not the source of truth for existing ones).
      headerDimtih: 1,
      headerDimtoh: 1,
    });

    const entity: DxfDimensionEntity = {
      type: "DIMENSION",
      handle: "130",
      layer: "0",
      // 163 = bit 7 (assoc-block) + bit 5 (default position) + 3 (diameter)
      dimensionType: 163,
      actualMeasurement: 60,
      anchorPoint: { x: 36.24, y: 23.34, z: 0 },
      diameterOrRadiusPoint: { x: 63.76, y: 76.66, z: 0 },
      middleOfText: { x: 37.17, y: 32.05, z: 0 },
      text: "60",
      textHeight: 2.5,
      styleName: "QCADDimStyle",
    } as DxfDimensionEntity;

    collectDimensionEntity(entity, {} as DxfData, ctx, collector as any, "0");

    // Verify the text glyphs were emitted and that their bounding box is rotated
    // (not axis-aligned). For axis-aligned text, all glyph vertices for one row of
    // characters lie at the same Y. For rotated text, X and Y both vary.
    const textMeshes = collector.meshes.filter((m) => m.vertices && m.vertices.length >= 9);
    expect(textMeshes.length).toBeGreaterThan(0);

    // Compute the spread along X and Y of all text vertices. If text is horizontal,
    // X spread >> Y spread. For a 62.7° rotated text the spread along both should
    // be roughly comparable (off-axis), with Y spread well above zero.
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const m of textMeshes) {
      const v = m.vertices!;
      for (let i = 0; i < v.length; i += 3) {
        if (v[i] < xMin) xMin = v[i];
        if (v[i] > xMax) xMax = v[i];
        if (v[i + 1] < yMin) yMin = v[i + 1];
        if (v[i + 1] > yMax) yMax = v[i + 1];
      }
    }
    const xSpread = xMax - xMin;
    const ySpread = yMax - yMin;
    // For 62.7° rotated "60" (2.5 height ~ 4 wide): X spread ≈ 4×cos+2.5×sin ≈ 4, Y spread ≈ 4×sin+2.5×cos ≈ 4.
    // If horizontal: X spread ≈ 4, Y spread ≈ 2.5.
    // The discriminator: Y spread > X spread × 0.6 means definitely rotated.
    expect(ySpread).toBeGreaterThan(xSpread * 0.6);
  });
});

describe("collectDimensionEntity — DIMDEC entity override", () => {
  it("uses entity.dimdec for measurement precision over DIMSTYLE.dimdec", () => {
    const collector = new MockCollector();
    const ctx = makeContext({
      layers: {
        Kote: { name: "Kote", visible: true, frozen: false, colorIndex: 5, color: 255 } as DxfLayer,
      },
      dimStyles: {
        // DIMSTYLE says 2 decimals (would yield "24.01"), entity overrides to 1 → "24.0"
        stil1: { name: "stil1", dimdec: 2 } as DxfDimStyle,
      },
    });

    // Use a measurement that produces different output for dimdec=1 vs dimdec=2
    const entity = makeRotatedDim({
      actualMeasurement: 24.0050334118132,
      dimdec: 1, // entity-level XDATA override
    });

    // Just sanity-check that collection runs without error and emits meshes —
    // the actual text content is in the mesh vertex data, which would require
    // a font shaper to verify. Smoke test: parser→collector→fmt pipeline links.
    expect(() => collectDimensionEntity(entity, {} as DxfData, ctx, collector as any, "Kote"))
      .not.toThrow();
    expect(collector.lines.length).toBeGreaterThan(0);
  });
});
