import { describe, it, expect } from "vitest";
import { findEntitiesByLayer } from "../findEntitiesByLayer";
import type {
  DxfData,
  DxfTextEntity,
  DxfLineEntity,
  DxfInsertEntity,
  DxfAttribEntity,
  DxfBlock,
} from "@/types/dxf";

describe("findEntitiesByLayer", () => {
  it("returns empty array for empty layer name", () => {
    const line: DxfLineEntity = { type: "LINE", handle: "A", layer: "WALLS",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(findEntitiesByLayer({ entities: [line] }, "")).toEqual([]);
    expect(findEntitiesByLayer({ entities: [line] }, "   ")).toEqual([]);
  });

  it("returns handles of entities on the given layer", () => {
    const a: DxfLineEntity = { type: "LINE", handle: "A", layer: "WALLS",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const b: DxfTextEntity = { type: "TEXT", handle: "B", layer: "WALLS", text: "x" };
    const c: DxfLineEntity = { type: "LINE", handle: "C", layer: "DOORS",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const dxf: DxfData = { entities: [a, b, c] };
    expect(findEntitiesByLayer(dxf, "WALLS").sort()).toEqual(["A", "B"]);
    expect(findEntitiesByLayer(dxf, "DOORS")).toEqual(["C"]);
  });

  it("is case-sensitive by default", () => {
    const a: DxfLineEntity = { type: "LINE", handle: "A", layer: "Walls",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(findEntitiesByLayer({ entities: [a] }, "WALLS")).toEqual([]);
    expect(findEntitiesByLayer({ entities: [a] }, "Walls")).toEqual(["A"]);
  });

  it("respects caseSensitive: false option", () => {
    const a: DxfLineEntity = { type: "LINE", handle: "A", layer: "Walls",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(findEntitiesByLayer({ entities: [a] }, "WALLS", { caseSensitive: false })).toEqual(["A"]);
  });

  it("ignores entities without a layer field", () => {
    const a: DxfLineEntity = { type: "LINE", handle: "A",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(findEntitiesByLayer({ entities: [a] }, "0")).toEqual([]);
  });

  it("matches ATTRIBs attached to INSERTs", () => {
    const att: DxfAttribEntity = { type: "ATTRIB", handle: "AT", layer: "TITLES",
      tag: "PARTNO", text: "X" };
    const insert: DxfInsertEntity = {
      type: "INSERT", handle: "I", name: "B", layer: "BLOCKS",
      position: { x: 0, y: 0 }, attribs: [att],
    };
    const dxf: DxfData = { entities: [insert] };
    expect(findEntitiesByLayer(dxf, "TITLES")).toEqual(["AT"]);
    expect(findEntitiesByLayer(dxf, "BLOCKS")).toEqual(["I"]);
  });

  it("matches entities inside blocks", () => {
    const blockText: DxfTextEntity = { type: "TEXT", handle: "BT", layer: "BLAYER", text: "x" };
    const block: DxfBlock = { entities: [blockText] };
    const dxf: DxfData = { entities: [], blocks: { BLOCK1: block } };
    expect(findEntitiesByLayer(dxf, "BLAYER")).toEqual(["BT"]);
  });
});
