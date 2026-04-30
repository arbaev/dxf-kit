import { describe, it, expect } from "vitest";
import { findEntitiesByText } from "../findEntitiesByText";
import type {
  DxfData,
  DxfTextEntity,
  DxfAttribEntity,
  DxfInsertEntity,
  DxfDimensionEntity,
  DxfMLeaderEntity,
  DxfLineEntity,
  DxfBlock,
} from "@/types/dxf";

describe("findEntitiesByText", () => {
  it("returns empty array for empty query", () => {
    const text: DxfTextEntity = { type: "TEXT", handle: "A", text: "anything" };
    expect(findEntitiesByText({ entities: [text] }, "")).toEqual([]);
    expect(findEntitiesByText({ entities: [text] }, "   ")).toEqual([]);
  });

  it("returns empty array when no entities match", () => {
    const text: DxfTextEntity = { type: "TEXT", handle: "A", text: "alpha" };
    expect(findEntitiesByText({ entities: [text] }, "beta")).toEqual([]);
  });

  it("substring search across TEXT, MTEXT, DIMENSION, MULTILEADER", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "T1", text: "ROOM 101" };
    const m: DxfTextEntity = { type: "MTEXT", handle: "M1", text: "ROOM 102 — kitchen" };
    const d: DxfDimensionEntity = { type: "DIMENSION", handle: "D1", text: "room dim" };
    const ml: DxfMLeaderEntity = { type: "MULTILEADER", handle: "L1", leaders: [], text: "see ROOM" };
    const dxf: DxfData = { entities: [t, m, d, ml] };

    const handles = findEntitiesByText(dxf, "room");
    expect(handles.sort()).toEqual(["D1", "L1", "M1", "T1"]);
  });

  it("is case-insensitive by default", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "A", text: "Hello World" };
    expect(findEntitiesByText({ entities: [t] }, "hello")).toEqual(["A"]);
    expect(findEntitiesByText({ entities: [t] }, "WORLD")).toEqual(["A"]);
  });

  it("respects caseSensitive option", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "A", text: "Hello World" };
    expect(findEntitiesByText({ entities: [t] }, "hello", { caseSensitive: true })).toEqual([]);
    expect(findEntitiesByText({ entities: [t] }, "Hello", { caseSensitive: true })).toEqual(["A"]);
  });

  it("supports regex matching", () => {
    const t1: DxfTextEntity = { type: "TEXT", handle: "T1", text: "PART-001" };
    const t2: DxfTextEntity = { type: "TEXT", handle: "T2", text: "PART-042" };
    const t3: DxfTextEntity = { type: "TEXT", handle: "T3", text: "OTHER" };
    const dxf: DxfData = { entities: [t1, t2, t3] };

    const handles = findEntitiesByText(dxf, "^PART-\\d+$", { regex: true });
    expect(handles.sort()).toEqual(["T1", "T2"]);
  });

  it("regex respects caseSensitive option", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "A", text: "Hello" };
    expect(findEntitiesByText({ entities: [t] }, "hello", { regex: true })).toEqual(["A"]);
    expect(findEntitiesByText({ entities: [t] }, "hello", { regex: true, caseSensitive: true })).toEqual([]);
  });

  it("matches ATTRIB text inside INSERT", () => {
    const a1: DxfAttribEntity = { type: "ATTRIB", handle: "A1", text: "PART-001", tag: "PARTNO" };
    const a2: DxfAttribEntity = { type: "ATTRIB", handle: "A2", text: "Rev A", tag: "REV" };
    const insert: DxfInsertEntity = {
      type: "INSERT", handle: "I1", name: "TITLE_BLOCK",
      position: { x: 0, y: 0 },
      attribs: [a1, a2],
    };
    const dxf: DxfData = { entities: [insert] };

    expect(findEntitiesByText(dxf, "PART-001")).toEqual(["A1"]);
    expect(findEntitiesByText(dxf, "rev")).toEqual(["A2"]);
  });

  it("falls back to ATTRIB tag when text is missing", () => {
    const a: DxfAttribEntity = { type: "ATTRIB", handle: "A", tag: "PARTNO" };
    const insert: DxfInsertEntity = {
      type: "INSERT", handle: "I", name: "B", position: { x: 0, y: 0 },
      attribs: [a],
    };
    expect(findEntitiesByText({ entities: [insert] }, "partno")).toEqual(["A"]);
  });

  it("matches entities inside blocks", () => {
    const blockText: DxfTextEntity = { type: "TEXT", handle: "BT", text: "block text" };
    const block: DxfBlock = { entities: [blockText] };
    const dxf: DxfData = { entities: [], blocks: { BLOCK1: block } };
    expect(findEntitiesByText(dxf, "block")).toEqual(["BT"]);
  });

  it("ignores entities without text content", () => {
    const line: DxfLineEntity = {
      type: "LINE", handle: "L1",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    };
    expect(findEntitiesByText({ entities: [line] }, "anything")).toEqual([]);
  });

  it("does not interpret regex special characters in substring mode", () => {
    const t: DxfTextEntity = { type: "TEXT", handle: "A", text: "value (mm)" };
    expect(findEntitiesByText({ entities: [t] }, "(mm)")).toEqual(["A"]);
  });
});
