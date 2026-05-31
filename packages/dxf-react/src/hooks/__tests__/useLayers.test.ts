import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayers, type LayerState, type UseLayersOptions } from "../useLayers";
import type { DxfLayer } from "dxf-render";

function makeLayer(overrides: Partial<DxfLayer> = {}): DxfLayer {
  return {
    name: "Layer1",
    colorIndex: 7,
    color: 0,
    visible: true,
    frozen: false,
    ...overrides,
  } as DxfLayer;
}

type Hook = ReturnType<typeof useLayers>;
const layer = (h: Hook, name: string): LayerState | undefined =>
  h.layerList.find((l) => l.name === name);

const setup = (opts?: UseLayersOptions) => renderHook(() => useLayers(opts));

describe("initLayers", () => {
  it("creates entries with name, visibility, color, entityCount", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        {
          Walls: makeLayer({ name: "Walls", colorIndex: 1, visible: true, frozen: false }),
          Doors: makeLayer({ name: "Doors", colorIndex: 3 }),
        },
        { Walls: 42, Doors: 7 },
      );
    });
    expect(result.current.layerList).toHaveLength(2);
    expect(layer(result.current, "Walls")!.color).toBe("#ff0000"); // ACI 1 = red
    expect(layer(result.current, "Walls")!.entityCount).toBe(42);
    expect(layer(result.current, "Walls")!.visible).toBe(true);
    expect(layer(result.current, "Doors")!.entityCount).toBe(7);
  });

  it("forces frozen layers hidden regardless of layer.visible", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        { F: makeLayer({ name: "F", visible: true, frozen: true }) },
        {},
      );
    });
    expect(layer(result.current, "F")!.visible).toBe(false);
    expect(layer(result.current, "F")!.frozen).toBe(true);
  });

  it("maps ACI colors and theme-adaptive ACI 7 to black on light theme", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        {
          Red: makeLayer({ name: "Red", colorIndex: 1 }),
          White7: makeLayer({ name: "White7", colorIndex: 7 }),
          ByBlock: makeLayer({ name: "ByBlock", colorIndex: 0 }),
          Blue: makeLayer({ name: "Blue", colorIndex: 5 }),
        },
        {},
        false,
      );
    });
    expect(layer(result.current, "Red")!.color).toBe("#ff0000");
    expect(layer(result.current, "White7")!.color).toBe("#000000");
    expect(layer(result.current, "ByBlock")!.color).toBe("#FFFFFF");
    expect(layer(result.current, "Blue")!.color).toBe("#0000ff");
  });

  it("creates entity-only layers from counts when the LAYER table is empty", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers({}, { "0": 452 });
    });
    expect(result.current.layerList).toHaveLength(1);
    expect(layer(result.current, "0")!.entityCount).toBe(452);
    expect(result.current.getVisibleLayerNames().has("0")).toBe(true);
  });

  it("uses white for entity-only layers on dark theme", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers({}, { test: 1 }, true);
    });
    expect(layer(result.current, "test")!.color).toBe("#ffffff");
  });
});

describe("toggleLayerVisibility / showAll / hideAll", () => {
  it("toggles a layer and ignores frozen", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          F: makeLayer({ name: "F", visible: false, frozen: true }),
        },
        {},
      );
    });
    act(() => result.current.toggleLayerVisibility("A"));
    expect(layer(result.current, "A")!.visible).toBe(false);
    act(() => result.current.toggleLayerVisibility("F"));
    expect(layer(result.current, "F")!.visible).toBe(false);
  });

  it("showAll reveals non-frozen layers; hideAll hides everything", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        {
          N: makeLayer({ name: "N", visible: true, frozen: false }),
          F: makeLayer({ name: "F", visible: false, frozen: true }),
        },
        {},
      );
    });
    act(() => result.current.hideAllLayers());
    expect(layer(result.current, "N")!.visible).toBe(false);
    act(() => result.current.showAllLayers());
    expect(layer(result.current, "N")!.visible).toBe(true);
    expect(layer(result.current, "F")!.visible).toBe(false);
  });
});

describe("getVisibleLayerNames / getHiddenLayerNames", () => {
  it("reflect visibility synchronously after a toggle", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
          F: makeLayer({ name: "F", visible: true, frozen: true }),
        },
        {},
      );
    });
    expect(result.current.getHiddenLayerNames()).toEqual([]);
    act(() => result.current.toggleLayerVisibility("A"));
    expect(result.current.getHiddenLayerNames()).toEqual(["A"]);
    const visible = result.current.getVisibleLayerNames();
    expect(visible.has("B")).toBe(true);
    expect(visible.has("A")).toBe(false);
    expect(visible.has("F")).toBe(false); // frozen
  });
});

describe("clearLayers", () => {
  it("empties the layer list", () => {
    const { result } = setup();
    act(() => {
      result.current.initLayers({ A: makeLayer({ name: "A" }) }, {});
    });
    expect(result.current.layerList).toHaveLength(1);
    act(() => result.current.clearLayers());
    expect(result.current.layerList).toEqual([]);
  });
});

describe("persistence via getStorageKey (uncontrolled)", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists hidden names on toggle and restores them on init", () => {
    const opts: UseLayersOptions = { getStorageKey: () => "k" };
    const first = setup(opts);
    act(() => {
      first.result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
        },
        {},
      );
    });
    act(() => first.result.current.toggleLayerVisibility("A"));
    expect(JSON.parse(window.localStorage.getItem("k")!)).toEqual(["A"]);

    // A fresh hook restores the persisted hidden set.
    const second = setup(opts);
    act(() => {
      second.result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
        },
        {},
      );
    });
    expect(layer(second.result.current, "A")!.visible).toBe(false);
    expect(layer(second.result.current, "B")!.visible).toBe(true);
  });

  it("survives malformed storage without throwing", () => {
    window.localStorage.setItem("k", "{not json");
    const { result } = setup({ getStorageKey: () => "k" });
    expect(() =>
      act(() => result.current.initLayers({ A: makeLayer({ name: "A" }) }, {})),
    ).not.toThrow();
    expect(layer(result.current, "A")!.visible).toBe(true);
  });
});

describe("controlled mode (getControlledHidden / onChange)", () => {
  beforeEach(() => window.localStorage.clear());

  it("applies the external hidden list on init and ignores localStorage", () => {
    window.localStorage.setItem("k", JSON.stringify(["A"]));
    const hidden = ["B"];
    const { result } = setup({
      getStorageKey: () => "k",
      getControlledHidden: () => hidden,
      onChange: () => {},
    });
    act(() => {
      result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
        },
        {},
      );
    });
    expect(layer(result.current, "A")!.visible).toBe(true); // localStorage ignored
    expect(layer(result.current, "B")!.visible).toBe(false); // controlled list applied
  });

  it("invokes onChange with the new hidden list and does not write storage", () => {
    const calls: string[][] = [];
    const hidden: string[] = [];
    const { result } = setup({
      getStorageKey: () => "k",
      getControlledHidden: () => hidden,
      onChange: (h) => calls.push([...h]),
    });
    act(() => {
      result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
        },
        {},
      );
    });
    act(() => result.current.toggleLayerVisibility("A"));
    expect(calls).toEqual([["A"]]);
    expect(window.localStorage.getItem("k")).toBeNull();
  });

  it("setHiddenLayers applies the list without firing onChange", () => {
    const calls: string[][] = [];
    const hidden: string[] = [];
    const { result } = setup({
      getControlledHidden: () => hidden,
      onChange: (h) => calls.push([...h]),
    });
    act(() => {
      result.current.initLayers(
        {
          A: makeLayer({ name: "A", visible: true, frozen: false }),
          B: makeLayer({ name: "B", visible: true, frozen: false }),
        },
        {},
      );
    });
    act(() => result.current.setHiddenLayers(["A"]));
    expect(layer(result.current, "A")!.visible).toBe(false);
    expect(layer(result.current, "B")!.visible).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
