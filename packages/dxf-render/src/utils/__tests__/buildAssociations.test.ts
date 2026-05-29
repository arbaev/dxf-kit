import { describe, it, expect } from "vitest";
import { buildAssociations } from "../buildAssociations";
import type {
  DxfData,
  DxfLeaderEntity,
  DxfMLeaderEntity,
  DxfTextEntity,
  DxfInsertEntity,
  DxfAttribEntity,
  DxfDimensionEntity,
  DxfLineEntity,
} from "@/types/dxf";

describe("buildAssociations", () => {
  describe("MULTILEADER (mleader, inline)", () => {
    it("emits an mleader association when text is inline", () => {
      const mleader: DxfMLeaderEntity = {
        type: "MULTILEADER",
        handle: "A1",
        leaders: [],
        text: "Note 1",
      };
      const dxf: DxfData = { entities: [mleader] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: "mleader:A1",
        kind: "mleader",
        primary: "A1",
        members: ["A1"],
        text: "Note 1",
        source: "inline",
      });
    });

    it("skips MULTILEADER without text", () => {
      const mleader: DxfMLeaderEntity = {
        type: "MULTILEADER",
        handle: "A2",
        leaders: [],
      };
      const dxf: DxfData = { entities: [mleader] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });
  });

  describe("LEADER (handle-ref via 340)", () => {
    it("links LEADER to its annotation TEXT via annotationHandle", () => {
      const leader: DxfLeaderEntity = {
        type: "LEADER",
        handle: "B1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        annotationHandle: "B2",
      };
      const annotation: DxfTextEntity = {
        type: "MTEXT",
        handle: "B2",
        text: "Detail",
      };
      const dxf: DxfData = { entities: [leader, annotation] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: "leader:B1",
        kind: "leader",
        primary: "B1",
        members: ["B1", "B2"],
        text: "Detail",
        source: "handle-ref",
      });
    });

    it("skips LEADER without annotationHandle", () => {
      const leader: DxfLeaderEntity = {
        type: "LEADER",
        handle: "B3",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = { entities: [leader] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });

    it("skips LEADER when annotationHandle target is missing", () => {
      const leader: DxfLeaderEntity = {
        type: "LEADER",
        handle: "B4",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        annotationHandle: "DEAD",
      };
      const dxf: DxfData = { entities: [leader] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });
  });

  describe("INSERT + ATTRIB (block-attribs)", () => {
    it("groups INSERT with its ATTRIB members and concatenates texts", () => {
      const a1: DxfAttribEntity = { type: "ATTRIB", handle: "C1", text: "PART-001" };
      const a2: DxfAttribEntity = { type: "ATTRIB", handle: "C2", text: "Rev A" };
      const insert: DxfInsertEntity = {
        type: "INSERT",
        handle: "C0",
        name: "TITLE_BLOCK",
        position: { x: 0, y: 0 },
        attribs: [a1, a2],
      };
      const dxf: DxfData = { entities: [insert] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: "block-attribs:C0",
        kind: "block-attribs",
        primary: "C0",
        members: ["C0", "C1", "C2"],
        text: "PART-001 Rev A",
        source: "attribs",
      });
    });

    it("skips INSERT with no ATTRIBs", () => {
      const insert: DxfInsertEntity = {
        type: "INSERT",
        handle: "C3",
        name: "BLOCK1",
        position: { x: 0, y: 0 },
      };
      const dxf: DxfData = { entities: [insert] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });

    it("emits association even when ATTRIB has no text but has a tag", () => {
      const a1: DxfAttribEntity = { type: "ATTRIB", handle: "C5", tag: "PARTNO" };
      const insert: DxfInsertEntity = {
        type: "INSERT",
        handle: "C4",
        name: "BLOCK1",
        position: { x: 0, y: 0 },
        attribs: [a1],
      };
      const dxf: DxfData = { entities: [insert] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0].members).toEqual(["C4", "C5"]);
      expect(out[0].text).toBe("PARTNO");
    });
  });

  describe("DIMENSION (inline)", () => {
    it("emits a dimension association with text override", () => {
      const dim: DxfDimensionEntity = { type: "DIMENSION", handle: "D1", text: "100mm" };
      const dxf: DxfData = { entities: [dim] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: "dimension:D1",
        kind: "dimension",
        primary: "D1",
        members: ["D1"],
        text: "100mm",
        source: "inline",
      });
    });

    it("falls back to actualMeasurement when text is empty or '<>'", () => {
      const dim1: DxfDimensionEntity = {
        type: "DIMENSION", handle: "D2", text: "<>", actualMeasurement: 42.5,
      };
      const dim2: DxfDimensionEntity = {
        type: "DIMENSION", handle: "D3", actualMeasurement: 17,
      };
      const dxf: DxfData = { entities: [dim1, dim2] };

      const out = buildAssociations(dxf);

      expect(out.find((a) => a.primary === "D2")?.text).toBe("42.5");
      expect(out.find((a) => a.primary === "D3")?.text).toBe("17");
    });

    it("emits a dimension association with no text when nothing is available", () => {
      const dim: DxfDimensionEntity = { type: "DIMENSION", handle: "D4" };
      const dxf: DxfData = { entities: [dim] };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0].text).toBeUndefined();
    });
  });

  describe("ignores entities without handles or unrelated types", () => {
    it("skips entities with no handle", () => {
      const dim: DxfDimensionEntity = { type: "DIMENSION", text: "100" };
      const dxf: DxfData = { entities: [dim] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });

    it("returns empty array for unrelated entity types", () => {
      const line: DxfLineEntity = {
        type: "LINE",
        handle: "E1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = { entities: [line] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });
  });

  it("normalizes numeric handles to uppercase hex", () => {
    const mleader: DxfMLeaderEntity = {
      type: "MULTILEADER",
      handle: 0xab,
      leaders: [],
      text: "x",
    };
    const dxf: DxfData = { entities: [mleader] };

    const out = buildAssociations(dxf);

    expect(out[0].primary).toBe("AB");
    expect(out[0].id).toBe("mleader:AB");
  });

  describe("ACAD_GROUP (group, group-dict)", () => {
    it("emits a group association for a GROUP with resolvable members", () => {
      const line1: DxfLineEntity = {
        type: "LINE",
        handle: "F1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const line2: DxfLineEntity = {
        type: "LINE",
        handle: "F2",
        vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      };
      const dxf: DxfData = {
        entities: [line1, line2],
        objects: {
          groups: {
            G1: {
              handle: "G1",
              name: "Wing A",
              isUnnamed: false,
              isSelectable: true,
              entityHandles: ["F1", "F2"],
            },
          },
        },
      };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: "group:G1",
        kind: "group",
        primary: "G1",
        members: ["F1", "F2"],
        text: "Wing A",
        source: "group-dict",
      });
    });

    it("filters out member handles that don't resolve to any entity", () => {
      const line: DxfLineEntity = {
        type: "LINE",
        handle: "F1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = {
        entities: [line],
        objects: {
          groups: {
            G1: {
              handle: "G1",
              isUnnamed: false,
              isSelectable: true,
              entityHandles: ["F1", "DEAD", "GONE"],
            },
          },
        },
      };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0].members).toEqual(["F1"]);
    });

    it("skips groups whose members all fail to resolve", () => {
      const dxf: DxfData = {
        entities: [],
        objects: {
          groups: {
            G1: {
              handle: "G1",
              isUnnamed: false,
              isSelectable: true,
              entityHandles: ["DEAD", "GONE"],
            },
          },
        },
      };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });

    it("emits a group association with undefined text for anonymous groups without a name", () => {
      const line: DxfLineEntity = {
        type: "LINE",
        handle: "F1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = {
        entities: [line],
        objects: {
          groups: {
            G1: {
              handle: "G1",
              isUnnamed: true,
              isSelectable: true,
              entityHandles: ["F1"],
            },
          },
        },
      };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0].text).toBeUndefined();
    });

    it("coexists with other association kinds without disturbing them", () => {
      const mleader: DxfMLeaderEntity = {
        type: "MULTILEADER",
        handle: "A1",
        leaders: [],
        text: "Note",
      };
      const line: DxfLineEntity = {
        type: "LINE",
        handle: "F1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = {
        entities: [mleader, line],
        objects: {
          groups: {
            G1: {
              handle: "G1",
              name: "Mixed",
              isUnnamed: false,
              isSelectable: true,
              entityHandles: ["F1"],
            },
          },
        },
      };

      const out = buildAssociations(dxf);
      const kinds = out.map((a) => a.kind).sort();
      expect(kinds).toEqual(["group", "mleader"]);
    });

    it("emits no group associations when dxf.objects.groups is missing", () => {
      const line: DxfLineEntity = {
        type: "LINE",
        handle: "F1",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = { entities: [line] };

      expect(buildAssociations(dxf)).toHaveLength(0);
    });

    it("resolves member handles inside blocks", () => {
      // buildEntityIndex covers entities inside block definitions, so a group
      // member that lives in a block should still be resolvable.
      const inBlock: DxfLineEntity = {
        type: "LINE",
        handle: "F2",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      };
      const dxf: DxfData = {
        entities: [],
        blocks: {
          MY_BLOCK: {
            name: "MY_BLOCK",
            basePoint: { x: 0, y: 0 },
            entities: [inBlock],
          },
        },
        objects: {
          groups: {
            G1: {
              handle: "G1",
              isUnnamed: false,
              isSelectable: true,
              entityHandles: ["F2"],
            },
          },
        },
      };

      const out = buildAssociations(dxf);

      expect(out).toHaveLength(1);
      expect(out[0].members).toEqual(["F2"]);
    });
  });
});
