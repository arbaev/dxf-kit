import "./styles.css";

// Vue components
export { default as DXFViewer } from "./components/DXFViewer.vue";
export { default as LayerPanel } from "./components/LayerPanel.vue";
export { default as FileUploader } from "./components/FileUploader.vue";
export { default as UnsupportedEntities } from "./components/UnsupportedEntities.vue";
export { default as DXFStatistics } from "./components/DXFStatistics.vue";
export { default as ViewerToolbar } from "./components/ViewerToolbar.vue";

// Vue composables
export { useDXFRenderer } from "./composables/useDXFRenderer";
export { useThreeScene } from "./composables/useThreeScene";
export { useLayers } from "./composables/useLayers";

// Re-export everything from dxf-render (backward compatibility)
export * from "dxf-render";
