import { describe, it, expect } from "vitest";
import { buildEntityIndex, extractEntityText } from "../entityIndex";
import type {
  DxfData,
  DxfLineEntity,
  DxfTextEntity,
  DxfInsertEntity,
  DxfAttribEntity,
  DxfDimensionEntity,
  DxfMLeaderEntity,
  DxfBlock,
} from "@/types/dxf";

describe("buildEntityIndex", () => {
  it("indexes top-level entities by handle", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      handle: "A1",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    };
    const text: DxfTextEntity = { type: "TEXT", handle: "B2", text: "hi" };
    const dxf: DxfData = { entities: [line, text] };

    const index = buildEntityIndex(dxf);

    expect(index.size).toBe(2);
    expect(index.get("A1")).toBe(line);
    expect(index.get("B2")).toBe(text);
  });

  it("converts numeric handles to uppercase hex strings", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      handle: 0xff,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    };
    const dxf: DxfData = { entities: [line] };

    const index = buildEntityIndex(dxf);

    expect(index.get("FF")).toBe(line);
  });

  it("indexes ATTRIBs attached to INSERT entities", () => {
    const attrib: DxfAttribEntity = { type: "ATTRIB", handle: "C3", text: "PART-001" };
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "D4",
      name: "BLOCK1",
      position: { x: 0, y: 0 },
      attribs: [attrib],
    };
    const dxf: DxfData = { entities: [insert] };

    const index = buildEntityIndex(dxf);

    expect(index.get("D4")).toBe(insert);
    expect(index.get("C3")).toBe(attrib);
  });

  it("indexes entities inside blocks", () => {
    const blockLine: DxfLineEntity = {
      type: "LINE",
      handle: "E5",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const block: DxfBlock = { entities: [blockLine] };
    const dxf: DxfData = { entities: [], blocks: { BLOCK1: block } };

    const index = buildEntityIndex(dxf);

    expect(index.get("E5")).toBe(blockLine);
  });

  it("ignores entities without handles", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const dxf: DxfData = { entities: [line] };

    expect(buildEntityIndex(dxf).size).toBe(0);
  });

  it("does not overwrite when same handle appears in top-level and a block", () => {
    const top: DxfLineEntity = {
      type: "LINE",
      handle: "F6",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const blockLine: DxfLineEntity = {
      type: "LINE",
      handle: "F6",
      vertices: [{ x: 5, y: 5 }, { x: 6, y: 6 }],
    };
    const dxf: DxfData = {
      entities: [top],
      blocks: { B: { entities: [blockLine] } },
    };

    const index = buildEntityIndex(dxf);

    expect(index.get("F6")).toBe(top);
  });
});

describe("extractEntityText", () => {
  it("returns text for TEXT and MTEXT", () => {
    const text: DxfTextEntity = { type: "TEXT", text: "hello" };
    const mtext: DxfTextEntity = { type: "MTEXT", text: "world" };
    expect(extractEntityText(text)).toBe("hello");
    expect(extractEntityText(mtext)).toBe("world");
  });

  it("falls back to ATTRIB tag if text is missing", () => {
    const attribWithText: DxfAttribEntity = { type: "ATTRIB", text: "VAL", tag: "TAG" };
    const attribTagOnly: DxfAttribEntity = { type: "ATTRIB", tag: "TAG" };
    expect(extractEntityText(attribWithText)).toBe("VAL");
    expect(extractEntityText(attribTagOnly)).toBe("TAG");
  });

  it("returns DIMENSION text override", () => {
    const dim: DxfDimensionEntity = { type: "DIMENSION", text: "<>" };
    expect(extractEntityText(dim)).toBe("<>");
  });

  it("returns MULTILEADER inline text", () => {
    const mleader: DxfMLeaderEntity = { type: "MULTILEADER", leaders: [], text: "Note A" };
    expect(extractEntityText(mleader)).toBe("Note A");
  });

  it("returns undefined for entities without text", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(extractEntityText(line)).toBeUndefined();
  });
});
