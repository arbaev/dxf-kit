export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Headless UI-style class map for DXFViewer's named UI parts.
 *
 * Each entry is concatenated onto the corresponding built-in `.dxfk-*` class on
 * the matching root element (Vue's standard `class` fallthrough handles the
 * concatenation for child components). All keys are optional.
 *
 * Use this for utility-CSS frameworks (Tailwind) or to namespace styles when
 * embedding multiple viewers on one page. For CSS-only overrides without
 * inline classes, target the `.dxfk-*` hook classes directly.
 */
export interface ViewerClasses {
  /** Root container — applied to `.dxfk-viewer`. */
  root?: string;
  /** Toolbar root — applied to `.dxfk-toolbar` (the default ViewerToolbar). */
  toolbar?: string;
  /** Layer panel root — applied to `.dxfk-layer-panel`. */
  layerPanel?: string;
  /** File name overlay — applied to `.dxfk-file-name-overlay`. */
  fileNameOverlay?: string;
  /** Cursor coordinates / zoom overlay — applied to `.dxfk-coordinates-overlay`. */
  coordinatesOverlay?: string;
  /** Debug overlay (FPS, draw calls) — applied to `.dxfk-debug-overlay`. */
  debugOverlay?: string;
  /** Loading overlay — applied to `.dxfk-loading-overlay`. */
  loadingOverlay?: string;
  /** Error overlay — applied to `.dxfk-error-overlay`. */
  errorOverlay?: string;
  /** Drag-and-drop overlay — applied to `.dxfk-drop-overlay`. */
  dropOverlay?: string;
  /** Empty-state overlay (no DXF loaded) — applied to its `.dxfk-message-overlay`. */
  emptyStateOverlay?: string;
}
