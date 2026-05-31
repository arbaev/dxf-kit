import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { WebGLRenderer, OrthographicCamera } from "three";
import type {
  DxfData,
  DxfLayer,
  AntialiasingMode,
  GroupLayersByPrefixOptions,
  PickingEntry,
  PickingIndex,
  EntityAssociation,
  MeasurePoint,
} from "dxf-render";
import {
  buildEntityIndex,
  buildPickingIndex,
  getZoomBox,
  getZoomBoxForLayer,
  findEntitiesByLayer,
} from "dxf-render";
import { useDXFRenderer } from "../hooks/useDXFRenderer";
import { useLoadError } from "../hooks/useLoadError";
import { useLayers } from "../hooks/useLayers";
import { usePicking, type PickingEvent } from "../hooks/usePicking";
import { useHighlight } from "../hooks/useHighlight";
import { useMeasurement, type MeasureResult } from "../hooks/useMeasurement";
import { useAreaMeasurement, type AreaMeasureResult } from "../hooks/useAreaMeasurement";
import { useAngleMeasurement, type AngleMeasureResult } from "../hooks/useAngleMeasurement";
import { useSnap } from "../hooks/useSnap";
import {
  useRectangleSelection,
  type RectSelectionModifier,
  type RectSelectionMode,
  type RectSelectionResolvedMode,
} from "../hooks/useRectangleSelection";
import { useViewerUnits } from "../hooks/useViewerUnits";
import { useMeasureLabels } from "../hooks/useMeasureLabels";
import { useCursorCoordinates } from "../hooks/useCursorCoordinates";
import { useFullscreen } from "../hooks/useFullscreen";
import { useDragAndDrop } from "../hooks/useDragAndDrop";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";
import { LayerPanel } from "./LayerPanel";
import { Ruler } from "./Ruler";
import { ViewerToolbar } from "./ViewerToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import type {
  OverlayPosition,
  ViewerClasses,
  MeasureMode,
  RulerUnits,
  AreaUnits,
  AngleUnits,
} from "../types";
import { cx } from "../utils/classNames";
import "./DXFViewer.css";

type LoadingPhase = "" | "fetching" | "parsing" | "rendering";

/** Minimal controls shape the rulers subscribe to for redraw on pan/zoom. */
type RulerControls = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const OVERLAY_POSITIONS: OverlayPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const formatK = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

const ErrorIcon = (
  <svg
    className="dxfk-message-icon dxfk-message-icon--error"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const PlaceholderIcon = (
  <svg
    className="dxfk-message-icon dxfk-message-icon--placeholder"
    width="64"
    height="64"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
  >
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

/**
 * Props for {@link DXFViewer}. This is the growing public surface — data,
 * lifecycle and the load/error/empty-state render-props are wired in stage 2.
 * Picking, measurement, layers, rulers, etc. are added in later stages.
 */
export interface DXFViewerProps {
  /** Parsed DXF object (alternative to `url`). */
  dxfData?: DxfData | null;
  /** Display name shown in the file-name overlay. */
  fileName?: string;
  /** HTTP(S) URL to fetch the DXF from. */
  url?: string;
  /** Custom font URL for text rendering. */
  fontUrl?: string;
  /** Fit the drawing to the viewport after load (default true). */
  autoFit?: boolean;
  /** Dark theme (default false). */
  darkTheme?: boolean;
  /** Antialiasing mode — init-time only; remount (via `key`) to change. */
  antialiasing?: AntialiasingMode;
  /** Show the file-name overlay (default true). */
  showFileName?: boolean;
  /** Show the cursor-coordinates overlay (default false). */
  showCoordinates?: boolean;
  /** Show the zoom-level overlay (default false). */
  showZoomLevel?: boolean;
  /** Show the debug overlay: FPS / draw calls / lines / triangles (default false). */
  showDebugInfo?: boolean;
  /** Show horizontal + vertical rulers (default false). */
  showRulers?: boolean;
  /** Show the reset / fit-to-view toolbar button (default false). */
  showResetButton?: boolean;
  /** Show the fullscreen toolbar button (default true). */
  showFullscreenButton?: boolean;
  /** Show the export-PNG toolbar button (default false). */
  showExportButton?: boolean;
  /** Show the distance-measure toolbar button (default false). */
  showMeasureButton?: boolean;
  /** Show the area-measure toolbar button (default false). */
  showMeasureAreaButton?: boolean;
  /** Show the angle-measure toolbar button (default false). */
  showMeasureAngleButton?: boolean;
  /** Show the read-only properties panel for the clicked entity (default false). */
  showPropertiesPanel?: boolean;
  /** Accept dropped `.dxf` files on the canvas (default false). */
  allowDrop?: boolean;
  /** Enable arrow-key pan / +- zoom / 0 reset on the focused canvas (default true). */
  keyboardNavigation?: boolean;
  /** Headless-style class-name map for the named UI parts. */
  classes?: ViewerClasses;
  /** Overlay grid position for the file name (default "top-left"). */
  fileNamePosition?: OverlayPosition;
  /** Overlay grid position for the coordinates / zoom overlay (default "bottom-left"). */
  coordinatesPosition?: OverlayPosition;
  /** Overlay grid position for the debug overlay (default "bottom-center"). */
  debugPosition?: OverlayPosition;
  /** Overlay grid position for the toolbar (default "top-right"). */
  toolbarPosition?: OverlayPosition;
  /** Overlay grid position for the properties panel (default "top-left"). */
  propertiesPanelPosition?: OverlayPosition;
  /** Overlay grid position for the custom overlay render-prop (default "top-center"). */
  overlayPosition?: OverlayPosition;
  /** Show the layer-visibility panel (default true). */
  showLayerPanel?: boolean;
  /** Overlay grid position for the layer panel (default "bottom-right"). */
  layerPanelPosition?: OverlayPosition;
  /** Auto-group layers by name prefix in the panel (default false). */
  groupLayers?: boolean | GroupLayersByPrefixOptions;
  /** localStorage key prefix for persisting hidden layers (uncontrolled mode). */
  persistLayersKey?: string;
  /**
   * Controlled hidden-layer names. When provided, the parent owns layer
   * visibility (`persistLayersKey` is ignored); pair with `onHiddenLayersChange`.
   */
  hiddenLayers?: string[];
  /** Enable click/hover entity picking (default false). */
  pickingEnabled?: boolean;
  /** Outline the entity (and associated members) under the cursor (default true). */
  highlightOnHover?: boolean;
  /** Highlight all associated members, not just the hovered entity (default true). */
  highlightAssociated?: boolean;
  /** Highlight overlay color (default "#ffaa00"). */
  highlightColor?: string;
  /** Show the picking meshes for debugging (default false). */
  pickingDebug?: boolean;
  /** Enable modifier+drag rectangle selection (default false; requires `pickingEnabled`). */
  rectangleSelection?: boolean;
  /** Modifier key that arms rectangle selection (default "shift"). */
  rectangleSelectionModifier?: RectSelectionModifier;
  /** Window/crossing semantics (default "auto" — resolved by drag direction). */
  rectangleSelectionMode?: RectSelectionMode;
  /** Units for rulers + as the default for measurement labels (default "mm"). */
  rulerUnits?: RulerUnits;
  /**
   * Active measurement tool (controlled). Mutually exclusive; pair with
   * `onMeasureModeChange`. Leave undefined for uncontrolled mode.
   */
  measureMode?: MeasureMode;
  /** Distance-label units override; falls back to `rulerUnits`. */
  measureUnits?: RulerUnits;
  /** Area-label square units (default "auto" — inherits from `rulerUnits`). */
  measureAreaUnits?: AreaUnits;
  /** Angle-label format (default "deg"). */
  measureAngleUnits?: AngleUnits;
  /** Measurement overlay color (default "#ff6b1a"). */
  measureColor?: string;
  /** Snap measurement clicks to nearby geometry while measuring (default true). */
  snapToGeometry?: boolean;

  /** Fired after parsing + rendering completes (success flag). */
  onDxfLoaded?: (success: boolean) => void;
  /** Fired with the DXF object after a successful load (or `null` on failure). */
  onDxfData?: (data: DxfData | null) => void;
  /** Fired when loading / rendering fails. */
  onError?: (error: string) => void;
  /** Fired with the list of entity types that could not be rendered. */
  onUnsupportedEntities?: (entities: string[]) => void;
  /** Fired when the reset-view action runs. */
  onResetView?: () => void;
  /** Fired when a `.dxf` file is dropped on the canvas (with its file name). */
  onFileDropped?: (fileName: string) => void;
  /** Fired when a layer row is hovered (`null` on leave). */
  onLayerHover?: (layerName: string | null) => void;
  /** Fired when the user toggles layer visibility (controlled mode). */
  onHiddenLayersChange?: (hidden: string[]) => void;
  /** Fired on pointer move over / away from an entity (`null` when leaving). */
  onEntityHover?: (event: PickingEvent | null) => void;
  /** Fired when an entity is clicked (not on pan). */
  onEntityClick?: (event: PickingEvent) => void;
  /** Fired after a rectangle drag completes, with the selected entities. */
  onEntitiesSelect?: (events: PickingEvent[]) => void;
  /** Fired when a rectangle drag exceeds the threshold (resolved mode). */
  onSelectionStart?: (mode: RectSelectionResolvedMode) => void;
  /** Fired after a rectangle drag completes or is cancelled. */
  onSelectionEnd?: () => void;
  /** Fired when the active measurement mode changes (controlled mode). */
  onMeasureModeChange?: (mode: MeasureMode) => void;
  /** Fired after a completed distance measurement. */
  onMeasure?: (result: MeasureResult) => void;
  /** Fired after a closed area measurement. */
  onMeasureArea?: (result: AreaMeasureResult) => void;
  /** Fired after a completed angle measurement. */
  onMeasureAngle?: (result: AngleMeasureResult) => void;
  /** Fired when a measurement is cancelled (Esc / mode off mid-draft). */
  onMeasureCancel?: () => void;

  /**
   * Replace the default toolbar. Receives the toolbar action context. When
   * omitted, the built-in {@link ViewerToolbar} is rendered.
   */
  renderToolbar?: (ctx: ToolbarSlotContext) => ReactNode;
  /** Extra buttons appended to the default toolbar (the `#toolbar-extra` slot). */
  toolbarExtra?: ReactNode;
  /** Custom content rendered in the overlay grid at `overlayPosition`. */
  renderOverlay?: (ctx: { zoomPercent: number; cursorX: number; cursorY: number }) => ReactNode;
  /** Replace the loading overlay. */
  renderLoading?: (ctx: { phase: LoadingPhase; progress: number }) => ReactNode;
  /** Replace the error overlay. */
  renderError?: (ctx: { message: string; retry: () => void }) => ReactNode;
  /** Replace the empty-state placeholder. */
  renderEmptyState?: () => ReactNode;
}

/** Context passed to the `renderToolbar` render-prop. */
export interface ToolbarSlotContext {
  resetView: () => void;
  exportToPNG: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  measureMode: MeasureMode;
  toggleMeasureDistance: () => void;
  toggleMeasureArea: () => void;
  toggleMeasureAngle: () => void;
  measureDistanceActive: boolean;
  measureAreaActive: boolean;
  measureAngleActive: boolean;
}

/** Imperative handle exposed via `ref`. Grows as later stages add capability. */
export interface DXFViewerHandle {
  loadDXFFromText: (dxfText: string) => Promise<void>;
  loadDXFFromData: (dxfData: DxfData) => Promise<void>;
  loadDXFFromUrl: (url: string) => Promise<void>;
  /** Load from an ArrayBuffer (auto-detects UTF-8 / UTF-16 LE/BE). */
  loadDXFFromBuffer: (buffer: ArrayBuffer) => Promise<void>;
  /** Load from a Blob / File. */
  loadDXFFromBlob: (blob: Blob) => Promise<void>;
  resetView: () => void;
  resize: () => void;
  exportToPNG: () => void;
  getRenderer: () => WebGLRenderer | null;
  /** Highlight entities by DXF handle (requires `pickingEnabled`). */
  highlight: (handles: string[]) => void;
  clearHighlight: () => void;
  /** Clear the entity shown in the PropertiesPanel. */
  clearSelection: () => void;
  /** Fit the camera to the bbox of the given entities (requires `pickingEnabled`). */
  zoomToEntity: (handles: string[]) => void;
  /** Fit the camera to all entities on a layer (requires `pickingEnabled`). */
  zoomToLayer: (layerName: string) => void;
  getAssociations: () => EntityAssociation[];
  findAssociationsByHandle: (handle: string) => EntityAssociation[];
  getPickingIndex: () => PickingIndex | null;
  /** Clear any in-flight or completed measurement overlay (distance / area / angle). */
  clearMeasure: () => void;
  /** Switch the measurement mode (also fires `onMeasureModeChange`). */
  setMeasureMode: (mode: MeasureMode) => void;
}

export const DXFViewer = forwardRef<DXFViewerHandle, DXFViewerProps>(function DXFViewer(
  props,
  ref,
) {
  const {
    dxfData = null,
    fileName = "",
    url = "",
    darkTheme = false,
    showFileName = true,
    showCoordinates = false,
    showZoomLevel = false,
    showDebugInfo = false,
    showRulers = false,
    showResetButton = false,
    showFullscreenButton = true,
    showExportButton = false,
    showMeasureButton = false,
    showMeasureAreaButton = false,
    showMeasureAngleButton = false,
    showPropertiesPanel = false,
    allowDrop = false,
    keyboardNavigation = true,
    classes,
    fileNamePosition = "top-left",
    coordinatesPosition = "bottom-left",
    debugPosition = "bottom-center",
    toolbarPosition = "top-right",
    propertiesPanelPosition = "top-left",
    overlayPosition = "top-center",
    showLayerPanel = true,
    layerPanelPosition = "bottom-right",
    groupLayers = false,
    hiddenLayers,
    pickingEnabled = false,
    highlightColor = "#ffaa00",
    pickingDebug = false,
    rectangleSelection = false,
    rectangleSelectionModifier = "shift",
    rectangleSelectionMode = "auto",
    rulerUnits = "mm",
    measureMode: measureModeProp,
    measureUnits,
    measureAreaUnits = "auto",
    measureAngleUnits = "deg",
    measureColor = "#ff6b1a",
    snapToGeometry = true,
    renderToolbar,
    toolbarExtra,
    renderOverlay,
    renderLoading,
    renderError,
    renderEmptyState,
  } = props;

  // Always-current props so stable callbacks can read the latest values
  // without being re-created.
  const propsRef = useRef(props);
  propsRef.current = props;

  const renderer = useDXFRenderer();
  const { controller: rendererCtrl, setIsLoading } = renderer;
  const { errorMessage, setError, clearError } = useLoadError();

  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("");
  const [loadedDxf, setLoadedDxf] = useState<DxfData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const lastLoadedDxfRef = useRef<DxfData | null>(null);

  const activeDxf = dxfData ?? loadedDxf;
  const hasDXFData = !!(activeDxf && activeDxf.entities && activeDxf.entities.length > 0);

  // Latest active DXF for stable callbacks.
  const activeDxfRef = useRef(activeDxf);
  activeDxfRef.current = activeDxf;

  const {
    layerList,
    getVisibleLayerNames,
    getHiddenLayerNames,
    initLayers,
    toggleLayerVisibility,
    showAllLayers,
    hideAllLayers,
    setHiddenLayers,
    updateLayerThemeColors,
    clearLayers,
  } = useLayers({
    getStorageKey: () => {
      const p = propsRef.current;
      if (!p.persistLayersKey) return null;
      return `${p.persistLayersKey}:${p.fileName || "default"}`;
    },
    getControlledHidden: () => propsRef.current.hiddenLayers,
    onChange: (hidden) => propsRef.current.onHiddenLayersChange?.(hidden),
  });

  const picking = usePicking();
  const highlightCtl = useHighlight();
  const rectSelection = useRectangleSelection();
  const rectScreenRect = rectSelection.screenRect;

  // Entity surfaced to the built-in PropertiesPanel (and `clearSelection`).
  // External `onEntityClick` listeners work independently of this.
  const [selectedEntity, setSelectedEntity] = useState<PickingEvent | null>(null);
  const lastDxfForPickingRef = useRef<DxfData | null>(null);

  // Measurement — controlled `measureMode` with an uncontrolled fallback.
  const [internalMeasureMode, setInternalMeasureMode] = useState<MeasureMode>("none");
  const measureMode = measureModeProp ?? internalMeasureMode;
  // Latest resolved measureMode for stable callbacks (mount effect must not
  // re-run when the mode changes — the dedicated mode effect handles that).
  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;

  const measurement = useMeasurement();
  const areaMeasurement = useAreaMeasurement();
  const angleMeasurement = useAngleMeasurement();
  const snap = useSnap();

  const getContainer = useCallback(() => containerRef.current, []);

  // Refs to the latest load / reset callbacks (defined lower) so the behavior
  // hooks below stay grouped with the others without a TDZ on those consts.
  const loadTextRef = useRef<(t: string) => void | Promise<void>>(() => {});
  const resetViewRef = useRef<() => void>(() => {});

  const { isFullscreen, toggleFullscreen } = useFullscreen(getContainer);

  const {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadDXFFromBuffer,
    loadDXFFromBlob,
  } = useDragAndDrop({
    allowDrop,
    loadText: (t) => loadTextRef.current(t),
    onFileDropped: (name) => propsRef.current.onFileDropped?.(name),
  });

  const keyboardNav = useKeyboardNavigation({
    getCamera: rendererCtrl.getCamera,
    getControls: rendererCtrl.getControls,
    resetView: () => resetViewRef.current(),
    render: rendererCtrl.render,
  });

  const { rulerUnitsScale, rulerUnitsLabel, currentMeasureUnits, measureUnitsScale, areaUnitScales } =
    useViewerUnits({
      activeDxf,
      rulerUnits,
      measureUnits,
      measureAreaUnits,
    });

  // Latest unit values for stable callbacks (e.g. attachMeasurementIfReady sets
  // the tools' initial units at attach time without re-creating the callback).
  const measureUnitsScaleRef = useRef(measureUnitsScale);
  measureUnitsScaleRef.current = measureUnitsScale;
  const currentMeasureUnitsRef = useRef(currentMeasureUnits);
  currentMeasureUnitsRef.current = currentMeasureUnits;
  const areaUnitScalesRef = useRef(areaUnitScales);
  areaUnitScalesRef.current = areaUnitScales;

  const { bumpCameraTick, measureLabel, areaLabel, angleLabel } = useMeasureLabels({
    getCamera: rendererCtrl.getCamera,
    getContainer,
    getOriginOffset: rendererCtrl.getOriginOffset,
    measureState: measurement.state,
    areaState: areaMeasurement.state,
    angleState: angleMeasurement.state,
    measureUnitsScale,
    currentMeasureUnits,
    areaUnitScales,
    measureAngleUnits,
  });

  // Cursor world coordinates (coordinates overlay + ruler cursor marker).
  const { cursorX, cursorY, isCursorVisible, cursorWorld, handleMouseMove, handleMouseLeave } =
    useCursorCoordinates({
      getContainer,
      getCamera: rendererCtrl.getCamera,
      getOriginOffset: rendererCtrl.getOriginOffset,
      isTracking: showCoordinates || showRulers,
    });

  // Live camera / controls / origin for the rulers (set after Three.js init so
  // the rulers re-render once the scene exists).
  const [rulerCamera, setRulerCamera] = useState<OrthographicCamera | null>(null);
  const [rulerControls, setRulerControls] = useState<RulerControls | null>(null);
  const [rulerOriginOffset, setRulerOriginOffset] = useState({ x: 0, y: 0 });

  const refreshRulerOriginOffset = useCallback(() => {
    const oo = rendererCtrl.getOriginOffset();
    setRulerOriginOffset((prev) =>
      prev.x !== oo.x || prev.y !== oo.y ? { x: oo.x, y: oo.y } : prev,
    );
  }, [rendererCtrl]);

  /**
   * Apply the current layer-visibility set to the rendered scene and to the
   * picking index (hidden layers must not be clickable / hoverable). Later
   * stages extend this to rectangle-selection / snap visible-layer sets.
   */
  const syncLayerVisibility = useCallback(() => {
    const visible = getVisibleLayerNames();
    rendererCtrl.applyLayerVisibility(visible);
    picking.setVisibleLayers(visible);
    rectSelection.setVisibleLayers(visible);
    snap.setVisibleLayers(visible);
  }, [rendererCtrl, getVisibleLayerNames, picking, rectSelection, snap]);

  const initLayersFromDXF = useCallback(
    (dxf: DxfData, dark?: boolean) => {
      const dxfLayers = (dxf.tables?.layer?.layers || {}) as Record<string, DxfLayer>;
      const entityLayerCounts: Record<string, number> = {};
      // Count via the flat index (top-level + INSERT ATTRIBs + block entities)
      // so the panel count matches hover highlight and includes block-only layers.
      const index = buildEntityIndex(dxf);
      for (const entity of index.values()) {
        const layerName = entity.layer || "0";
        entityLayerCounts[layerName] = (entityLayerCounts[layerName] || 0) + 1;
      }
      initLayers(dxfLayers, entityLayerCounts, dark);
    },
    [initLayers],
  );

  const handleToggleLayer = useCallback(
    (layerName: string) => {
      toggleLayerVisibility(layerName);
      syncLayerVisibility();
    },
    [toggleLayerVisibility, syncLayerVisibility],
  );

  const handleShowAllLayers = useCallback(() => {
    showAllLayers();
    syncLayerVisibility();
  }, [showAllLayers, syncLayerVisibility]);

  const handleHideAllLayers = useCallback(() => {
    hideAllLayers();
    syncLayerVisibility();
  }, [hideAllLayers, syncLayerVisibility]);

  const handleLayerHover = useCallback(
    (layerName: string | null) => {
      propsRef.current.onLayerHover?.(layerName);
      if (!(propsRef.current.highlightOnHover ?? true)) return;
      if (!layerName) {
        highlightCtl.clear();
        rendererCtrl.render();
        return;
      }
      const dxf = activeDxfRef.current;
      if (!dxf) return;
      const handles = findEntitiesByLayer(dxf, layerName);
      if (handles.length === 0) {
        highlightCtl.clear();
        rendererCtrl.render();
        return;
      }
      const entries: PickingEntry[] = [];
      for (const h of handles) entries.push(...picking.getPickingEntries(h));
      highlightCtl.highlight(entries);
      rendererCtrl.render();
    },
    [highlightCtl, rendererCtrl, picking],
  );

  // --- Picking + highlight -------------------------------------------------

  const setupPickingForDxf = useCallback(
    (dxf: DxfData): void => {
      if (!(propsRef.current.pickingEnabled ?? false)) return;
      const scene = rendererCtrl.getScene();
      if (!scene) return;
      const oo = rendererCtrl.getOriginOffset();
      const offset = { x: oo.x, y: oo.y, z: oo.z };
      picking.installPickingData(dxf, scene, offset);
      highlightCtl.init(scene, offset, propsRef.current.highlightColor ?? "#ffaa00");
      const entityIdx = picking.getEntityIndex();
      const pickingIdx = picking.getPickingIndex();
      if (entityIdx && pickingIdx) {
        highlightCtl.installHighlightData(entityIdx, pickingIdx);
      }
      if (pickingIdx) {
        rectSelection.installRectData(pickingIdx, offset);
      }
      if (propsRef.current.pickingDebug ?? false) picking.setDebug(true);
      lastDxfForPickingRef.current = dxf;
    },
    [picking, highlightCtl, rectSelection, rendererCtrl],
  );

  const teardownPicking = useCallback((): void => {
    highlightCtl.removeHighlightData();
    highlightCtl.dispose();
    picking.removePickingData(rendererCtrl.getScene());
    rectSelection.removeRectData();
    lastDxfForPickingRef.current = null;
    setSelectedEntity(null);
  }, [highlightCtl, picking, rectSelection, rendererCtrl]);

  const collectHighlightEntries = useCallback(
    (event: PickingEvent): PickingEntry[] => {
      if ((propsRef.current.highlightAssociated ?? true) && event.association) {
        const entries: PickingEntry[] = [];
        for (const handle of event.association.members) {
          entries.push(...picking.getPickingEntries(handle));
        }
        return entries;
      }
      if (event.pickId) {
        const entry = picking.getPickingEntryById(event.pickId);
        if (entry) return [entry];
      }
      return [];
    },
    [picking],
  );

  const handleEntityHover = useCallback(
    (event: PickingEvent | null): void => {
      propsRef.current.onEntityHover?.(event);
      if (!(propsRef.current.highlightOnHover ?? true)) return;
      if (!event) {
        highlightCtl.clear();
      } else {
        const entries = collectHighlightEntries(event);
        if (entries.length > 0) highlightCtl.highlight(entries);
      }
      rendererCtrl.render();
    },
    [highlightCtl, collectHighlightEntries, rendererCtrl],
  );

  const handleEntityClick = useCallback((event: PickingEvent): void => {
    setSelectedEntity(event);
    propsRef.current.onEntityClick?.(event);
  }, []);

  const attachPickingIfReady = useCallback((): void => {
    if (!(propsRef.current.pickingEnabled ?? false)) return;
    const renderer = rendererCtrl.getRenderer();
    const camera = rendererCtrl.getCamera();
    if (!renderer || !camera) return;
    picking.attach(renderer.domElement, camera, {
      onHover: handleEntityHover,
      onClick: handleEntityClick,
    });
  }, [picking, rendererCtrl, handleEntityHover, handleEntityClick]);

  const highlight = useCallback(
    (handles: string[]): void => {
      const entries: PickingEntry[] = [];
      for (const h of handles) {
        entries.push(...picking.getPickingEntries(h));
      }
      highlightCtl.highlight(entries);
      rendererCtrl.render();
    },
    [picking, highlightCtl, rendererCtrl],
  );

  const clearHighlight = useCallback((): void => {
    highlightCtl.clear();
    rendererCtrl.render();
  }, [highlightCtl, rendererCtrl]);

  const getAssociations = useCallback(
    (): EntityAssociation[] => picking.getAssociations(),
    [picking],
  );
  const findAssociationsByHandle = useCallback(
    (handle: string): EntityAssociation[] => picking.findAssociationsByHandle(handle),
    [picking],
  );

  const zoomToEntity = useCallback(
    (handles: string[]): void => {
      const index = picking.getPickingIndex();
      if (!index) return;
      const box = getZoomBox(index, handles, { originOffset: rendererCtrl.getOriginOffset() });
      if (box) rendererCtrl.zoomToBox(box);
    },
    [picking, rendererCtrl],
  );

  const zoomToLayer = useCallback(
    (layerName: string): void => {
      const index = picking.getPickingIndex();
      if (!index) return;
      const box = getZoomBoxForLayer(index, layerName, {
        originOffset: rendererCtrl.getOriginOffset(),
      });
      if (box) rendererCtrl.zoomToBox(box);
    },
    [picking, rendererCtrl],
  );

  const getPickingIndex = useCallback((): PickingIndex | null => picking.getPickingIndex(), [picking]);

  // --- Rectangle selection -------------------------------------------------

  const handleRectSelectionStart = useCallback((mode: RectSelectionResolvedMode): void => {
    propsRef.current.onSelectionStart?.(mode);
  }, []);

  const handleRectSelectionSelect = useCallback(
    (entries: PickingEntry[]): void => {
      const events = entries.map((entry) => picking.buildEventForEntry(entry));
      propsRef.current.onEntitiesSelect?.(events);
    },
    [picking],
  );

  const handleRectSelectionEnd = useCallback((): void => {
    propsRef.current.onSelectionEnd?.();
  }, []);

  const attachRectSelectionIfReady = useCallback((): void => {
    if (
      !(propsRef.current.rectangleSelection ?? false) ||
      !(propsRef.current.pickingEnabled ?? false)
    ) {
      return;
    }
    const renderer = rendererCtrl.getRenderer();
    const camera = rendererCtrl.getCamera();
    if (!renderer || !camera) return;
    rectSelection.attach(renderer.domElement, camera, rendererCtrl.getControls(), {
      onStart: handleRectSelectionStart,
      onSelect: handleRectSelectionSelect,
      onEnd: handleRectSelectionEnd,
    });
    rectSelection.setModifier(propsRef.current.rectangleSelectionModifier ?? "shift");
    rectSelection.setMode(propsRef.current.rectangleSelectionMode ?? "auto");
    rectSelection.setEnabled(true);
  }, [
    rectSelection,
    rendererCtrl,
    handleRectSelectionStart,
    handleRectSelectionSelect,
    handleRectSelectionEnd,
  ]);

  // --- Measurement + snap --------------------------------------------------

  /**
   * Feed the snap controller the indexes it needs. Reuses the picking index when
   * picking is on (free); otherwise builds them directly, but only once a
   * measurement mode is active. Clears the data when snapping is off / no DXF.
   */
  const ensureSnapData = useCallback(
    (dxf?: DxfData | null): void => {
      const data = dxf ?? activeDxfRef.current;
      if (!(propsRef.current.snapToGeometry ?? true) || !data) {
        snap.setData(null, null);
        return;
      }
      const pi = picking.getPickingIndex();
      const ei = picking.getEntityIndex();
      if (pi && ei) {
        snap.setData(pi, ei);
        return;
      }
      if (measureModeRef.current === "none") {
        snap.setData(null, null);
        return;
      }
      snap.setData(buildPickingIndex(data), buildEntityIndex(data));
    },
    [snap, picking],
  );

  const handleMeasureResult = useCallback((result: MeasureResult): void => {
    propsRef.current.onMeasure?.(result);
  }, []);
  const handleMeasureAreaResult = useCallback((result: AreaMeasureResult): void => {
    propsRef.current.onMeasureArea?.(result);
  }, []);
  const handleMeasureAngleResult = useCallback((result: AngleMeasureResult): void => {
    propsRef.current.onMeasureAngle?.(result);
  }, []);
  const handleMeasureCancel = useCallback((): void => {
    propsRef.current.onMeasureCancel?.();
  }, []);

  // Suspend / restore competing pointer tools (picking; rectangle-selection is
  // added in a later stage) so they don't double-fire on a measurement click.
  const suspendCompetingTools = useCallback((): void => {
    picking.setEnabled(false);
    rectSelection.setEnabled(false);
  }, [picking, rectSelection]);
  const restoreCompetingTools = useCallback((): void => {
    picking.setEnabled(propsRef.current.pickingEnabled ?? false);
    rectSelection.setEnabled(
      (propsRef.current.rectangleSelection ?? false) && (propsRef.current.pickingEnabled ?? false),
    );
  }, [picking, rectSelection]);

  const clearMeasurements = useCallback((): void => {
    measurement.clear();
    areaMeasurement.clear();
    angleMeasurement.clear();
  }, [measurement, areaMeasurement, angleMeasurement]);

  const attachMeasurementIfReady = useCallback((): void => {
    const renderer = rendererCtrl.getRenderer();
    const camera = rendererCtrl.getCamera();
    const scene = rendererCtrl.getScene();
    if (!renderer || !camera || !scene) return;
    const controls = rendererCtrl.getControls() as unknown as Parameters<typeof measurement.attach>[3];
    const render = () => rendererCtrl.render();
    const color = propsRef.current.measureColor ?? "#ff6b1a";

    // Shared geometry-snap controller + resolver injected into every tool.
    snap.attach(renderer.domElement, scene, camera, rendererCtrl.getOriginOffset, render);
    snap.setColor(color);
    snap.setEnabled(propsRef.current.snapToGeometry ?? true);
    ensureSnapData();
    const snapResolver = (raw: MeasurePoint, x: number, y: number): MeasurePoint =>
      snap.resolve(raw, x, y);

    measurement.attach(renderer.domElement, scene, camera, controls, rendererCtrl.getOriginOffset, render, {
      onResult: handleMeasureResult,
      onCancel: handleMeasureCancel,
      snap: snapResolver,
    });
    measurement.setColor(color);
    measurement.setUnitsScale(measureUnitsScaleRef.current, currentMeasureUnitsRef.current);

    areaMeasurement.attach(renderer.domElement, scene, camera, controls, rendererCtrl.getOriginOffset, render, {
      onResult: handleMeasureAreaResult,
      onCancel: handleMeasureCancel,
      snap: snapResolver,
    });
    areaMeasurement.setColor(color);
    areaMeasurement.setUnits(areaUnitScalesRef.current);

    angleMeasurement.attach(renderer.domElement, scene, camera, controls, rendererCtrl.getOriginOffset, render, {
      onResult: handleMeasureAngleResult,
      onCancel: handleMeasureCancel,
      snap: snapResolver,
    });
    angleMeasurement.setColor(color);
    angleMeasurement.setUnits(propsRef.current.measureAngleUnits ?? "deg");

    // Enable whichever tool the current measureMode selects.
    const mode = measureModeRef.current;
    if (mode === "distance") {
      measurement.setEnabled(true);
      suspendCompetingTools();
    } else if (mode === "area") {
      areaMeasurement.setEnabled(true);
      suspendCompetingTools();
    } else if (mode === "angle") {
      angleMeasurement.setEnabled(true);
      suspendCompetingTools();
    }
  }, [
    rendererCtrl,
    snap,
    measurement,
    areaMeasurement,
    angleMeasurement,
    ensureSnapData,
    handleMeasureResult,
    handleMeasureAreaResult,
    handleMeasureAngleResult,
    handleMeasureCancel,
    suspendCompetingTools,
  ]);

  const setMeasureMode = useCallback((mode: MeasureMode): void => {
    if (propsRef.current.measureMode === undefined) setInternalMeasureMode(mode);
    propsRef.current.onMeasureModeChange?.(mode);
  }, []);

  // Toolbar toggles: a second press on the active tool turns it off.
  const toggleMeasureDistance = useCallback(() => {
    setMeasureMode(measureModeRef.current === "distance" ? "none" : "distance");
  }, [setMeasureMode]);
  const toggleMeasureArea = useCallback(() => {
    setMeasureMode(measureModeRef.current === "area" ? "none" : "area");
  }, [setMeasureMode]);
  const toggleMeasureAngle = useCallback(() => {
    setMeasureMode(measureModeRef.current === "angle" ? "none" : "angle");
  }, [setMeasureMode]);

  const hasSameHiddenSet = useCallback(
    (a: readonly string[]): boolean => {
      const current = getHiddenLayerNames();
      if (a.length !== current.length) return false;
      const set = new Set(a);
      for (const x of current) if (!set.has(x)) return false;
      return true;
    },
    [getHiddenLayerNames],
  );

  const handleLoadError = useCallback(
    (error: unknown, fallbackMsg: string) => {
      clearLayers();
      const msg = setError(error, fallbackMsg);
      propsRef.current.onError?.(msg);
      propsRef.current.onDxfLoaded?.(false);
      propsRef.current.onDxfData?.(null);
    },
    [setError, clearLayers],
  );

  const loadDXFFromText = useCallback(
    async (dxfText: string) => {
      clearError();
      setSelectedEntity(null);
      clearMeasurements();
      setIsLoading(true);
      try {
        setLoadingPhase("parsing");
        const dxf = await rendererCtrl.parseDXFAsync(dxfText);
        lastLoadedDxfRef.current = dxf;
        setLoadedDxf(dxf);

        setLoadingPhase("rendering");
        const unsupported = await rendererCtrl.displayDXF(
          dxf,
          propsRef.current.darkTheme,
          propsRef.current.fontUrl || undefined,
        );
        initLayersFromDXF(dxf, propsRef.current.darkTheme);
        syncLayerVisibility();
        setupPickingForDxf(dxf);
        ensureSnapData(dxf);
        refreshRulerOriginOffset();
        propsRef.current.onDxfLoaded?.(true);
        propsRef.current.onDxfData?.(dxf);
        if (unsupported && unsupported.length > 0) {
          propsRef.current.onUnsupportedEntities?.(unsupported);
        }
      } catch (error) {
        handleLoadError(error, "Unknown error loading DXF");
      } finally {
        setLoadingPhase("");
        setIsLoading(false);
      }
    },
    [
      rendererCtrl,
      setIsLoading,
      clearError,
      clearMeasurements,
      handleLoadError,
      initLayersFromDXF,
      syncLayerVisibility,
      setupPickingForDxf,
      ensureSnapData,
      refreshRulerOriginOffset,
    ],
  );

  const loadDXFFromData = useCallback(
    async (data: DxfData) => {
      clearError();
      setSelectedEntity(null);
      clearMeasurements();
      setIsLoading(true);
      setLoadingPhase("rendering");
      setLoadedDxf(data);
      try {
        const unsupported = await rendererCtrl.displayDXF(
          data,
          propsRef.current.darkTheme,
          propsRef.current.fontUrl || undefined,
        );
        initLayersFromDXF(data, propsRef.current.darkTheme);
        syncLayerVisibility();
        setupPickingForDxf(data);
        ensureSnapData(data);
        refreshRulerOriginOffset();
        propsRef.current.onDxfLoaded?.(true);
        propsRef.current.onDxfData?.(data);
        if (unsupported && unsupported.length > 0) {
          propsRef.current.onUnsupportedEntities?.(unsupported);
        }
      } catch (error) {
        handleLoadError(error, "Unknown error displaying DXF");
      } finally {
        setLoadingPhase("");
        setIsLoading(false);
      }
    },
    [
      rendererCtrl,
      setIsLoading,
      clearError,
      clearMeasurements,
      handleLoadError,
      initLayersFromDXF,
      syncLayerVisibility,
      setupPickingForDxf,
      ensureSnapData,
      refreshRulerOriginOffset,
    ],
  );

  const loadDXFFromUrl = useCallback(
    async (fetchUrl: string) => {
      clearError();
      setIsLoading(true);
      setLoadingPhase("fetching");
      try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const text = await response.text();
        await loadDXFFromText(text);
      } catch (error) {
        // loadDXFFromText has its own error handling; this catches fetch errors only
        handleLoadError(error, "Failed to fetch DXF");
      } finally {
        setLoadingPhase("");
        setIsLoading(false);
      }
    },
    [clearError, setIsLoading, loadDXFFromText, handleLoadError],
  );

  const handleResetView = useCallback(() => {
    rendererCtrl.resetView();
    propsRef.current.onResetView?.();
  }, [rendererCtrl]);

  const resize = useCallback(() => {
    if (canvasMountRef.current) rendererCtrl.handleResize(canvasMountRef.current);
  }, [rendererCtrl]);

  const exportToPNG = useCallback(() => {
    const r = rendererCtrl.getRenderer();
    if (!r) return;
    const link = document.createElement("a");
    link.download = (propsRef.current.fileName || "dxf-export").replace(/\.dxf$/i, "") + ".png";
    link.href = r.domElement.toDataURL("image/png");
    link.click();
  }, [rendererCtrl]);

  const retry = useCallback(() => {
    const p = propsRef.current;
    if (p.url) {
      loadDXFFromUrl(p.url);
    } else if (p.dxfData && (p.dxfData.entities?.length ?? 0) > 0) {
      loadDXFFromData(p.dxfData);
    }
  }, [loadDXFFromUrl, loadDXFFromData]);

  // Keep the wrapper refs current for the behavior hooks declared near the top.
  loadTextRef.current = loadDXFFromText;
  resetViewRef.current = handleResetView;

  // Mount: init Three.js, kick off the initial load, observe resize. The single
  // effect keeps init/dispose balanced and StrictMode-safe (mount → cleanup →
  // mount re-runs initThreeJS after a full cleanup).
  useEffect(() => {
    const mount = canvasMountRef.current;
    const root = containerRef.current;
    if (!mount || !root) return;

    rendererCtrl.initThreeJS(mount, {
      enableControls: true,
      aaMode: propsRef.current.antialiasing ?? "msaa",
    });

    attachPickingIfReady();
    attachRectSelectionIfReady();
    attachMeasurementIfReady();

    // Reposition the measurement labels on camera pan/zoom — only while a
    // measurement mode is active, so idle panning doesn't re-render.
    const controls = rendererCtrl.getControls();
    const onControlsChange = () => {
      if (measureModeRef.current !== "none") bumpCameraTick();
    };
    if (controls) controls.addEventListener("change", onControlsChange);

    // Feed the live camera / controls into the rulers (they re-render with these).
    setRulerCamera(rendererCtrl.getCamera());
    setRulerControls((controls as RulerControls | null) ?? null);

    const renderer = rendererCtrl.getRenderer();
    if (renderer && (propsRef.current.keyboardNavigation ?? true)) {
      keyboardNav.attach(renderer.domElement);
    }

    const p = propsRef.current;
    if (p.url) {
      loadDXFFromUrl(p.url);
    } else if (p.dxfData && (p.dxfData.entities?.length ?? 0) > 0) {
      loadDXFFromData(p.dxfData);
    }

    const ro = new ResizeObserver(() => {
      if (canvasMountRef.current) rendererCtrl.handleResize(canvasMountRef.current);
    });
    ro.observe(root);

    return () => {
      ro.disconnect();
      if (controls) controls.removeEventListener("change", onControlsChange);
      picking.detach();
      rectSelection.detach();
      measurement.dispose();
      areaMeasurement.dispose();
      angleMeasurement.dispose();
      snap.dispose();
      keyboardNav.detach();
      teardownPicking();
      rendererCtrl.cleanup();
    };
  }, [
    rendererCtrl,
    loadDXFFromUrl,
    loadDXFFromData,
    attachPickingIfReady,
    attachRectSelectionIfReady,
    attachMeasurementIfReady,
    bumpCameraTick,
    picking,
    rectSelection,
    teardownPicking,
    measurement,
    areaMeasurement,
    angleMeasurement,
    snap,
    keyboardNav,
  ]);

  // Prop-change effects. Each guards against the initial render (the mount
  // effect performs the first load) and StrictMode re-runs by comparing against
  // a ref seeded with the initial prop value.
  const urlRef = useRef(url);
  useEffect(() => {
    if (urlRef.current === url) return;
    urlRef.current = url;
    if (url) loadDXFFromUrl(url);
  }, [url, loadDXFFromUrl]);

  const dxfDataRef = useRef(dxfData);
  useEffect(() => {
    if (dxfDataRef.current === dxfData) return;
    dxfDataRef.current = dxfData;
    if (dxfData && dxfData.entities && dxfData.entities.length > 0 && dxfData !== lastLoadedDxfRef.current) {
      loadDXFFromData(dxfData);
    }
  }, [dxfData, loadDXFFromData]);

  const darkRef = useRef(darkTheme);
  useEffect(() => {
    if (darkRef.current === darkTheme) return;
    darkRef.current = darkTheme;
    // Instant theme switch: update material colors + scene background + layer swatches.
    rendererCtrl.switchTheme(darkTheme);
    updateLayerThemeColors(darkTheme);
  }, [darkTheme, rendererCtrl, updateLayerThemeColors]);

  // Push external `hiddenLayers` updates into useLayers (controlled mode). The
  // same-set guard short-circuits the echo from our own onChange notification.
  useEffect(() => {
    if (hiddenLayers === undefined) return;
    if (hasSameHiddenSet(hiddenLayers)) return;
    setHiddenLayers(hiddenLayers);
    syncLayerVisibility();
  }, [hiddenLayers, hasSameHiddenSet, setHiddenLayers, syncLayerVisibility]);

  // Picking toggled at runtime (skip the initial render — mount handles setup).
  const pickingEnabledRef = useRef(pickingEnabled);
  useEffect(() => {
    if (pickingEnabledRef.current === pickingEnabled) return;
    pickingEnabledRef.current = pickingEnabled;
    picking.setEnabled(pickingEnabled);
    if (!pickingEnabled) {
      teardownPicking();
      rectSelection.detach();
    } else {
      if (lastDxfForPickingRef.current == null) {
        const dxf = activeDxfRef.current;
        if (dxf && (dxf.entities?.length ?? 0) > 0) setupPickingForDxf(dxf);
      }
      attachPickingIfReady();
      attachRectSelectionIfReady();
      syncLayerVisibility();
    }
    // Snap reuses the picking index when available; rebuild its data either way.
    ensureSnapData();
  }, [
    pickingEnabled,
    picking,
    rectSelection,
    teardownPicking,
    setupPickingForDxf,
    attachPickingIfReady,
    attachRectSelectionIfReady,
    syncLayerVisibility,
    ensureSnapData,
  ]);

  const rectangleSelectionRef = useRef(rectangleSelection);
  useEffect(() => {
    if (rectangleSelectionRef.current === rectangleSelection) return;
    rectangleSelectionRef.current = rectangleSelection;
    if (rectangleSelection) attachRectSelectionIfReady();
    else rectSelection.detach();
  }, [rectangleSelection, rectSelection, attachRectSelectionIfReady]);

  const rectModifierRef = useRef(rectangleSelectionModifier);
  useEffect(() => {
    if (rectModifierRef.current === rectangleSelectionModifier) return;
    rectModifierRef.current = rectangleSelectionModifier;
    rectSelection.setModifier(rectangleSelectionModifier);
  }, [rectangleSelectionModifier, rectSelection]);

  const rectModeRef = useRef(rectangleSelectionMode);
  useEffect(() => {
    if (rectModeRef.current === rectangleSelectionMode) return;
    rectModeRef.current = rectangleSelectionMode;
    rectSelection.setMode(rectangleSelectionMode);
  }, [rectangleSelectionMode, rectSelection]);

  const pickingDebugRef = useRef(pickingDebug);
  useEffect(() => {
    if (pickingDebugRef.current === pickingDebug) return;
    pickingDebugRef.current = pickingDebug;
    picking.setDebug(pickingDebug);
    rendererCtrl.render();
  }, [pickingDebug, picking, rendererCtrl]);

  const highlightColorRef = useRef(highlightColor);
  useEffect(() => {
    if (highlightColorRef.current === highlightColor) return;
    highlightColorRef.current = highlightColor;
    highlightCtl.setColor(highlightColor);
  }, [highlightColor, highlightCtl]);

  // Measurement mode switching (skip the initial render — the mount effect's
  // attachMeasurementIfReady enables the initial mode).
  const measureModeWatchRef = useRef(measureMode);
  useEffect(() => {
    if (measureModeWatchRef.current === measureMode) return;
    measureModeWatchRef.current = measureMode;
    // Disable the non-target tools first — that restores the LEFT mouse button
    // each tool steals — before the target tool steals it again.
    if (measureMode !== "distance") measurement.setEnabled(false);
    if (measureMode !== "area") areaMeasurement.setEnabled(false);
    if (measureMode !== "angle") angleMeasurement.setEnabled(false);
    if (measureMode === "distance") measurement.setEnabled(true);
    if (measureMode === "area") areaMeasurement.setEnabled(true);
    if (measureMode === "angle") angleMeasurement.setEnabled(true);
    // Measurement tools intercept clicks before picking, so suspend it while a
    // tool is active and restore on `none`.
    if (measureMode === "none") restoreCompetingTools();
    else suspendCompetingTools();
    snap.clear();
    if (measureMode !== "none") ensureSnapData();
  }, [
    measureMode,
    measurement,
    areaMeasurement,
    angleMeasurement,
    restoreCompetingTools,
    suspendCompetingTools,
    snap,
    ensureSnapData,
  ]);

  const measureColorRef = useRef(measureColor);
  useEffect(() => {
    if (measureColorRef.current === measureColor) return;
    measureColorRef.current = measureColor;
    measurement.setColor(measureColor);
    areaMeasurement.setColor(measureColor);
    angleMeasurement.setColor(measureColor);
    snap.setColor(measureColor);
  }, [measureColor, measurement, areaMeasurement, angleMeasurement, snap]);

  const snapToGeometryRef = useRef(snapToGeometry);
  useEffect(() => {
    if (snapToGeometryRef.current === snapToGeometry) return;
    snapToGeometryRef.current = snapToGeometry;
    snap.setEnabled(snapToGeometry);
    ensureSnapData();
  }, [snapToGeometry, snap, ensureSnapData]);

  const measureAngleUnitsRef = useRef(measureAngleUnits);
  useEffect(() => {
    if (measureAngleUnitsRef.current === measureAngleUnits) return;
    measureAngleUnitsRef.current = measureAngleUnits;
    angleMeasurement.setUnits(measureAngleUnits);
  }, [measureAngleUnits, angleMeasurement]);

  // Unit scales kept in sync with the tools (idempotent — safe on every render).
  useEffect(() => {
    measurement.setUnitsScale(measureUnitsScale, currentMeasureUnits);
  }, [measureUnitsScale, currentMeasureUnits, measurement]);

  useEffect(() => {
    areaMeasurement.setUnits(areaUnitScales);
  }, [areaUnitScales, areaMeasurement]);

  const keyboardNavRef = useRef(keyboardNavigation);
  useEffect(() => {
    if (keyboardNavRef.current === keyboardNavigation) return;
    keyboardNavRef.current = keyboardNavigation;
    keyboardNav.setEnabled(keyboardNavigation);
    if (keyboardNavigation) {
      const renderer = rendererCtrl.getRenderer();
      if (renderer) keyboardNav.attach(renderer.domElement);
    } else {
      keyboardNav.detach();
    }
  }, [keyboardNavigation, keyboardNav, rendererCtrl]);

  // Forward renderer (WebGL init) errors to the consumer.
  useEffect(() => {
    if (renderer.error) propsRef.current.onError?.(renderer.error);
  }, [renderer.error]);

  useImperativeHandle(
    ref,
    () => ({
      loadDXFFromText,
      loadDXFFromData,
      loadDXFFromUrl,
      loadDXFFromBuffer,
      loadDXFFromBlob,
      resetView: handleResetView,
      resize,
      exportToPNG,
      getRenderer: rendererCtrl.getRenderer,
      highlight,
      clearHighlight,
      clearSelection: () => setSelectedEntity(null),
      zoomToEntity,
      zoomToLayer,
      getAssociations,
      findAssociationsByHandle,
      getPickingIndex,
      clearMeasure: clearMeasurements,
      setMeasureMode,
    }),
    [
      loadDXFFromText,
      loadDXFFromData,
      loadDXFFromUrl,
      loadDXFFromBuffer,
      loadDXFFromBlob,
      handleResetView,
      resize,
      exportToPNG,
      rendererCtrl,
      highlight,
      clearHighlight,
      zoomToEntity,
      zoomToLayer,
      getAssociations,
      findAssociationsByHandle,
      getPickingIndex,
      clearMeasurements,
      setMeasureMode,
    ],
  );

  return (
    <div
      ref={containerRef}
      className={cx("dxfk-viewer", darkTheme && "dxfk-dark", classes?.root)}
      role="region"
      aria-label="DXF drawing viewer"
      aria-busy={renderer.isLoading}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={canvasMountRef} className="dxfk-canvas-mount" />

      {hasDXFData && showRulers && (
        <>
          <Ruler
            orientation="horizontal"
            camera={rulerCamera}
            controls={rulerControls}
            originOffset={rulerOriginOffset}
            cursorWorld={cursorWorld}
            isCursorVisible={isCursorVisible}
            unitsScale={rulerUnitsScale}
            darkTheme={darkTheme}
            className={classes?.rulerHorizontal}
          />
          <Ruler
            orientation="vertical"
            camera={rulerCamera}
            controls={rulerControls}
            originOffset={rulerOriginOffset}
            cursorWorld={cursorWorld}
            isCursorVisible={isCursorVisible}
            unitsScale={rulerUnitsScale}
            darkTheme={darkTheme}
            className={classes?.rulerVertical}
          />
          <div
            className={cx("dxfk-ruler-corner", darkTheme && "dxfk-dark", classes?.rulerCorner)}
            aria-hidden="true"
          >
            {rulerUnitsLabel}
          </div>
        </>
      )}

      {!renderer.webGLSupported && (
        <div className="dxfk-message-overlay">
          <div className="dxfk-message-content">
            {ErrorIcon}
            <div className="dxfk-message-title">WebGL Not Supported</div>
            <div className="dxfk-message-text">
              Update your browser or enable hardware acceleration
            </div>
          </div>
        </div>
      )}

      {hasDXFData && (
        <div className={cx("dxfk-overlay-grid", showRulers && "dxfk-overlay-grid--with-rulers")}>
          {OVERLAY_POSITIONS.map((pos) => (
            <div key={pos} className={`dxfk-overlay-cell dxfk-overlay-cell--${pos}`}>
              {fileNamePosition === pos && showFileName && fileName && (
                <div className={cx("dxfk-file-name-overlay", classes?.fileNameOverlay)}>
                  {fileName}
                </div>
              )}

              {coordinatesPosition === pos && (showCoordinates || showZoomLevel) && (
                <div className={cx("dxfk-coordinates-overlay", classes?.coordinatesOverlay)}>
                  {showCoordinates && (
                    <>
                      <div className="dxfk-coord-row">
                        <span className="dxfk-coord-label">X:</span>
                        <span
                          className={cx("dxfk-coord-value", !isCursorVisible && "dxfk-coord-value--na")}
                        >
                          {isCursorVisible ? cursorX.toFixed(2) : "N/A"}
                        </span>
                      </div>
                      <div className="dxfk-coord-row">
                        <span className="dxfk-coord-label">Y:</span>
                        <span
                          className={cx("dxfk-coord-value", !isCursorVisible && "dxfk-coord-value--na")}
                        >
                          {isCursorVisible ? cursorY.toFixed(2) : "N/A"}
                        </span>
                      </div>
                    </>
                  )}
                  {showZoomLevel && (
                    <div className="dxfk-coord-row">
                      <span className="dxfk-coord-value dxfk-zoom-value">{renderer.zoomPercent}%</span>
                    </div>
                  )}
                </div>
              )}

              {debugPosition === pos && showDebugInfo && (
                <div className={cx("dxfk-debug-overlay", classes?.debugOverlay)}>
                  <span>{renderer.debugInfo.fps} FPS</span>
                  <span>{renderer.debugInfo.drawCalls} draws</span>
                  <span>{formatK(renderer.debugInfo.lines)} lines</span>
                  <span>{formatK(renderer.debugInfo.triangles)} tris</span>
                </div>
              )}

              {showLayerPanel && layerPanelPosition === pos && layerList.length > 0 && (
                <LayerPanel
                  className={classes?.layerPanel}
                  layers={layerList}
                  darkTheme={darkTheme}
                  groupLayers={groupLayers}
                  onToggleLayer={handleToggleLayer}
                  onShowAll={handleShowAllLayers}
                  onHideAll={handleHideAllLayers}
                  onLayerHover={handleLayerHover}
                />
              )}

              {toolbarPosition === pos &&
                (renderToolbar ? (
                  renderToolbar({
                    resetView: handleResetView,
                    exportToPNG,
                    toggleFullscreen,
                    isFullscreen,
                    measureMode,
                    toggleMeasureDistance,
                    toggleMeasureArea,
                    toggleMeasureAngle,
                    measureDistanceActive: measureMode === "distance",
                    measureAreaActive: measureMode === "area",
                    measureAngleActive: measureMode === "angle",
                  })
                ) : (
                  <ViewerToolbar
                    className={classes?.toolbar}
                    showExportButton={showExportButton}
                    showResetButton={showResetButton}
                    showFullscreenButton={showFullscreenButton}
                    showMeasureButton={showMeasureButton}
                    measureActive={measureMode === "distance"}
                    showMeasureAreaButton={showMeasureAreaButton}
                    measureAreaActive={measureMode === "area"}
                    showMeasureAngleButton={showMeasureAngleButton}
                    measureAngleActive={measureMode === "angle"}
                    isFullscreen={isFullscreen}
                    darkTheme={darkTheme}
                    extra={toolbarExtra}
                    onExport={exportToPNG}
                    onResetView={handleResetView}
                    onToggleFullscreen={toggleFullscreen}
                    onToggleMeasure={toggleMeasureDistance}
                    onToggleMeasureArea={toggleMeasureArea}
                    onToggleMeasureAngle={toggleMeasureAngle}
                  />
                ))}

              {showPropertiesPanel && propertiesPanelPosition === pos && (
                <PropertiesPanel
                  className={classes?.propertiesPanel}
                  event={selectedEntity}
                  darkTheme={darkTheme}
                />
              )}

              {overlayPosition === pos && renderOverlay && (
                <>{renderOverlay({ zoomPercent: renderer.zoomPercent, cursorX, cursorY })}</>
              )}
            </div>
          ))}
        </div>
      )}

      {renderer.isLoading ? (
        <div
          className={cx("dxfk-message-overlay", "dxfk-loading-overlay", classes?.loadingOverlay)}
          role="status"
          aria-live="polite"
        >
          {renderLoading ? (
            renderLoading({ phase: loadingPhase, progress: renderer.displayProgress })
          ) : (
            <div className="dxfk-message-content">
              <div className="dxfk-spinner" />
              <div className="dxfk-message-text">
                {loadingPhase === "fetching"
                  ? "Loading DXF..."
                  : loadingPhase === "parsing"
                    ? "Parsing DXF..."
                    : "Rendering..."}
              </div>
              {loadingPhase === "rendering" && (
                <div className="dxfk-progress-container">
                  <div
                    className="dxfk-progress-bar"
                    style={{ width: renderer.displayProgress * 100 + "%" }}
                  />
                </div>
              )}
              {loadingPhase === "rendering" && (
                <div className="dxfk-progress-text">
                  {Math.round(renderer.displayProgress * 100)}%
                </div>
              )}
            </div>
          )}
        </div>
      ) : errorMessage ? (
        <div
          className={cx("dxfk-message-overlay", "dxfk-error-overlay", classes?.errorOverlay)}
          role="alert"
          aria-live="assertive"
        >
          {renderError ? (
            renderError({ message: errorMessage, retry })
          ) : (
            <div className="dxfk-message-content">
              {ErrorIcon}
              <div className="dxfk-message-title">Error</div>
              <div className="dxfk-message-text">{errorMessage}</div>
            </div>
          )}
        </div>
      ) : !hasDXFData ? (
        <div className={cx("dxfk-message-overlay", classes?.emptyStateOverlay)}>
          {renderEmptyState ? (
            renderEmptyState()
          ) : (
            <div className="dxfk-message-content">
              {PlaceholderIcon}
              <div className="dxfk-message-text">Select a DXF file to view</div>
            </div>
          )}
        </div>
      ) : null}

      {measureLabel && (
        <div
          className={cx("dxfk-measure-label", darkTheme && "dxfk-dark", classes?.measureLabel)}
          style={
            {
              left: measureLabel.left + "px",
              top: measureLabel.top + "px",
              "--dxfk-measure-color": measureColor,
            } as CSSProperties
          }
          aria-live="polite"
        >
          {measureLabel.text}
        </div>
      )}

      {areaLabel && (
        <div
          className={cx(
            "dxfk-measure-area-label",
            darkTheme && "dxfk-dark",
            classes?.measureAreaLabel,
          )}
          style={
            {
              left: areaLabel.left + "px",
              top: areaLabel.top + "px",
              "--dxfk-measure-color": measureColor,
            } as CSSProperties
          }
          aria-live="polite"
        >
          <div className="dxfk-measure-area-row">Area: {areaLabel.areaText}</div>
          <div className="dxfk-measure-area-row dxfk-measure-area-row--secondary">
            Perimeter: {areaLabel.perimeterText}
          </div>
        </div>
      )}

      {angleLabel && (
        <div
          className={cx(
            "dxfk-measure-angle-label",
            darkTheme && "dxfk-dark",
            classes?.measureAngleLabel,
          )}
          style={
            {
              left: angleLabel.left + "px",
              top: angleLabel.top + "px",
              "--dxfk-measure-color": measureColor,
            } as CSSProperties
          }
          aria-live="polite"
        >
          {angleLabel.text}
        </div>
      )}

      {rectScreenRect && (
        <div
          className={cx(
            "dxfk-selection-rect",
            `dxfk-selection-rect--${rectScreenRect.mode}`,
            classes?.selectionRect,
          )}
          style={{
            left: rectScreenRect.x + "px",
            top: rectScreenRect.y + "px",
            width: rectScreenRect.width + "px",
            height: rectScreenRect.height + "px",
          }}
          aria-hidden="true"
        />
      )}

      {isDragOver && (
        <div className={cx("dxfk-message-overlay", "dxfk-drop-overlay", classes?.dropOverlay)}>
          <div className="dxfk-message-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <div className="dxfk-message-text">Drop DXF file here</div>
          </div>
        </div>
      )}
    </div>
  );
});
