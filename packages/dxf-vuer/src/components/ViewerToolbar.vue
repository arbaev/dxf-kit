<template>
  <div
    class="dxfk-toolbar"
    :class="{ 'dxfk-dark': darkTheme }"
    role="toolbar"
    aria-label="DXF viewer toolbar"
  >
    <button
      v-if="showExportButton"
      class="dxfk-toolbar-button"
      @click="$emit('export')"
      title="Export PNG"
      aria-label="Export current view as PNG"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </button>
    <button
      v-if="showMeasureButton"
      class="dxfk-toolbar-button"
      :class="{ 'dxfk-toolbar-button--active': measureActive }"
      @click="$emit('toggle-measure')"
      :title="measureActive ? 'Disable measure tool' : 'Measure distance'"
      :aria-label="measureActive ? 'Disable measure tool' : 'Enable measure-distance tool'"
      :aria-pressed="measureActive"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 17 17 3l4 4L7 21z" />
        <path d="M14 6l2 2" />
        <path d="M11 9l2 2" />
        <path d="M8 12l2 2" />
        <path d="M5 15l2 2" />
      </svg>
    </button>
    <button
      v-if="showMeasureAreaButton"
      class="dxfk-toolbar-button"
      :class="{ 'dxfk-toolbar-button--active': measureAreaActive }"
      @click="$emit('toggle-measure-area')"
      :title="measureAreaActive ? 'Disable area tool' : 'Measure area'"
      :aria-label="measureAreaActive ? 'Disable area-measurement tool' : 'Enable area-measurement tool'"
      :aria-pressed="measureAreaActive"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polygon points="12 3 21 9.5 17.5 20.5 6.5 20.5 3 9.5" />
        <circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="21" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="3" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    </button>
    <button
      v-if="showMeasureAngleButton"
      class="dxfk-toolbar-button"
      :class="{ 'dxfk-toolbar-button--active': measureAngleActive }"
      @click="$emit('toggle-measure-angle')"
      :title="measureAngleActive ? 'Disable angle tool' : 'Measure angle'"
      :aria-label="measureAngleActive ? 'Disable angle-measurement tool' : 'Enable angle-measurement tool'"
      :aria-pressed="measureAngleActive"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 122.88 103.56"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M59.49,1.72c1.03-1.69,3.24-2.23,4.94-1.2c1.69,1.03,2.23,3.24,1.2,4.94L34.75,55.92c6.65,4.72,12.18,10.9,16.11,18.07 c3.69,6.72,5.99,14.31,6.51,22.37h61.91c1.99,0,3.6,1.61,3.6,3.6c0,1.99-1.61,3.6-3.6,3.6H3.59v-0.01c-0.64,0-1.29-0.17-1.87-0.53 c-1.69-1.03-2.23-3.24-1.2-4.94L59.49,1.72L59.49,1.72z M31,62.05L10.01,96.36h40.14c-0.51-6.82-2.47-13.23-5.59-18.91 C41.22,71.36,36.57,66.1,31,62.05L31,62.05z"
        />
      </svg>
    </button>
    <button
      v-if="showResetButton"
      class="dxfk-toolbar-button"
      @click="$emit('reset-view')"
      title="Fit to View"
      aria-label="Reset camera and fit drawing to view"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="7" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    </button>
    <button
      v-if="showFullscreenButton"
      class="dxfk-toolbar-button"
      @click="$emit('toggle-fullscreen')"
      :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
      :aria-pressed="isFullscreen"
    >
      <svg
        v-if="!isFullscreen"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 8V4h4" />
        <path d="M16 4h4v4" />
        <path d="M20 16v4h-4" />
        <path d="M4 16v4h4" />
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
        <path d="M8 4v4H4" />
        <path d="M16 4v4h4" />
        <path d="M4 16h4v4" />
        <path d="M20 16h-4v4" />
      </svg>
    </button>
    <slot name="extra" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  showExportButton?: boolean;
  showResetButton?: boolean;
  showFullscreenButton?: boolean;
  showMeasureButton?: boolean;
  measureActive?: boolean;
  showMeasureAreaButton?: boolean;
  measureAreaActive?: boolean;
  showMeasureAngleButton?: boolean;
  measureAngleActive?: boolean;
  isFullscreen?: boolean;
  darkTheme?: boolean;
}

withDefaults(defineProps<Props>(), {
  showExportButton: false,
  showResetButton: false,
  showFullscreenButton: true,
  showMeasureButton: false,
  measureActive: false,
  showMeasureAreaButton: false,
  measureAreaActive: false,
  showMeasureAngleButton: false,
  measureAngleActive: false,
  isFullscreen: false,
  darkTheme: false,
});

defineEmits<{
  (e: "export"): void;
  (e: "reset-view"): void;
  (e: "toggle-fullscreen"): void;
  (e: "toggle-measure"): void;
  (e: "toggle-measure-area"): void;
  (e: "toggle-measure-angle"): void;
}>();
</script>

<style scoped>
.dxfk-toolbar {
  display: flex;
  gap: 4px;
  pointer-events: auto;
}

.dxfk-toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dxfk-spacing-sm, 8px);
  color: var(--dxfk-text-color, #212121);
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  transition: all 0.2s;
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background-color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
}

.dxfk-toolbar-button:hover {
  border-color: rgb(from var(--dxfk-primary-color, #1040b0) r g b / 0.5);
}

.dxfk-toolbar-button:active {
  transform: scale(0.94);
}

.dxfk-toolbar-button--active {
  background-color: var(--dxfk-primary-color, #1040b0);
  border-color: var(--dxfk-primary-color, #1040b0);
  color: #fff;
}

.dxfk-toolbar-button--active:hover {
  border-color: var(--dxfk-primary-color, #1040b0);
}

.dxfk-toolbar.dxfk-dark .dxfk-toolbar-button {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  color: #e0e0e0;
}

.dxfk-toolbar.dxfk-dark .dxfk-toolbar-button--active {
  background-color: var(--dxfk-primary-color, #2563eb);
  border-color: var(--dxfk-primary-color, #2563eb);
  color: #fff;
}

@media (max-width: 768px) {
  .dxfk-toolbar-button {
    padding: 6px;
  }

  .dxfk-toolbar-button svg {
    width: 18px;
    height: 18px;
  }
}
</style>
