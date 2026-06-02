import { DxfViewerElement } from "./dxf-viewer";
import { DxfLayerPanelElement } from "./components/layer-panel";
import { DxfPropertiesPanelElement } from "./components/properties-panel";
import { DxfRulerElement } from "./components/ruler";

export { DxfViewerElement, DxfLayerPanelElement, DxfPropertiesPanelElement, DxfRulerElement };

export type { LayerState } from "./controllers/layers";
export {
  getEntityProperties,
  type PropertyRow,
  type PropertySection,
} from "./utils/entityProperties";
export type {
  OverlayPosition,
  MeasureMode,
  RulerUnits,
  AreaUnits,
  AngleUnits,
  LoadingPhase,
} from "./types";

// Interaction event / result types surfaced through Custom Events (entity-hover,
// entity-click, entities-select, measure, measure-area, measure-angle,
// selection-start). Re-exported so consumers can type their event handlers —
// parity with the dxf-vuer / dxf-react wrappers.
export type {
  PickingEvent,
  MeasureResult,
  AreaMeasureResult,
  AngleMeasureResult,
  RectSelectionResolvedMode,
  RectSelectionMode,
  RectSelectionModifier,
} from "dxf-interaction";

/** Register a custom element once. Guarded against double registration. */
function defineElement(tag: string, ctor: CustomElementConstructor): void {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
}

defineElement("dxf-viewer", DxfViewerElement);
defineElement("dxf-layer-panel", DxfLayerPanelElement);
defineElement("dxf-properties-panel", DxfPropertiesPanelElement);
defineElement("dxf-ruler", DxfRulerElement);

declare global {
  interface HTMLElementTagNameMap {
    "dxf-viewer": DxfViewerElement;
    "dxf-layer-panel": DxfLayerPanelElement;
    "dxf-properties-panel": DxfPropertiesPanelElement;
    "dxf-ruler": DxfRulerElement;
  }
}

// Re-export the dxf-render engine (parser, types, helpers) for convenience.
export * from "dxf-render";
