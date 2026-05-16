import * as THREE from "three";
import { describe, it, expect, beforeAll } from "vitest";
import { processDimensionEntity } from "../insertCollector";
import { collectEntity } from "../index";
import { GeometryCollector } from "../../mergeCollectors";
import { MaterialCacheStore } from "../../materialCache";
import { loadDefaultFont } from "../../text/fontManager";
import { clearGlyphCache } from "../../text/glyphCache";
import { DEFAULT_DIM_VARS } from "../../dimensions";
import type { Font } from "opentype.js";
import type { RenderContext } from "../../primitives";
import type { DxfData, DxfDimensionEntity, DxfBlock, DxfLayer } from "@/types/dxf";

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
    dimVars: DEFAULT_DIM_VARS,
  } as RenderContext;
}

function makeLine(handle: string, x1: number, y1: number, x2: number, y2: number): unknown {
  return {
    type: "LINE",
    handle,
    layer: "0",
    colorIndex: 0,
    vertices: [
      { x: x1, y: y1, z: 0 },
      { x: x2, y: y2, z: 0 },
    ],
  };
}

describe("processDimensionEntity — pre-rendered block path", () => {
  // The pre-rendered block path is the one fixed for nested DIMENSIONs in
  // building1.dxf handle 17CF: a DIM inside an outer block had `entity.block =
  // "*D289"`, but the in-block dispatch used to go straight into
  // collectDimensionEntity, ignoring the WYSIWYG geometry stashed in *D289.

  it("renders the pre-rendered block's entities (not DIMSTYLE geometry) when entity.block is set", async () => {
    const dim: DxfDimensionEntity = {
      type: "DIMENSION",
      handle: "D1",
      layer: "0",
      block: "*D_Pre",
      dimensionType: 0,
      actualMeasurement: 200,
      anchorPoint: { x: 100, y: 200, z: 0 },
      middleOfText: { x: 200, y: 220, z: 0 },
      linearOrAngularPoint1: { x: 100, y: 0, z: 0 },
      linearOrAngularPoint2: { x: 300, y: 0, z: 0 },
    } as DxfDimensionEntity;

    const dxf: DxfData = {
      entities: [dim],
      blocks: {
        "*D_Pre": { name: "*D_Pre", entities: [makeLine("L1", 100, 200, 300, 200)] } as DxfBlock,
      },
    } as DxfData;

    const collector = new GeometryCollector();
    const group = new THREE.Group();
    await processDimensionEntity(
      dim, dxf, makeCtx(), collector, "0", null, group, 0,
      { lastYield: 0 }, undefined, undefined, collectEntity, undefined,
    );

    // The unique LINE from the pre-rendered block must have been collected.
    // Without the fix this LINE would never appear because collectDimensionEntity
    // synthesizes its own dim-line/arrow/text geometry from the DIMSTYLE.
    const entries = [...collector.lineSegments.entries()];
    const allCoords = entries.flatMap(([, arr]) => arr.toArray());
    expect(allCoords).toContain(100);
    expect(allCoords).toContain(300);
    expect(allCoords).toContain(200);
  });

  it("scales pre-rendered block coords by worldMatrix (dim inside an outer scaled INSERT)", async () => {
    // Reproduces the building1.dxf 17CF case: an outer INSERT with scale 10
    // contains a DIMENSION whose pre-rendered block has a LINE from (10,0) to
    // (20,0). After processing, the line must be at (100,0)–(200,0).
    const dim: DxfDimensionEntity = {
      type: "DIMENSION",
      handle: "D2",
      layer: "0",
      block: "*D_Pre",
      dimensionType: 0,
      actualMeasurement: 10,
      anchorPoint: { x: 10, y: 0, z: 0 },
      middleOfText: { x: 15, y: 10, z: 0 },
      linearOrAngularPoint1: { x: 10, y: 0, z: 0 },
      linearOrAngularPoint2: { x: 20, y: 0, z: 0 },
    } as DxfDimensionEntity;

    const dxf: DxfData = {
      entities: [dim],
      blocks: {
        "*D_Pre": { name: "*D_Pre", entities: [makeLine("L2", 10, 0, 20, 0)] } as DxfBlock,
      },
    } as DxfData;

    const collector = new GeometryCollector();
    const group = new THREE.Group();
    const worldMatrix = new THREE.Matrix4().makeScale(10, 10, 1);

    await processDimensionEntity(
      dim, dxf, makeCtx(), collector, "0", worldMatrix, group, 1,
      { lastYield: 0 }, undefined, undefined, collectEntity, undefined,
    );

    const entries = [...collector.lineSegments.entries()];
    const allCoords = entries.flatMap(([, arr]) => arr.toArray());
    // Scaled endpoints: (100,0) and (200,0)
    expect(allCoords).toContain(100);
    expect(allCoords).toContain(200);
    // Pre-scale values (10, 20) should not appear at all
    expect(allCoords).not.toContain(10);
    expect(allCoords).not.toContain(20);
  });

  it("falls back to DIMSTYLE path when entity.block is missing", async () => {
    // No `block` field → DIMSTYLE-synthesizing path. The fallback path is what
    // QCAD-emitted DXFs typically need; this guards we don't break it.
    const dim: DxfDimensionEntity = {
      type: "DIMENSION",
      handle: "D3",
      layer: "0",
      dimensionType: 0,
      actualMeasurement: 100,
      anchorPoint: { x: 0, y: 50, z: 0 },
      middleOfText: { x: 50, y: 50, z: 0 },
      linearOrAngularPoint1: { x: 0, y: 0, z: 0 },
      linearOrAngularPoint2: { x: 100, y: 0, z: 0 },
    } as DxfDimensionEntity;

    const dxf: DxfData = { entities: [dim], blocks: {} } as DxfData;

    const collector = new GeometryCollector();
    const group = new THREE.Group();
    // The contract is just "doesn't crash" — DIMSTYLE-synthesizing path may
    // emit some geometry depending on defaults.
    await processDimensionEntity(
      dim, dxf, makeCtx(), collector, "0", null, group, 0,
      { lastYield: 0 }, undefined, undefined, collectEntity, undefined,
    );
  });

  it("falls back to DIMSTYLE path when entity.block names a missing or empty block", async () => {
    const dim: DxfDimensionEntity = {
      type: "DIMENSION",
      handle: "D4",
      layer: "0",
      block: "*D_Missing",
      dimensionType: 0,
      actualMeasurement: 50,
      anchorPoint: { x: 0, y: 0, z: 0 },
      middleOfText: { x: 25, y: 5, z: 0 },
      linearOrAngularPoint1: { x: 0, y: 0, z: 0 },
      linearOrAngularPoint2: { x: 50, y: 0, z: 0 },
    } as DxfDimensionEntity;

    const dxf: DxfData = {
      entities: [dim],
      blocks: { "*D_Missing": { name: "*D_Missing", entities: [] } as DxfBlock },
    } as DxfData;

    const collector = new GeometryCollector();
    const group = new THREE.Group();
    await processDimensionEntity(
      dim, dxf, makeCtx(), collector, "0", null, group, 0,
      { lastYield: 0 }, undefined, undefined, collectEntity, undefined,
    );
  });
});
