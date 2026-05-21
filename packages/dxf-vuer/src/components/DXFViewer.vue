<template>
  <div
    ref="dxfContainer"
    class="dxfk-viewer"
    :class="[{ 'dxfk-dark': darkTheme }, classes?.root]"
    role="region"
    aria-label="DXF drawing viewer"
    :aria-busy="isLoading"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div v-if="!webGLSupported" class="dxfk-message-overlay">
      <div class="dxfk-message-content">
        <svg
          class="dxfk-message-icon dxfk-message-icon--error"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="14" />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
        <div class="dxfk-message-title">WebGL Not Supported</div>
        <div class="dxfk-message-text">Update your browser or enable hardware acceleration</div>
      </div>
    </div>

    <template v-if="hasDXFData && showRulers">
      <Ruler
        orientation="horizontal"
        :camera="rulerCamera"
        :controls="rulerControls"
        :origin-offset="rulerOriginOffset"
        :cursor-world="cursorWorld"
        :is-cursor-visible="isCursorVisible"
        :units-scale="rulerUnitsScale"
        :dark-theme="darkTheme"
        :class="classes?.rulerHorizontal"
      />
      <Ruler
        orientation="vertical"
        :camera="rulerCamera"
        :controls="rulerControls"
        :origin-offset="rulerOriginOffset"
        :cursor-world="cursorWorld"
        :is-cursor-visible="isCursorVisible"
        :units-scale="rulerUnitsScale"
        :dark-theme="darkTheme"
        :class="classes?.rulerVertical"
      />
      <div
        class="dxfk-ruler-corner"
        :class="[{ 'dxfk-dark': darkTheme }, classes?.rulerCorner]"
        aria-hidden="true"
      >
        {{ rulerUnitsLabel }}
      </div>
    </template>

    <div v-if="hasDXFData" class="dxfk-overlay-grid" :class="{ 'dxfk-overlay-grid--with-rulers': showRulers }">
      <div
        v-for="pos in overlayPositions"
        :key="pos"
        class="dxfk-overlay-cell"
        :class="`dxfk-overlay-cell--${pos}`"
      >
        <div
          v-if="fileNamePosition === pos && showFileName && fileName"
          class="dxfk-file-name-overlay"
          :class="classes?.fileNameOverlay"
        >
          {{ fileName }}
        </div>

        <slot
          v-if="toolbarPosition === pos"
          name="toolbar"
          v-bind="{ resetView: handleResetView, exportToPNG, toggleFullscreen, isFullscreen }"
        >
          <ViewerToolbar
            :class="classes?.toolbar"
            :show-export-button="showExportButton"
            :show-reset-button="showResetButton"
            :show-fullscreen-button="showFullscreenButton"
            :is-fullscreen="isFullscreen"
            :dark-theme="darkTheme"
            @export="exportToPNG"
            @reset-view="handleResetView"
            @toggle-fullscreen="toggleFullscreen"
          >
            <template v-if="$slots['toolbar-extra']" #extra>
              <slot name="toolbar-extra" />
            </template>
          </ViewerToolbar>
        </slot>

        <div
          v-if="coordinatesPosition === pos && (showCoordinates || showZoomLevel)"
          class="dxfk-coordinates-overlay"
          :class="classes?.coordinatesOverlay"
        >
          <template v-if="showCoordinates">
            <div class="dxfk-coord-row">
              <span class="dxfk-coord-label">X:</span>
              <span class="dxfk-coord-value" :class="{ 'dxfk-coord-value--na': !isCursorVisible }">
                {{ isCursorVisible ? cursorX.toFixed(2) : "N/A" }}
              </span>
            </div>
            <div class="dxfk-coord-row">
              <span class="dxfk-coord-label">Y:</span>
              <span class="dxfk-coord-value" :class="{ 'dxfk-coord-value--na': !isCursorVisible }">
                {{ isCursorVisible ? cursorY.toFixed(2) : "N/A" }}
              </span>
            </div>
          </template>
          <div v-if="showZoomLevel" class="dxfk-coord-row">
            <span class="dxfk-coord-value dxfk-zoom-value">{{ zoomPercent }}%</span>
          </div>
        </div>

        <div
          v-if="debugPosition === pos && showDebugInfo"
          class="dxfk-debug-overlay"
          :class="classes?.debugOverlay"
        >
          <span>{{ debugInfo.fps }} FPS</span>
          <span>{{ debugInfo.drawCalls }} draws</span>
          <span>{{ formatK(debugInfo.lines) }} lines</span>
          <span>{{ formatK(debugInfo.triangles) }} tris</span>
        </div>

        <LayerPanel
          v-if="showLayerPanel && layerPanelPosition === pos && layerList.length > 0"
          :class="classes?.layerPanel"
          :layers="layerList"
          :dark-theme="darkTheme"
          @toggle-layer="handleToggleLayer"
          @show-all="handleShowAllLayers"
          @hide-all="handleHideAllLayers"
        />

        <slot
          v-if="overlayPosition === pos && $slots.overlay"
          name="overlay"
          v-bind="{ zoomPercent, cursorX, cursorY }"
        />
      </div>
    </div>

    <div
      v-if="isLoading"
      class="dxfk-message-overlay dxfk-loading-overlay"
      :class="classes?.loadingOverlay"
      role="status"
      aria-live="polite"
    >
      <slot name="loading" :phase="loadingPhase" :progress="displayProgress">
        <div class="dxfk-message-content">
          <div class="dxfk-spinner"></div>
          <div class="dxfk-message-text">
            {{
              loadingPhase === "fetching"
                ? "Loading DXF..."
                : loadingPhase === "parsing"
                  ? "Parsing DXF..."
                  : "Rendering..."
            }}
          </div>
          <div v-if="loadingPhase === 'rendering'" class="dxfk-progress-container">
            <div class="dxfk-progress-bar" :style="{ width: displayProgress * 100 + '%' }"></div>
          </div>
          <div v-if="loadingPhase === 'rendering'" class="dxfk-progress-text">
            {{ Math.round(displayProgress * 100) }}%
          </div>
        </div>
      </slot>
    </div>

    <div
      v-else-if="errorMessage"
      class="dxfk-message-overlay dxfk-error-overlay"
      :class="classes?.errorOverlay"
      role="alert"
      aria-live="assertive"
    >
      <slot name="error" :message="errorMessage" :retry="retry">
        <div class="dxfk-message-content">
          <svg
            class="dxfk-message-icon dxfk-message-icon--error"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            />
            <line x1="12" y1="9" x2="12" y2="14" />
            <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
          </svg>
          <div class="dxfk-message-title">Error</div>
          <div class="dxfk-message-text">{{ errorMessage }}</div>
        </div>
      </slot>
    </div>

    <div
      v-else-if="!hasDXFData"
      class="dxfk-message-overlay"
      :class="classes?.emptyStateOverlay"
    >
      <slot name="empty-state">
        <div class="dxfk-message-content">
          <svg
            class="dxfk-message-icon dxfk-message-icon--placeholder"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <div class="dxfk-message-text">Select a DXF file to view</div>
        </div>
      </slot>
    </div>

    <div
      v-if="isDragOver"
      class="dxfk-message-overlay dxfk-drop-overlay"
      :class="classes?.dropOverlay"
    >
      <div class="dxfk-message-content">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <div class="dxfk-message-text">Drop DXF file here</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw, markRaw } from "vue";
import * as THREE from "three";
import { useDXFRenderer } from "../composables/useDXFRenderer";
import { useLayers } from "../composables/useLayers";
import { useLoadError } from "../composables/useLoadError";
import { usePicking, type PickingEvent } from "../composables/usePicking";
import { useHighlight } from "../composables/useHighlight";
import { useKeyboardNavigation } from "../composables/useKeyboardNavigation";
import type { DxfData, DxfLayer, PickingEntry, EntityAssociation } from "dxf-render";
import { getZoomBox, getZoomBoxForLayer, getUnitsToMmFactor } from "dxf-render";
import type { OverlayPosition, ViewerClasses, RulerUnits } from "../types";
import type { AntialiasingMode } from "dxf-render";
import LayerPanel from "./LayerPanel.vue";
import ViewerToolbar from "./ViewerToolbar.vue";
import Ruler from "./Ruler.vue";

const overlayPositions: OverlayPosition[] = [
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right",
];

interface Props {
  dxfData?: DxfData | null;
  fileName?: string;
  url?: string;
  showResetButton?: boolean;
  showFullscreenButton?: boolean;
  autoFit?: boolean;
  showCoordinates?: boolean;
  showZoomLevel?: boolean;
  showDebugInfo?: boolean;
  showFileName?: boolean;
  showExportButton?: boolean;
  showLayerPanel?: boolean;
  allowDrop?: boolean;
  darkTheme?: boolean;
  fontUrl?: string;
  antialiasing?: AntialiasingMode;
  fileNamePosition?: OverlayPosition;
  toolbarPosition?: OverlayPosition;
  coordinatesPosition?: OverlayPosition;
  debugPosition?: OverlayPosition;
  layerPanelPosition?: OverlayPosition;
  overlayPosition?: OverlayPosition;
  pickingEnabled?: boolean;
  highlightOnHover?: boolean;
  highlightAssociated?: boolean;
  highlightColor?: string;
  pickingDebug?: boolean;
  persistLayersKey?: string;
  keyboardNavigation?: boolean;
  classes?: ViewerClasses;
  showRulers?: boolean;
  rulerUnits?: RulerUnits;
}

const props = withDefaults(defineProps<Props>(), {
  dxfData: null,
  fileName: "",
  url: "",
  showResetButton: false,
  showFullscreenButton: true,
  autoFit: true,
  showCoordinates: false,
  showZoomLevel: false,
  showDebugInfo: false,
  showFileName: true,
  showExportButton: false,
  showLayerPanel: true,
  allowDrop: false,
  darkTheme: false,
  fontUrl: "",
  antialiasing: "msaa",
  fileNamePosition: "top-left",
  toolbarPosition: "top-right",
  coordinatesPosition: "bottom-left",
  debugPosition: "bottom-center",
  layerPanelPosition: "bottom-right",
  overlayPosition: "top-center",
  pickingEnabled: false,
  highlightOnHover: true,
  highlightAssociated: true,
  highlightColor: "#ffaa00",
  pickingDebug: false,
  persistLayersKey: "",
  keyboardNavigation: true,
  classes: () => ({}),
  showRulers: false,
  rulerUnits: "mm",
});

interface Emits {
  (e: "dxf-loaded", success: boolean): void;
  (e: "dxf-data", data: DxfData | null): void;
  (e: "error", error: string): void;
  (e: "unsupported-entities", entities: string[]): void;
  (e: "reset-view"): void;
  (e: "file-dropped", fileName: string): void;
  (e: "entity-hover", event: PickingEvent | null): void;
  (e: "entity-click", event: PickingEvent): void;
}

const emit = defineEmits<Emits>();

const dxfContainer = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);

// Refs used to feed live camera/controls into the Ruler component once Three.js
// is initialised. Kept non-reactive on the inside via `markRaw`-friendly usage.
const rulerCamera = ref<THREE.OrthographicCamera | null>(null);
const rulerControls = ref<{
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
} | null>(null);

const {
  isLoading,
  displayProgress,
  zoomPercent,
  debugInfo,
  webGLSupported,
  error: rendererError,
  initThreeJS,
  parseDXFAsync,
  displayDXF,
  handleResize,
  resetView,
  zoomToBox,
  applyLayerVisibility,
  switchTheme,
  cleanup,
  getCamera,
  getRenderer,
  getScene,
  getControls,
  getOriginOffset,
  render: renderScene,
} = useDXFRenderer();

const keyboardNav = useKeyboardNavigation({
  getCamera,
  getControls,
  resetView: () => {
    handleResetView();
  },
  render: () => renderScene(),
});

const picking = usePicking();
const highlightCtl = useHighlight();
let lastDxfForPicking: DxfData | null = null;

const setupPickingForDxf = (dxf: DxfData): void => {
  if (!props.pickingEnabled) return;
  const scene = getScene();
  if (!scene) return;
  const oo = getOriginOffset();
  const offset = { x: oo.x, y: oo.y, z: oo.z };
  picking.installPickingData(dxf, scene, offset);
  highlightCtl.init(scene, offset, props.highlightColor);
  if (props.pickingDebug) picking.setDebug(true);
  lastDxfForPicking = dxf;
};

const teardownPicking = (): void => {
  highlightCtl.dispose();
  picking.removePickingData(getScene());
  lastDxfForPicking = null;
};

const handleEntityHover = (event: PickingEvent | null): void => {
  emit("entity-hover", event);
  if (!props.highlightOnHover) return;
  if (!event) {
    highlightCtl.clear();
  } else {
    const entries = collectHighlightEntries(event);
    if (entries.length > 0) highlightCtl.highlight(entries);
  }
  renderScene();
};

const collectHighlightEntries = (event: PickingEvent): PickingEntry[] => {
  if (props.highlightAssociated && event.association) {
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
};

const handleEntityClick = (event: PickingEvent): void => {
  emit("entity-click", event);
};

const highlight = (handles: string[]): void => {
  const entries: PickingEntry[] = [];
  for (const h of handles) {
    entries.push(...picking.getPickingEntries(h));
  }
  highlightCtl.highlight(entries);
  renderScene();
};

const clearHighlight = (): void => {
  highlightCtl.clear();
  renderScene();
};

const getAssociations = (): EntityAssociation[] => picking.getAssociations();
const findAssociationsByHandle = (handle: string): EntityAssociation[] =>
  picking.findAssociationsByHandle(handle);

/**
 * Fit the camera to the entities with the given DXF handles. Delegates the
 * scene-space bbox computation to `getZoomBox()` from dxf-render.
 *
 * Picking must have been installed (i.e. `pickingEnabled` was true when the
 * DXF was loaded). Handles that are not in the picking index are skipped
 * silently — XLINE/RAY are intentionally absent (they're infinite).
 */
const zoomToEntity = (handles: string[]): void => {
  const index = picking.getPickingIndex();
  if (!index) return;
  const box = getZoomBox(index, handles, { originOffset: getOriginOffset() });
  if (box) zoomToBox(box);
};

/**
 * Fit the camera to all entities of a given layer. Requires `pickingEnabled`
 * (the picking index is the source of bboxes). Returns silently when picking
 * is disabled or no entries on the layer.
 */
const zoomToLayer = (layerName: string): void => {
  const index = picking.getPickingIndex();
  if (!index) return;
  const box = getZoomBoxForLayer(index, layerName, { originOffset: getOriginOffset() });
  if (box) zoomToBox(box);
};

const loadingPhase = ref<"" | "fetching" | "parsing" | "rendering">("");
const { errorMessage, setError, clearError } = useLoadError();

const formatK = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

// Cursor world coordinates
const cursorX = ref(0);
const cursorY = ref(0);
const isCursorVisible = ref(false);

const handleMouseMove = (e: MouseEvent) => {
  if (!props.showCoordinates && !props.showRulers) return;
  const container = dxfContainer.value;
  const camera = getCamera();
  if (!container || !camera) return;

  const rect = container.getBoundingClientRect();
  const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const worldPos = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);

  // Add back origin offset to display original DXF coordinates
  const offset = getOriginOffset();
  cursorX.value = worldPos.x + offset.x;
  cursorY.value = worldPos.y + offset.y;
  isCursorVisible.value = true;
};

const handleMouseLeave = () => {
  isCursorVisible.value = false;
};

// Drag-and-drop
const isDragOver = ref(false);
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null;

const handleDragOver = (e: DragEvent) => {
  if (!props.allowDrop) return;
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer);
    dragLeaveTimer = null;
  }
  isDragOver.value = true;
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
};

const handleDragLeave = () => {
  if (!props.allowDrop) return;
  // Debounce to avoid flicker when dragging over child elements
  dragLeaveTimer = setTimeout(() => {
    isDragOver.value = false;
  }, 50);
};

const handleDrop = async (e: DragEvent) => {
  if (!props.allowDrop) return;
  isDragOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  emit("file-dropped", file.name);
  const text = await file.text();
  loadDXFFromText(text);
};

const toggleFullscreen = async () => {
  if (!dxfContainer.value) return;
  if (!document.fullscreenElement) {
    await dxfContainer.value.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
};

const onFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const {
  layerList,
  visibleLayerNames,
  initLayers,
  toggleLayerVisibility,
  showAllLayers,
  hideAllLayers,
  updateLayerThemeColors,
  clearLayers,
} = useLayers({
  getStorageKey: () => {
    if (!props.persistLayersKey) return null;
    return `${props.persistLayersKey}:${props.fileName || "default"}`;
  },
});

const hasDXFData = computed(() => {
  return props.dxfData && props.dxfData.entities && props.dxfData.entities.length > 0;
});

// Reference to data loaded via loadDXFFromText so watch does not reload them
let lastLoadedDxf: DxfData | null = null;

// Tracks the currently loaded DXF so rulers can read $INSUNITS reactively
// (lastLoadedDxf is a plain let-binding and won't trigger reactivity).
const loadedDxfRef = ref<DxfData | null>(null);

const activeDxf = computed<DxfData | null>(() => props.dxfData ?? loadedDxfRef.value);

// Scale factor applied to world coords to produce the value rendered on rulers.
// "dxf-units" — no conversion. "mm"/"inch" — go through $INSUNITS; when the file
// is Unitless ($INSUNITS=0) we treat one DXF unit as one millimetre 1:1.
const rulerUnitsScale = computed<number>(() => {
  if (props.rulerUnits === "dxf-units") return 1;
  const insUnits = activeDxf.value?.header?.$INSUNITS ?? 0;
  const toMm = insUnits === 0 ? 1 : getUnitsToMmFactor(insUnits) || 1;
  return props.rulerUnits === "inch" ? toMm / 25.4 : toMm;
});

const rulerUnitsLabel = computed<string>(() => {
  if (props.rulerUnits === "mm") return "mm";
  if (props.rulerUnits === "inch") return "in";
  return "—";
});

// Reactive snapshot of the scene's originOffset. `getOriginOffset()` returns a
// non-reactive object that changes only when a new DXF is rendered, so we mirror
// it into a ref and refresh after every successful displayDXF() call.
const rulerOriginOffset = ref({ x: 0, y: 0 });

const refreshRulerOriginOffset = () => {
  const oo = getOriginOffset();
  if (rulerOriginOffset.value.x !== oo.x || rulerOriginOffset.value.y !== oo.y) {
    rulerOriginOffset.value = { x: oo.x, y: oo.y };
  }
};

const cursorWorld = computed(() => ({ x: cursorX.value, y: cursorY.value }));

const handleResetView = () => {
  resetView();
  emit("reset-view");
};

const exportToPNG = () => {
  const renderer = getRenderer();
  if (!renderer) return;
  const link = document.createElement("a");
  link.download = (props.fileName || "dxf-export").replace(/\.dxf$/i, "") + ".png";
  link.href = renderer.domElement.toDataURL("image/png");
  link.click();
};

const retry = () => {
  if (props.url) {
    loadDXFFromUrl(props.url);
  } else if (props.dxfData && hasDXFData.value) {
    loadDXFFromData(props.dxfData);
  }
};

const initLayersFromDXF = (dxf: DxfData, darkTheme?: boolean) => {
  const dxfLayers = (dxf.tables?.layer?.layers || {}) as Record<string, DxfLayer>;
  const entityLayerCounts: Record<string, number> = {};
  for (const entity of dxf.entities) {
    const layerName = entity.layer || "0";
    entityLayerCounts[layerName] = (entityLayerCounts[layerName] || 0) + 1;
  }
  initLayers(dxfLayers, entityLayerCounts, darkTheme);
};

const handleToggleLayer = (layerName: string) => {
  toggleLayerVisibility(layerName);
  applyLayerVisibility(visibleLayerNames.value);
};

const handleShowAllLayers = () => {
  showAllLayers();
  applyLayerVisibility(visibleLayerNames.value);
};

const handleHideAllLayers = () => {
  hideAllLayers();
  applyLayerVisibility(visibleLayerNames.value);
};

const handleLoadError = (error: unknown, fallbackMsg: string) => {
  clearLayers();
  const msg = setError(error, fallbackMsg);
  emit("error", msg);
  emit("dxf-loaded", false);
  emit("dxf-data", null);
};

const loadDXFFromText = async (dxfText: string) => {
  clearError();
  isLoading.value = true;
  try {
    loadingPhase.value = "parsing";
    const dxf = await parseDXFAsync(dxfText);

    lastLoadedDxf = dxf;
    loadedDxfRef.value = dxf;

    loadingPhase.value = "rendering";
    const unsupportedEntities = await displayDXF(dxf, props.darkTheme, props.fontUrl);
    initLayersFromDXF(dxf, props.darkTheme);
    applyLayerVisibility(visibleLayerNames.value);
    setupPickingForDxf(dxf);
    refreshRulerOriginOffset();
    emit("dxf-loaded", true);
    emit("dxf-data", dxf);

    if (unsupportedEntities && unsupportedEntities.length > 0) {
      emit("unsupported-entities", unsupportedEntities);
    }
  } catch (error) {
    handleLoadError(error, "Unknown error loading DXF");
  } finally {
    loadingPhase.value = "";
    isLoading.value = false;
  }
};

const loadDXFFromData = async (dxfData: DxfData) => {
  clearError();
  isLoading.value = true;
  loadingPhase.value = "rendering";
  loadedDxfRef.value = dxfData;
  try {
    const unsupportedEntities = await displayDXF(dxfData, props.darkTheme, props.fontUrl);
    initLayersFromDXF(dxfData, props.darkTheme);
    applyLayerVisibility(visibleLayerNames.value);
    setupPickingForDxf(dxfData);
    refreshRulerOriginOffset();
    emit("dxf-loaded", true);
    emit("dxf-data", dxfData);

    if (unsupportedEntities && unsupportedEntities.length > 0) {
      emit("unsupported-entities", unsupportedEntities);
    }
  } catch (error) {
    handleLoadError(error, "Unknown error displaying DXF");
  } finally {
    loadingPhase.value = "";
    isLoading.value = false;
  }
};

const decodeBuffer = (buffer: ArrayBuffer): string => {
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
};

const loadDXFFromBuffer = async (buffer: ArrayBuffer) => {
  await loadDXFFromText(decodeBuffer(buffer));
};

const loadDXFFromBlob = async (blob: Blob) => {
  const buffer = await blob.arrayBuffer();
  await loadDXFFromBuffer(buffer);
};

const loadDXFFromUrl = async (url: string) => {
  clearError();
  isLoading.value = true;
  loadingPhase.value = "fetching";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const text = await response.text();
    await loadDXFFromText(text);
  } catch (error) {
    // loadDXFFromText has its own error handling;
    // this catch handles fetch errors only
    handleLoadError(error, "Failed to fetch DXF");
  } finally {
    loadingPhase.value = "";
    isLoading.value = false;
  }
};

const resize = () => {
  if (dxfContainer.value) {
    handleResize(dxfContainer.value);
  }
};

watch(
  () => props.dxfData,
  (newData) => {
    // Skip if data was already loaded via loadDXFFromText
    if (newData && hasDXFData.value && toRaw(newData) !== lastLoadedDxf) {
      loadDXFFromData(newData);
    }
  },
);

watch(
  () => props.url,
  (newUrl) => {
    if (newUrl) loadDXFFromUrl(newUrl);
  },
);

watch(
  () => props.darkTheme,
  (newDark) => {
    // Instant theme switch: update material colors + scene background without re-render
    switchTheme(newDark);
    updateLayerThemeColors(newDark);
  },
);

watch(rendererError, (newError) => {
  if (newError) {
    emit("error", newError);
  }
});

watch(
  () => props.pickingEnabled,
  (enabled) => {
    picking.setEnabled(enabled);
    if (!enabled) {
      teardownPicking();
    } else if (lastDxfForPicking == null) {
      const dxf = props.dxfData ?? null;
      if (dxf && dxf.entities?.length) setupPickingForDxf(dxf);
    }
    // (Re-)attach pointer listeners to the canvas if picking just turned on
    if (enabled) attachPickingIfReady();
  },
);

watch(
  () => props.highlightColor,
  (color) => { highlightCtl.setColor(color); },
);

watch(
  () => props.pickingDebug,
  (on) => {
    picking.setDebug(on);
    renderScene();
  },
);

watch(
  () => props.keyboardNavigation,
  (on) => {
    keyboardNav.setEnabled(on);
    if (on) {
      const renderer = getRenderer();
      if (renderer) keyboardNav.attach(renderer.domElement);
    } else {
      keyboardNav.detach();
    }
  },
);

const attachPickingIfReady = (): void => {
  if (!props.pickingEnabled) return;
  const renderer = getRenderer();
  const camera = getCamera();
  if (!renderer || !camera) return;
  picking.attach(renderer.domElement, camera, {
    onHover: handleEntityHover,
    onClick: handleEntityClick,
  });
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  nextTick(() => {
    if (dxfContainer.value) {
      initThreeJS(dxfContainer.value, { enableControls: true, aaMode: props.antialiasing });
      attachPickingIfReady();

      const cam = getCamera();
      rulerCamera.value = cam ? markRaw(cam) : null;
      const ctrls = getControls();
      rulerControls.value = ctrls
        ? markRaw(ctrls as unknown as NonNullable<typeof rulerControls.value>)
        : null;

      const renderer = getRenderer();
      if (renderer && props.keyboardNavigation) {
        keyboardNav.attach(renderer.domElement);
      }

      if (props.url) {
        loadDXFFromUrl(props.url);
      } else if (props.dxfData && hasDXFData.value) {
        loadDXFFromData(props.dxfData);
      }

      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(dxfContainer.value);
    }
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  picking.detach();
  keyboardNav.detach();
  teardownPicking();
  cleanup();
});

defineExpose({
  loadDXFFromText,
  loadDXFFromData,
  loadDXFFromUrl,
  loadDXFFromBuffer,
  loadDXFFromBlob,
  resize,
  resetView,
  exportToPNG,
  getRenderer,
  highlight,
  clearHighlight,
  getAssociations,
  findAssociationsByHandle,
  zoomToEntity,
  zoomToLayer,
  getPickingIndex: picking.getPickingIndex,
});
</script>

<style scoped>
.dxfk-viewer {
  position: relative;
  width: 100%;
  flex: 1;
  background-color: var(--dxfk-bg-color, #fafafa);
  border: 2px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  overflow: hidden;
  touch-action: none;
}

/* Overlay grid: 6-cell layout for positioning overlay elements */
.dxfk-overlay-grid {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "top-left     top-center     top-right"
    "bottom-left  bottom-center  bottom-right";
  padding: var(--dxfk-spacing-sm, 8px);
  gap: var(--dxfk-spacing-sm, 8px);
  pointer-events: none;
}

/* Reserve space along the top and left edges for the rulers so overlay
   elements don't sit on top of them. */
.dxfk-overlay-grid--with-rulers {
  padding-top: calc(var(--dxfk-ruler-size, 24px) + var(--dxfk-spacing-sm, 8px));
  padding-left: calc(var(--dxfk-ruler-size, 24px) + var(--dxfk-spacing-sm, 8px));
}

.dxfk-ruler-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--dxfk-ruler-size, 24px);
  height: var(--dxfk-ruler-size, 24px);
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--dxfk-ruler-text, #333);
  background-color: var(--dxfk-ruler-bg, #fafafa);
  border-right: 1px solid var(--dxfk-ruler-tick, #999);
  border-bottom: 1px solid var(--dxfk-ruler-tick, #999);
  pointer-events: none;
  user-select: none;
}

.dxfk-ruler-corner.dxfk-dark {
  --dxfk-ruler-bg: #1f1f1f;
  --dxfk-ruler-text: #ddd;
  --dxfk-ruler-tick: #888;
}

.dxfk-overlay-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 0;
}

.dxfk-overlay-cell--top-left { grid-area: top-left; align-items: flex-start; }
.dxfk-overlay-cell--top-center { grid-area: top-center; align-items: center; }
.dxfk-overlay-cell--top-right { grid-area: top-right; align-items: flex-end; }
.dxfk-overlay-cell--bottom-left { grid-area: bottom-left; align-items: flex-start; justify-content: flex-end; }
.dxfk-overlay-cell--bottom-center { grid-area: bottom-center; align-items: center; justify-content: flex-end; }
.dxfk-overlay-cell--bottom-right { grid-area: bottom-right; align-items: flex-end; justify-content: flex-end; }

.dxfk-file-name-overlay {
  padding: var(--dxfk-spacing-sm, 8px) var(--dxfk-spacing-md, 16px);
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  font-size: 14px;
  color: var(--dxfk-text-color, #212121);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dxfk-viewer :deep(canvas) {
  display: block;
}

.dxfk-coordinates-overlay {
  display: flex;
  flex-direction: column;
  padding: 4px var(--dxfk-spacing-sm, 8px);
  background-color: rgba(255, 255, 255, 0.95);
  color: var(--dxfk-text-color, #212121);
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  font-size: 12px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  white-space: nowrap;
}

.dxfk-coord-row {
  display: flex;
  gap: 2px;
}

.dxfk-coord-value--na {
  color: var(--dxfk-text-secondary, #757575);
  opacity: 0.65;
}

.dxfk-coord-label {
  width: 1.2em;
  text-align: right;
  flex-shrink: 0;
}

.dxfk-coord-value {
  width: 7em;
  text-align: right;
  flex-shrink: 0;
}

.dxfk-zoom-value {
  width: auto;
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-debug-overlay {
  display: flex;
  gap: var(--dxfk-spacing-sm, 8px);
  padding: 4px var(--dxfk-spacing-sm, 8px);
  background-color: rgba(0, 0, 0, 0.7);
  color: #ccc;
  border-radius: var(--dxfk-border-radius, 4px);
  font-size: 11px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}

.dxfk-message-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dxfk-spacing-lg, 24px);
}

.dxfk-message-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--dxfk-spacing-md, 16px);
  text-align: center;
}

.dxfk-message-icon--error {
  color: var(--dxfk-error-color, #f44336);
}

.dxfk-message-icon--placeholder {
  color: var(--dxfk-border-color, #e0e0e0);
}

.dxfk-message-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--dxfk-text-color, #212121);
}

.dxfk-message-text {
  font-size: 1rem;
  color: var(--dxfk-text-secondary, #757575);
  max-width: 300px;
}

.dxfk-loading-overlay {
  z-index: 20;
  background-color: rgba(250, 250, 250, 0.85);
}

.dxfk-error-overlay {
  z-index: 20;
  background-color: rgba(250, 250, 250, 0.95);
}

.dxfk-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--dxfk-border-color, #e0e0e0);
  border-top-color: var(--dxfk-primary-color, #1040b0);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.dxfk-progress-container {
  width: 200px;
  height: 4px;
  background-color: var(--dxfk-border-color, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.dxfk-progress-bar {
  height: 100%;
  background-color: var(--dxfk-primary-color, #1040b0);
  transition: width 0.1s ease-out;
}

.dxfk-progress-text {
  font-size: 0.85rem;
  color: var(--dxfk-text-secondary, #757575);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.dxfk-drop-overlay {
  z-index: 30;
  background-color: rgba(250, 250, 250, 0.9);
  border: 3px dashed var(--dxfk-primary-color, #1040b0);
}

.dxfk-drop-overlay svg {
  color: var(--dxfk-primary-color, #1040b0);
}

/*
 * Dark theme — applied when the viewer root carries `.dxfk-dark`. Child
 * components (ViewerToolbar, LayerPanel) own their own dark styles via the
 * `darkTheme` prop, so this block stays local to elements the viewer renders
 * directly.
 */
.dxfk-viewer.dxfk-dark {
  background-color: #1a1a1a;
  border-color: #333;
}

.dxfk-viewer.dxfk-dark .dxfk-loading-overlay {
  background-color: rgba(26, 26, 26, 0.85);
}

.dxfk-viewer.dxfk-dark .dxfk-error-overlay {
  background-color: rgba(26, 26, 26, 0.95);
}

.dxfk-viewer.dxfk-dark .dxfk-file-name-overlay {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #333;
  color: #e0e0e0;
}

.dxfk-viewer.dxfk-dark .dxfk-coordinates-overlay {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  color: #e0e0e0;
}

.dxfk-viewer.dxfk-dark .dxfk-message-text {
  color: #aaa;
}

.dxfk-viewer.dxfk-dark .dxfk-progress-text {
  color: #aaa;
}

.dxfk-viewer.dxfk-dark .dxfk-message-title {
  color: #e0e0e0;
}

.dxfk-viewer.dxfk-dark .dxfk-spinner {
  border-color: #444;
  border-top-color: #6b8fd4;
}

.dxfk-viewer.dxfk-dark .dxfk-progress-container {
  background-color: #444;
}

.dxfk-viewer.dxfk-dark .dxfk-message-icon--placeholder {
  color: #555;
}

.dxfk-viewer.dxfk-dark .dxfk-drop-overlay {
  background-color: rgba(26, 26, 26, 0.9);
  border-color: #6b8fd4;
}

.dxfk-viewer.dxfk-dark .dxfk-drop-overlay svg {
  color: #6b8fd4;
}

@media (max-width: 768px) {
  .dxfk-file-name-overlay {
    padding: 6px var(--dxfk-spacing-sm, 8px);
    font-size: 12px;
  }

  .dxfk-message-title {
    font-size: 1.1rem;
  }

  .dxfk-message-text {
    font-size: 0.9rem;
  }
}
</style>
