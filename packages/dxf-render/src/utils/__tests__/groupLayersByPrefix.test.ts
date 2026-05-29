import { describe, it, expect } from "vitest";
import {
  groupLayersByPrefix,
  type LayerGroup,
} from "../groupLayersByPrefix";

describe("groupLayersByPrefix — basics", () => {
  it("returns empty array for empty input", () => {
    expect(groupLayersByPrefix([])).toEqual([]);
  });

  it("groups layers by hyphen prefix (AIA convention)", () => {
    const result = groupLayersByPrefix(["A-WALL", "A-DOOR", "A-GLAZ"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL", "A-DOOR", "A-GLAZ"] },
    ]);
  });

  it("groups layers by underscore prefix", () => {
    const result = groupLayersByPrefix(["M_PIPE_CHWS", "M_PIPE_CHWR"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "M", layers: ["M_PIPE_CHWS", "M_PIPE_CHWR"] },
    ]);
  });

  it("splits on the first separator only — multi-word prefixes group at first segment", () => {
    const result = groupLayersByPrefix([
      "MEP-HVAC-DUCTS",
      "MEP-PIPE",
      "MEP-EQUIPMENT",
    ]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "MEP", layers: ["MEP-HVAC-DUCTS", "MEP-PIPE", "MEP-EQUIPMENT"] },
    ]);
  });

  it("treats hyphen and underscore as equivalent by default", () => {
    const result = groupLayersByPrefix(["A-WALL", "A_DOOR"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL", "A_DOOR"] },
    ]);
  });

  it("produces multiple groups sorted alphabetically", () => {
    const result = groupLayersByPrefix([
      "S-COLS",
      "A-WALL",
      "A-DOOR",
      "M-PIPE",
      "S-BEAM",
      "M-DUCT",
    ]);
    expect(result.map((g) => g.prefix)).toEqual(["A", "M", "S"]);
  });
});

describe("groupLayersByPrefix — ungrouped bucket", () => {
  it("falls into '' for names without separator", () => {
    const result = groupLayersByPrefix(["0", "Defpoints", "A-WALL", "A-DOOR"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL", "A-DOOR"] },
      { prefix: "", layers: ["0", "Defpoints"] },
    ]);
  });

  it("falls into '' when name starts with separator (empty prefix)", () => {
    const result = groupLayersByPrefix(["-FOO", "_BAR", "A-WALL", "A-DOOR"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL", "A-DOOR"] },
      { prefix: "", layers: ["-FOO", "_BAR"] },
    ]);
  });

  it("places ungrouped bucket last even when alphabetically '' would be first", () => {
    const result = groupLayersByPrefix(["0", "A-WALL", "A-DOOR"]);
    expect(result[result.length - 1].prefix).toBe("");
  });

  it("omits ungrouped bucket entirely when empty", () => {
    const result = groupLayersByPrefix(["A-WALL", "A-DOOR", "B-FOO", "B-BAR"]);
    expect(result.every((g) => g.prefix !== "")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("preserves input order within the ungrouped bucket — including below-threshold groups", () => {
    // S-only has 1 member → collapses into ungrouped; order must match input.
    const result = groupLayersByPrefix([
      "A-WALL",
      "0",
      "S-COLS",
      "A-DOOR",
      "Defpoints",
    ]);
    const ungrouped = result.find((g) => g.prefix === "");
    expect(ungrouped?.layers).toEqual(["0", "S-COLS", "Defpoints"]);
  });
});

describe("groupLayersByPrefix — minGroupSize", () => {
  it("collapses single-layer prefixes into ungrouped by default (minGroupSize=2)", () => {
    const result = groupLayersByPrefix(["A-WALL", "B-FOO", "C-BAR"]);
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "", layers: ["A-WALL", "B-FOO", "C-BAR"] },
    ]);
  });

  it("minGroupSize=1 keeps every prefixed layer as its own group", () => {
    const result = groupLayersByPrefix(["A-WALL", "B-FOO", "0"], {
      minGroupSize: 1,
    });
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL"] },
      { prefix: "B", layers: ["B-FOO"] },
      { prefix: "", layers: ["0"] },
    ]);
  });

  it("minGroupSize=3 requires at least 3 members per group", () => {
    const result = groupLayersByPrefix([
      "A-WALL",
      "A-DOOR",
      "B-FOO",
      "B-BAR",
      "B-BAZ",
    ]);
    // Default 2: both A and B form groups
    const withDefault = result;
    expect(withDefault.map((g) => g.prefix)).toEqual(["A", "B"]);

    const stricter = groupLayersByPrefix(
      ["A-WALL", "A-DOOR", "B-FOO", "B-BAR", "B-BAZ"],
      { minGroupSize: 3 },
    );
    expect(stricter).toEqual<LayerGroup<string>[]>([
      { prefix: "B", layers: ["B-FOO", "B-BAR", "B-BAZ"] },
      { prefix: "", layers: ["A-WALL", "A-DOOR"] },
    ]);
  });

  it("clamps minGroupSize to at least 1", () => {
    const result = groupLayersByPrefix(["A-WALL"], { minGroupSize: 0 });
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL"] },
    ]);
  });
});

describe("groupLayersByPrefix — custom separator", () => {
  it("accepts a string separator (plain text)", () => {
    const result = groupLayersByPrefix(
      ["DOMAIN::FOO", "DOMAIN::BAR", "OTHER::BAZ"],
      { separator: "::", minGroupSize: 1 },
    );
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "DOMAIN", layers: ["DOMAIN::FOO", "DOMAIN::BAR"] },
      { prefix: "OTHER", layers: ["OTHER::BAZ"] },
    ]);
  });

  it("accepts a RegExp separator", () => {
    const result = groupLayersByPrefix(
      ["A.FOO", "A.BAR", "A/BAZ"],
      { separator: /[./]/ },
    );
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A.FOO", "A.BAR", "A/BAZ"] },
    ]);
  });

  it("does not share regex lastIndex across calls when separator has /g flag", () => {
    const sep = /[-_]/g;
    const result = groupLayersByPrefix(["A-WALL", "A-DOOR", "B-FOO", "B-BAR"], {
      separator: sep,
    });
    // Without flag-stripping this would produce inconsistent splits across iterations.
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL", "A-DOOR"] },
      { prefix: "B", layers: ["B-FOO", "B-BAR"] },
    ]);
  });

  it("treats empty string separator as 'no separator' (everything ungrouped)", () => {
    const result = groupLayersByPrefix(["A-WALL", "A-DOOR"], { separator: "" });
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "", layers: ["A-WALL", "A-DOOR"] },
    ]);
  });
});

describe("groupLayersByPrefix — polymorphic input", () => {
  it("accepts objects with a `name` field (LayerState-like)", () => {
    type L = { name: string; visible: boolean };
    const layers: L[] = [
      { name: "A-WALL", visible: true },
      { name: "A-DOOR", visible: false },
      { name: "0", visible: true },
    ];
    const result = groupLayersByPrefix(layers);
    expect(result).toEqual<LayerGroup<L>[]>([
      { prefix: "A", layers: [layers[0], layers[1]] },
      { prefix: "", layers: [layers[2]] },
    ]);
    // Object identity preserved
    expect(result[0].layers[0]).toBe(layers[0]);
  });

  it("preserves input order within a group", () => {
    const result = groupLayersByPrefix(
      ["A-FOO", "B-BAR", "A-BAZ", "A-QUX", "B-WAT"],
    );
    expect(result.find((g) => g.prefix === "A")?.layers).toEqual([
      "A-FOO",
      "A-BAZ",
      "A-QUX",
    ]);
    expect(result.find((g) => g.prefix === "B")?.layers).toEqual([
      "B-BAR",
      "B-WAT",
    ]);
  });
});

describe("groupLayersByPrefix — case sensitivity", () => {
  it("is case-sensitive by default (DXF spec)", () => {
    const result = groupLayersByPrefix(["A-WALL", "a-door"], {
      minGroupSize: 1,
    });
    expect(result).toEqual<LayerGroup<string>[]>([
      { prefix: "A", layers: ["A-WALL"] },
      { prefix: "a", layers: ["a-door"] },
    ]);
  });
});
