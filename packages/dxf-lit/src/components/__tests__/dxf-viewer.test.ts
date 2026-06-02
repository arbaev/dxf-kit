import { describe, it, expect } from "vitest";
import "../../index"; // registers the custom elements as a side effect
import type { DxfViewerElement } from "../../dxf-viewer";

/**
 * Smoke + binding tests. jsdom has no WebGL, so scene init bails into the
 * "WebGL not supported" path — these assert the element registers, mounts,
 * mirrors attributes ↔ properties, fires Custom Events and exposes its
 * imperative methods without throwing. Visual rendering is verified manually.
 */
async function mount(markup: string): Promise<DxfViewerElement> {
  document.body.innerHTML = markup;
  const el = document.body.querySelector("dxf-viewer") as DxfViewerElement;
  await el.updateComplete;
  return el;
}

describe("<dxf-viewer> (smoke)", () => {
  it("registers the viewer and its sub-components", () => {
    expect(customElements.get("dxf-viewer")).toBeTruthy();
    expect(customElements.get("dxf-layer-panel")).toBeTruthy();
    expect(customElements.get("dxf-properties-panel")).toBeTruthy();
    expect(customElements.get("dxf-ruler")).toBeTruthy();
  });

  it("mounts and shows the empty-state placeholder when no DXF is provided", async () => {
    const el = await mount(`<dxf-viewer></dxf-viewer>`);
    expect(el.shadowRoot?.textContent).toContain("Select a DXF file to view");
  });

  it("mounts and unmounts without throwing", async () => {
    const el = await mount(`<dxf-viewer file-name="test.dxf"></dxf-viewer>`);
    expect(el).toBeInstanceOf(HTMLElement);
    el.remove();
  });
});

describe("<dxf-viewer> attributes ↔ properties", () => {
  it("reflects dark-theme between attribute and property", async () => {
    const el = await mount(`<dxf-viewer dark-theme></dxf-viewer>`);
    expect(el.darkTheme).toBe(true);
    el.darkTheme = false;
    await el.updateComplete;
    expect(el.hasAttribute("dark-theme")).toBe(false);
  });

  it("treats an opt-out boolean attribute (=\"false\") as false for a default-true prop", async () => {
    const el = await mount(`<dxf-viewer show-fullscreen-button="false"></dxf-viewer>`);
    expect(el.showFullscreenButton).toBe(false);
  });

  it("keeps default-true props true when the attribute is absent", async () => {
    const el = await mount(`<dxf-viewer></dxf-viewer>`);
    expect(el.showFullscreenButton).toBe(true);
    expect(el.showLayerPanel).toBe(true);
    expect(el.keyboardNavigation).toBe(true);
  });

  it("parses hidden-layers from a JSON attribute", async () => {
    const el = await mount(`<dxf-viewer hidden-layers='["A","B"]'></dxf-viewer>`);
    expect(el.hiddenLayers).toEqual(["A", "B"]);
  });

  it("parses hidden-layers from a comma-separated attribute", async () => {
    const el = await mount(`<dxf-viewer hidden-layers="A, B ,C"></dxf-viewer>`);
    expect(el.hiddenLayers).toEqual(["A", "B", "C"]);
  });

  it("reads picking-enabled from the attribute", async () => {
    const el = await mount(`<dxf-viewer picking-enabled></dxf-viewer>`);
    expect(el.pickingEnabled).toBe(true);
  });
});

describe("<dxf-viewer> events + methods", () => {
  it("setMeasureMode updates the property and fires measure-mode-change", async () => {
    const el = await mount(`<dxf-viewer></dxf-viewer>`);
    let detail: string | null = null;
    el.addEventListener("measure-mode-change", (e) => {
      detail = (e as CustomEvent).detail;
    });
    el.setMeasureMode("distance");
    expect(el.measureMode).toBe("distance");
    expect(detail).toBe("distance");
  });

  it("exposes the imperative API without throwing", async () => {
    const el = await mount(`<dxf-viewer></dxf-viewer>`);
    expect(() => el.clearSelection()).not.toThrow();
    expect(() => el.clearHighlight()).not.toThrow();
    expect(() => el.clearMeasure()).not.toThrow();
    expect(el.getPickingIndex()).toBeNull();
    expect(el.getAssociations()).toEqual([]);
    expect(el.getRenderer()).toBeNull(); // no WebGL in jsdom
  });

  it("exposes read-only state getters", async () => {
    const el = await mount(`<dxf-viewer></dxf-viewer>`);
    expect(el.loadingPhase).toBe("");
    expect(el.zoomPercent).toBe(100);
    expect(el.errorMessage).toBeNull();
  });
});
