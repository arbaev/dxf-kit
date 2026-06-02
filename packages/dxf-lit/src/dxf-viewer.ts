import { LitElement, html, nothing, svg, type PropertyValues, type ComplexAttributeConverter } from "lit";
import { property, state, query } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { Vector3 } from "three";
import type { WebGLRenderer } from "three";
import type {
  DxfData,
  AntialiasingMode,
  GroupLayersByPrefixOptions,
  DxfLayer,
  PickingEntry,
  PickingIndex,
  EntityAssociation,
} from "dxf-render";
import {
  buildEntityIndex,
  buildPickingIndex,
  getZoomBox,
  getZoomBoxForLayer,
  findEntitiesByLayer,
  type MeasurePoint,
} from "dxf-render";
import {
  createPickingController,
  createHighlightController,
  createSnapController,
  createRectangleSelectionController,
  createMeasurementController,
  createAreaMeasurementController,
  createAngleMeasurementController,
  type PickingEvent,
  type PickingController,
  type HighlightController,
  type SnapController,
  type RectSelectionController,
  type RectScreenRect,
  type RectSelectionResolvedMode,
  type MeasurementController,
  type AreaMeasurementController,
  type AngleMeasurementController,
  type MeasureState,
  type AreaMeasureState,
  type AngleMeasureState,
  type MeasureResult,
  type AreaMeasureResult,
  type AngleMeasureResult,
} from "dxf-interaction";
import {
  computeMeasureLabel,
  computeAreaLabel,
  computeAngleLabel,
} from "./utils/measure-labels";
import {
  createKeyboardNavigationController,
  type KeyboardNavigationController,
} from "./render/keyboard-navigation";
import type { MapControls } from "three/addons/controls/MapControls.js";
import { createThreeSceneController, type ThreeSceneController } from "./render/three-scene";
import { createDXFRendererController, type DXFRendererController, type DebugInfo } from "./render/dxf-renderer";
import { LayersController } from "./controllers/layers";
import { computeViewerUnits, type ViewerUnits } from "./utils/viewer-units";
import { viewerStyles } from "./styles";
import type { DxfRulerElement } from "./components/ruler";
import type {
  OverlayPosition,
  MeasureMode,
  RulerUnits,
  AreaUnits,
  AngleUnits,
  LoadingPhase,
} from "./types";

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

/**
 * Boolean attribute converter that supports an explicit `="false"`. Native
 * boolean attributes can't be turned off once the property defaults to `true`
 * (absence reads as `false`, clobbering the default). This converter keeps the
 * property default when the attribute is absent and lets consumers write
 * `show-fullscreen-button="false"` / `picking-enabled="false"` to opt out.
 */
const booleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute: (value) => value !== null && value !== "false" && value !== "0",
  toAttribute: (value) => (value ? "" : null),
};

/** JSON (or comma-separated) array attribute converter — used for `hidden-layers`. */
const stringArrayConverter: ComplexAttributeConverter<string[] | undefined> = {
  fromAttribute: (value) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through to CSV parsing
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  },
  toAttribute: (value) => (value == null ? null : JSON.stringify(value)),
};

const errorIcon = svg`
  <svg class="dxfk-message-icon dxfk-message-icon--error" width="48" height="48"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
`;

const placeholderIcon = svg`
  <svg class="dxfk-message-icon dxfk-message-icon--placeholder" width="64" height="64"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
`;

/**
 * `<dxf-viewer>` — a framework-agnostic Web Component for rendering AutoCAD DXF
 * drawings, built on the dxf-render engine + dxf-interaction controllers. The
 * 1:1 counterpart of dxf-vuer's / dxf-react's `DXFViewer`, with the same
 * `--dxfk-*` theme surface.
 *
 * State that Vue/React passed into scoped slots (measure mode, loading phase,
 * cursor coordinates, …) is surfaced here as readable properties + Custom
 * Events, since native slots can't receive data. See README for the full API.
 */
export class DxfViewerElement extends LitElement {
  static override styles = viewerStyles;

  // --- Data / source -------------------------------------------------------
  /** Parsed DXF object (alternative to `url`). Property only (object). */
  @property({ attribute: false }) dxfData: DxfData | null = null;
  /** HTTP(S) URL to fetch the DXF from. */
  @property({ type: String }) url = "";
  /** Display name shown in the file-name overlay. */
  @property({ type: String, attribute: "file-name" }) fileName = "";
  /** Custom font URL for text rendering. */
  @property({ type: String, attribute: "font-url" }) fontUrl = "";
  /** Antialiasing mode — init-time only; recreate the element to change. */
  @property({ type: String }) antialiasing: AntialiasingMode = "msaa";

  // --- Appearance ----------------------------------------------------------
  /** Dark theme (reflects to the `dark-theme` attribute for CSS theming). */
  @property({ converter: booleanConverter, reflect: true, attribute: "dark-theme" }) darkTheme = false;

  // --- Overlay toggles -----------------------------------------------------
  @property({ converter: booleanConverter, attribute: "show-file-name" }) showFileName = true;
  @property({ converter: booleanConverter, attribute: "show-coordinates" }) showCoordinates = false;
  @property({ converter: booleanConverter, attribute: "show-zoom-level" }) showZoomLevel = false;
  @property({ converter: booleanConverter, attribute: "show-debug-info" }) showDebugInfo = false;
  @property({ converter: booleanConverter, attribute: "show-rulers" }) showRulers = false;
  @property({ converter: booleanConverter, attribute: "show-reset-button" }) showResetButton = false;
  @property({ converter: booleanConverter, attribute: "show-fullscreen-button" }) showFullscreenButton = true;
  @property({ converter: booleanConverter, attribute: "show-export-button" }) showExportButton = false;
  @property({ converter: booleanConverter, attribute: "show-measure-button" }) showMeasureButton = false;
  @property({ converter: booleanConverter, attribute: "show-measure-area-button" }) showMeasureAreaButton = false;
  @property({ converter: booleanConverter, attribute: "show-measure-angle-button" }) showMeasureAngleButton = false;
  @property({ converter: booleanConverter, attribute: "show-properties-panel" }) showPropertiesPanel = false;
  @property({ converter: booleanConverter, attribute: "show-layer-panel" }) showLayerPanel = true;

  // --- Behavior ------------------------------------------------------------
  @property({ converter: booleanConverter, attribute: "allow-drop" }) allowDrop = false;
  @property({ converter: booleanConverter, attribute: "keyboard-navigation" }) keyboardNavigation = true;

  // --- Overlay positions ---------------------------------------------------
  @property({ type: String, attribute: "file-name-position" }) fileNamePosition: OverlayPosition = "top-left";
  @property({ type: String, attribute: "coordinates-position" }) coordinatesPosition: OverlayPosition = "bottom-left";
  @property({ type: String, attribute: "debug-position" }) debugPosition: OverlayPosition = "bottom-center";
  @property({ type: String, attribute: "toolbar-position" }) toolbarPosition: OverlayPosition = "top-right";
  @property({ type: String, attribute: "properties-panel-position" }) propertiesPanelPosition: OverlayPosition = "top-left";
  @property({ type: String, attribute: "overlay-position" }) overlayPosition: OverlayPosition = "top-center";
  @property({ type: String, attribute: "layer-panel-position" }) layerPanelPosition: OverlayPosition = "bottom-right";

  // --- Layers --------------------------------------------------------------
  /** Auto-group layers by name prefix in the panel. Property only (boolean | options). */
  @property({ attribute: false }) groupLayers: boolean | GroupLayersByPrefixOptions = false;
  /** localStorage key prefix for persisting hidden layers (uncontrolled mode). */
  @property({ type: String, attribute: "persist-layers-key" }) persistLayersKey = "";
  /** Controlled hidden-layer names; pair with the `hidden-layers-change` event. */
  @property({ converter: stringArrayConverter, attribute: "hidden-layers" }) hiddenLayers?: string[];

  // --- Picking / selection -------------------------------------------------
  @property({ converter: booleanConverter, attribute: "picking-enabled" }) pickingEnabled = false;
  @property({ converter: booleanConverter, attribute: "highlight-on-hover" }) highlightOnHover = true;
  @property({ converter: booleanConverter, attribute: "highlight-associated" }) highlightAssociated = true;
  @property({ type: String, attribute: "highlight-color" }) highlightColor = "#ffaa00";
  @property({ converter: booleanConverter, attribute: "picking-debug" }) pickingDebug = false;
  @property({ converter: booleanConverter, attribute: "rectangle-selection" }) rectangleSelection = false;
  @property({ type: String, attribute: "rectangle-selection-modifier" }) rectangleSelectionModifier: "shift" | "ctrl" | "alt" = "shift";
  @property({ type: String, attribute: "rectangle-selection-mode" }) rectangleSelectionMode: "auto" | "window" | "crossing" = "auto";

  // --- Units / measurement -------------------------------------------------
  @property({ type: String, attribute: "ruler-units" }) rulerUnits: RulerUnits = "mm";
  @property({ type: String, reflect: true, attribute: "measure-mode" }) measureMode: MeasureMode = "none";
  @property({ type: String, attribute: "measure-units" }) measureUnits?: RulerUnits;
  @property({ type: String, attribute: "measure-area-units" }) measureAreaUnits: AreaUnits = "auto";
  @property({ type: String, attribute: "measure-angle-units" }) measureAngleUnits: AngleUnits = "deg";
  @property({ type: String, attribute: "measure-color" }) measureColor = "#ff6b1a";
  @property({ converter: booleanConverter, attribute: "snap-to-geometry" }) snapToGeometry = true;

  // --- Internal reactive state --------------------------------------------
  @state() private _isLoading = false;
  @state() private _loadingPhase: LoadingPhase = "";
  @state() private _displayProgress = 0;
  @state() private _zoomPercent = 100;
  @state() private _debugInfo: DebugInfo = { fps: 0, drawCalls: 0, triangles: 0, lines: 0 };
  @state() private _errorMessage: string | null = null;
  @state() private _webGLSupported = true;
  @state() private _webGLError: string | null = null;
  @state() private _loadedDxf: DxfData | null = null;
  @state() private _selectedEntity: PickingEvent | null = null;
  @state() private _isFullscreen = false;
  @state() private _isDragOver = false;
  @state() private _cursorX = 0;
  @state() private _cursorY = 0;
  @state() private _isCursorVisible = false;
  @state() private _rectScreenRect: RectScreenRect | null = null;
  @state() private _measureState: MeasureState = { points: [], hoverWorld: null };
  @state() private _areaState: AreaMeasureState = {
    points: [],
    hoverWorld: null,
    closed: false,
    originSnap: false,
  };
  @state() private _angleState: AngleMeasureState = { points: [], hoverWorld: null, closed: false };

  @query(".dxfk-canvas-mount") private _canvasMount!: HTMLDivElement;

  // --- Controllers (created once, live for the element's lifetime) ---------
  private _three: ThreeSceneController = createThreeSceneController({
    setWebGLSupported: (v) => { this._webGLSupported = v; },
    // Scene/WebGL init errors are surfaced via the WebGL overlay, kept separate
    // from `_errorMessage` (DXF load errors) so the empty-state still shows.
    setError: (v) => { this._webGLError = v; },
  });
  private _renderer: DXFRendererController = createDXFRendererController(this._three, {
    setDisplayProgress: (v) => { this._displayProgress = v; },
    setZoomPercent: (v) => { this._zoomPercent = v; },
    setDebugInfo: (v) => { this._debugInfo = v; },
  });
  private _layers = new LayersController(this, {
    getStorageKey: () => (this.persistLayersKey ? `${this.persistLayersKey}:${this.fileName || "default"}` : null),
    getControlledHidden: () => this.hiddenLayers,
    onChange: (hidden) => this._emit("hidden-layers-change", hidden),
  });

  // Interaction controllers (framework-agnostic, from dxf-interaction).
  private _picking: PickingController = createPickingController();
  private _highlight: HighlightController = createHighlightController();
  private _snap: SnapController = createSnapController();
  private _rectSelection: RectSelectionController = createRectangleSelectionController(
    (rect: RectScreenRect | null) => {
      this._rectScreenRect = rect;
    },
  );
  private _measurement: MeasurementController = createMeasurementController((s) => {
    this._measureState = s;
  });
  private _areaMeasurement: AreaMeasurementController = createAreaMeasurementController((s) => {
    this._areaState = s;
  });
  private _angleMeasurement: AngleMeasurementController = createAngleMeasurementController((s) => {
    this._angleState = s;
  });
  private _keyboard: KeyboardNavigationController = createKeyboardNavigationController({
    getCamera: () => this._renderer.getCamera(),
    getControls: () => this._renderer.getControls() as unknown as MapControls | null,
    resetView: () => this.resetView(),
    render: () => this._renderer.render(),
  });

  private _resizeObserver: ResizeObserver | null = null;
  private _dragLeaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;
  private _lastLoadedDxf: DxfData | null = null;
  private _lastDxfForPicking: DxfData | null = null;

  // Guards mirroring dxf-react's prop refs: seeded in `firstUpdated` so the
  // first `updated` cycle doesn't re-trigger the initial load.
  private _urlGuard?: string;
  private _dxfDataGuard?: DxfData | null;
  private _darkGuard?: boolean;
  private _hiddenLayersGuard?: string[];
  private _pickingEnabledGuard?: boolean;
  private _rectangleSelectionGuard?: boolean;
  private _rectModifierGuard?: string;
  private _rectModeGuard?: string;
  private _pickingDebugGuard?: boolean;
  private _highlightColorGuard?: string;
  private _measureModeGuard?: MeasureMode;
  private _measureColorGuard?: string;
  private _angleUnitsGuard?: AngleUnits;
  private _snapGuard?: boolean;
  private _keyboardNavGuard?: boolean;
  private _controlsForLabels: { removeEventListener: (t: string, l: () => void) => void } | null = null;

  // --- Computed ------------------------------------------------------------
  private get _activeDxf(): DxfData | null {
    return this.dxfData ?? this._loadedDxf;
  }
  private get _hasDXFData(): boolean {
    const d = this._activeDxf;
    return !!(d && d.entities && d.entities.length > 0);
  }
  private get _units(): ViewerUnits {
    return computeViewerUnits({
      activeDxf: this._activeDxf,
      rulerUnits: this.rulerUnits,
      measureUnits: this.measureUnits,
      measureAreaUnits: this.measureAreaUnits,
    });
  }

  /** Current loading phase (`""` when idle). Read by consumers building a custom loading UI. */
  get loadingPhase(): LoadingPhase {
    return this._loadingPhase;
  }
  /** Current rendering progress (0–1). */
  get loadingProgress(): number {
    return this._displayProgress;
  }
  /** Current error message, or `null`. */
  get errorMessage(): string | null {
    return this._errorMessage;
  }
  /** Current zoom level as a percentage of the fit-to-view baseline. */
  get zoomPercent(): number {
    return this._zoomPercent;
  }
  /** Live render stats (FPS / draw calls / triangles / lines). */
  get debugInfo(): DebugInfo {
    return this._debugInfo;
  }

  // --- Lifecycle -----------------------------------------------------------
  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("fullscreenchange", this._onFullscreenChange);
    this.addEventListener("pointermove", this._handlePointerMove);
    this.addEventListener("pointerleave", this._handlePointerLeave);
    this.addEventListener("dragover", this._handleDragOver);
    this.addEventListener("dragleave", this._handleDragLeave);
    this.addEventListener("drop", this._handleDrop);
  }

  override firstUpdated(): void {
    const mount = this._canvasMount;
    if (!mount) return;

    this._renderer.initThreeJS(mount, {
      enableControls: true,
      aaMode: this.antialiasing,
    });
    this._initialized = true;

    this._attachPickingIfReady();
    this._attachRectSelectionIfReady();
    this._attachMeasurementIfReady();

    // Reposition the measurement labels on camera pan/zoom — only while a
    // measurement mode is active, so idle panning doesn't re-render.
    const controls = this._renderer.getControls();
    if (controls) {
      controls.addEventListener("change", this._onControlsChange);
      this._controlsForLabels = controls as unknown as DxfViewerElement["_controlsForLabels"];
    }

    const renderer = this._renderer.getRenderer();
    if (renderer && this.keyboardNavigation) this._keyboard.attach(renderer.domElement);

    // Seed guards with current values so the first `updated` cycle is a no-op.
    this._urlGuard = this.url;
    this._dxfDataGuard = this.dxfData;
    this._darkGuard = this.darkTheme;
    this._hiddenLayersGuard = this.hiddenLayers;
    this._pickingEnabledGuard = this.pickingEnabled;
    this._rectangleSelectionGuard = this.rectangleSelection;
    this._rectModifierGuard = this.rectangleSelectionModifier;
    this._rectModeGuard = this.rectangleSelectionMode;
    this._pickingDebugGuard = this.pickingDebug;
    this._highlightColorGuard = this.highlightColor;
    this._measureModeGuard = this.measureMode;
    this._measureColorGuard = this.measureColor;
    this._angleUnitsGuard = this.measureAngleUnits;
    this._snapGuard = this.snapToGeometry;
    this._keyboardNavGuard = this.keyboardNavigation;

    // Initial load.
    if (this.url) {
      void this.loadDXFFromUrl(this.url);
    } else if (this.dxfData && (this.dxfData.entities?.length ?? 0) > 0) {
      void this.loadDXFFromData(this.dxfData);
    }

    this._resizeObserver = new ResizeObserver(() => {
      if (this._canvasMount) this._renderer.handleResize(this._canvasMount);
    });
    this._resizeObserver.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("fullscreenchange", this._onFullscreenChange);
    this.removeEventListener("pointermove", this._handlePointerMove);
    this.removeEventListener("pointerleave", this._handlePointerLeave);
    this.removeEventListener("dragover", this._handleDragOver);
    this.removeEventListener("dragleave", this._handleDragLeave);
    this.removeEventListener("drop", this._handleDrop);
    if (this._dragLeaveTimer) {
      clearTimeout(this._dragLeaveTimer);
      this._dragLeaveTimer = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._controlsForLabels?.removeEventListener("change", this._onControlsChange);
    this._controlsForLabels = null;
    this._keyboard.detach();
    this._picking.detach();
    this._rectSelection.detach();
    this._measurement.dispose();
    this._areaMeasurement.dispose();
    this._angleMeasurement.dispose();
    this._snap.dispose();
    this._teardownPicking();
    this._renderer.cleanup();
    this._initialized = false;
  }

  private _onControlsChange = (): void => {
    if (this.measureMode !== "none") this.requestUpdate();
  };

  override updated(_changed: PropertyValues): void {
    if (!this._initialized) return;

    if (this.url !== this._urlGuard) {
      this._urlGuard = this.url;
      if (this.url) void this.loadDXFFromUrl(this.url);
    }

    if (this.dxfData !== this._dxfDataGuard) {
      this._dxfDataGuard = this.dxfData;
      if (
        this.dxfData &&
        (this.dxfData.entities?.length ?? 0) > 0 &&
        this.dxfData !== this._lastLoadedDxf
      ) {
        void this.loadDXFFromData(this.dxfData);
      }
    }

    if (this.darkTheme !== this._darkGuard) {
      this._darkGuard = this.darkTheme;
      this._renderer.switchTheme(this.darkTheme);
      this._layers.updateLayerThemeColors(this.darkTheme);
    }

    // Controlled hidden-layers updates pushed in from outside.
    if (this.hiddenLayers !== this._hiddenLayersGuard) {
      this._hiddenLayersGuard = this.hiddenLayers;
      if (this.hiddenLayers !== undefined && !this._hasSameHiddenSet(this.hiddenLayers)) {
        this._layers.setHiddenLayers(this.hiddenLayers);
        this._syncLayerVisibility();
      }
    }

    if (this.pickingEnabled !== this._pickingEnabledGuard) {
      this._pickingEnabledGuard = this.pickingEnabled;
      this._picking.setEnabled(this.pickingEnabled);
      if (!this.pickingEnabled) {
        this._teardownPicking();
        this._rectSelection.detach();
      } else {
        if (this._lastDxfForPicking == null) {
          const dxf = this._activeDxf;
          if (dxf && (dxf.entities?.length ?? 0) > 0) this._setupPickingForDxf(dxf);
        }
        this._attachPickingIfReady();
        this._attachRectSelectionIfReady();
        this._syncLayerVisibility();
      }
      this._ensureSnapData();
    }

    if (this.rectangleSelection !== this._rectangleSelectionGuard) {
      this._rectangleSelectionGuard = this.rectangleSelection;
      if (this.rectangleSelection) this._attachRectSelectionIfReady();
      else this._rectSelection.detach();
    }

    if (this.rectangleSelectionModifier !== this._rectModifierGuard) {
      this._rectModifierGuard = this.rectangleSelectionModifier;
      this._rectSelection.setModifier(this.rectangleSelectionModifier);
    }

    if (this.rectangleSelectionMode !== this._rectModeGuard) {
      this._rectModeGuard = this.rectangleSelectionMode;
      this._rectSelection.setMode(this.rectangleSelectionMode);
    }

    if (this.pickingDebug !== this._pickingDebugGuard) {
      this._pickingDebugGuard = this.pickingDebug;
      this._picking.setDebug(this.pickingDebug);
      this._renderer.render();
    }

    if (this.highlightColor !== this._highlightColorGuard) {
      this._highlightColorGuard = this.highlightColor;
      this._highlight.setColor(this.highlightColor);
    }

    if (this.measureMode !== this._measureModeGuard) {
      this._measureModeGuard = this.measureMode;
      const mode = this.measureMode;
      // Disable the non-target tools first — that restores the LEFT mouse button
      // each tool steals — before the target tool steals it again.
      if (mode !== "distance") this._measurement.setEnabled(false);
      if (mode !== "area") this._areaMeasurement.setEnabled(false);
      if (mode !== "angle") this._angleMeasurement.setEnabled(false);
      if (mode === "distance") this._measurement.setEnabled(true);
      if (mode === "area") this._areaMeasurement.setEnabled(true);
      if (mode === "angle") this._angleMeasurement.setEnabled(true);
      if (mode === "none") this._restoreCompetingTools();
      else this._suspendCompetingTools();
      this._snap.clear();
      if (mode !== "none") this._ensureSnapData();
    }

    if (this.measureColor !== this._measureColorGuard) {
      this._measureColorGuard = this.measureColor;
      this._measurement.setColor(this.measureColor);
      this._areaMeasurement.setColor(this.measureColor);
      this._angleMeasurement.setColor(this.measureColor);
      this._snap.setColor(this.measureColor);
    }

    if (this.measureAngleUnits !== this._angleUnitsGuard) {
      this._angleUnitsGuard = this.measureAngleUnits;
      this._angleMeasurement.setUnits(this.measureAngleUnits);
    }

    if (this.snapToGeometry !== this._snapGuard) {
      this._snapGuard = this.snapToGeometry;
      this._snap.setEnabled(this.snapToGeometry);
      this._ensureSnapData();
    }

    if (this.keyboardNavigation !== this._keyboardNavGuard) {
      this._keyboardNavGuard = this.keyboardNavigation;
      this._keyboard.setEnabled(this.keyboardNavigation);
      const r = this._renderer.getRenderer();
      if (this.keyboardNavigation) {
        if (r) this._keyboard.attach(r.domElement);
      } else {
        this._keyboard.detach();
      }
    }

    // Keep unit scales in sync with the tools (idempotent — safe every cycle).
    const units = this._units;
    this._measurement.setUnitsScale(units.measureUnitsScale, units.currentMeasureUnits);
    this._areaMeasurement.setUnits(units.areaUnitScales);
  }

  // --- Loading -------------------------------------------------------------
  /** Parse + render DXF from raw text. */
  async loadDXFFromText(dxfText: string): Promise<void> {
    this._errorMessage = null;
    this._selectedEntity = null;
    this._clearMeasurements();
    this._isLoading = true;
    try {
      this._loadingPhase = "parsing";
      const dxf = await this._renderer.parseDXFAsync(dxfText);
      this._lastLoadedDxf = dxf;
      this._loadedDxf = dxf;

      this._loadingPhase = "rendering";
      const unsupported = await this._renderer.displayDXF(
        dxf,
        this.darkTheme,
        this.fontUrl || undefined,
      );
      this._onDxfRendered(dxf);
      this._emit("dxf-loaded", true);
      this._emit("dxf-data", dxf);
      if (unsupported && unsupported.length > 0) {
        this._emit("unsupported-entities", unsupported);
      }
    } catch (error) {
      this._handleLoadError(error, "Unknown error loading DXF");
    } finally {
      this._loadingPhase = "";
      this._isLoading = false;
    }
  }

  /** Render an already-parsed DXF object. */
  async loadDXFFromData(data: DxfData): Promise<void> {
    this._errorMessage = null;
    this._selectedEntity = null;
    this._clearMeasurements();
    this._isLoading = true;
    this._loadingPhase = "rendering";
    this._lastLoadedDxf = data;
    this._loadedDxf = data;
    try {
      const unsupported = await this._renderer.displayDXF(
        data,
        this.darkTheme,
        this.fontUrl || undefined,
      );
      this._onDxfRendered(data);
      this._emit("dxf-loaded", true);
      this._emit("dxf-data", data);
      if (unsupported && unsupported.length > 0) {
        this._emit("unsupported-entities", unsupported);
      }
    } catch (error) {
      this._handleLoadError(error, "Unknown error displaying DXF");
    } finally {
      this._loadingPhase = "";
      this._isLoading = false;
    }
  }

  /** Fetch a DXF from a URL, then parse + render it. */
  async loadDXFFromUrl(fetchUrl: string): Promise<void> {
    this._errorMessage = null;
    this._isLoading = true;
    this._loadingPhase = "fetching";
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const text = await response.text();
      await this.loadDXFFromText(text);
    } catch (error) {
      this._handleLoadError(error, "Failed to fetch DXF");
    } finally {
      this._loadingPhase = "";
      this._isLoading = false;
    }
  }

  /** Load from an ArrayBuffer (auto-detects UTF-8 / UTF-16 LE/BE). */
  async loadDXFFromBuffer(buffer: ArrayBuffer): Promise<void> {
    await this.loadDXFFromText(this._decodeBuffer(buffer));
  }

  /** Load from a Blob / File. */
  async loadDXFFromBlob(blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    await this.loadDXFFromBuffer(buffer);
  }

  private _decodeBuffer(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    // UTF-16 LE BOM (DXF files saved by AutoCAD with non-ASCII content)
    if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(buffer);
    }
    // UTF-16 BE BOM
    if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(buffer);
    }
    // UTF-8 (with or without BOM — TextDecoder strips it automatically)
    return new TextDecoder("utf-8").decode(buffer);
  }

  /**
   * Post-render hook: initialise layers and sync visibility. Picking, snap and
   * ruler-offset wiring are layered on in stages D–E.
   */
  private _onDxfRendered(dxf: DxfData): void {
    this._initLayersFromDXF(dxf, this.darkTheme);
    this._syncLayerVisibility();
    this._setupPickingForDxf(dxf);
    this._ensureSnapData(dxf);
  }

  private _initLayersFromDXF(dxf: DxfData, dark?: boolean): void {
    const dxfLayers = (dxf.tables?.layer?.layers || {}) as Record<string, DxfLayer>;
    const entityLayerCounts: Record<string, number> = {};
    const index = buildEntityIndex(dxf);
    for (const entity of index.values()) {
      const layerName = entity.layer || "0";
      entityLayerCounts[layerName] = (entityLayerCounts[layerName] || 0) + 1;
    }
    this._layers.initLayers(dxfLayers, entityLayerCounts, dark);
  }

  /** Apply the current layer-visibility set to the scene, picking index and snap. */
  private _syncLayerVisibility(): void {
    const visible = this._layers.getVisibleLayerNames();
    this._renderer.applyLayerVisibility(visible);
    this._picking.setVisibleLayers(visible);
    this._rectSelection.setVisibleLayers(visible);
    this._snap.setVisibleLayers(visible);
  }

  private _hasSameHiddenSet(a: readonly string[]): boolean {
    const current = this._layers.getHiddenLayerNames();
    if (a.length !== current.length) return false;
    const set = new Set(a);
    for (const x of current) if (!set.has(x)) return false;
    return true;
  }

  private _handleLoadError(error: unknown, fallback: string): void {
    this._layers.clearLayers();
    const message = error instanceof Error ? error.message : fallback;
    this._errorMessage = message;
    this._emit("error", message);
    this._emit("dxf-loaded", false);
    this._emit("dxf-data", null);
  }

  // --- Layer handlers ------------------------------------------------------
  private _handleToggleLayer = (e: CustomEvent<string>): void => {
    this._layers.toggleLayerVisibility(e.detail);
    this._syncLayerVisibility();
  };
  private _handleShowAllLayers = (): void => {
    this._layers.showAllLayers();
    this._syncLayerVisibility();
  };
  private _handleHideAllLayers = (): void => {
    this._layers.hideAllLayers();
    this._syncLayerVisibility();
  };
  private _handleLayerHover = (e: CustomEvent<string | null>): void => {
    const layerName = e.detail;
    this._emit("layer-hover", layerName);
    if (!this.highlightOnHover) return;
    if (!layerName) {
      this._highlight.clear();
      this._renderer.render();
      return;
    }
    const dxf = this._activeDxf;
    if (!dxf) return;
    const handles = findEntitiesByLayer(dxf, layerName);
    if (handles.length === 0) {
      this._highlight.clear();
      this._renderer.render();
      return;
    }
    const entries: PickingEntry[] = [];
    for (const h of handles) entries.push(...this._picking.getPickingEntries(h));
    this._highlight.highlight(entries);
    this._renderer.render();
  };

  // --- Picking + highlight + rectangle selection ---------------------------
  private _setupPickingForDxf(dxf: DxfData): void {
    if (!this.pickingEnabled) return;
    const scene = this._renderer.getScene();
    if (!scene) return;
    const oo = this._renderer.getOriginOffset();
    const offset = { x: oo.x, y: oo.y, z: oo.z };
    this._picking.installPickingData(dxf, scene, offset);
    this._highlight.init(scene, offset, this.highlightColor);
    const entityIdx = this._picking.getEntityIndex();
    const pickingIdx = this._picking.getPickingIndex();
    if (entityIdx && pickingIdx) this._highlight.installHighlightData(entityIdx, pickingIdx);
    if (pickingIdx) this._rectSelection.installRectData(pickingIdx, offset);
    if (this.pickingDebug) this._picking.setDebug(true);
    this._lastDxfForPicking = dxf;
  }

  private _teardownPicking(): void {
    this._highlight.removeHighlightData();
    this._highlight.dispose();
    this._picking.removePickingData(this._renderer.getScene());
    this._rectSelection.removeRectData();
    this._lastDxfForPicking = null;
    this._selectedEntity = null;
  }

  private _attachPickingIfReady(): void {
    if (!this.pickingEnabled) return;
    const renderer = this._renderer.getRenderer();
    const camera = this._renderer.getCamera();
    if (!renderer || !camera) return;
    this._picking.attach(renderer.domElement, camera, {
      onHover: this._handleEntityHover,
      onClick: this._handleEntityClick,
    });
  }

  private _attachRectSelectionIfReady(): void {
    if (!this.rectangleSelection || !this.pickingEnabled) return;
    const renderer = this._renderer.getRenderer();
    const camera = this._renderer.getCamera();
    if (!renderer || !camera) return;
    this._rectSelection.attach(renderer.domElement, camera, this._renderer.getControls(), {
      onStart: (mode: RectSelectionResolvedMode) => this._emit("selection-start", mode),
      onSelect: (entries: PickingEntry[]) => {
        const events = entries.map((entry) => this._picking.buildEventForEntry(entry));
        this._emit("entities-select", events);
      },
      onEnd: () => this._emit("selection-end", undefined),
    });
    this._rectSelection.setModifier(this.rectangleSelectionModifier);
    this._rectSelection.setMode(this.rectangleSelectionMode);
    this._rectSelection.setEnabled(true);
  }

  private _collectHighlightEntries(event: PickingEvent): PickingEntry[] {
    if (this.highlightAssociated && event.association) {
      const entries: PickingEntry[] = [];
      for (const handle of event.association.members) {
        entries.push(...this._picking.getPickingEntries(handle));
      }
      return entries;
    }
    if (event.pickId) {
      const entry = this._picking.getPickingEntryById(event.pickId);
      if (entry) return [entry];
    }
    return [];
  }

  private _handleEntityHover = (event: PickingEvent | null): void => {
    this._emit("entity-hover", event);
    if (!this.highlightOnHover) return;
    if (!event) {
      this._highlight.clear();
    } else {
      const entries = this._collectHighlightEntries(event);
      if (entries.length > 0) this._highlight.highlight(entries);
    }
    this._renderer.render();
  };

  private _handleEntityClick = (event: PickingEvent): void => {
    this._selectedEntity = event;
    this._emit("entity-click", event);
  };

  /**
   * Feed the snap controller the indexes it needs. Reuses the picking index when
   * picking is on (free); otherwise builds them directly, but only once a
   * measurement mode is active. Clears the data when snapping is off / no DXF.
   */
  private _ensureSnapData(dxf?: DxfData | null): void {
    const data = dxf ?? this._activeDxf;
    if (!this.snapToGeometry || !data) {
      this._snap.setData(null, null);
      return;
    }
    const pi = this._picking.getPickingIndex();
    const ei = this._picking.getEntityIndex();
    if (pi && ei) {
      this._snap.setData(pi, ei);
      return;
    }
    if (this.measureMode === "none") {
      this._snap.setData(null, null);
      return;
    }
    this._snap.setData(buildPickingIndex(data), buildEntityIndex(data));
  }

  // --- Imperative API: picking ---------------------------------------------
  /** Highlight entities by DXF handle (requires `picking-enabled`). */
  highlight(handles: string[]): void {
    const entries: PickingEntry[] = [];
    for (const h of handles) entries.push(...this._picking.getPickingEntries(h));
    this._highlight.highlight(entries);
    this._renderer.render();
  }
  /** Clear the highlight overlay. */
  clearHighlight(): void {
    this._highlight.clear();
    this._renderer.render();
  }
  /** Fit the camera to the bbox of the given entities (requires `picking-enabled`). */
  zoomToEntity(handles: string[]): void {
    const index = this._picking.getPickingIndex();
    if (!index) return;
    const box = getZoomBox(index, handles, { originOffset: this._renderer.getOriginOffset() });
    if (box) this._renderer.zoomToBox(box);
  }
  /** Fit the camera to all entities on a layer (requires `picking-enabled`). */
  zoomToLayer(layerName: string): void {
    const index = this._picking.getPickingIndex();
    if (!index) return;
    const box = getZoomBoxForLayer(index, layerName, { originOffset: this._renderer.getOriginOffset() });
    if (box) this._renderer.zoomToBox(box);
  }
  /** All entity associations from the picking index. */
  getAssociations(): EntityAssociation[] {
    return this._picking.getAssociations();
  }
  /** Associations involving a specific handle. */
  findAssociationsByHandle(handle: string): EntityAssociation[] {
    return this._picking.findAssociationsByHandle(handle);
  }
  /** The picking index (or null before a DXF with picking enabled is loaded). */
  getPickingIndex(): PickingIndex | null {
    return this._picking.getPickingIndex();
  }

  // --- Measurement ---------------------------------------------------------
  private _attachMeasurementIfReady(): void {
    const renderer = this._renderer.getRenderer();
    const camera = this._renderer.getCamera();
    const scene = this._renderer.getScene();
    if (!renderer || !camera || !scene) return;
    const controls = this._renderer.getControls() as unknown as Parameters<MeasurementController["attach"]>[3];
    const render = (): void => this._renderer.render();
    const getOffset = this._renderer.getOriginOffset;
    const color = this.measureColor;
    const units = this._units;

    // Shared geometry-snap controller + resolver injected into every tool.
    this._snap.attach(renderer.domElement, scene, camera, getOffset, render);
    this._snap.setColor(color);
    this._snap.setEnabled(this.snapToGeometry);
    this._ensureSnapData();
    const snapResolver = (raw: MeasurePoint, x: number, y: number): MeasurePoint =>
      this._snap.resolve(raw, x, y);

    this._measurement.attach(renderer.domElement, scene, camera, controls, getOffset, render, {
      onResult: (r: MeasureResult) => this._emit("measure", r),
      onCancel: () => this._emit("measure-cancel", undefined),
      snap: snapResolver,
    });
    this._measurement.setColor(color);
    this._measurement.setUnitsScale(units.measureUnitsScale, units.currentMeasureUnits);

    this._areaMeasurement.attach(renderer.domElement, scene, camera, controls, getOffset, render, {
      onResult: (r: AreaMeasureResult) => this._emit("measure-area", r),
      onCancel: () => this._emit("measure-cancel", undefined),
      snap: snapResolver,
    });
    this._areaMeasurement.setColor(color);
    this._areaMeasurement.setUnits(units.areaUnitScales);

    this._angleMeasurement.attach(renderer.domElement, scene, camera, controls, getOffset, render, {
      onResult: (r: AngleMeasureResult) => this._emit("measure-angle", r),
      onCancel: () => this._emit("measure-cancel", undefined),
      snap: snapResolver,
    });
    this._angleMeasurement.setColor(color);
    this._angleMeasurement.setUnits(this.measureAngleUnits);

    // Enable whichever tool the current measureMode selects.
    const mode = this.measureMode;
    if (mode === "distance") {
      this._measurement.setEnabled(true);
      this._suspendCompetingTools();
    } else if (mode === "area") {
      this._areaMeasurement.setEnabled(true);
      this._suspendCompetingTools();
    } else if (mode === "angle") {
      this._angleMeasurement.setEnabled(true);
      this._suspendCompetingTools();
    }
  }

  // Measurement tools intercept clicks before picking, so suspend it while a
  // tool is active and restore on `none`.
  private _suspendCompetingTools(): void {
    this._picking.setEnabled(false);
    this._rectSelection.setEnabled(false);
  }
  private _restoreCompetingTools(): void {
    this._picking.setEnabled(this.pickingEnabled);
    this._rectSelection.setEnabled(this.rectangleSelection && this.pickingEnabled);
  }
  private _clearMeasurements(): void {
    this._measurement.clear();
    this._areaMeasurement.clear();
    this._angleMeasurement.clear();
  }

  /** Clear any in-flight or completed measurement overlay (distance / area / angle). */
  clearMeasure(): void {
    this._clearMeasurements();
  }

  // --- Cursor coordinates --------------------------------------------------
  private _handlePointerMove = (e: PointerEvent): void => {
    if (!(this.showCoordinates || this.showRulers)) return;
    const camera = this._renderer.getCamera();
    if (!camera) return;
    const rect = this.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const world = new Vector3(ndcX, ndcY, 0).unproject(camera);
    const offset = this._renderer.getOriginOffset();
    this._cursorX = world.x + offset.x;
    this._cursorY = world.y + offset.y;
    this._isCursorVisible = true;
  };
  private _handlePointerLeave = (): void => {
    this._isCursorVisible = false;
  };

  // --- Drag & drop ---------------------------------------------------------
  private _handleDragOver = (e: DragEvent): void => {
    if (!this.allowDrop) return;
    e.preventDefault();
    if (this._dragLeaveTimer) {
      clearTimeout(this._dragLeaveTimer);
      this._dragLeaveTimer = null;
    }
    this._isDragOver = true;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  private _handleDragLeave = (): void => {
    if (!this.allowDrop) return;
    // Debounce to avoid flicker when dragging over child elements.
    this._dragLeaveTimer = setTimeout(() => {
      this._isDragOver = false;
    }, 50);
  };
  private _handleDrop = async (e: DragEvent): Promise<void> => {
    if (!this.allowDrop) return;
    e.preventDefault();
    this._isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    this._emit("file-dropped", file.name);
    const text = await file.text();
    await this.loadDXFFromText(text);
  };

  // --- Fullscreen ----------------------------------------------------------
  private _onFullscreenChange = (): void => {
    this._isFullscreen = document.fullscreenElement === this;
  };
  toggleFullscreen(): void {
    if (document.fullscreenElement === this) {
      void document.exitFullscreen?.();
    } else {
      void this.requestFullscreen?.();
    }
  }

  // --- Imperative API ------------------------------------------------------
  /** Reset the camera to the fit-to-view state. */
  resetView(): void {
    this._renderer.resetView();
    this._emit("reset-view", undefined);
  }

  /** Recompute the canvas size from the current container bounds. */
  resize(): void {
    if (this._canvasMount) this._renderer.handleResize(this._canvasMount);
  }

  /** Download the current view as a PNG. */
  exportToPNG(): void {
    const r = this._renderer.getRenderer();
    if (!r) return;
    const link = document.createElement("a");
    link.download = (this.fileName || "dxf-export").replace(/\.dxf$/i, "") + ".png";
    link.href = r.domElement.toDataURL("image/png");
    link.click();
  }

  /** The underlying Three.js WebGL renderer (or `null` before init). */
  getRenderer(): WebGLRenderer | null {
    return this._renderer.getRenderer();
  }

  /** Clear the entity shown in the properties panel. */
  clearSelection(): void {
    this._selectedEntity = null;
  }

  /** Switch the active measurement mode (also fires `measure-mode-change`). */
  setMeasureMode(mode: MeasureMode): void {
    this.measureMode = mode;
    this._emit("measure-mode-change", mode);
  }

  /** Re-run the last load (used by the error overlay's retry action). */
  retry(): void {
    if (this.url) {
      void this.loadDXFFromUrl(this.url);
    } else if (this.dxfData && (this.dxfData.entities?.length ?? 0) > 0) {
      void this.loadDXFFromData(this.dxfData);
    }
  }

  // Toolbar measure toggles (a second press on the active tool turns it off).
  private _toggleMeasureDistance = (): void =>
    this.setMeasureMode(this.measureMode === "distance" ? "none" : "distance");
  private _toggleMeasureArea = (): void =>
    this.setMeasureMode(this.measureMode === "area" ? "none" : "area");
  private _toggleMeasureAngle = (): void =>
    this.setMeasureMode(this.measureMode === "angle" ? "none" : "angle");

  // --- Events --------------------------------------------------------------
  private _emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // --- Render --------------------------------------------------------------
  override render() {
    return html`
      <div class="dxfk-canvas-mount" part="canvas"></div>

      ${this._hasDXFData && this.showRulers ? this._renderRulers() : nothing}
      ${!this._webGLSupported ? this._renderWebGLError() : nothing}
      ${this._hasDXFData ? this._renderOverlayGrid() : nothing}
      ${this._rectScreenRect ? this._renderSelectionRect() : nothing}
      ${this._hasDXFData ? this._renderMeasureLabels() : nothing}
      ${this._isLoading ? this._renderLoading() : nothing}
      ${!this._isLoading && this._errorMessage ? this._renderError() : nothing}
      ${!this._isLoading && !this._errorMessage && !this._hasDXFData
        ? this._renderEmptyState()
        : nothing}
      ${this._isDragOver ? this._renderDropOverlay() : nothing}
    `;
  }

  private _renderDropOverlay() {
    return html`
      <div class="dxfk-message-overlay dxfk-drop-overlay" part="drop-overlay">
        <div class="dxfk-message-content">
          ${svg`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>`}
          <div class="dxfk-message-text">Drop DXF file to load</div>
        </div>
      </div>
    `;
  }

  private _renderRulers() {
    const units = this._units;
    const camera = this._renderer.getCamera();
    const controls = this._renderer.getControls() as unknown as DxfRulerElement["controls"];
    const oo = this._renderer.getOriginOffset();
    const cursorWorld = { x: this._cursorX, y: this._cursorY };
    return html`
      <dxf-ruler
        part="ruler-horizontal"
        orientation="horizontal"
        .camera=${camera}
        .controls=${controls}
        .originOffset=${{ x: oo.x, y: oo.y }}
        .cursorWorld=${cursorWorld}
        ?is-cursor-visible=${this._isCursorVisible}
        .unitsScale=${units.rulerUnitsScale}
        ?dark-theme=${this.darkTheme}
      ></dxf-ruler>
      <dxf-ruler
        part="ruler-vertical"
        orientation="vertical"
        .camera=${camera}
        .controls=${controls}
        .originOffset=${{ x: oo.x, y: oo.y }}
        .cursorWorld=${cursorWorld}
        ?is-cursor-visible=${this._isCursorVisible}
        .unitsScale=${units.rulerUnitsScale}
        ?dark-theme=${this.darkTheme}
      ></dxf-ruler>
      <div class="dxfk-ruler-corner" part="ruler-corner" aria-hidden="true">${units.rulerUnitsLabel}</div>
    `;
  }

  private _renderOverlayGrid() {
    return html`
      <div
        class=${classMap({
          "dxfk-overlay-grid": true,
          "dxfk-overlay-grid--with-rulers": this.showRulers,
        })}
      >
        ${OVERLAY_POSITIONS.map(
          (pos) => html`
            <div class="dxfk-overlay-cell dxfk-overlay-cell--${pos}">
              ${this.fileNamePosition === pos && this.showFileName && this.fileName
                ? html`<div class="dxfk-file-name-overlay" part="file-name">${this.fileName}</div>`
                : nothing}
              ${this.toolbarPosition === pos ? this._renderToolbarSlot() : nothing}
              ${this.coordinatesPosition === pos && (this.showCoordinates || this.showZoomLevel)
                ? this._renderCoordinates()
                : nothing}
              ${this.debugPosition === pos && this.showDebugInfo ? this._renderDebug() : nothing}
              ${this.showLayerPanel && this.layerPanelPosition === pos && this._layers.layerList.length > 0
                ? this._renderLayerPanel()
                : nothing}
              ${this.showPropertiesPanel && this.propertiesPanelPosition === pos
                ? this._renderPropertiesPanel()
                : nothing}
              ${this.overlayPosition === pos ? html`<slot name="overlay"></slot>` : nothing}
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderSelectionRect() {
    const r = this._rectScreenRect;
    if (!r) return nothing;
    return html`
      <div
        class=${classMap({
          "dxfk-selection-rect": true,
          [`dxfk-selection-rect--${r.mode}`]: true,
        })}
        part="selection-rect"
        style=${styleMap({
          left: `${r.x}px`,
          top: `${r.y}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        })}
      ></div>
    `;
  }

  private _renderMeasureLabels() {
    const oo = this._renderer.getOriginOffset();
    const ctx = {
      camera: this._renderer.getCamera(),
      container: this as HTMLElement,
      offset: { x: oo.x, y: oo.y, z: oo.z },
    };
    const units = this._units;
    const measure = computeMeasureLabel({
      ctx,
      state: this._measureState,
      measureUnitsScale: units.measureUnitsScale,
      currentMeasureUnits: units.currentMeasureUnits,
    });
    const area = computeAreaLabel({ ctx, state: this._areaState, areaUnitScales: units.areaUnitScales });
    const angle = computeAngleLabel({
      ctx,
      state: this._angleState,
      measureAngleUnits: this.measureAngleUnits,
    });
    return html`
      ${measure
        ? html`<div
            class="dxfk-measure-label"
            part="measure-label"
            style=${styleMap({
              left: `${measure.left}px`,
              top: `${measure.top}px`,
              "--dxfk-measure-color": this.measureColor,
            })}
            aria-live="polite"
          >
            ${measure.text}
          </div>`
        : nothing}
      ${area
        ? html`<div
            class="dxfk-measure-area-label"
            part="measure-area-label"
            style=${styleMap({
              left: `${area.left}px`,
              top: `${area.top}px`,
              "--dxfk-measure-color": this.measureColor,
            })}
          >
            <div class="dxfk-measure-area-row">Area: ${area.areaText}</div>
            <div class="dxfk-measure-area-row dxfk-measure-area-row--secondary">
              Perimeter: ${area.perimeterText}
            </div>
          </div>`
        : nothing}
      ${angle
        ? html`<div
            class="dxfk-measure-angle-label"
            part="measure-angle-label"
            style=${styleMap({
              left: `${angle.left}px`,
              top: `${angle.top}px`,
              "--dxfk-measure-color": this.measureColor,
            })}
          >
            ${angle.text}
          </div>`
        : nothing}
    `;
  }

  private _renderToolbarSlot() {
    return html`<slot name="toolbar">${this._renderToolbar()}</slot>`;
  }

  private _renderToolbar() {
    const md = this.measureMode;
    const btn = (
      label: string,
      title: string,
      active: boolean,
      onClick: () => void,
      icon: unknown,
    ) => html`
      <button
        class=${classMap({ "dxfk-toolbar-button": true, "dxfk-toolbar-button--active": active })}
        title=${title}
        aria-label=${label}
        aria-pressed=${active}
        @click=${onClick}
      >
        ${icon}
      </button>
    `;
    return html`
      <div class="dxfk-toolbar" part="toolbar" role="toolbar" aria-label="DXF viewer toolbar">
        ${this.showExportButton
          ? btn("Export current view as PNG", "Export PNG", false, () => this.exportToPNG(), svg`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>`)
          : nothing}
        ${this.showMeasureButton
          ? btn(
              md === "distance" ? "Disable measure tool" : "Enable measure-distance tool",
              md === "distance" ? "Disable measure tool" : "Measure distance",
              md === "distance",
              this._toggleMeasureDistance,
              svg`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 17 17 3l4 4L7 21z" /><path d="M14 6l2 2" /><path d="M11 9l2 2" /><path d="M8 12l2 2" /><path d="M5 15l2 2" />
              </svg>`,
            )
          : nothing}
        ${this.showMeasureAreaButton
          ? btn(
              md === "area" ? "Disable area-measurement tool" : "Enable area-measurement tool",
              md === "area" ? "Disable area tool" : "Measure area",
              md === "area",
              this._toggleMeasureArea,
              svg`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 3 21 9.5 17.5 20.5 6.5 20.5 3 9.5" />
                <circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="21" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="17.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="6.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
                <circle cx="3" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
              </svg>`,
            )
          : nothing}
        ${this.showMeasureAngleButton
          ? btn(
              md === "angle" ? "Disable angle-measurement tool" : "Enable angle-measurement tool",
              md === "angle" ? "Disable angle tool" : "Measure angle",
              md === "angle",
              this._toggleMeasureAngle,
              svg`
              <svg width="20" height="20" viewBox="0 0 122.88 103.56" fill="currentColor" aria-hidden="true">
                <path d="M59.49,1.72c1.03-1.69,3.24-2.23,4.94-1.2c1.69,1.03,2.23,3.24,1.2,4.94L34.75,55.92c6.65,4.72,12.18,10.9,16.11,18.07 c3.69,6.72,5.99,14.31,6.51,22.37h61.91c1.99,0,3.6,1.61,3.6,3.6c0,1.99-1.61,3.6-3.6,3.6H3.59v-0.01c-0.64,0-1.29-0.17-1.87-0.53 c-1.69-1.03-2.23-3.24-1.2-4.94L59.49,1.72L59.49,1.72z M31,62.05L10.01,96.36h40.14c-0.51-6.82-2.47-13.23-5.59-18.91 C41.22,71.36,36.57,66.1,31,62.05L31,62.05z" />
              </svg>`,
            )
          : nothing}
        ${this.showResetButton
          ? btn("Reset camera and fit drawing to view", "Fit to View", false, () => this.resetView(), svg`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="7" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
              </svg>`)
          : nothing}
        ${this.showFullscreenButton
          ? btn(
              this._isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
              this._isFullscreen ? "Exit Fullscreen" : "Fullscreen",
              this._isFullscreen,
              () => this.toggleFullscreen(),
              this._isFullscreen
                ? svg`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 4v4H4" /><path d="M16 4v4h4" /><path d="M4 16h4v4" /><path d="M20 16h-4v4" /></svg>`
                : svg`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 8V4h4" /><path d="M16 4h4v4" /><path d="M20 16v4h-4" /><path d="M4 16v4h4" /></svg>`,
            )
          : nothing}
        <slot name="toolbar-extra"></slot>
      </div>
    `;
  }

  private _renderCoordinates() {
    const naClass = (visible: boolean) =>
      classMap({ "dxfk-coord-value": true, "dxfk-coord-value--na": !visible });
    return html`
      <div class="dxfk-coordinates-overlay" part="coordinates">
        ${this.showCoordinates
          ? html`
              <div class="dxfk-coord-row">
                <span class="dxfk-coord-label">X</span>
                <span class=${naClass(this._isCursorVisible)}>
                  ${this._isCursorVisible ? this._cursorX.toFixed(2) : "—"}
                </span>
              </div>
              <div class="dxfk-coord-row">
                <span class="dxfk-coord-label">Y</span>
                <span class=${naClass(this._isCursorVisible)}>
                  ${this._isCursorVisible ? this._cursorY.toFixed(2) : "—"}
                </span>
              </div>
            `
          : nothing}
        ${this.showZoomLevel
          ? html`
              <div class="dxfk-coord-row">
                <span class="dxfk-coord-label">Z</span>
                <span class="dxfk-coord-value dxfk-zoom-value">${this._zoomPercent}%</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderDebug() {
    const d = this._debugInfo;
    return html`
      <div class="dxfk-debug-overlay" part="debug">
        <span>FPS ${d.fps}</span>
        <span>Calls ${formatK(d.drawCalls)}</span>
        <span>Lines ${formatK(d.lines)}</span>
        <span>Tris ${formatK(d.triangles)}</span>
      </div>
    `;
  }

  private _renderLayerPanel() {
    return html`
      <dxf-layer-panel
        .layers=${this._layers.layerList}
        .groupLayers=${this.groupLayers}
        ?dark-theme=${this.darkTheme}
        @toggle-layer=${this._handleToggleLayer}
        @show-all=${this._handleShowAllLayers}
        @hide-all=${this._handleHideAllLayers}
        @layer-hover=${this._handleLayerHover}
      ></dxf-layer-panel>
    `;
  }

  private _renderPropertiesPanel() {
    return html`
      <dxf-properties-panel
        .event=${this._selectedEntity}
        ?dark-theme=${this.darkTheme}
      ></dxf-properties-panel>
    `;
  }

  private _renderLoading() {
    const phase = this._loadingPhase;
    const text =
      phase === "fetching" ? "Loading DXF..." : phase === "parsing" ? "Parsing DXF..." : "Rendering...";
    return html`
      <slot name="loading">
        <div class="dxfk-message-overlay dxfk-loading-overlay" part="loading-overlay" role="status" aria-live="polite">
          <div class="dxfk-message-content">
            <div class="dxfk-spinner"></div>
            <div class="dxfk-message-text">${text}</div>
            ${phase === "rendering"
              ? html`
                  <div class="dxfk-progress-container">
                    <div class="dxfk-progress-bar" style="width: ${this._displayProgress * 100}%"></div>
                  </div>
                  <div class="dxfk-progress-text">${Math.round(this._displayProgress * 100)}%</div>
                `
              : nothing}
          </div>
        </div>
      </slot>
    `;
  }

  private _renderError() {
    return html`
      <slot name="error">
        <div class="dxfk-message-overlay dxfk-error-overlay" part="error-overlay" role="alert" aria-live="assertive">
          <div class="dxfk-message-content">
            ${errorIcon}
            <div class="dxfk-message-title">Error</div>
            <div class="dxfk-message-text">${this._errorMessage}</div>
          </div>
        </div>
      </slot>
    `;
  }

  private _renderEmptyState() {
    return html`
      <slot name="empty-state">
        <div class="dxfk-message-overlay" part="empty-state-overlay">
          <div class="dxfk-message-content">
            ${placeholderIcon}
            <div class="dxfk-message-text">Select a DXF file to view</div>
          </div>
        </div>
      </slot>
    `;
  }

  private _renderWebGLError() {
    return html`
      <div class="dxfk-message-overlay" part="error-overlay">
        <div class="dxfk-message-content">
          ${errorIcon}
          <div class="dxfk-message-title">WebGL Not Supported</div>
          <div class="dxfk-message-text">
            ${this._webGLError ?? "Update your browser or enable hardware acceleration"}
          </div>
        </div>
      </div>
    `;
  }
}
