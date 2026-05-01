import { describe, it, expect } from "vitest";
import { findEntitiesByType } from "../findEntitiesByType";
import type {
  DxfData,
  DxfTextEntity,
  DxfLineEntity,
  DxfCircleEntity,
  DxfInsertEntity,
  DxfAttribEntity,
  DxfBlock,
} from "@/types/dxf";

describe("findEntitiesByType", () => {
  it("returns empty array for empty type", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "A", text: "x" };
    expect(findEntitiesByType({ entities: [t] }, "")).toEqual([]);
    expect(findEntitiesByType({ entities: [t] }, [])).toEqual([]);
    expect(findEntitiesByType({ entities: [t] }, ["", "  "])).toEqual([]);
  });

  it("matches a single type", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "T1", text: "x" };
    const l: DxfLineEntity = { type: "LINE", handle: "L1",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const dxf: DxfData = { entities: [t, l] };
    expect(findEntitiesByType(dxf, "TEXT")).toEqual(["T1"]);
    expect(findEntitiesByType(dxf, "LINE")).toEqual(["L1"]);
  });

  it("matches an array of types", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "T1", text: "x" };
    const m: DxfTextEntity = { type: "MTEXT", handle: "M1", text: "y" };
    const l: DxfLineEntity = { type: "LINE", handle: "L1",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const dxf: DxfData = { entities: [t, m, l] };
    expect(findEntitiesByType(dxf, ["TEXT", "MTEXT"]).sort()).toEqual(["M1", "T1"]);
  });

  it("normalizes input case to uppercase", () => {
    const c: DxfCircleEntity = { type: "CIRCLE", handle: "C1",
      center: { x: 0, y: 0 }, radius: 1 };
    expect(findEntitiesByType({ entities: [c] }, "circle")).toEqual(["C1"]);
    expect(findEntitiesByType({ entities: [c] }, ["Circle"])).toEqual(["C1"]);
  });

  it("returns empty array when no entity matches", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "T1", text: "x" };
    expect(findEntitiesByType({ entities: [t] }, "LINE")).toEqual([]);
  });

  it("matches ATTRIBs attached to INSERTs", () => {
    const att: DxfAttribEntity = { type: "ATTRIB", handle: "AT", tag: "T", text: "v" };
    const insert: DxfInsertEntity = {
      type: "INSERT", handle: "I", name: "B",
      position: { x: 0, y: 0 }, attribs: [att],
    };
    const dxf: DxfData = { entities: [insert] };
    expect(findEntitiesByType(dxf, "ATTRIB")).toEqual(["AT"]);
    expect(findEntitiesByType(dxf, "INSERT")).toEqual(["I"]);
  });

  it("matches entities inside blocks", () => {
    const bl: DxfLineEntity = { type: "LINE", handle: "BL",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const block: DxfBlock = { entities: [bl] };
    const dxf: DxfData = { entities: [], blocks: { B1: block } };
    expect(findEntitiesByType(dxf, "LINE")).toEqual(["BL"]);
  });

  it("deduplicates types in input", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "T1", text: "x" };
    expect(findEntitiesByType({ entities: [t] }, ["TEXT", "TEXT", "text"])).toEqual(["T1"]);
  });
});
