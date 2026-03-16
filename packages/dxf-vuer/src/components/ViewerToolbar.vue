<template>
  <div class="viewer-toolbar">
    <button
      v-if="showExportButton"
      class="toolbar-button"
      @click="$emit('export')"
      title="Export PNG"
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
      v-if="showResetButton"
      class="toolbar-button"
      @click="$emit('reset-view')"
      title="Fit to View"
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
      class="toolbar-button"
      @click="$emit('toggle-fullscreen')"
      :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
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
  </div>
</template>

<script setup lang="ts">
interface Props {
  showExportButton?: boolean;
  showResetButton?: boolean;
  showFullscreenButton?: boolean;
  isFullscreen?: boolean;
}

withDefaults(defineProps<Props>(), {
  showExportButton: false,
  showResetButton: false,
  showFullscreenButton: true,
  isFullscreen: false,
});

defineEmits<{
  (e: "export"): void;
  (e: "reset-view"): void;
  (e: "toggle-fullscreen"): void;
}>();
</script>

<style scoped>
.viewer-toolbar {
  position: absolute;
  top: var(--dxf-vuer-spacing-sm, 8px);
  right: var(--dxf-vuer-spacing-sm, 8px);
  z-index: 10;
  display: flex;
  gap: 4px;
}

.toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--dxf-vuer-spacing-sm, 8px);
  color: var(--dxf-vuer-text-color, #212121);
  border: 1px solid var(--dxf-vuer-border-color, #e0e0e0);
  border-radius: var(--dxf-vuer-border-radius, 4px);
  transition: all 0.2s;
  user-select: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background-color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
}

.toolbar-button:hover {
  border-color: rgb(from var(--dxf-vuer-primary-color, #1040b0) r g b / 0.5);
}

.toolbar-button:active {
  transform: scale(0.94);
}

@media (max-width: 768px) {
  .toolbar-button {
    padding: 6px;
  }

  .toolbar-button svg {
    width: 18px;
    height: 18px;
  }
}
</style>
