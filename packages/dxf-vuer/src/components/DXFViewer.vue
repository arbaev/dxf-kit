<template>
  <div
    ref="dxfContainer"
    class="dxf-viewer"
    :class="{ 'dark-theme': darkTheme }"
    role="region"
    aria-label="DXF drawing viewer"
    :aria-busy="isLoading"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <div v-if="!webGLSupported" class="message-overlay">
      <div class="message-content error">
        <svg
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
        <div class="message-title">WebGL Not Supported</div>
        <div class="message-text">Update your browser or enable hardware acceleration</div>
      </div>
    </div>

    <div v-if="hasDXFData" class="overlay-grid">
      <div
        v-for="pos in overlayPositions"
        :key="pos"
        class="overlay-cell"
        :class="`cell-${pos}`"
      >
        <div v-if="fileNamePosition === pos && showFileName && fileName" class="file-name-overlay">
          {{ fileName }}
        </div>

        <slot
          v-if="toolbarPosition === pos"
          name="toolbar"
          v-bind="{ resetView: handleResetView, exportToPNG, toggleFullscreen, isFullscreen }"
        >
          <ViewerToolbar
            :show-export-button="showExportButton"
            :show-reset-button="showResetButton"
            :show-fullscreen-button="showFullscreenButton"
            :is-fullscreen="isFullscreen"
            @export="exportToPNG"
            @reset-view="handleResetView"
            @toggle-fullscreen="toggleFullscreen"
          >
            <template v-if="$slots['toolbar-extra']" #extra>
              <slot name="toolbar-extra" />
            </template>
          </ViewerToolbar>
        </slot>

        <div v-if="coordinatesPosition === pos && (showCoordinates || showZoomLevel)" class="coordinates-overlay">
          <template v-if="showCoordinates">
            <div class="coord-row">
              <span class="coord-label">X:</span>
              <span class="coord-value" :class="{ 'coord-value--na': !isCursorVisible }">
                {{ isCursorVisible ? cursorX.toFixed(2) : "N/A" }}
              </span>
            </div>
            <div class="coord-row">
              <span class="coord-label">Y:</span>
              <span class="coord-value" :class="{ 'coord-value--na': !isCursorVisible }">
                {{ isCursorVisible ? cursorY.toFixed(2) : "N/A" }}
              </span>
            </div>
          </template>
          <div v-if="showZoomLevel" class="coord-row">
            <span class="coord-value zoom-value">{{ zoomPercent }}%</span>
          </div>
        </div>

        <div v-if="debugPosition === pos && showDebugInfo" class="debug-overlay">
          <span>{{ debugInfo.fps }} FPS</span>
          <span>{{ debugInfo.drawCalls }} draws</span>
          <span>{{ formatK(debugInfo.lines) }} lines</span>
          <span>{{ formatK(debugInfo.triangles) }} tris</span>
        </div>

        <LayerPanel
          v-if="showLayerPanel && layerPanelPosition === pos && layerList.length > 0"
          :layers="layerList"
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

    <div v-if="isLoading" class="message-overlay loading-overlay" role="status" aria-live="polite">
      <slot name="loading" :phase="loadingPhase" :progress="displayProgress">
        <div class="message-content">
          <div class="spinner"></div>
          <div class="message-text">
            {{
              loadingPhase === "fetching"
                ? "Loading DXF..."
                : loadingPhase === "parsing"
                  ? "Parsing DXF..."
                  : "Rendering..."
            }}
          </div>
          <div v-if="loadingPhase === 'rendering'" class="progress-container">
            <div class="progress-bar" :style="{ width: displayProgress * 100 + '%' }"></div>
          </div>
          <div v-if="loadingPhase === 'rendering'" class="progress-text">
            {{ Math.round(displayProgress * 100) }}%
          </div>
        </div>
      </slot>
    </div>

    <div v-else-if="errorMessage" class="message-overlay error-overlay" role="alert" aria-live="assertive">
      <slot name="error" :message="errorMessage" :retry="retry">
        <div class="message-content error">
          <svg
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
          <div class="message-title">Error</div>
          <div class="message-text">{{ errorMessage }}</div>
        </div>
      </slot>
    </div>

    <div v-else-if="!hasDXFData" class="message-overlay">
      <slot name="empty-state">
        <div class="message-content placeholder">
          <svg
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
          <div class="message-text">Select a DXF file to view</div>
        </div>
      </slot>
    </div>

    <div v-if="isDragOver" class="message-overlay drop-overlay">
      <div class="message-content">
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
        <div class="message-text">Drop DXF file here</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw } from "vue";
import * as THREE from "three";
import { useDXFRenderer } from "../composables/useDXFRenderer";
import { useLayers } from "../composables/useLayers";
import { useLoadError } from "../composables/useLoadError";
import { usePicking, type PickingEvent } from "../composables/usePicking";
import { useHighlight } from "../composables/useHighlight";
import { useKeyboardNavigation } from "../composables/useKeyboardNavigation";
import type { DxfData, DxfLayer, PickingEntry, EntityAssociation } from "dxf-render";
import { getZoomBox, getZoomBoxForLayer } from "dxf-render";
import type { OverlayPosition } from "../types";
import type { AntialiasingMode } from "dxf-render";
import LayerPanel from "./LayerPanel.vue";
import ViewerToolbar from "./ViewerToolbar.vue";

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
  if (!props.showCoordinates) return;
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

    loadingPhase.value = "rendering";
    const unsupportedEntities = await displayDXF(dxf, props.darkTheme, props.fontUrl);
    initLayersFromDXF(dxf, props.darkTheme);
    applyLayerVisibility(visibleLayerNames.value);
    setupPickingForDxf(dxf);
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
  try {
    const unsupportedEntities = await displayDXF(dxfData, props.darkTheme, props.fontUrl);
    initLayersFromDXF(dxfData, props.darkTheme);
    applyLayerVisibility(visibleLayerNames.value);
    setupPickingForDxf(dxfData);
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
.dxf-viewer {
  position: relative;
  width: 100%;
  flex: 1;
  background-color: var(--dxf-vuer-bg-color, #fafafa);
  border: 2px solid var(--dxf-vuer-border-color, #e0e0e0);
  border-radius: var(--dxf-vuer-border-radius, 4px);
  overflow: hidden;
  touch-action: none;
}

/* Overlay grid: 9-cell layout for positioning overlay elements */
.overlay-grid {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "top-left     top-center     top-right"
    "bottom-left  bottom-center  bottom-right";
  padding: var(--dxf-vuer-spacing-sm, 8px);
  gap: var(--dxf-vuer-spacing-sm, 8px);
  pointer-events: none;
}

.overlay-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 0;
}

.cell-top-left { grid-area: top-left; align-items: flex-start; }
.cell-top-center { grid-area: top-center; align-items: center; }
.cell-top-right { grid-area: top-right; align-items: flex-end; }
.cell-bottom-left { grid-area: bottom-left; align-items: flex-start; justify-content: flex-end; }
.cell-bottom-center { grid-area: bottom-center; align-items: center; justify-content: flex-end; }
.cell-bottom-right { grid-area: bottom-right; align-items: flex-end; justify-content: flex-end; }

.file-name-overlay {
  padding: var(--dxf-vuer-spacing-sm, 8px) var(--dxf-vuer-spacing-md, 16px);
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--dxf-vuer-border-color, #e0e0e0);
  border-radius: var(--dxf-vuer-border-radius, 4px);
  font-size: 14px;
  color: var(--dxf-vuer-text-color, #212121);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dxf-viewer :deep(canvas) {
  display: block;
}

.coordinates-overlay {
  display: flex;
  flex-direction: column;
  padding: 4px var(--dxf-vuer-spacing-sm, 8px);
  background-color: rgba(255, 255, 255, 0.95);
  color: var(--dxf-vuer-text-color, #212121);
  border: 1px solid var(--dxf-vuer-border-color, #e0e0e0);
  border-radius: var(--dxf-vuer-border-radius, 4px);
  font-size: 12px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  white-space: nowrap;
}

.coord-row {
  display: flex;
  gap: 2px;
}

.coord-value--na {
  color: var(--dxf-vuer-text-secondary, #757575);
  opacity: 0.65;
}

.coord-label {
  width: 1.2em;
  text-align: right;
  flex-shrink: 0;
}

.coord-value {
  width: 7em;
  text-align: right;
  flex-shrink: 0;
}

.zoom-value {
  width: auto;
  color: var(--dxf-vuer-text-secondary, #757575);
}

.debug-overlay {
  display: flex;
  gap: var(--dxf-vuer-spacing-sm, 8px);
  padding: 4px var(--dxf-vuer-spacing-sm, 8px);
  background-color: rgba(0, 0, 0, 0.7);
  color: #ccc;
  border-radius: var(--dxf-vuer-border-radius, 4px);
  font-size: 11px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}

.message-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dxf-vuer-spacing-lg, 24px);
}

.message-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--dxf-vuer-spacing-md, 16px);
  text-align: center;
}

.message-content.error svg {
  color: var(--dxf-vuer-error-color, #f44336);
}

.message-content.placeholder svg {
  color: var(--dxf-vuer-border-color, #e0e0e0);
}

.message-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--dxf-vuer-text-color, #212121);
}

.message-text {
  font-size: 1rem;
  color: var(--dxf-vuer-text-secondary, #757575);
  max-width: 300px;
}

.loading-overlay {
  z-index: 20;
  background-color: rgba(250, 250, 250, 0.85);
}

.error-overlay {
  z-index: 20;
  background-color: rgba(250, 250, 250, 0.95);
}



.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--dxf-vuer-border-color, #e0e0e0);
  border-top-color: var(--dxf-vuer-primary-color, #1040b0);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.progress-container {
  width: 200px;
  height: 4px;
  background-color: var(--dxf-vuer-border-color, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: var(--dxf-vuer-primary-color, #1040b0);
  transition: width 0.1s ease-out;
}

.progress-text {
  font-size: 0.85rem;
  color: var(--dxf-vuer-text-secondary, #757575);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Dark theme overrides */
.dxf-viewer.dark-theme {
  background-color: #1a1a1a;
  border-color: #333;
}

.dark-theme .loading-overlay {
  background-color: rgba(26, 26, 26, 0.85);
}

.dark-theme .error-overlay {
  background-color: rgba(26, 26, 26, 0.95);
}



.dark-theme .file-name-overlay {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #333;
  color: #e0e0e0;
}

.dark-theme :deep(.toolbar-button) {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  color: #e0e0e0;
}

.dark-theme .message-text {
  color: #aaa;
}

.dark-theme .progress-text {
  color: #aaa;
}

.dark-theme .message-title {
  color: #e0e0e0;
}

.dark-theme .spinner {
  border-color: #444;
  border-top-color: #6b8fd4;
}

.dark-theme .progress-container {
  background-color: #444;
}

.dark-theme .message-content.placeholder svg {
  color: #555;
}

.dark-theme :deep(.layer-panel) {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.dark-theme :deep(.layer-panel-header) {
  border-bottom-color: #444;
}

.dark-theme :deep(.layer-panel-title) {
  color: #e0e0e0;
}

.dark-theme :deep(.collapse-btn) {
  color: #aaa;
}

.dark-theme :deep(.layer-panel-actions) {
  border-bottom-color: #444;
}

.dark-theme :deep(.action-btn) {
  border-color: #555;
  color: #aaa;
}

.dark-theme :deep(.action-btn:hover) {
  border-color: #6b8fd4;
  color: #6b8fd4;
}

.dark-theme :deep(.layer-item:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

.dark-theme :deep(.eye-icon) {
  color: #e0e0e0;
}

.dark-theme :deep(.eye-icon.off) {
  color: #666;
}

.dark-theme :deep(.layer-name) {
  color: #e0e0e0;
}

.dark-theme :deep(.layer-count) {
  color: #888;
}

.dark-theme :deep(.color-swatch) {
  border-color: rgba(255, 255, 255, 0.2);
}

.drop-overlay {
  z-index: 30;
  background-color: rgba(250, 250, 250, 0.9);
  border: 3px dashed var(--dxf-vuer-primary-color, #1040b0);
}

.drop-overlay svg {
  color: var(--dxf-vuer-primary-color, #1040b0);
}

.dark-theme .drop-overlay {
  background-color: rgba(26, 26, 26, 0.9);
  border-color: #6b8fd4;
}

.dark-theme .drop-overlay svg {
  color: #6b8fd4;
}

.dark-theme .coordinates-overlay {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  color: #e0e0e0;
}

@media (max-width: 768px) {
  .file-name-overlay {
    padding: 6px var(--dxf-vuer-spacing-sm, 8px);
    font-size: 12px;
  }

  .message-title {
    font-size: 1.1rem;
  }

  .message-text {
    font-size: 0.9rem;
  }
}
</style>
