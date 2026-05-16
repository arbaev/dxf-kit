import { describe, it, expect } from "vitest";
import { createScannerAt } from "../../__tests__/test-helpers";
import { parseHatch } from "../hatch";
import { parseLeader } from "../leader";
import { parseMultiLeader } from "../multileader";
import { parseViewport } from "../viewport";
import { parseImage } from "../image";
import { parseWipeout } from "../wipeout";

// ═══════════════════════════════════════════════════════════════════════════
// HATCH
// ═══════════════════════════════════════════════════════════════════════════

describe("parseHatch", () => {
  it("parses solid fill hatch with patternName=SOLID and code 70=1", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.type).toBe("HATCH");
    expect(entity.patternName).toBe("SOLID");
    expect(entity.solid).toBe(true);
    expect(entity.boundaryPaths).toHaveLength(0);
  });

  it("parses edge boundary with 2 line edges", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "1",
      // boundary path: edge type (bit 2 NOT set => 0 means edge boundary)
      "92", "0",
      "93", "2",
      // line edge 1
      "72", "1",
      "10", "0.0",
      "20", "0.0",
      "11", "10.0",
      "21", "5.0",
      // line edge 2
      "72", "1",
      "10", "10.0",
      "20", "5.0",
      "11", "20.0",
      "21", "0.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.type).toBe("HATCH");
    expect(entity.patternName).toBe("ANSI31");
    expect(entity.solid).toBe(false);
    expect(entity.boundaryPaths).toHaveLength(1);

    const path = entity.boundaryPaths[0];
    expect(path.edges).toBeDefined();
    expect(path.edges).toHaveLength(2);

    const edge0 = path.edges![0];
    expect(edge0.type).toBe("line");
    if (edge0.type === "line") {
      expect(edge0.start).toEqual({ x: 0, y: 0 });
      expect(edge0.end).toEqual({ x: 10, y: 5 });
    }

    const edge1 = path.edges![1];
    expect(edge1.type).toBe("line");
    if (edge1.type === "line") {
      expect(edge1.start).toEqual({ x: 10, y: 5 });
      expect(edge1.end).toEqual({ x: 20, y: 0 });
    }
  });

  it("parses edge boundary with an arc edge", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "1",
      "92", "0",
      "93", "1",
      // arc edge
      "72", "2",
      "10", "5.0",
      "20", "5.0",
      "40", "3.0",
      "50", "0.0",
      "51", "180.0",
      "73", "1",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths).toHaveLength(1);
    const edges = entity.boundaryPaths[0].edges!;
    expect(edges).toHaveLength(1);

    const arc = edges[0];
    expect(arc.type).toBe("arc");
    if (arc.type === "arc") {
      expect(arc.center).toEqual({ x: 5, y: 5 });
      expect(arc.radius).toBe(3);
      expect(arc.startAngle).toBe(0);
      expect(arc.endAngle).toBe(180);
      expect(arc.ccw).toBe(true);
    }
  });

  it("parses polyline boundary with 3 vertices (no bulge, open)", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "1",
      // polyline boundary: bit 2 set => pathTypeFlag=2
      "92", "2",
      "72", "0",
      "73", "0",
      "93", "3",
      "10", "0.0",
      "20", "0.0",
      "10", "10.0",
      "20", "0.0",
      "10", "10.0",
      "20", "10.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths).toHaveLength(1);
    const path = entity.boundaryPaths[0];
    expect(path.polylineVertices).toBeDefined();
    expect(path.polylineVertices).toHaveLength(3);
    expect(path.polylineVertices![0]).toEqual({ x: 0, y: 0 });
    expect(path.polylineVertices![1]).toEqual({ x: 10, y: 0 });
    expect(path.polylineVertices![2]).toEqual({ x: 10, y: 10 });
  });

  it("parses polyline boundary with bulge values", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "1",
      "92", "2",
      "72", "1",     // hasBulge = true
      "73", "0",     // not closed
      "93", "2",
      "10", "0.0",
      "20", "0.0",
      "42", "0.5",
      "10", "10.0",
      "20", "0.0",
      "42", "0.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths).toHaveLength(1);
    const verts = entity.boundaryPaths[0].polylineVertices!;
    expect(verts).toHaveLength(2);
    expect(verts[0]).toEqual({ x: 0, y: 0, bulge: 0.5 });
    // bulge=0 is not stored on vertex
    expect(verts[1]).toEqual({ x: 10, y: 0 });
  });

  it("parses closed polyline boundary and duplicates first vertex", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "1",
      "92", "2",
      "72", "0",     // no bulge
      "73", "1",     // isClosed = true
      "93", "3",
      "10", "0.0",
      "20", "0.0",
      "10", "10.0",
      "20", "0.0",
      "10", "10.0",
      "20", "10.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    const verts = entity.boundaryPaths[0].polylineVertices!;
    // 3 original + 1 duplicated first vertex = 4
    expect(verts).toHaveLength(4);
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts[3]).toEqual({ x: 0, y: 0 });
  });

  it("parses pattern lines with dashes", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "0",
      // 2 pattern lines
      "78", "2",
      // pattern line 1
      "53", "45.0",
      "43", "0.0",
      "44", "0.0",
      "45", "0.0",
      "46", "3.175",
      "79", "2",
      "49", "3.175",
      "49", "-1.5875",
      // pattern line 2
      "53", "135.0",
      "43", "1.0",
      "44", "2.0",
      "45", "0.0",
      "46", "6.35",
      "79", "1",
      "49", "6.35",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.patternLines).toBeDefined();
    expect(entity.patternLines).toHaveLength(2);

    const pl0 = entity.patternLines![0];
    expect(pl0.angle).toBe(45);
    expect(pl0.basePoint).toEqual({ x: 0, y: 0 });
    expect(pl0.offset).toEqual({ x: 0, y: 3.175 });
    expect(pl0.dashes).toEqual([3.175, -1.5875]);

    const pl1 = entity.patternLines![1];
    expect(pl1.angle).toBe(135);
    expect(pl1.basePoint).toEqual({ x: 1, y: 2 });
    expect(pl1.offset).toEqual({ x: 0, y: 6.35 });
    expect(pl1.dashes).toEqual([6.35]);
  });

  it("parses multiple boundary paths", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "2",
      // boundary path 1: polyline
      "92", "2",
      "72", "0",
      "73", "0",
      "93", "2",
      "10", "0.0",
      "20", "0.0",
      "10", "10.0",
      "20", "10.0",
      // boundary path 2: edge with 1 line edge
      "92", "0",
      "93", "1",
      "72", "1",
      "10", "20.0",
      "20", "20.0",
      "11", "30.0",
      "21", "30.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths).toHaveLength(2);

    // First path: polyline
    expect(entity.boundaryPaths[0].polylineVertices).toBeDefined();
    expect(entity.boundaryPaths[0].polylineVertices).toHaveLength(2);

    // Second path: edge
    expect(entity.boundaryPaths[1].edges).toBeDefined();
    expect(entity.boundaryPaths[1].edges).toHaveLength(1);
    const lineEdge = entity.boundaryPaths[1].edges![0];
    expect(lineEdge.type).toBe("line");
    if (lineEdge.type === "line") {
      expect(lineEdge.start).toEqual({ x: 20, y: 20 });
      expect(lineEdge.end).toEqual({ x: 30, y: 30 });
    }
  });

  it("parses patternScale (code 41) and patternAngle (code 52)", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "0",
      "41", "2.5",
      "52", "30.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.type).toBe("HATCH");
    expect(entity.patternScale).toBe(2.5);
    expect(entity.patternAngle).toBe(30);
  });

  it("captures sourceObjectHandles from edge boundary (codes 97 + 330)", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "1",
      "92", "1",       // external boundary
      "93", "1",
      "72", "1",       // 1 line edge
      "10", "0.0",
      "20", "0.0",
      "11", "10.0",
      "21", "0.0",
      "97", "2",
      "330", "151",
      "330", "1AB",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths).toHaveLength(1);
    expect(entity.boundaryPaths[0].sourceObjectHandles).toEqual(["151", "1AB"]);
  });

  it("captures sourceObjectHandles from polyline boundary", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "1",
      "92", "3",       // polyline + external (bit 1 + bit 2)
      "72", "0",
      "73", "1",
      "93", "3",
      "10", "0.0",
      "20", "0.0",
      "10", "10.0",
      "20", "0.0",
      "10", "10.0",
      "20", "10.0",
      "97", "1",
      "330", "ABCDEF",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths[0].sourceObjectHandles).toEqual(["ABCDEF"]);
  });

  it("normalizes sourceObjectHandles to uppercase", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "1",
      "92", "0",
      "93", "1",
      "72", "1",
      "10", "0.0",
      "20", "0.0",
      "11", "1.0",
      "21", "0.0",
      "97", "1",
      "330", "abc123",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths[0].sourceObjectHandles).toEqual(["ABC123"]);
  });

  it("leaves sourceObjectHandles undefined when no code 97 present", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "ANSI31",
      "70", "0",
      "91", "1",
      "92", "0",
      "93", "1",
      "72", "1",
      "10", "0.0",
      "20", "0.0",
      "11", "1.0",
      "21", "0.0",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.boundaryPaths[0].sourceObjectHandles).toBeUndefined();
  });

  it("parses hatch with extrusion direction", () => {
    const { scanner, group } = createScannerAt(
      "0", "HATCH",
      "2", "SOLID",
      "70", "1",
      "91", "0",
      "210", "0.0",
      "220", "0.0",
      "230", "-1.0",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseHatch(scanner, group);

    expect(entity.type).toBe("HATCH");
    expect(entity.patternName).toBe("SOLID");
    expect(entity.extrusionDirection).toEqual({ x: 0, y: 0, z: -1 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LEADER
// ═══════════════════════════════════════════════════════════════════════════

describe("parseLeader", () => {
  it("parses leader with 3 vertices and styleName", () => {
    const { scanner, group } = createScannerAt(
      "0", "LEADER",
      "3", "Standard",
      "76", "3",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "10", "10.0",
      "20", "10.0",
      // A next-entity sentinel is needed because parsePoint reads ahead
      // for the Z coordinate. If the lookahead hits 0/EOF, the scanner's
      // _eof flag is set permanently and cannot be cleared by rewind().
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseLeader(scanner, group);

    expect(entity.type).toBe("LEADER");
    expect(entity.styleName).toBe("Standard");
    expect(entity.numVertices).toBe(3);
    expect(entity.vertices).toHaveLength(3);
    expect(entity.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(entity.vertices[1]).toEqual({ x: 5, y: 5 });
    expect(entity.vertices[2]).toEqual({ x: 10, y: 10 });
  });

  it("parses leader with arrowHeadFlag=0 (no arrowhead)", () => {
    const { scanner, group } = createScannerAt(
      "0", "LEADER",
      "71", "0",
      "76", "2",
      "10", "1.0",
      "20", "2.0",
      "10", "3.0",
      "20", "4.0",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseLeader(scanner, group);

    expect(entity.type).toBe("LEADER");
    expect(entity.arrowHeadFlag).toBe(0);
    expect(entity.vertices).toHaveLength(2);
    expect(entity.vertices[0]).toEqual({ x: 1, y: 2 });
    expect(entity.vertices[1]).toEqual({ x: 3, y: 4 });
  });

  it("parses arrowSize from XDATA DSTYLE (DIMASZ override)", () => {
    const { scanner, group } = createScannerAt(
      "0", "LEADER",
      "3", "Standard",
      "76", "2",
      "10", "0.0",
      "20", "0.0",
      "10", "10.0",
      "20", "10.0",
      "1001", "ACAD",
      "1000", "DSTYLE",
      "1002", "{",
      "1070", "41",     // DIMVAR code 41 = DIMASZ
      "1040", "24.0",   // arrow size = 24
      "1070", "371",    // DIMVAR code 371 = DIMLWD
      "1070", "-1",     // integer value = -1
      "1002", "}",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseLeader(scanner, group);

    expect(entity.type).toBe("LEADER");
    expect(entity.arrowSize).toBe(24);
    expect(entity.vertices).toHaveLength(2);
  });

  it("parses annotationHandle from code 340", () => {
    const { scanner, group } = createScannerAt(
      "0", "LEADER",
      "76", "2",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "340", "2A",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseLeader(scanner, group);

    expect(entity.annotationHandle).toBe("2A");
  });

  it("does not set arrowSize when XDATA has no DIMASZ override", () => {
    const { scanner, group } = createScannerAt(
      "0", "LEADER",
      "76", "2",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "1001", "ACAD",
      "1000", "DSTYLE",
      "1002", "{",
      "1070", "371",
      "1070", "-1",
      "1002", "}",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseLeader(scanner, group);

    expect(entity.arrowSize).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MULTILEADER
// ═══════════════════════════════════════════════════════════════════════════

describe("parseMultiLeader", () => {
  it("parses basic multileader with one leader, one line, 2 vertices", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "302", "LEADER{",
      "10", "10.0",
      "20", "10.0",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.type).toBe("MULTILEADER");
    expect(entity.leaders).toHaveLength(1);

    const leader = entity.leaders[0];
    expect(leader.lines).toHaveLength(1);
    expect(leader.lines[0].vertices).toHaveLength(2);
    expect(leader.lines[0].vertices[0]).toEqual({ x: 0, y: 0 });
    expect(leader.lines[0].vertices[1]).toEqual({ x: 5, y: 5 });
    expect(leader.lastLeaderPoint).toEqual({ x: 10, y: 10 });
  });

  it("parses text content from code 304 (value other than LEADER_LINE{ marker)", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "304", "Hello World",
      "302", "LEADER{",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.text).toBe("Hello World");
    expect(entity.leaders).toHaveLength(1);
  });

  it("parses multiple leaders", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      // leader 1
      "302", "LEADER{",
      "10", "5.0",
      "20", "5.0",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "305", "}",
      "303", "}",
      // leader 2
      "302", "LEADER{",
      "10", "25.0",
      "20", "25.0",
      "304", "LEADER_LINE{",
      "10", "20.0",
      "20", "20.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.leaders).toHaveLength(2);
    expect(entity.leaders[0].lines[0].vertices[0]).toEqual({ x: 0, y: 0 });
    expect(entity.leaders[0].lastLeaderPoint).toEqual({ x: 5, y: 5 });
    expect(entity.leaders[1].lines[0].vertices[0]).toEqual({ x: 20, y: 20 });
    expect(entity.leaders[1].lastLeaderPoint).toEqual({ x: 25, y: 25 });
  });

  it("parses hasArrowHead=false from code 171=0", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "171", "0",
      "300", "CONTEXT_DATA{",
      "302", "LEADER{",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.hasArrowHead).toBe(false);
    expect(entity.leaders).toHaveLength(1);
  });

  it("parses textPosition (12 inside CONTEXT_DATA), textHeight (41 inside CONTEXT_DATA) and arrowSize (entity-level 42)", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "40", "1.0",          // ContentScale — must NOT become textHeight
      "41", "2.5",          // TextHeight (CONTEXT_DATA)
      "140", "0.36",        // LandingGap — must NOT become textHeight
      "12", "15.0",         // textPosition X
      "22", "15.0",
      "304", "Test",
      "302", "LEADER{",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "10", "5.0",
      "20", "5.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "41", "0.18",         // entity-level DoglegLength — must NOT overwrite textHeight
      "42", "1.0",          // ArrowHeadSize (entity-level)
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.textHeight).toBe(2.5);
    expect(entity.arrowSize).toBe(1.0);
    expect(entity.textPosition).toBeDefined();
    expect(entity.textPosition!.x).toBe(15);
    expect(entity.textPosition!.y).toBe(15);
    expect(entity.text).toBe("Test");
  });

  it("parses entity-level leaderLineType (code 170 = 2 → spline)", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "302", "LEADER{",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "170", "2",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.leaderLineType).toBe(2);
  });

  it("ignores code 170 inside CONTEXT_DATA (different meaning at that scope)", () => {
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "170", "1",           // HasBlockReference — not the entity-level LeaderLineType
      "302", "LEADER{",
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.leaderLineType).toBeUndefined();
  });

  it("does not overwrite text with the literal LEADER_LINE{ marker (real-world AutoCAD layout)", () => {
    // Mirrors the actual byte sequence in todo/dxf-samples/problems/2018.dxf
    // where the MText content "OL-A-70" comes via code 304 BEFORE the LEADER
    // subsection is opened, and "LEADER_LINE{" arrives later — also via 304.
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "40", "1.0",
      "10", "100.0",
      "20", "200.0",
      "41", "60.0",
      "304", "OL-A-70",
      "11", "0.0",
      "21", "0.0",
      "31", "1.0",
      "12", "150.0",
      "22", "250.0",
      "32", "0.0",
      "302", "LEADER{",
      "290", "1",
      "10", "120.0",
      "20", "210.0",
      "30", "0.0",
      "11", "1.0",
      "21", "0.0",
      "31", "0.0",
      "40", "33.0",
      "304", "LEADER_LINE{",
      "10", "80.0",
      "20", "180.0",
      "30", "0.0",
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.text).toBe("OL-A-70");
    expect(entity.leaders).toHaveLength(1);
    expect(entity.leaders[0].lines).toHaveLength(1);
    expect(entity.leaders[0].lines[0].vertices).toEqual([{ x: 80, y: 180, z: 0 }]);
    expect(entity.leaders[0].lastLeaderPoint).toEqual({ x: 120, y: 210, z: 0 });
  });

  it("parses entity-level styleHandle, propertyOverrideFlag, leaderLineColorRaw and CONTEXT_DATA textColorRaw", () => {
    // Mirrors the 2018.dxf MULTILEADER 47020 byte layout: inside CONTEXT_DATA
    // code 90 carries TextColor; after CONTEXT_DATA closes, code 90 becomes
    // PropertyOverrideFlag, code 91 — LeaderLineColor, code 340 — styleHandle.
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "304", "M22-G-42",
      "302", "LEADER{",
      "10", "65.0",
      "20", "260.0",
      "30", "0.0",
      "90", "0",                  // LeaderBranchIndex inside LEADER — must NOT become textColorRaw
      "304", "LEADER_LINE{",
      "10", "10.0",
      "20", "0.0",
      "30", "0.0",
      "91", "0",                  // LeaderLineIndex inside LEADER_LINE — must NOT become leaderLineColorRaw
      "305", "}",
      "303", "}",
      "90", "-1023410170",        // TextColor inside CONTEXT_DATA top (after LEADER closes) — byACI(6) magenta
      "301", "}",
      "340", "3c063",             // entity-level styleHandle (lowercase should be uppercased)
      "90", "17122304",           // entity-level PropertyOverrideFlag
      "170", "2",                 // entity-level LeaderLineType
      "91", "-1023410170",        // entity-level LeaderLineColor — byACI(6) magenta
      "42", "1.0",                // entity-level ArrowHeadSize
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.styleHandle).toBe("3C063");
    expect(entity.propertyOverrideFlag).toBe(17122304);
    expect(entity.leaderLineColorRaw).toBe(-1023410170);
    expect(entity.textColorRaw).toBe(-1023410170);
    expect(entity.leaderLineType).toBe(2);
    expect(entity.arrowSize).toBe(1);
  });

  it("does not capture color codes from nested LEADER/LEADER_LINE scopes", () => {
    // Code 90 inside LEADER is LeaderBranchIndex; code 91 inside LEADER_LINE
    // is LeaderLineIndex. Neither should leak into entity color fields.
    const { scanner, group } = createScannerAt(
      "0", "MULTILEADER",
      "300", "CONTEXT_DATA{",
      "302", "LEADER{",
      "90", "5",                  // LeaderBranchIndex — must be ignored
      "304", "LEADER_LINE{",
      "10", "0.0",
      "20", "0.0",
      "91", "3",                  // LeaderLineIndex — must be ignored
      "305", "}",
      "303", "}",
      "301", "}",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMultiLeader(scanner, group);

    expect(entity.textColorRaw).toBeUndefined();
    expect(entity.leaderLineColorRaw).toBeUndefined();
    expect(entity.propertyOverrideFlag).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VIEWPORT (minimal - only common properties)
// ═══════════════════════════════════════════════════════════════════════════

describe("parseViewport", () => {
  it("parses basic viewport with layer", () => {
    const { scanner, group } = createScannerAt(
      "0", "VIEWPORT",
      "8", "ViewportLayer",
      "0", "EOF",
    );

    const entity = parseViewport(scanner, group);

    expect(entity.type).toBe("VIEWPORT");
    expect(entity.layer).toBe("ViewportLayer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE (minimal - only common properties)
// ═══════════════════════════════════════════════════════════════════════════

describe("parseImage", () => {
  it("parses basic image with layer", () => {
    const { scanner, group } = createScannerAt(
      "0", "IMAGE",
      "8", "ImageLayer",
      "0", "EOF",
    );

    const entity = parseImage(scanner, group);

    expect(entity.type).toBe("IMAGE");
    expect(entity.layer).toBe("ImageLayer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WIPEOUT (minimal - only common properties)
// ═══════════════════════════════════════════════════════════════════════════

describe("parseWipeout", () => {
  it("parses basic wipeout with layer", () => {
    const { scanner, group } = createScannerAt(
      "0", "WIPEOUT",
      "8", "WipeoutLayer",
      "0", "EOF",
    );

    const entity = parseWipeout(scanner, group);

    expect(entity.type).toBe("WIPEOUT");
    expect(entity.layer).toBe("WipeoutLayer");
  });
});
