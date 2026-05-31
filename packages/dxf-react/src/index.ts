import "./styles.css";

// Components
export {
  DXFViewer,
  type DXFViewerProps,
  type DXFViewerHandle,
  type ToolbarSlotContext,
} from "./components/DXFViewer";
export { LayerPanel, type LayerPanelProps } from "./components/LayerPanel";
export { PropertiesPanel, type PropertiesPanelProps } from "./components/PropertiesPanel";
export { FileUploader, type FileUploaderProps } from "./components/FileUploader";
export {
  UnsupportedEntities,
  type UnsupportedEntitiesProps,
} from "./components/UnsupportedEntities";
export { DXFStatistics, type DXFStatisticsProps } from "./components/DXFStatistics";
export { ViewerToolbar, type ViewerToolbarProps } from "./components/ViewerToolbar";

// Hooks
export { useThreeScene } from "./hooks/useThreeScene";
export { useDXFRenderer } from "./hooks/useDXFRenderer";
export { useLayers, type LayerState, type UseLayersOptions } from "./hooks/useLayers";
export { usePicking, type PickingEvent, type PickingController } from "./hooks/usePicking";
export { useHighlight, type HighlightController } from "./hooks/useHighlight";
export { useSnap, type SnapController } from "./hooks/useSnap";
export {
  useMeasurement,
  formatMeasureValue,
  type MeasureKind,
  type MeasureUnits,
  type MeasureState,
  type MeasureResult,
  type MeasureCallbacks,
} from "./hooks/useMeasurement";
export {
  useAreaMeasurement,
  formatAreaValue,
  type AreaMeasureResult,
  type AreaMeasureState,
  type AreaMeasureCallbacks,
  type AreaUnitScales,
} from "./hooks/useAreaMeasurement";
export {
  useAngleMeasurement,
  formatAngleValue,
  type AngleMeasureResult,
  type AngleMeasureState,
  type AngleMeasureCallbacks,
} from "./hooks/useAngleMeasurement";
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
  type RectSelectionController,
} from "./hooks/useRectangleSelection";

// Types
export type {
  OverlayPosition,
  ViewerClasses,
  RulerUnits,
  MeasureMode,
  AreaUnits,
  AngleUnits,
} from "./types";

// Utilities
export {
  getEntityProperties,
  type PropertyRow,
  type PropertySection,
} from "./utils/entityProperties";

// Re-export everything from dxf-render (backward compatibility)
export * from "dxf-render";
