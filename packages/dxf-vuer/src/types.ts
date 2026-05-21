export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Units displayed on the rulers.
 *
 * - `"dxf-units"` — raw DXF values, no conversion (badge: "—").
 * - `"mm"` — converts via `$INSUNITS`; when the file is Unitless ($INSUNITS=0)
 *   the raw values are treated as millimeters 1:1.
 * - `"inch"` — same conversion path as `"mm"`, then divided by 25.4.
 */
export type RulerUnits = "dxf-units" | "mm" | "inch";

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
  /** Properties panel root — applied to `.dxfk-properties-panel`. */
  propertiesPanel?: string;
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
  /** Horizontal ruler — applied to `.dxfk-ruler-h`. */
  rulerHorizontal?: string;
  /** Vertical ruler — applied to `.dxfk-ruler-v`. */
  rulerVertical?: string;
  /** Ruler corner badge (top-left, shows units label) — applied to `.dxfk-ruler-corner`. */
  rulerCorner?: string;
}
