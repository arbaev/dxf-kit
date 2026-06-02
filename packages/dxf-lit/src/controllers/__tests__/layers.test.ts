import { describe, it, expect, beforeEach } from "vitest";
import type { ReactiveControllerHost } from "lit";
import { LayersController, type LayerState, type LayersControllerOptions } from "../layers";
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

/** Minimal ReactiveControllerHost stub — the controller only calls requestUpdate. */
function makeHost(): ReactiveControllerHost {
  return {
    addController() {},
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  } as unknown as ReactiveControllerHost;
}

const setup = (opts?: LayersControllerOptions) => new LayersController(makeHost(), opts);
const layer = (c: LayersController, name: string): LayerState | undefined =>
  c.layerList.find((l) => l.name === name);

describe("LayersController.initLayers", () => {
  it("creates entries with name, visibility, color, entityCount", () => {
    const c = setup();
    c.initLayers(
      {
        Walls: makeLayer({ name: "Walls", colorIndex: 1, visible: true, frozen: false }),
        Doors: makeLayer({ name: "Doors", colorIndex: 3 }),
      },
      { Walls: 42, Doors: 7 },
    );
    expect(c.layerList).toHaveLength(2);
    expect(layer(c, "Walls")!.color).toBe("#ff0000"); // ACI 1 = red
    expect(layer(c, "Walls")!.entityCount).toBe(42);
    expect(layer(c, "Walls")!.visible).toBe(true);
    expect(layer(c, "Doors")!.entityCount).toBe(7);
  });

  it("forces frozen layers hidden regardless of layer.visible", () => {
    const c = setup();
    c.initLayers({ F: makeLayer({ name: "F", visible: true, frozen: true }) }, {});
    expect(layer(c, "F")!.visible).toBe(false);
    expect(layer(c, "F")!.frozen).toBe(true);
  });

  it("maps ACI colors and theme-adaptive ACI 7 to black on light theme", () => {
    const c = setup();
    c.initLayers(
      {
        Red: makeLayer({ name: "Red", colorIndex: 1 }),
        White7: makeLayer({ name: "White7", colorIndex: 7 }),
        ByBlock: makeLayer({ name: "ByBlock", colorIndex: 0 }),
        Blue: makeLayer({ name: "Blue", colorIndex: 5 }),
      },
      {},
      false,
    );
    expect(layer(c, "Red")!.color).toBe("#ff0000");
    expect(layer(c, "White7")!.color).toBe("#000000");
    expect(layer(c, "ByBlock")!.color).toBe("#FFFFFF");
    expect(layer(c, "Blue")!.color).toBe("#0000ff");
  });

  it("creates entity-only layers from counts when the LAYER table is empty", () => {
    const c = setup();
    c.initLayers({}, { "0": 452 });
    expect(c.layerList).toHaveLength(1);
    expect(layer(c, "0")!.entityCount).toBe(452);
    expect(c.getVisibleLayerNames().has("0")).toBe(true);
  });
});

describe("LayersController.toggle / showAll / hideAll", () => {
  it("toggles a layer and ignores frozen", () => {
    const c = setup();
    c.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        F: makeLayer({ name: "F", visible: false, frozen: true }),
      },
      {},
    );
    c.toggleLayerVisibility("A");
    expect(layer(c, "A")!.visible).toBe(false);
    c.toggleLayerVisibility("F");
    expect(layer(c, "F")!.visible).toBe(false);
  });

  it("showAll reveals non-frozen layers; hideAll hides everything", () => {
    const c = setup();
    c.initLayers(
      {
        N: makeLayer({ name: "N", visible: true, frozen: false }),
        F: makeLayer({ name: "F", visible: false, frozen: true }),
      },
      {},
    );
    c.hideAllLayers();
    expect(layer(c, "N")!.visible).toBe(false);
    c.showAllLayers();
    expect(layer(c, "N")!.visible).toBe(true);
    expect(layer(c, "F")!.visible).toBe(false);
  });
});

describe("LayersController visibility queries", () => {
  it("reflect visibility synchronously after a toggle", () => {
    const c = setup();
    c.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        B: makeLayer({ name: "B", visible: true, frozen: false }),
        F: makeLayer({ name: "F", visible: true, frozen: true }),
      },
      {},
    );
    expect(c.getHiddenLayerNames()).toEqual([]);
    c.toggleLayerVisibility("A");
    expect(c.getHiddenLayerNames()).toEqual(["A"]);
    const visible = c.getVisibleLayerNames();
    expect(visible.has("B")).toBe(true);
    expect(visible.has("A")).toBe(false);
    expect(visible.has("F")).toBe(false); // frozen
  });
});

describe("LayersController persistence (uncontrolled)", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists hidden names on toggle and restores them on init", () => {
    const opts: LayersControllerOptions = { getStorageKey: () => "k" };
    const first = setup(opts);
    first.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        B: makeLayer({ name: "B", visible: true, frozen: false }),
      },
      {},
    );
    first.toggleLayerVisibility("A");
    expect(JSON.parse(window.localStorage.getItem("k")!)).toEqual(["A"]);

    const second = setup(opts);
    second.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        B: makeLayer({ name: "B", visible: true, frozen: false }),
      },
      {},
    );
    expect(layer(second, "A")!.visible).toBe(false);
    expect(layer(second, "B")!.visible).toBe(true);
  });

  it("survives malformed storage without throwing", () => {
    window.localStorage.setItem("k", "{not json");
    const c = setup({ getStorageKey: () => "k" });
    expect(() => c.initLayers({ A: makeLayer({ name: "A" }) }, {})).not.toThrow();
    expect(layer(c, "A")!.visible).toBe(true);
  });
});

describe("LayersController controlled mode", () => {
  beforeEach(() => window.localStorage.clear());

  it("applies the external hidden list on init and ignores localStorage", () => {
    window.localStorage.setItem("k", JSON.stringify(["A"]));
    const hidden = ["B"];
    const c = setup({
      getStorageKey: () => "k",
      getControlledHidden: () => hidden,
      onChange: () => {},
    });
    c.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        B: makeLayer({ name: "B", visible: true, frozen: false }),
      },
      {},
    );
    expect(layer(c, "A")!.visible).toBe(true); // localStorage ignored
    expect(layer(c, "B")!.visible).toBe(false); // controlled list applied
  });

  it("invokes onChange with the new hidden list and does not write storage", () => {
    const calls: string[][] = [];
    const hidden: string[] = [];
    const c = setup({
      getStorageKey: () => "k",
      getControlledHidden: () => hidden,
      onChange: (h) => calls.push([...h]),
    });
    c.initLayers(
      {
        A: makeLayer({ name: "A", visible: true, frozen: false }),
        B: makeLayer({ name: "B", visible: true, frozen: false }),
      },
      {},
    );
    c.toggleLayerVisibility("A");
    expect(calls).toEqual([["A"]]);
    expect(window.localStorage.getItem("k")).toBeNull();
  });
});
