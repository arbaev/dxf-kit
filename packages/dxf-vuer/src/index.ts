import "./styles.css";

// Vue components
export { default as DXFViewer } from "./components/DXFViewer.vue";
export { default as LayerPanel } from "./components/LayerPanel.vue";
export { default as PropertiesPanel } from "./components/PropertiesPanel.vue";
export { default as FileUploader } from "./components/FileUploader.vue";
export { default as UnsupportedEntities } from "./components/UnsupportedEntities.vue";
export { default as DXFStatistics } from "./components/DXFStatistics.vue";
export { default as ViewerToolbar } from "./components/ViewerToolbar.vue";

// Vue composables
export { useDXFRenderer } from "./composables/useDXFRenderer";
export { useThreeScene } from "./composables/useThreeScene";
export { useLayers } from "./composables/useLayers";
export { usePicking, type PickingEvent } from "./composables/usePicking";
export { useHighlight } from "./composables/useHighlight";
export {
  useRectangleSelection,
  resolveSelectionMode,
  normaliseScreenRect,
  buildWorldRect,
  type RectSelectionMode,
  type RectSelectionResolvedMode,
  type RectSelectionModifier,
  type RectSelectionCallbacks,
  type RectScreenRect,
  type OrbitLikeControls,
} from "./composables/useRectangleSelection";

// Types
export type { OverlayPosition, ViewerClasses, RulerUnits } from "./types";
export {
  getEntityProperties,
  type PropertyRow,
  type PropertySection,
} from "./utils/entityProperties";

// Re-export everything from dxf-render (backward compatibility)
export * from "dxf-render";
