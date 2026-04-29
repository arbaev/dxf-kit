import { describe, it, expect } from "vitest";
import { buildPickingIndex } from "../pickingIndex";
import type {
  DxfData,
  DxfLineEntity,
  DxfCircleEntity,
  DxfArcEntity,
  DxfPointEntity,
  DxfPolylineEntity,
  DxfInsertEntity,
  DxfAttribEntity,
  DxfTextEntity,
  DxfXlineEntity,
  DxfBlock,
} from "@/types/dxf";

describe("buildPickingIndex", () => {
  it("builds entries for top-level LINE/CIRCLE/POINT entities", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      handle: "1",
      layer: "WALLS",
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 5 }],
    };
    const circle: DxfCircleEntity = {
      type: "CIRCLE",
      handle: "2",
      layer: "DOORS",
      center: { x: 5, y: 5 },
      radius: 3,
    };
    const point: DxfPointEntity = {
      type: "POINT",
      handle: "3",
      layer: "MARKS",
      position: { x: 1, y: 1 },
    };

    const dxf: DxfData = { entities: [line, circle, point] };
    const index = buildPickingIndex(dxf);

    expect(index.entries).toHaveLength(3);
    expect(index.byHandle.get("1")?.[0].type).toBe("LINE");
    expect(index.byHandle.get("1")?.[0].layer).toBe("WALLS");
    expect(index.byId.get("1")?.type).toBe("LINE");
    const lineBox = index.byHandle.get("1")![0].bbox;
    expect(lineBox.min.x).toBe(0);
    expect(lineBox.max.x).toBe(10);

    const circleBox = index.byHandle.get("2")![0].bbox;
    expect(circleBox.min.x).toBe(2);
    expect(circleBox.max.x).toBe(8);
  });

  // Note: DxfArcEntity stores angles in RADIANS (parser converts code 50/51).
  it("computes tight ARC bbox for a single quadrant (0 → π/2)", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      handle: "1",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI / 2,
    };
    const dxf: DxfData = { entities: [arc] };
    const box = buildPickingIndex(dxf).byHandle.get("1")![0].bbox;
    // Arc from (5,0) to (0,5) — bbox is exactly that quadrant
    expect(box.min.x).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.x).toBeCloseTo(5, 5);
    expect(box.max.y).toBeCloseTo(5, 5);
  });

  it("computes tight ARC bbox for top-left quadrant (π/2 → π)", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      handle: "1",
      center: { x: 90, y: 10 },
      radius: 80,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
    };
    const dxf: DxfData = { entities: [arc] };
    const box = buildPickingIndex(dxf).byHandle.get("1")![0].bbox;
    // Arc from (90,90) to (10,10) — should NOT extend past x=90 or below y=10
    expect(box.min.x).toBeCloseTo(10, 5);
    expect(box.max.x).toBeCloseTo(90, 5);
    expect(box.min.y).toBeCloseTo(10, 5);
    expect(box.max.y).toBeCloseTo(90, 5);
  });

  it("includes cardinal points crossed by the arc (3π/2 → π/2 via 0)", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      handle: "1",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: (3 * Math.PI) / 2,
      endAngle: Math.PI / 2,
    };
    const dxf: DxfData = { entities: [arc] };
    const box = buildPickingIndex(dxf).byHandle.get("1")![0].bbox;
    // Arc sweeps 270→0→90: includes endpoints (0,-5),(0,5) AND the 0° cardinal (5,0)
    expect(box.max.x).toBeCloseTo(5, 5);  // 0 cardinal crossed
    expect(box.min.x).toBeCloseTo(0, 5);  // π NOT crossed
    expect(box.min.y).toBeCloseTo(-5, 5);
    expect(box.max.y).toBeCloseTo(5, 5);
  });

  it("treats start==end as a full circle", () => {
    const arc: DxfArcEntity = {
      type: "ARC",
      handle: "1",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: 0,
    };
    const dxf: DxfData = { entities: [arc] };
    const box = buildPickingIndex(dxf).byHandle.get("1")![0].bbox;
    expect(box.min.x).toBeCloseTo(-5, 5);
    expect(box.max.x).toBeCloseTo(5, 5);
    expect(box.min.y).toBeCloseTo(-5, 5);
    expect(box.max.y).toBeCloseTo(5, 5);
  });

  it("computes LWPOLYLINE bbox from vertices", () => {
    const poly: DxfPolylineEntity = {
      type: "LWPOLYLINE",
      handle: "1",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    };
    const dxf: DxfData = { entities: [poly] };
    const box = buildPickingIndex(dxf).byHandle.get("1")![0].bbox;
    expect(box.min.x).toBe(0);
    expect(box.min.y).toBe(0);
    expect(box.max.x).toBe(10);
    expect(box.max.y).toBe(10);
  });

  it("skips XLINE entities (infinite — not pickable by bbox)", () => {
    const xline: DxfXlineEntity = {
      type: "XLINE",
      handle: "1",
      basePoint: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
    };
    const dxf: DxfData = { entities: [xline] };
    expect(buildPickingIndex(dxf).entries).toHaveLength(0);
  });

  it("skips paper-space and invisible entities", () => {
    const e1: DxfLineEntity = {
      type: "LINE",
      handle: "1",
      inPaperSpace: true,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const e2: DxfLineEntity = {
      type: "LINE",
      handle: "2",
      visible: false,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const dxf: DxfData = { entities: [e1, e2] };
    expect(buildPickingIndex(dxf).entries).toHaveLength(0);
  });

  it("expands INSERTs into per-child entries plus an aggregate INSERT entry", () => {
    const blockLine: DxfLineEntity = {
      type: "LINE",
      handle: "B1",
      vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    };
    const block: DxfBlock = { entities: [blockLine] };
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      name: "BLOCK1",
      position: { x: 100, y: 200 },
    };
    const dxf: DxfData = { entities: [insert], blocks: { BLOCK1: block } };

    const index = buildPickingIndex(dxf);

    // One child entry + one aggregate INSERT entry
    expect(index.entries).toHaveLength(2);
    const childBox = index.byHandle.get("B1")![0].bbox;
    expect(childBox.min.x).toBe(100);
    expect(childBox.max.x).toBe(104);
    expect(childBox.min.y).toBe(200);

    const insertBox = index.byHandle.get("I1")![0].bbox;
    expect(insertBox.min.x).toBe(100);
    expect(insertBox.max.x).toBe(104);
  });

  it("indexes ATTRIB entries on INSERT", () => {
    const attrib: DxfAttribEntity = {
      type: "ATTRIB",
      handle: "A1",
      text: "X",
      startPoint: { x: 50, y: 50 },
      textHeight: 2,
    };
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      name: "B",
      position: { x: 0, y: 0 },
      attribs: [attrib],
    };
    const dxf: DxfData = { entities: [insert], blocks: { B: { entities: [] } } };

    const index = buildPickingIndex(dxf);

    expect(index.byHandle.get("A1")?.[0].type).toBe("ATTRIB");
  });

  it("inherits layer from INSERT for child entities on layer 0", () => {
    const child: DxfLineEntity = {
      type: "LINE",
      handle: "C1",
      layer: "0",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      name: "B",
      layer: "WALLS",
      position: { x: 0, y: 0 },
    };
    const dxf: DxfData = { entities: [insert], blocks: { B: { entities: [child] } } };

    const index = buildPickingIndex(dxf);

    expect(index.byHandle.get("C1")?.[0].layer).toBe("WALLS");
  });

  it("uses unique pick ids for array INSERT instances while keeping the same DXF handle", () => {
    const blockLine: DxfLineEntity = {
      type: "LINE",
      handle: "B1",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const insert: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      name: "B",
      position: { x: 0, y: 0 },
      columnCount: 2,
      rowCount: 1,
      columnSpacing: 10,
    };
    const dxf: DxfData = { entities: [insert], blocks: { B: { entities: [blockLine] } } };

    const index = buildPickingIndex(dxf);
    const aggregateIds = index.entries
      .filter((e) => e.type === "INSERT")
      .map((e) => e.id);
    expect(aggregateIds).toContain("I1:0:0");
    expect(aggregateIds).toContain("I1:0:1");
    // DXF handles stay clean — both aggregates share handle "I1"
    expect(index.byHandle.get("I1")).toHaveLength(2);
  });

  it("emits a separate entry per INSERT instance when the same block is reused", () => {
    const blockLine: DxfLineEntity = {
      type: "LINE",
      handle: "B1",
      vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    };
    const block: DxfBlock = { entities: [blockLine] };
    const insert1: DxfInsertEntity = {
      type: "INSERT",
      handle: "I1",
      name: "B",
      position: { x: 0, y: 0 },
    };
    const insert2: DxfInsertEntity = {
      type: "INSERT",
      handle: "I2",
      name: "B",
      position: { x: 100, y: 100 },
    };
    const dxf: DxfData = { entities: [insert1, insert2], blocks: { B: block } };

    const index = buildPickingIndex(dxf);

    // The block's child line "B1" is emitted twice — once per INSERT instance —
    // with distinct pick ids but the same DXF handle.
    const b1Entries = index.byHandle.get("B1") ?? [];
    expect(b1Entries).toHaveLength(2);
    const b1Ids = b1Entries.map((e) => e.id).sort();
    expect(b1Ids).toEqual(["B1@I1", "B1@I2"]);

    // Each pick id resolves to a different bbox (offset by INSERT position)
    const e1 = index.byId.get("B1@I1")!;
    const e2 = index.byId.get("B1@I2")!;
    expect(e1.bbox.min.x).toBe(0);
    expect(e2.bbox.min.x).toBe(100);
  });

  it("uses TEXT endPoint (code 11) as anchor when halign/valign is set", () => {
    const text: DxfTextEntity = {
      type: "TEXT",
      handle: "T1",
      // code 10 (insertion) — ignored when alignment point is present
      startPoint: { x: -627, y: -495 },
      // code 11 (alignment) — center of "FLOOR PLAN" since halign=Center, valign=Middle
      endPoint: { x: -282, y: -449 },
      text: "FLOOR PLAN",
      height: 91.6,
      xScale: 0.85,
      halign: 1,  // Center
      valign: 2,  // Middle
    };
    const dxf: DxfData = { entities: [text] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // Centered on (-282, -449), not on (-627, -495)
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    expect(cx).toBeCloseTo(-282, 0);
    expect(cy).toBeCloseTo(-449, 0);
  });

  it("respects TEXT xScale (width factor, code 41)", () => {
    const wide: DxfTextEntity = {
      type: "TEXT",
      handle: "W",
      startPoint: { x: 0, y: 0 },
      text: "ABC",
      height: 10,
      xScale: 2,
    };
    const narrow: DxfTextEntity = {
      type: "TEXT",
      handle: "N",
      startPoint: { x: 100, y: 0 },
      text: "ABC",
      height: 10,
      xScale: 0.5,
    };
    const dxf: DxfData = { entities: [wide, narrow] };
    const wideBox = buildPickingIndex(dxf).byHandle.get("W")![0].bbox;
    const narrowBox = buildPickingIndex(dxf).byHandle.get("N")![0].bbox;
    // text-only width (excluding padding 2 * h*0.7 = 14):
    //   wide   = 3 * h * 0.7 * 2.0 = 42
    //   narrow = 3 * h * 0.7 * 0.5 = 10.5
    // Total bbox width includes padding: wide=56, narrow=24.5
    expect(wideBox.max.x - wideBox.min.x).toBeCloseTo(56, 1);
    expect(narrowBox.max.x - narrowBox.min.x).toBeCloseTo(24.5, 1);
  });

  it("handles TEXT entities with bbox derived from height/length", () => {
    const text: DxfTextEntity = {
      type: "TEXT",
      handle: "T1",
      position: { x: 0, y: 0 },
      text: "ABC",
      height: 2,
    };
    const dxf: DxfData = { entities: [text] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // TEXT default valign=Baseline → text sits ABOVE anchor
    expect(box.min.y).toBe(0);
    expect(box.max.y).toBe(2);
    // h*0.7 padding on the left
    expect(box.min.x).toBeCloseTo(-1.4, 1);
  });

  it("places MTEXT bbox below anchor for TopLeft attachmentPoint (1)", () => {
    const mtext: DxfTextEntity = {
      type: "MTEXT",
      handle: "T1",
      position: { x: 0, y: 100 },
      text: "ISO TEXT",
      height: 20,
      width: 121.66,
      attachmentPoint: 1,
    };
    const dxf: DxfData = { entities: [mtext] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // TopLeft anchor → text extends DOWN (one line at h=20 * 5/3 ≈ 33.33)
    expect(box.max.y).toBe(100);
    expect(box.min.y).toBeCloseTo(100 - 20 * (5 / 3), 1);
    expect(box.min.x).toBeCloseTo(-14, 1);
    expect(box.max.x).toBeCloseTo(126, 1);
  });

  it("places MTEXT bbox above anchor for BottomLeft attachmentPoint (7)", () => {
    const mtext: DxfTextEntity = {
      type: "MTEXT",
      handle: "T1",
      position: { x: 0, y: 100 },
      text: "UNICODE TEXT",
      height: 30,
      width: 282.5,
      attachmentPoint: 7,
    };
    const dxf: DxfData = { entities: [mtext] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // BottomLeft anchor → text extends UP from y=100 (one line h=30 * 5/3 = 50)
    expect(box.min.y).toBe(100);
    expect(box.max.y).toBeCloseTo(150, 1);
    expect(box.min.x).toBeCloseTo(-21, 1);
    // 12 chars * 30 * 0.7 = 252 < width 282.5 → use 252, plus 21 padding = 273
    expect(box.max.x).toBeCloseTo(273, 1);
  });

  it("strips MTEXT format codes and accounts for inline \\H height multipliers", () => {
    const mtext: DxfTextEntity = {
      type: "MTEXT",
      handle: "T1",
      position: { x: 0, y: 0 },
      // 3 lines, inline \H2x; doubles the height multiplier from line 1 onward.
      // After stripping: ["Title", "subtitle", "end"] (longest = "subtitle" = 8)
      text: "\\C1;\\H2x;Title\\Psubtitle\\P{end}",
      height: 10,
      attachmentPoint: 7,
    };
    const dxf: DxfData = { entities: [mtext] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // \H2x; activates from line 1 → all 3 lines doubled: 3 * (10 * 2 * 5/3) = 100
    expect(box.max.y).toBeCloseTo(100, 1);
    // Width also doubled: longest "subtitle" (8) * 10 * 0.7 * 2 = 112, plus 7 padding each side = 126
    expect(box.max.x - box.min.x).toBeCloseTo(126, 1);
  });

  it("limits MTEXT width by reference rectangle and accounts for wrapping in height", () => {
    const mtext: DxfTextEntity = {
      type: "MTEXT",
      handle: "T1",
      position: { x: 0, y: 0 },
      text: "very long line that gets wrapped",
      height: 10,
      width: 50,
      attachmentPoint: 7,
    };
    const dxf: DxfData = { entities: [mtext] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // charEstimate = 32 * 10 * 0.7 = 224, ref width = 50 caps width to 50, plus 7 padding each side = 64
    expect(box.max.x - box.min.x).toBeCloseTo(64, 1);
    // ceil(224 * 1.3 / 50) = ceil(5.824) = 6 wrapped rows, each h * 5/3 ≈ 16.67 → 100
    expect(box.max.y - box.min.y).toBeCloseTo(100, 1);
  });

  it("centers MTEXT bbox horizontally for MiddleCenter attachmentPoint (5)", () => {
    const mtext: DxfTextEntity = {
      type: "MTEXT",
      handle: "T1",
      position: { x: 100, y: 50 },
      text: "AB",
      height: 10,
      attachmentPoint: 5,
    };
    const dxf: DxfData = { entities: [mtext] };
    const box = buildPickingIndex(dxf).byHandle.get("T1")![0].bbox;
    // Width=2*10*0.7=14 → spans 100±7, plus 7 padding each side → 86..114
    expect(box.min.x).toBeCloseTo(86, 1);
    expect(box.max.x).toBeCloseTo(114, 1);
    // Vertically centered (h * 5/3 ≈ 16.67) → 50 ± 8.33
    expect(box.min.y).toBeCloseTo(50 - (10 * (5 / 3)) / 2, 1);
    expect(box.max.y).toBeCloseTo(50 + (10 * (5 / 3)) / 2, 1);
  });

  it("ignores entities without a handle", () => {
    const line: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(buildPickingIndex({ entities: [line] }).entries).toHaveLength(0);
  });
});
