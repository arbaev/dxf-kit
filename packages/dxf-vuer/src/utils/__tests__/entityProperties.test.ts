import { describe, it, expect } from "vitest";
import { getEntityProperties } from "../entityProperties";
import type {
  DxfLineEntity,
  DxfCircleEntity,
  DxfArcEntity,
  DxfPointEntity,
  DxfTextEntity,
  DxfInsertEntity,
  DxfHatchEntity,
  DxfPolylineEntity,
  DxfSolidEntity,
  Dxf3DFaceEntity,
  DxfDimensionEntity,
  DxfEntity,
} from "dxf-render";

const findSection = (sections: ReturnType<typeof getEntityProperties>, title: string) =>
  sections.find((s) => s.title === title);

const findRow = (
  sections: ReturnType<typeof getEntityProperties>,
  sectionTitle: string,
  rowLabel: string,
) => {
  const section = findSection(sections, sectionTitle);
  return section?.rows.find((r) => r.label === rowLabel);
};

describe("getEntityProperties — General section", () => {
  it("emits Type, Handle, Layer, Color, Linetype, Lineweight for any entity", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      handle: "A1B",
      layer: "WALLS",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    };
    const sections = getEntityProperties(e);
    const general = findSection(sections, "General");
    expect(general).toBeDefined();
    expect(findRow(sections, "General", "Type")?.value).toBe("LINE");
    expect(findRow(sections, "General", "Handle")?.value).toBe("A1B");
    expect(findRow(sections, "General", "Handle")?.mono).toBe(true);
    expect(findRow(sections, "General", "Layer")?.value).toBe("WALLS");
    expect(findRow(sections, "General", "Color")?.value).toBe("ByLayer");
    expect(findRow(sections, "General", "Linetype")?.value).toBe("ByLayer");
    expect(findRow(sections, "General", "Lineweight")?.value).toBe("ByLayer");
  });

  it("defaults Layer to '0' when missing", () => {
    const e: DxfPointEntity = { type: "POINT", position: { x: 0, y: 0 } };
    expect(findRow(getEntityProperties(e), "General", "Layer")?.value).toBe("0");
  });

  it("shows ByBlock for colorIndex 0", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      colorIndex: 0,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(findRow(getEntityProperties(e), "General", "Color")?.value).toBe("ByBlock");
  });

  it("renders True color when entity carries a truecolor RGB", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      color: 0xff0000,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const row = findRow(getEntityProperties(e), "General", "Color");
    expect(row?.value).toBe("True color #FF0000");
    expect(row?.swatch).toBe("#ff0000");
  });

  it("renders ACI swatch as hex from the ACI palette", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      colorIndex: 1, // ACI 1 = red
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    const row = findRow(getEntityProperties(e), "General", "Color");
    expect(row?.value).toBe("ACI 1");
    expect(row?.swatch).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("renders theme-adaptive ACI (7/250/251/255) with the neutral swatch", () => {
    for (const aci of [7, 250, 251, 255]) {
      const e: DxfLineEntity = {
        type: "LINE",
        colorIndex: aci,
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      };
      const row = findRow(getEntityProperties(e), "General", "Color");
      expect(row?.value).toBe(`ACI ${aci}`);
      expect(row?.swatch).toBe("#888888");
    }
  });

  it("formats lineweight in mm for positive values", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      lineweight: 25, // 0.25 mm
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(findRow(getEntityProperties(e), "General", "Lineweight")?.value).toBe("0.25 mm");
  });

  it("emits Visible: No only when entity.visible === false", () => {
    const visible: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(findRow(getEntityProperties(visible), "General", "Visible")).toBeUndefined();

    const hidden: DxfLineEntity = {
      type: "LINE",
      visible: false,
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    };
    expect(findRow(getEntityProperties(hidden), "General", "Visible")?.value).toBe("No");
  });
});

describe("getEntityProperties — Geometry sections", () => {
  it("LINE: Start, End, Length", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 3, y: 4 }],
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Start")?.value).toBe("(0, 0)");
    expect(findRow(getEntityProperties(e), "Geometry", "End")?.value).toBe("(3, 4)");
    expect(findRow(getEntityProperties(e), "Geometry", "Length")?.value).toBe("5");
  });

  it("LINE: includes Z when non-zero", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }],
    };
    expect(findRow(getEntityProperties(e), "Geometry", "End")?.value).toBe("(0, 0, 5)");
  });

  it("CIRCLE: Center, Radius, Diameter, Circumference", () => {
    const e: DxfCircleEntity = {
      type: "CIRCLE",
      center: { x: 5, y: 5 },
      radius: 10,
    };
    const sections = getEntityProperties(e);
    expect(findRow(sections, "Geometry", "Center")?.value).toBe("(5, 5)");
    expect(findRow(sections, "Geometry", "Radius")?.value).toBe("10");
    expect(findRow(sections, "Geometry", "Diameter")?.value).toBe("20");
    // 2 * PI * 10 ≈ 62.832
    expect(findRow(sections, "Geometry", "Circumference")?.value).toMatch(/^62\.83/);
  });

  it("ARC: Start/End angle as degrees, sweep-based arc length", () => {
    const e: DxfArcEntity = {
      type: "ARC",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: 90, // quarter arc
    };
    const sections = getEntityProperties(e);
    expect(findRow(sections, "Geometry", "Start angle")?.value).toBe("0°");
    expect(findRow(sections, "Geometry", "End angle")?.value).toBe("90°");
    // PI/2 * 10 ≈ 15.708
    expect(findRow(sections, "Geometry", "Arc length")?.value).toMatch(/^15\.70/);
  });

  it("POLYLINE: vertex count and Closed flag", () => {
    const e: DxfPolylineEntity = {
      type: "POLYLINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
      shape: true,
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Vertices")?.value).toBe("3");
    expect(findRow(getEntityProperties(e), "Geometry", "Closed")?.value).toBe("Yes");
  });

  it("SOLID reads its four points from `points`, not `vertices`", () => {
    const e: DxfSolidEntity = {
      type: "SOLID",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    };
    const sections = getEntityProperties(e);
    expect(findRow(sections, "Geometry", "Vertices")?.value).toBe("4");
    expect(findRow(sections, "Geometry", "V1")?.value).toBe("(0, 0)");
    expect(findRow(sections, "Geometry", "V4")?.value).toBe("(1, 1)");
  });

  it("3DFACE reads from `vertices`", () => {
    const e: Dxf3DFaceEntity = {
      type: "3DFACE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Vertices")?.value).toBe("3");
  });

  it("HATCH: Pattern, Solid flag, boundary path count", () => {
    const e: DxfHatchEntity = {
      type: "HATCH",
      patternName: "ANSI31",
      solid: false,
      boundaryPaths: [{ edges: [] }, { edges: [] }],
      patternScale: 2.5,
      patternAngle: 45,
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Pattern")?.value).toBe("ANSI31");
    expect(findRow(getEntityProperties(e), "Geometry", "Solid fill")?.value).toBe("No");
    expect(findRow(getEntityProperties(e), "Geometry", "Boundary paths")?.value).toBe("2");
    expect(findRow(getEntityProperties(e), "Geometry", "Pattern scale")?.value).toBe("2.5");
    expect(findRow(getEntityProperties(e), "Geometry", "Pattern angle")?.value).toBe("45°");
  });

  it("HATCH solid fill hides pattern scale/angle rows", () => {
    const e: DxfHatchEntity = {
      type: "HATCH",
      patternName: "SOLID",
      solid: true,
      boundaryPaths: [{ edges: [] }],
      patternScale: 1,
      patternAngle: 0,
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Pattern scale")).toBeUndefined();
    expect(findRow(getEntityProperties(e), "Geometry", "Pattern angle")).toBeUndefined();
  });

  it("INSERT: Block name, Array suppressed when 1×1", () => {
    const single: DxfInsertEntity = {
      type: "INSERT",
      name: "DOOR",
      position: { x: 10, y: 20 },
    };
    expect(findRow(getEntityProperties(single), "Geometry", "Block name")?.value).toBe("DOOR");
    expect(findRow(getEntityProperties(single), "Geometry", "Array")).toBeUndefined();

    const array: DxfInsertEntity = {
      type: "INSERT",
      name: "TILE",
      position: { x: 0, y: 0 },
      columnCount: 3,
      rowCount: 2,
    };
    expect(findRow(getEntityProperties(array), "Geometry", "Array")?.value).toBe("3 × 2");
  });

  it("DIMENSION: Dimension type label", () => {
    const e: DxfDimensionEntity = {
      type: "DIMENSION",
      dimensionType: 0,
      actualMeasurement: 123.456,
    };
    expect(findRow(getEntityProperties(e), "Geometry", "Dimension type")?.value).toBe("Linear");
    expect(findRow(getEntityProperties(e), "Geometry", "Measurement")?.value).toBe("123.456");
  });
});

describe("getEntityProperties — Text section", () => {
  it("emits Text row for TEXT entities with content", () => {
    const e: DxfTextEntity = {
      type: "TEXT",
      text: "Hello",
      textStyle: "Standard",
      position: { x: 0, y: 0 },
      height: 2.5,
    };
    const sections = getEntityProperties(e);
    expect(findSection(sections, "Text")).toBeDefined();
    expect(findRow(sections, "Text", "Text")?.value).toBe("Hello");
    expect(findRow(sections, "Text", "Style")?.value).toBe("Standard");
  });

  it("omits Text section when there is no text content", () => {
    const e: DxfLineEntity = {
      type: "LINE",
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    };
    expect(findSection(getEntityProperties(e), "Text")).toBeUndefined();
  });
});

describe("getEntityProperties — fallback", () => {
  it("returns just the General section for unknown entity types", () => {
    const e = { type: "UNKNOWN_FOO", handle: "F00", layer: "0" } as DxfEntity;
    const sections = getEntityProperties(e);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("General");
    expect(findRow(sections, "General", "Type")?.value).toBe("UNKNOWN_FOO");
  });
});
