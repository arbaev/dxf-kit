<template>
  <div class="app" :class="{ dark: isDark }">
    <div class="top-actions">
      <a
        class="top-action-btn"
        href="https://github.com/arbaev/dxf-kit"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View on GitHub"
        title="View on GitHub"
        @click="trackEvent('external-link', { target: 'github' })"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"
          />
        </svg>
      </a>
      <button
        class="top-action-btn"
        @click="isDark = !isDark"
        :title="isDark ? 'Light mode' : 'Dark mode'"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <svg
          v-if="isDark"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
    </div>

    <main class="app-main">
      <HeroSection />

      <div class="upload-area">
        <FileUploader @file-selected="handleFileSelected" />
      </div>

      <div class="sample-buttons">
        <span class="sample-label">or try built-in samples:</span>
        <div class="sample-list">
          <button
            v-for="sample in samples"
            :key="sample.file"
            class="sample-btn"
            :class="{
              active: currentFileName === sample.label,
              loading: loadingSampleFile === sample.file,
            }"
            :disabled="isLoadingSample"
            :aria-label="`Load sample: ${sample.label} (${sample.size})`"
            @click="loadSample(sample)"
          >
            <span v-if="loadingSampleFile === sample.file" class="sample-spinner" />
            {{ sample.label }}
            <span class="sample-hint" :class="{ 'sample-hint--heavy': sample.heavy }">{{
              sample.size
            }}</span>
          </button>
        </div>
      </div>

      <p class="controls-hint">
        {{ isTouchDevice ? "Pinch to zoom · Drag to pan" : "Scroll to zoom · Drag to pan" }}
      </p>

      <div v-if="error" class="error-message">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="6" x2="12" y2="14" />
          <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
        </svg>
        <span>{{ error }}</span>
      </div>

      <UnsupportedEntities v-if="unsupportedEntities.length > 0" :entities="unsupportedEntities" />

      <div id="viewer" class="viewer-container">
        <DXFViewer
          :key="aaMode"
          ref="dxfViewerRef"
          :dxf-data="dxfData"
          :file-name="currentFileName"
          :show-reset-button="showResetButton"
          :show-fullscreen-button="showFullscreenButton"
          :show-export-button="showExportButton"
          :show-file-name="showFileName"
          :show-coordinates="showCoordinates"
          :show-zoom-level="showZoomLevel"
          :show-debug-info="showDebugInfo"
          :show-layer-panel="showLayerPanel"
          :group-layers="groupLayers"
          :show-properties-panel="showPropertiesPanel"
          :allow-drop="true"
          :auto-fit="true"
          :file-name-position="fileNamePosition"
          :toolbar-position="toolbarPosition"
          :coordinates-position="coordinatesPosition"
          :debug-position="debugPosition"
          :layer-panel-position="layerPanelPosition"
          :properties-panel-position="propertiesPanelPosition"
          :dark-theme="isDark"
          :antialiasing="aaMode"
          :picking-enabled="pickingEnabled"
          :picking-debug="pickingDebug"
          :highlight-on-hover="highlightOnHover"
          :highlight-associated="highlightAssociated"
          :rectangle-selection="rectangleSelection"
          :overlay-position="pickingPosition"
          :show-rulers="showRulers"
          :ruler-units="rulerUnits"
          :show-measure-button="true"
          :show-measure-area-button="true"
          :show-measure-angle-button="true"
          :snap-to-geometry="snapToGeometry"
          v-model:measure-mode="measureMode"
          v-model:hidden-layers="hiddenLayers"
          @dxf-data="handleDXFData"
          @unsupported-entities="handleUnsupportedEntities"
          @error="handleError"
          @dxf-loaded="handleDXFLoaded"
          @reset-view="resetView"
          @file-dropped="handleFileDropped"
          @entity-hover="handleEntityHover"
          @entities-select="handleEntitiesSelect"
          @measure="handleMeasureResult"
          @measure-area="handleMeasureAreaResult"
          @measure-angle="handleMeasureAngleResult"
          @measure-cancel="handleMeasureCancel"
        >
          <template #overlay>
            <div v-if="pickingEnabled && hoveredEntity" class="hover-pill">
              <span class="hover-tag">{{ hoveredEntity.type }}</span>
              <code class="hover-handle">#{{ hoveredEntity.handle }}</code>
              <span v-if="hoveredEntity.text" class="hover-text">{{ hoveredEntity.text }}</span>
            </div>
          </template>
        </DXFViewer>
      </div>

      <div v-if="dxfData && dxfData.entities && dxfData.entities.length > 0" class="search-bar">
        <svg
          class="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Search by text — TEXT · ATTRIB · DIMENSION"
          aria-label="Search entities by text"
          @keyup.enter="zoomToSearchResults"
        />
        <span v-if="searchQuery" class="search-count">
          {{ searchResults.length }} {{ searchResults.length === 1 ? "match" : "matches" }}
        </span>
        <button
          v-if="searchQuery && searchResults.length > 0"
          class="search-zoom"
          type="button"
          title="Zoom to all matches (Enter)"
          @click="zoomToSearchResults"
        >
          Zoom to all
          <svg
            class="search-zoom-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
        <button
          v-if="searchQuery"
          class="search-clear"
          type="button"
          aria-label="Clear search"
          @click="clearSearch"
        >
          ×
        </button>
      </div>

      <section class="settings-panel" aria-label="Viewer settings">
        <header class="settings-header">
          <h3 class="settings-title">Settings</h3>
          <!-- Scenario presets, centered in the header: guided one-click path;
               manual tweaks → "Custom". Drops to its own row on mobile. -->
          <div class="settings-presets" role="radiogroup" aria-label="Setting scenarios">
            <button
              v-for="preset in presetList"
              :key="preset.id"
              class="preset-btn"
              type="button"
              role="radio"
              :aria-checked="activePreset === preset.id"
              :class="{ active: activePreset === preset.id }"
              :title="preset.hint"
              @click="applyPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
            <span v-if="activePreset === null" class="preset-custom">Custom</span>
          </div>
          <button
            class="settings-reset"
            type="button"
            @click="resetSettings"
            title="Reset all viewer settings to defaults"
          >
            Reset
          </button>
        </header>

        <div class="settings-body">
          <!-- LEFT: controls (the knobs you turn) -->
          <div class="settings-controls">
            <div class="control-group">
              <span class="control-group-title">Rendering</span>
              <label class="aa-row">
                <span class="aa-label">Antialiasing</span>
                <select v-model="aaMode" class="aa-select">
                  <option value="none">None</option>
                  <option value="msaa">MSAA (hardware, default)</option>
                  <option value="smaa">SMAA</option>
                  <option value="fxaa">FXAA</option>
                  <option value="taa">TAA (jittered, idle-only)</option>
                  <option value="ssaa">SSAA (high quality, slow)</option>
                </select>
              </label>
              <p class="settings-cell-hint">{{ aaDescription }}</p>
              <label class="picking-label">
                <input type="checkbox" v-model="showRulers" />
                <span>Show rulers</span>
              </label>
              <label class="aa-row">
                <span class="aa-label">Units</span>
                <select v-model="rulerUnits" class="aa-select" :disabled="!showRulers">
                  <option value="dxf-units">DXF units (raw)</option>
                  <option value="mm">Millimeters</option>
                  <option value="inch">Inches</option>
                </select>
              </label>
              <label class="picking-label">
                <input type="checkbox" v-model="groupLayers" :disabled="!showLayerPanel" />
                <span>Group layers by prefix</span>
              </label>
            </div>

            <div class="control-group">
              <span class="control-group-title">Tools</span>
              <label class="picking-label">
                <input type="checkbox" v-model="pickingEnabled" />
                <span>Entity picking</span>
              </label>
              <div v-if="pickingEnabled" class="control-sub">
                <label class="picking-label">
                  <input type="checkbox" v-model="highlightOnHover" />
                  <span>Highlight on hover</span>
                </label>
                <label class="picking-label">
                  <input
                    type="checkbox"
                    v-model="highlightAssociated"
                    :disabled="!highlightOnHover"
                  />
                  <span>Highlight associated members</span>
                </label>
                <label class="picking-label">
                  <input type="checkbox" v-model="rectangleSelection" />
                  <span>Rectangle selection (Shift-drag)</span>
                </label>
                <label class="picking-label">
                  <input type="checkbox" v-model="pickingDebug" />
                  <span>Show picking bboxes (debug)</span>
                </label>
              </div>
              <p class="settings-cell-hint">
                Hover for live data, click for the snapshot in the inspector. Shift-drag selects:
                left&rarr;right = window, right&rarr;left = crossing.
              </p>

              <!-- Measurement settings (Maximum only) — redundant with the canvas
                   toolbar in normal use, so kept out of the everyday scenarios. -->
              <template v-if="showMeasureControls">
                <div class="control-field">
                  <span class="aa-label">Measurement</span>
                  <div class="segmented" role="radiogroup" aria-label="Measurement tool">
                    <button
                      type="button"
                      class="segmented-btn"
                      role="radio"
                      :aria-checked="measureMode === 'none'"
                      :class="{ active: measureMode === 'none' }"
                      @click="measureMode = 'none'"
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      class="segmented-btn"
                      role="radio"
                      :aria-checked="measureMode === 'distance'"
                      :class="{ active: measureMode === 'distance' }"
                      @click="measureMode = 'distance'"
                    >
                      Distance
                    </button>
                    <button
                      type="button"
                      class="segmented-btn"
                      role="radio"
                      :aria-checked="measureMode === 'area'"
                      :class="{ active: measureMode === 'area' }"
                      @click="measureMode = 'area'"
                    >
                      Area
                    </button>
                    <button
                      type="button"
                      class="segmented-btn"
                      role="radio"
                      :aria-checked="measureMode === 'angle'"
                      :class="{ active: measureMode === 'angle' }"
                      @click="measureMode = 'angle'"
                    >
                      Angle
                    </button>
                  </div>
                </div>
                <label class="picking-label">
                  <input type="checkbox" v-model="snapToGeometry" />
                  <span>Snap to geometry (endpoint / midpoint / center)</span>
                </label>
              </template>
            </div>

            <div class="control-group">
              <span class="control-group-title">Layout</span>
              <p class="settings-cell-hint">
                Click an empty cell to position an overlay; click the active (blue) cell to hide it.
              </p>
              <div class="overlay-rows">
                <div v-for="row in overlayRows" :key="row.label" class="overlay-row">
                  <span class="overlay-label" :class="{ off: !row.isVisible() }">{{
                    row.label
                  }}</span>
                  <div
                    class="layout-mini-grid"
                    role="radiogroup"
                    :aria-label="`${row.label} position`"
                  >
                    <button
                      v-for="pos in overlayPositions"
                      :key="pos"
                      class="layout-cell"
                      :class="{ active: row.isVisible() && row.getPosition() === pos }"
                      :aria-label="pos"
                      :title="
                        row.isVisible() && row.getPosition() === pos
                          ? `${pos} (click to hide)`
                          : pos
                      "
                      @click="onCellClick(row, pos)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT: inspector (what the viewer reports back) -->
          <div class="settings-inspector">
            <span class="control-group-title">Inspector</span>

            <p v-if="inspectorIdle" class="inspector-empty">
              Shift-drag to select entities — the list shows up here. Click a single entity to see
              its full properties in the on-canvas panel.
            </p>

            <div v-if="selectedEntities.length > 0" class="inspector-section">
              <header class="settings-cell-header">
                <span class="settings-cell-title">
                  Selection
                  <span class="settings-badge">{{ selectedEntities.length }}</span>
                </span>
                <button class="settings-cell-action" type="button" @click="clearRectangleSelection">
                  Clear
                </button>
              </header>
              <div class="rect-selection-summary">
                <span
                  v-for="[type, count] in selectionTypeCounts"
                  :key="type"
                  class="rect-selection-chip"
                >
                  {{ type }} <code>{{ count }}</code>
                </span>
              </div>
              <ul class="rect-selection-list">
                <li
                  v-for="event in selectedEntitiesPreview"
                  :key="event.pickId ?? event.handle"
                  class="rect-selection-item"
                  @click="zoomToSelectedEntity(event)"
                >
                  <span class="picking-tag">{{ event.type }}</span>
                  <code class="rect-selection-handle">#{{ event.handle }}</code>
                  <span class="rect-selection-layer">{{ event.layer }}</span>
                  <span v-if="event.text" class="rect-selection-text">{{ event.text }}</span>
                </li>
                <li
                  v-if="selectedEntities.length > selectedEntitiesPreview.length"
                  class="rect-selection-more"
                >
                  …and {{ selectedEntities.length - selectedEntitiesPreview.length }} more
                </li>
              </ul>
            </div>

            <div class="inspector-section">
              <header class="settings-cell-header">
                <span class="settings-cell-title">
                  Associations
                  <span v-if="associations.length > 0" class="settings-badge">{{
                    associations.length
                  }}</span>
                </span>
                <button
                  v-if="pickingEnabled && associations.length > 0"
                  class="settings-cell-action"
                  type="button"
                  @click="clearAssociationHighlight"
                >
                  Clear
                </button>
              </header>
              <template v-if="!pickingEnabled">
                <p class="settings-cell-hint">
                  Enable &laquo;Entity picking&raquo; to inspect associations.
                </p>
              </template>
              <template v-else-if="associations.length === 0">
                <p class="settings-cell-hint">
                  No associations in this drawing. Try the <code>Floor Plan</code> sample — it has
                  MLEADER, LEADER&rarr;TEXT, INSERT+ATTRIB and DIMENSION links.
                </p>
              </template>
              <template v-else>
                <p class="settings-cell-hint">Click a row to highlight and zoom to its members.</p>
                <div class="associations-list">
                  <button
                    v-for="(group, kind) in groupedAssociations"
                    :key="kind"
                    class="associations-kind-btn"
                    :class="{ active: activeKindFilter === kind }"
                    @click="activeKindFilter = activeKindFilter === kind ? null : kind"
                  >
                    {{ kind }} <span class="associations-kind-count">({{ group.length }})</span>
                  </button>
                </div>
                <div class="associations-rows">
                  <button
                    v-for="a in visibleAssociations"
                    :key="a.id"
                    class="association-row"
                    :class="{ active: activeAssociationId === a.id }"
                    @click="highlightAssociation(a)"
                  >
                    <span class="association-kind-tag">{{ a.kind }}</span>
                    <code class="association-primary">#{{ a.primary }}</code>
                    <span class="association-members">{{ a.members.length }} members</span>
                    <span v-if="a.text" class="association-text">{{ a.text }}</span>
                  </button>
                </div>
              </template>
            </div>

            <div v-if="showVModelDemo" class="inspector-section">
              <header class="settings-cell-header">
                <span class="settings-cell-title">
                  Layer visibility (<code>v-model</code>)
                  <span v-if="hiddenLayers.length > 0" class="settings-badge">{{
                    hiddenLayers.length
                  }}</span>
                </span>
                <button
                  v-if="hiddenLayers.length > 0"
                  class="settings-cell-action"
                  type="button"
                  @click="showAllLayersExternally"
                >
                  Show all
                </button>
              </header>
              <p class="settings-cell-hint">
                <code>:hidden-layers</code> drives the layer panel from the parent — toggle in the
                panel and watch the array update, or click below and watch the panel.
              </p>
              <div class="vmodel-actions">
                <button
                  class="vmodel-btn"
                  type="button"
                  :disabled="allLayerNames.length === 0"
                  @click="hideFirstLayer"
                >
                  Hide one more
                </button>
                <button
                  class="vmodel-btn"
                  type="button"
                  :disabled="allLayerNames.length === 0"
                  @click="hideHalfLayers"
                >
                  Hide half
                </button>
              </div>
              <div class="vmodel-state">
                <span class="vmodel-label">hiddenLayers =</span>
                <code v-if="hiddenLayers.length === 0" class="vmodel-empty">[]</code>
                <template v-else>
                  <span v-for="name in hiddenLayers" :key="name" class="vmodel-chip">
                    {{ name }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StatsSection />
      <FeaturesSection />
      <FrameworkTabs />
      <ExamplesSection />
      <WhatsNewSection />

      <footer class="app-footer">
        MIT License &middot;
        <a
          href="https://www.npmjs.com/package/dxf-render"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: 'npm-render' })"
          >dxf-render</a
        >
        &middot;
        <a
          href="https://www.npmjs.com/package/dxf-vuer"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: 'npm-vuer' })"
          >dxf-vuer</a
        >
        &middot;
        <a
          href="https://www.npmjs.com/package/dxf-react"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: 'npm-react' })"
          >dxf-react</a
        >
        &middot;
        <a
          href="https://github.com/arbaev/dxf-kit"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: 'github' })"
          >GitHub</a
        >
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import type { Ref } from "vue";
import { FileUploader, UnsupportedEntities, DXFViewer } from "dxf-vuer";
import type {
  AntialiasingMode,
  OverlayPosition,
  PickingEvent,
  MeasureResult,
  MeasureMode,
  AreaMeasureResult,
  AngleMeasureResult,
} from "dxf-vuer";
import "dxf-vuer/style.css";
import type { DxfData, EntityAssociation } from "dxf-render";
import { findEntitiesByText } from "dxf-render";
import HeroSection from "./components/HeroSection.vue";
import StatsSection from "./components/StatsSection.vue";
import FeaturesSection from "./components/FeaturesSection.vue";
import WhatsNewSection from "./components/WhatsNewSection.vue";
import ExamplesSection from "./components/ExamplesSection.vue";
import FrameworkTabs from "./components/FrameworkTabs.vue";
import { trackEvent } from "./analytics";

const THEME_STORAGE_KEY = "dxf-vuer-demo:dark-theme";

const readSavedTheme = (): boolean | null => {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* localStorage may be unavailable (private mode, sandboxed iframe) */
  }
  return null;
};

const isDark = ref(readSavedTheme() ?? window.matchMedia("(prefers-color-scheme: dark)").matches);
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

watch(
  isDark,
  (dark) => {
    document.documentElement.style.backgroundColor = dark ? "#121212" : "";
    document.body.style.backgroundColor = "";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "1" : "0");
    } catch {
      /* ignore */
    }
  },
  { immediate: true },
);
const dxfData = ref<DxfData | null>(null);
const unsupportedEntities = ref<string[]>([]);
const error = ref<string | null>(null);
const currentFileName = ref<string>("");
const dxfViewerRef = ref<InstanceType<typeof DXFViewer> | null>(null);
const isLoadingSample = ref(false);
const loadingSampleFile = ref<string | null>(null);
const aaMode = ref<AntialiasingMode>("msaa");
const pickingEnabled = ref(true);
const pickingDebug = ref(false);
const highlightOnHover = ref(true);
const highlightAssociated = ref(true);
const rectangleSelection = ref(true);
const selectedEntities = ref<PickingEvent[]>([]);
const measureMode = ref<MeasureMode>("none");
const snapToGeometry = ref(true);
const lastMeasureResult = ref<MeasureResult | null>(null);
const lastAreaResult = ref<AreaMeasureResult | null>(null);
const lastAngleResult = ref<AngleMeasureResult | null>(null);
const hiddenLayers = ref<string[]>([]);
const hoveredEntity = ref<PickingEvent | null>(null);
const associations = ref<EntityAssociation[]>([]);
const activeKindFilter = ref<string | null>(null);
const activeAssociationId = ref<string | null>(null);
const searchQuery = ref("");

const searchResults = computed<string[]>(() => {
  if (!dxfData.value || !searchQuery.value) return [];
  const all = findEntitiesByText(dxfData.value, searchQuery.value);
  // Filter out matches that aren't visible in the rendered scene (e.g. text
  // inside unreferenced blocks left over by AutoCAD): the picking index only
  // contains entities reachable from `dxf.entities` + INSERT-expanded blocks.
  const index = dxfViewerRef.value?.getPickingIndex?.();
  if (!index) return all;
  return all.filter((handle) => index.byHandle.has(handle));
});

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchResults, (handles) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    if (!dxfViewerRef.value) return;
    if (handles.length === 0) {
      dxfViewerRef.value.clearHighlight();
    } else {
      dxfViewerRef.value.highlight(handles);
    }
  }, 150);
});

const zoomToSearchResults = (): void => {
  if (dxfViewerRef.value && searchResults.value.length > 0) {
    dxfViewerRef.value.zoomToEntity(searchResults.value);
  }
};

const clearSearch = (): void => {
  searchQuery.value = "";
  if (dxfViewerRef.value) dxfViewerRef.value.clearHighlight();
};

const handleEntityHover = (event: PickingEvent | null) => {
  hoveredEntity.value = event;
};

const handleEntitiesSelect = (events: PickingEvent[]) => {
  selectedEntities.value = events;
  // Re-highlight via the imperative API so the selection survives the drag overlay vanishing.
  if (dxfViewerRef.value && events.length > 0) {
    dxfViewerRef.value.highlight(events.map((e) => e.handle));
  } else {
    dxfViewerRef.value?.clearHighlight();
  }
};

const selectionTypeCounts = computed<[string, number][]>(() => {
  const counts = new Map<string, number>();
  for (const e of selectedEntities.value) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
});

const selectedEntitiesPreview = computed<PickingEvent[]>(() => {
  return selectedEntities.value.slice(0, 10);
});

const clearRectangleSelection = () => {
  selectedEntities.value = [];
  dxfViewerRef.value?.clearHighlight();
};

const handleMeasureResult = (result: MeasureResult) => {
  lastMeasureResult.value = result;
};

const handleMeasureAreaResult = (result: AreaMeasureResult) => {
  lastAreaResult.value = result;
};

const handleMeasureAngleResult = (result: AngleMeasureResult) => {
  lastAngleResult.value = result;
};

const handleMeasureCancel = () => {
  // Don't clear the last readings — keep the previous values visible.
};

const clearMeasureResult = () => {
  lastMeasureResult.value = null;
  lastAreaResult.value = null;
  lastAngleResult.value = null;
  dxfViewerRef.value?.clearMeasure();
};

const zoomToSelectedEntity = (event: PickingEvent) => {
  dxfViewerRef.value?.zoomToEntity([event.handle]);
};

const groupedAssociations = computed(() => {
  const groups: Record<string, EntityAssociation[]> = {};
  for (const a of associations.value) {
    (groups[a.kind] ??= []).push(a);
  }
  return groups;
});

const visibleAssociations = computed(() => {
  const list = activeKindFilter.value
    ? (groupedAssociations.value[activeKindFilter.value] ?? [])
    : associations.value;
  return list.slice(0, 100);
});

const highlightAssociation = (a: EntityAssociation) => {
  if (!dxfViewerRef.value) return;
  activeAssociationId.value = a.id;
  dxfViewerRef.value.highlight(a.members);
  dxfViewerRef.value.zoomToEntity(a.members);
};

const clearAssociationHighlight = () => {
  activeAssociationId.value = null;
  if (dxfViewerRef.value) dxfViewerRef.value.clearHighlight();
};

// Reset = re-apply the "default" scenario (see PRESETS below).
const resetSettings = () => {
  applyPreset("default");
};

// Display option toggles (mirror DXFViewer prop defaults the demo overrides)
const showFileName = ref(true);
const showCoordinates = ref(true);
const showZoomLevel = ref(true);
const showDebugInfo = ref(true);
const showResetButton = ref(true);
const showFullscreenButton = ref(true);
const showExportButton = ref(true);
const showLayerPanel = ref(true);
const showPropertiesPanel = ref(true);
const showRulers = ref(true);
const rulerUnits = ref<"dxf-units" | "mm" | "inch">("mm");
const groupLayers = ref(true);

// Demo-only meta flags (not DXFViewer props), both on only in the "Maximum"
// scenario: the "Layer visibility (v-model)" developer demo, and the in-panel
// measurement controls (redundant with the canvas toolbar in normal use).
const showVModelDemo = ref(false);
const showMeasureControls = ref(false);

// Overlay positions
const overlayPositions: OverlayPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const fileNamePosition = ref<OverlayPosition>("top-left");
const toolbarPosition = ref<OverlayPosition>("top-right");
const coordinatesPosition = ref<OverlayPosition>("bottom-left");
const debugPosition = ref<OverlayPosition>("bottom-center");
const layerPanelPosition = ref<OverlayPosition>("bottom-right");
const propertiesPanelPosition = ref<OverlayPosition>("top-left");
const pickingPosition = ref<OverlayPosition>("top-center");

interface OverlayRow {
  label: string;
  getPosition: () => OverlayPosition;
  setPosition: (p: OverlayPosition) => void;
  isVisible: () => boolean;
  setVisible: (v: boolean) => void;
}

const overlayRows: OverlayRow[] = [
  {
    label: "File name",
    getPosition: () => fileNamePosition.value,
    setPosition: (p) => (fileNamePosition.value = p),
    isVisible: () => showFileName.value,
    setVisible: (v) => (showFileName.value = v),
  },
  {
    label: "Coordinates + Zoom",
    getPosition: () => coordinatesPosition.value,
    setPosition: (p) => (coordinatesPosition.value = p),
    isVisible: () => showCoordinates.value || showZoomLevel.value,
    setVisible: (v) => {
      showCoordinates.value = v;
      showZoomLevel.value = v;
    },
  },
  {
    label: "Toolbar",
    getPosition: () => toolbarPosition.value,
    setPosition: (p) => (toolbarPosition.value = p),
    isVisible: () => showResetButton.value || showFullscreenButton.value || showExportButton.value,
    setVisible: (v) => {
      showResetButton.value = v;
      showFullscreenButton.value = v;
      showExportButton.value = v;
    },
  },
  {
    label: "Debug info",
    getPosition: () => debugPosition.value,
    setPosition: (p) => (debugPosition.value = p),
    isVisible: () => showDebugInfo.value,
    setVisible: (v) => (showDebugInfo.value = v),
  },
  {
    label: "Layers panel",
    getPosition: () => layerPanelPosition.value,
    setPosition: (p) => (layerPanelPosition.value = p),
    isVisible: () => showLayerPanel.value,
    setVisible: (v) => (showLayerPanel.value = v),
  },
  {
    label: "Properties panel",
    getPosition: () => propertiesPanelPosition.value,
    setPosition: (p) => (propertiesPanelPosition.value = p),
    isVisible: () => showPropertiesPanel.value,
    setVisible: (v) => (showPropertiesPanel.value = v),
  },
  {
    label: "Entity picking",
    getPosition: () => pickingPosition.value,
    setPosition: (p) => (pickingPosition.value = p),
    isVisible: () => pickingEnabled.value,
    setVisible: (v) => (pickingEnabled.value = v),
  },
];

const onCellClick = (row: OverlayRow, pos: OverlayPosition) => {
  if (row.isVisible() && row.getPosition() === pos) {
    row.setVisible(false);
  } else {
    row.setPosition(pos);
    row.setVisible(true);
  }
};

const aaDescriptions: Record<AntialiasingMode, string> = {
  msaa: "Hardware multisampling: crisp geometric edges with no blur and almost free runtime cost. Best default for CAD lines and text.",
  smaa: "Edge-detection post-processing AA. Smooths jagged lines without softening text noticeably; cheap and works while panning.",
  fxaa: "Cheapest fullscreen AA — single shader pass. Smooths edges but tends to blur thin lines and small text.",
  taa: "Temporal AA: accumulates 32 jittered frames after the camera stops. Very smooth on static views, but the first frame after movement looks aliased.",
  ssaa: "Super-sampling: renders at higher resolution and downscales. Reference-quality image; expensive — not for interactive use on big drawings.",
  none: "No antialiasing — raw rasterization. Maximum performance and pixel sharpness, with visible staircase aliasing on diagonal lines.",
};

const aaDescription = computed(() => aaDescriptions[aaMode.value]);

// ── Presets ────────────────────────────────────────────────────────────────
// A scenario is a coherent snapshot of every viewer knob. Presets give first-time
// visitors a guided path; fine-tuning the individual controls is still possible
// (any manual tweak drops the panel into the "Custom" state — see activePreset).
interface SettingsState {
  aaMode: AntialiasingMode;
  pickingEnabled: boolean;
  pickingDebug: boolean;
  highlightOnHover: boolean;
  highlightAssociated: boolean;
  rectangleSelection: boolean;
  measureMode: MeasureMode;
  snapToGeometry: boolean;
  showRulers: boolean;
  rulerUnits: "dxf-units" | "mm" | "inch";
  groupLayers: boolean;
  showFileName: boolean;
  showCoordinates: boolean;
  showZoomLevel: boolean;
  showDebugInfo: boolean;
  showResetButton: boolean;
  showFullscreenButton: boolean;
  showExportButton: boolean;
  showLayerPanel: boolean;
  showPropertiesPanel: boolean;
  fileNamePosition: OverlayPosition;
  toolbarPosition: OverlayPosition;
  coordinatesPosition: OverlayPosition;
  debugPosition: OverlayPosition;
  layerPanelPosition: OverlayPosition;
  propertiesPanelPosition: OverlayPosition;
  pickingPosition: OverlayPosition;
  // Demo meta (Maximum only): the "Layer visibility (v-model)" developer section
  // and the in-panel measurement controls.
  showVModelDemo: boolean;
  showMeasureControls: boolean;
}

// The canonical "everything on, sensible defaults" state — also the Reset target.
const DEFAULT_SETTINGS: SettingsState = {
  aaMode: "msaa",
  pickingEnabled: true,
  pickingDebug: false,
  highlightOnHover: true,
  highlightAssociated: true,
  rectangleSelection: true,
  measureMode: "none",
  snapToGeometry: true,
  showRulers: true,
  rulerUnits: "mm",
  groupLayers: true,
  showFileName: true,
  showCoordinates: true,
  showZoomLevel: true,
  showDebugInfo: true,
  showResetButton: true,
  showFullscreenButton: true,
  showExportButton: true,
  showLayerPanel: true,
  showPropertiesPanel: true,
  fileNamePosition: "top-left",
  toolbarPosition: "top-right",
  coordinatesPosition: "bottom-left",
  debugPosition: "bottom-center",
  layerPanelPosition: "bottom-right",
  propertiesPanelPosition: "top-left",
  pickingPosition: "top-center",
  showVModelDemo: false,
  showMeasureControls: false,
};

type PresetId = "default" | "minimal" | "inspect" | "measure" | "maximum";

const PRESETS: Record<PresetId, SettingsState> = {
  // Sensible "all viewer features on" starting point — the Reset target.
  default: DEFAULT_SETTINGS,
  // A bare canvas: just the drawing + a toolbar to orient. No picking/rulers/panels.
  minimal: {
    ...DEFAULT_SETTINGS,
    pickingEnabled: false,
    rectangleSelection: false,
    showRulers: false,
    showCoordinates: false,
    showZoomLevel: false,
    showDebugInfo: false,
    showLayerPanel: false,
    showPropertiesPanel: false,
  },
  // Inspection: hover/click data + properties + associations, rulers/debug off.
  inspect: {
    ...DEFAULT_SETTINGS,
    showRulers: false,
    showDebugInfo: false,
  },
  // Measuring: start with the distance tool, snapping on, rulers (mm) visible.
  measure: {
    ...DEFAULT_SETTINGS,
    measureMode: "distance",
    rectangleSelection: false,
    showDebugInfo: false,
    showPropertiesPanel: false,
  },
  // Kitchen-sink: default + the developer-only extras (v-model demo + in-panel
  // measurement controls).
  maximum: {
    ...DEFAULT_SETTINGS,
    showVModelDemo: true,
    showMeasureControls: true,
  },
};

const presetList: { id: PresetId; label: string; hint: string }[] = [
  { id: "default", label: "Default", hint: "Recommended starting point — all viewer features on" },
  { id: "minimal", label: "Minimal", hint: "Clean canvas: just the drawing and a toolbar" },
  { id: "inspect", label: "Inspect", hint: "Picking, properties and associations in focus" },
  { id: "measure", label: "Measure", hint: "Distance tool + snapping + rulers" },
  { id: "maximum", label: "Maximum", hint: "Everything, including the v-model layer demo" },
];

// Maps each SettingsState key to its backing ref so applyPreset / activePreset can
// iterate generically instead of restating all 27 fields three times.
const settingsRefs: { [K in keyof SettingsState]: Ref<SettingsState[K]> } = {
  aaMode,
  pickingEnabled,
  pickingDebug,
  highlightOnHover,
  highlightAssociated,
  rectangleSelection,
  measureMode,
  snapToGeometry,
  showRulers,
  rulerUnits,
  groupLayers,
  showFileName,
  showCoordinates,
  showZoomLevel,
  showDebugInfo,
  showResetButton,
  showFullscreenButton,
  showExportButton,
  showLayerPanel,
  showPropertiesPanel,
  fileNamePosition,
  toolbarPosition,
  coordinatesPosition,
  debugPosition,
  layerPanelPosition,
  propertiesPanelPosition,
  pickingPosition,
  showVModelDemo,
  showMeasureControls,
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof SettingsState)[];

const applyPreset = (id: PresetId) => {
  const snapshot = PRESETS[id];
  for (const key of SETTINGS_KEYS) {
    // Each entry is Ref<the matching field type>; the index dance keeps TS happy.
    (settingsRefs[key] as Ref<SettingsState[typeof key]>).value = snapshot[key];
  }
  // Clear transient read-outs and viewer overlays so a scenario starts clean
  // (otherwise e.g. switching to "Minimal" leaves a dangling highlight on canvas).
  clearRectangleSelection();
  clearMeasureResult();
  activeKindFilter.value = null;
  clearAssociationHighlight();
};

// The preset whose snapshot exactly matches the current state, or null ("Custom").
const activePreset = computed<PresetId | null>(() => {
  for (const { id } of presetList) {
    const snapshot = PRESETS[id];
    if (SETTINGS_KEYS.every((key) => settingsRefs[key].value === snapshot[key])) {
      return id;
    }
  }
  return null;
});

// ── Inspector state ──────────────────────────────────────────────────────────
// No rectangle selection yet → show the "drag to select" hint. (Single-entity
// properties live in the on-canvas panel; measurement read-outs on the canvas.)
const inspectorIdle = computed(() => selectedEntities.value.length === 0);

const samples = [
  { file: "/entities.dxf", label: "Basic Entities", size: "191 KB" },
  { file: "/samples/linetypes.dxf", label: "Line Types & Widths", size: "3 KB" },
  { file: "/samples/electric.dxf", label: "Electric Schematic", size: "220 KB" },
  { file: "/samples/hatch-patterns.dxf", label: "Hatch Patterns", size: "164 KB" },
  { file: "/samples/floorplan.dxf", label: "Floor Plan", size: "1.1 MB" },
  { file: "/samples/house-plan.dxf", label: "House Plan", size: "17 MB", heavy: true },
];

async function loadSample(
  sample: { file: string; label: string; size: string; heavy?: boolean },
  options: { trackInteraction?: boolean } = { trackInteraction: true },
) {
  if (isLoadingSample.value) return;
  isLoadingSample.value = true;
  loadingSampleFile.value = sample.file;
  error.value = null;
  unsupportedEntities.value = [];
  if (options.trackInteraction) {
    trackEvent("sample-load", { name: sample.label });
  }
  try {
    const response = await fetch(sample.file);
    const text = await response.text();
    currentFileName.value = sample.label;
    loadingSampleFile.value = null;
    if (dxfViewerRef.value) {
      dxfViewerRef.value.loadDXFFromText(text);
    }
  } catch {
    error.value = `Failed to load ${sample.label}`;
    trackEvent("dxf-error", { source: "sample-fetch" });
  } finally {
    isLoadingSample.value = false;
    loadingSampleFile.value = null;
  }
}

onMounted(async () => {
  await nextTick();
  loadSample(samples[0], { trackInteraction: false });
});

const handleFileSelected = async (file: File) => {
  trackEvent("file-upload", { source: "button" });
  try {
    error.value = null;
    unsupportedEntities.value = [];
    currentFileName.value = file.name;

    const text = await file.text();

    // Parsing and display happen inside DXFViewer
    // via the exposed loadDXFFromText method
    if (dxfViewerRef.value) {
      dxfViewerRef.value.loadDXFFromText(text);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Error loading file";
    dxfData.value = null;
    unsupportedEntities.value = [];
    trackEvent("dxf-error", { source: "file-read" });
  }
};

const handleUnsupportedEntities = (entities: string[]) => {
  unsupportedEntities.value = entities;
};

const handleError = (errorMsg: string) => {
  error.value = errorMsg;
  trackEvent("dxf-error", { source: "viewer" });
};

const handleFileDropped = (name: string) => {
  currentFileName.value = name;
  trackEvent("file-upload", { source: "drag-drop" });
};

const handleDXFLoaded = (success: boolean) => {
  if (!success) {
    dxfData.value = null;
    associations.value = [];
    return;
  }
  if (dxfViewerRef.value) {
    associations.value = dxfViewerRef.value.getAssociations() ?? [];
  }
  activeKindFilter.value = null;
  activeAssociationId.value = null;
};

const handleDXFData = (data: DxfData | null) => {
  dxfData.value = data;
  selectedEntities.value = [];
  // Reset the controlled v-model when a new file is loaded so we don't carry
  // hidden-layer names from the previous DXF over to the new one.
  hiddenLayers.value = [];
};

const allLayerNames = computed<string[]>(() => {
  const layers = dxfData.value?.tables?.layer?.layers;
  if (!layers) return [];
  // Exclude frozen layers — the v-model never includes them, so the demo
  // buttons should also skip them to stay consistent with the contract.
  return Object.values(layers)
    .filter((l) => !l.frozen)
    .map((l) => l.name);
});

const hideFirstLayer = () => {
  const candidate = allLayerNames.value.find((n) => !hiddenLayers.value.includes(n));
  if (candidate) hiddenLayers.value = [...hiddenLayers.value, candidate];
};

const showAllLayersExternally = () => {
  hiddenLayers.value = [];
};

const hideHalfLayers = () => {
  const half = Math.ceil(allLayerNames.value.length / 2);
  hiddenLayers.value = allLayerNames.value.slice(0, half);
};

const resetView = () => {
  if (dxfViewerRef.value) {
    dxfViewerRef.value.resetView();
  }
};
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.top-actions {
  position: absolute;
  top: var(--spacing-md);
  right: var(--spacing-md);
  z-index: 100;
  display: flex;
  gap: 8px;
}

.top-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-secondary);
  width: 36px;
  height: 36px;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-decoration: none;
}

.top-action-btn:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
  width: 100%;
}

.viewer-container {
  display: flex;
  height: 70vh;
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  /* Centered, ~half width, prominent pill so it clearly reads as search.
     Sits just below the canvas; settings-panel's top margin spaces it below. */
  align-self: center;
  width: 50%;
  min-width: 340px;
  max-width: 720px;
  margin-top: var(--spacing-md);
  padding: 10px 18px;
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  background: white;
  box-shadow: 0 2px 10px rgba(74, 144, 217, 0.12);
  transition:
    box-shadow 0.15s,
    border-color 0.15s;
}

.search-bar:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 2px 16px rgba(74, 144, 217, 0.28);
}

.search-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-color);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-count {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.search-zoom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--primary-color);
  border-radius: 3px;
  background: transparent;
  color: var(--primary-color);
  cursor: pointer;
}

.search-zoom-icon {
  opacity: 0.85;
}

.search-zoom:hover {
  background: var(--primary-color);
  color: white;
}

.search-clear {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.search-clear:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-color);
}

.app.dark .search-bar {
  background: #1e1e1e;
  border-color: var(--primary-color);
  box-shadow: 0 2px 10px rgba(74, 144, 217, 0.2);
}

.app.dark .search-clear:hover {
  background: rgba(255, 255, 255, 0.08);
}

.settings-panel {
  margin-top: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: white;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.02);
}

.settings-title {
  margin: 0;
  flex-shrink: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-color);
}

.settings-reset {
  flex-shrink: 0;
  padding: 4px 12px;
  font-size: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: white;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.settings-reset:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* Scenario presets — guided one-click path, centered in the header */
.settings-presets {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.preset-btn {
  padding: 5px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover:not(.active) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.preset-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.preset-custom {
  font-size: 0.7rem;
  font-style: italic;
  color: var(--text-secondary);
}

/* Body: controls (input) on the left, inspector (output) on the right */
.settings-body {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
}

.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px;
  min-width: 0;
}

.settings-inspector {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  min-width: 0;
  border-left: 1px solid var(--border-color);
  background: rgba(0, 0, 0, 0.015);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group-title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color);
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Sub-options revealed under a master toggle (e.g. picking) */
.control-sub {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 22px;
  padding-left: 10px;
  border-left: 2px solid var(--border-color);
}

/* Segmented control (measurement tool selector) */
.segmented {
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.segmented-btn {
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  border: none;
  border-right: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-color);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.segmented-btn:last-child {
  border-right: none;
}

.segmented-btn:hover:not(.active) {
  color: var(--primary-color);
}

.segmented-btn.active {
  background: var(--primary-color);
  color: white;
}

/* Inspector sections */
.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inspector-section + .inspector-section {
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.inspector-empty {
  margin: 0;
  padding: 4px 0;
  font-size: 0.78rem;
  font-style: italic;
  line-height: 1.5;
  color: var(--text-secondary);
}

.settings-cell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.settings-cell-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 1px 7px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  background: var(--primary-color);
  color: white;
  border-radius: 999px;
}

.settings-cell-action {
  padding: 2px 10px;
  font-size: 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.settings-cell-action:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.settings-cell-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.settings-cell-hint code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.7rem;
}

@media (max-width: 768px) {
  /* Header wraps: title + Reset stay on row 1, scenarios drop to a full-width
     row 2 (left-aligned) so they don't overflow narrow screens. */
  .settings-header {
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .settings-presets {
    order: 1;
    flex-basis: 100%;
    justify-content: flex-start;
  }

  /* Inspector drops below the controls — swap its divider from left to top. */
  .settings-body {
    grid-template-columns: 1fr;
  }
  .settings-inspector {
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
}

.app-footer {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.app-footer a {
  color: var(--primary-color);
  text-decoration: none;
}

.app-footer a:hover {
  text-decoration: underline;
}

.upload-area {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.upload-area :deep(.dxfk-file-uploader) {
  max-width: none;
  flex: none;
}

.upload-area :deep(.dxfk-file-uploader-button) {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 12px 32px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--border-radius);
  box-shadow: 0 2px 8px rgba(74, 144, 217, 0.3);
  backdrop-filter: none;
}

.upload-area :deep(.dxfk-file-uploader-button:hover) {
  background: #3a7bc8;
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
}

.sample-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);
}

.sample-label {
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.sample-list {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sample-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: white;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.sample-btn:hover:not(:disabled):not(.active) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.sample-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.sample-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sample-btn.loading {
  opacity: 0.7;
}

.sample-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sample-hint {
  font-size: 0.6875rem;
  opacity: 0.6;
  margin-left: 4px;
}

.sample-hint--heavy {
  color: #d32f2f;
  opacity: 1;
  font-weight: 600;
}

.sample-btn.active .sample-hint--heavy {
  color: #ffcdd2;
}

.aa-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
  color: var(--text-color);
}

.aa-label {
  color: var(--text-color);
  font-size: 0.8125rem;
  font-weight: 600;
}

.aa-select {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: white;
  color: var(--text-color);
  font-size: 0.8125rem;
  cursor: pointer;
}

.aa-select:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.app.dark .aa-select {
  background: #1e1e1e;
  border-color: #444;
  color: var(--text-color);
}

.picking-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-color);
  cursor: pointer;
}

.picking-tag {
  background: var(--primary-color);
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 600;
}

.rect-selection-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 6px;
}

.rect-selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(64, 128, 255, 0.12);
  border: 1px solid rgba(64, 128, 255, 0.35);
  border-radius: 999px;
  font-size: 0.7rem;
  color: var(--text-color);
}

.rect-selection-chip code {
  background: rgba(0, 0, 0, 0.06);
  padding: 0 4px;
  border-radius: 3px;
  font-size: 0.7rem;
}

.rect-selection-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.rect-selection-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.72rem;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.rect-selection-item:last-child {
  border-bottom: none;
}

.rect-selection-item:hover {
  background: rgba(64, 128, 255, 0.08);
}

.rect-selection-handle {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.7rem;
}

.rect-selection-layer {
  color: var(--text-secondary, #888);
  font-size: 0.7rem;
}

.rect-selection-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary, #888);
  font-style: italic;
}

.rect-selection-more {
  padding: 4px 8px;
  font-size: 0.7rem;
  color: var(--text-secondary, #888);
  text-align: center;
  font-style: italic;
}

.vmodel-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.vmodel-btn {
  padding: 3px 10px;
  font-size: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.vmodel-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.vmodel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.vmodel-state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 3px;
  font-size: 0.72rem;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
}

.vmodel-label {
  color: var(--text-secondary);
  font-weight: 600;
}

.vmodel-empty {
  background: transparent;
  color: var(--text-secondary);
  padding: 0;
}

.vmodel-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  background: rgba(64, 128, 255, 0.14);
  border: 1px solid rgba(64, 128, 255, 0.35);
  border-radius: 999px;
  color: var(--text-color);
  font-size: 0.7rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app.dark .vmodel-state {
  background: rgba(255, 255, 255, 0.05);
}

.app.dark .vmodel-chip {
  background: rgba(96, 156, 255, 0.18);
  border-color: rgba(96, 156, 255, 0.4);
}

.associations-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.associations-kind-btn {
  padding: 3px 10px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: transparent;
  font-size: 0.75rem;
  color: var(--text-color);
  cursor: pointer;
  text-transform: lowercase;
}

.associations-kind-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.associations-kind-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.associations-kind-count {
  opacity: 0.7;
  margin-left: 4px;
}

.associations-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 180px;
  overflow-y: auto;
  padding-top: 4px;
}

.association-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  font-size: 0.75rem;
  color: var(--text-color);
  cursor: pointer;
  text-align: left;
}

.association-row:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: var(--border-color);
}

.association-row.active {
  border-color: var(--primary-color);
  background: rgba(74, 144, 217, 0.08);
}

.association-kind-tag {
  background: var(--primary-color);
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: lowercase;
  flex-shrink: 0;
}

.association-primary {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.association-members {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.association-text {
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.app.dark .association-row:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #444;
}

.app.dark .association-row.active {
  background: rgba(107, 143, 212, 0.12);
  border-color: var(--primary-color);
}

.app.dark .association-primary {
  background: rgba(255, 255, 255, 0.08);
}

.app.dark .associations-kind-btn {
  border-color: #444;
}

.app.dark .rect-selection-chip {
  background: rgba(96, 156, 255, 0.18);
  border-color: rgba(96, 156, 255, 0.4);
}

.app.dark .rect-selection-chip code,
.app.dark .rect-selection-handle {
  background: rgba(255, 255, 255, 0.08);
}

.app.dark .rect-selection-item:hover {
  background: rgba(96, 156, 255, 0.14);
}

.hover-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ccc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  pointer-events: none;
}

.hover-tag {
  color: #fff;
}

.hover-handle {
  opacity: 0.7;
}

.hover-text {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
}

.overlay-rows {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
}

.overlay-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.overlay-label {
  color: var(--text-color);
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
}

.overlay-label.off {
  opacity: 0.55;
}

.layout-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 14px);
  grid-template-rows: repeat(2, 14px);
  gap: 3px;
  flex-shrink: 0;
}

.layout-cell {
  width: 14px;
  height: 14px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.1s,
    background 0.1s;
}

.layout-cell:hover {
  border-color: var(--primary-color);
}

.layout-cell.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.app.dark .settings-panel {
  background: #1e1e1e;
  border-color: #444;
}

.app.dark .settings-header {
  background: rgba(255, 255, 255, 0.04);
  border-bottom-color: #444;
}

.app.dark .settings-reset {
  background: transparent;
  border-color: #444;
  color: #aaa;
}

.app.dark .preset-btn {
  border-color: #444;
  color: #ddd;
}

.app.dark .settings-inspector {
  border-left-color: #444;
  background: rgba(255, 255, 255, 0.02);
}

.app.dark .control-sub {
  border-left-color: #444;
}

.app.dark .segmented,
.app.dark .segmented-btn {
  border-color: #444;
}

.app.dark .inspector-section + .inspector-section {
  border-top-color: #444;
}

.app.dark .settings-cell-action {
  border-color: #444;
  color: #aaa;
}

.app.dark .settings-cell-hint code {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 768px) {
  .app.dark .settings-inspector {
    border-top-color: #444;
  }
}

.app.dark .layout-cell {
  border-color: #555;
}

.controls-hint {
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  opacity: 0.7;
  margin: 0 0 var(--spacing-sm);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: var(--border-radius);
  font-size: 14px;
  flex-shrink: 0;
}

.error-message svg {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .app-main {
    padding: var(--spacing-md);
  }

  .viewer-container {
    height: 50vh;
  }

  /* Search spans the full width on narrow screens instead of half. */
  .search-bar {
    width: 100%;
    min-width: 0;
  }

  .aa-row {
    flex-wrap: wrap;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus visible */
.top-action-btn:focus-visible,
.sample-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* Dark theme tokens live in demo/style.css (.dark) so they apply to every demo
   page (neutral landing + per-framework landings), not just this component.
   Component-specific dark overrides stay below. */
.app.dark .top-action-btn {
  background: #1e1e1e;
  border-color: #444;
  color: #999;
}

.app.dark .sample-btn {
  background: #1e1e1e;
  border-color: #444;
}

.app.dark .sample-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.app.dark .sample-btn.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.app.dark .viewer-container {
  border-color: #333;
}

.app.dark .error-message {
  background-color: #3a1c1e;
  color: #f5a0a5;
  border-color: #5c2b2e;
}
</style>
