import { describe, it, expect } from "vitest";
import { createScannerAt } from "../../__tests__/test-helpers";
import { parseMline } from "../mline";

describe("parseMline", () => {
  it("parses MLINE with 2 vertices and 2 elements", () => {
    const { scanner, group } = createScannerAt(
      "0", "MLINE",
      "8", "Layer1",
      "62", "1",
      "2", "STANDARD",
      "40", "1.0",
      "70", "0",
      "71", "1",
      "72", "2",
      "73", "2",
      // Start point (skipped)
      "10", "0.0",
      "20", "0.0",
      "30", "0.0",
      // Vertex 1
      "11", "0.0",
      "21", "0.0",
      "31", "0.0",
      "12", "1.0",
      "22", "0.0",
      "32", "0.0",
      "13", "0.0",
      "23", "1.0",
      "33", "0.0",
      // Element 0 of vertex 1
      "74", "2",
      "41", "0.5",
      "41", "0.0",
      "75", "0",
      // Element 1 of vertex 1
      "74", "2",
      "41", "-0.5",
      "41", "0.0",
      "75", "0",
      // Vertex 2
      "11", "10.0",
      "21", "0.0",
      "31", "0.0",
      "12", "1.0",
      "22", "0.0",
      "32", "0.0",
      "13", "0.0",
      "23", "1.0",
      "33", "0.0",
      // Element 0 of vertex 2
      "74", "2",
      "41", "0.5",
      "41", "0.0",
      "75", "0",
      // Element 1 of vertex 2
      "74", "2",
      "41", "-0.5",
      "41", "0.0",
      "75", "0",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMline(scanner, group);

    expect(entity.type).toBe("MLINE");
    expect(entity.layer).toBe("Layer1");
    expect(entity.colorIndex).toBe(1);
    expect(entity.styleName).toBe("STANDARD");
    expect(entity.scale).toBe(1);
    expect(entity.justification).toBe(0);
    expect(entity.flags).toBe(1);
    expect(entity.numVertices).toBe(2);
    expect(entity.numElements).toBe(2);
    expect(entity.vertices).toHaveLength(2);

    // Vertex 1
    const v1 = entity.vertices[0];
    expect(v1.x).toBe(0);
    expect(v1.y).toBe(0);
    expect(v1.miter).toEqual({ x: 0, y: 1, z: 0 });
    expect(v1.elementParams).toHaveLength(2);
    expect(v1.elementParams[0].params[0]).toBe(0.5);
    expect(v1.elementParams[1].params[0]).toBe(-0.5);

    // Vertex 2
    const v2 = entity.vertices[1];
    expect(v2.x).toBe(10);
    expect(v2.y).toBe(0);
    expect(v2.elementParams).toHaveLength(2);
    expect(v2.elementParams[0].params[0]).toBe(0.5);
    expect(v2.elementParams[1].params[0]).toBe(-0.5);
  });

  it("parses closed MLINE (flag bit 2)", () => {
    const { scanner, group } = createScannerAt(
      "0", "MLINE",
      "71", "3",
      "72", "2",
      "73", "1",
      "10", "0.0",
      "20", "0.0",
      "30", "0.0",
      // Vertex 1
      "11", "0.0",
      "21", "0.0",
      "31", "0.0",
      "12", "1.0",
      "22", "0.0",
      "32", "0.0",
      "13", "0.0",
      "23", "1.0",
      "33", "0.0",
      "74", "1",
      "41", "0.0",
      "75", "0",
      // Vertex 2
      "11", "5.0",
      "21", "5.0",
      "31", "0.0",
      "12", "1.0",
      "22", "0.0",
      "32", "0.0",
      "13", "0.0",
      "23", "1.0",
      "33", "0.0",
      "74", "1",
      "41", "0.0",
      "75", "0",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMline(scanner, group);

    expect(entity.flags).toBe(3);
    // Closed flag is bit 2 (value & 2)
    expect(entity.flags & 2).toBe(2);
    expect(entity.vertices).toHaveLength(2);
  });

  it("parses extrusion direction", () => {
    const { scanner, group } = createScannerAt(
      "0", "MLINE",
      "72", "0",
      "73", "0",
      "210", "0.0",
      "220", "0.0",
      "230", "1.0",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const entity = parseMline(scanner, group);
    expect(entity.extrusionDirection).toEqual({ x: 0, y: 0, z: 1 });
  });
});
