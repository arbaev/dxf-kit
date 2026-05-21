<template>
  <div
    class="dxfk-layer-panel"
    :class="[
      { 'dxfk-layer-panel--collapsed': !isExpanded, 'dxfk-dark': darkTheme }
    ]"
    role="region"
    aria-label="Layer visibility panel"
  >
    <div
      class="dxfk-layer-panel-header"
      role="button"
      tabindex="0"
      :aria-expanded="isExpanded"
      :aria-label="isExpanded ? 'Collapse layer panel' : 'Expand layer panel'"
      @click="isExpanded = !isExpanded"
      @keydown.enter.prevent="isExpanded = !isExpanded"
      @keydown.space.prevent="isExpanded = !isExpanded"
    >
      <span class="dxfk-layer-panel-title">Layers ({{ layers.length }})</span>
      <button
        class="dxfk-layer-panel-collapse"
        :title="isExpanded ? 'Collapse' : 'Expand'"
        :aria-label="isExpanded ? 'Collapse' : 'Expand'"
        tabindex="-1"
      >
        {{ isExpanded ? '−' : '+' }}
      </button>
    </div>

    <div v-if="isExpanded" class="dxfk-layer-panel-body">
      <div class="dxfk-layer-panel-actions">
        <button @click.stop="$emit('show-all')" class="dxfk-layer-panel-action" aria-label="Show all layers">All</button>
        <button @click.stop="$emit('hide-all')" class="dxfk-layer-panel-action" aria-label="Hide all layers">None</button>
      </div>

      <div v-if="layers.length > 5" class="dxfk-layer-filter-wrapper">
        <input
          v-model="filter"
          type="text"
          class="dxfk-layer-filter"
          placeholder="Filter layers…"
          aria-label="Filter layers by name"
          @click.stop
        />
        <button
          v-if="filter"
          class="dxfk-layer-filter-clear"
          aria-label="Clear filter"
          @click.stop="filter = ''"
        >×</button>
      </div>

      <div class="dxfk-layer-list">
        <div v-if="filteredLayers.length === 0" class="dxfk-layer-empty">No layers match "{{ filter }}"</div>
        <div
          v-for="layer in filteredLayers"
          :key="layer.name"
          class="dxfk-layer-item"
          :class="{ 'dxfk-layer-item--hidden': !layer.visible, 'dxfk-layer-item--frozen': layer.frozen }"
          role="button"
          :tabindex="layer.frozen ? -1 : 0"
          :aria-pressed="layer.visible"
          :aria-disabled="layer.frozen"
          :aria-label="`Toggle visibility of layer ${layer.name}`"
          @click="!layer.frozen && $emit('toggle-layer', layer.name)"
          @keydown.enter.prevent="!layer.frozen && $emit('toggle-layer', layer.name)"
          @keydown.space.prevent="!layer.frozen && $emit('toggle-layer', layer.name)"
        >
          <!-- Frozen: snowflake icon -->
          <svg
            v-if="layer.frozen"
            class="dxfk-layer-icon-frozen"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
            <!-- Crossbars -->
            <line x1="12" y1="2" x2="9" y2="5" />
            <line x1="12" y1="2" x2="15" y2="5" />
            <line x1="12" y1="22" x2="9" y2="19" />
            <line x1="12" y1="22" x2="15" y2="19" />
          </svg>
          <!-- Visible: eye open -->
          <svg
            v-else-if="layer.visible"
            class="dxfk-layer-icon-eye"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <!-- Hidden: eye off -->
          <svg
            v-else
            class="dxfk-layer-icon-eye dxfk-layer-icon-eye--off"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>

          <!-- Locked indicator (shown when not frozen) -->
          <svg
            v-if="layer.locked && !layer.frozen"
            class="dxfk-layer-icon-lock"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>

          <span class="dxfk-layer-swatch" :style="{ backgroundColor: layer.color }"></span>
          <span class="dxfk-layer-name" :title="layer.name">{{ layer.name }}</span>
          <span class="dxfk-layer-count">{{ layer.entityCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { LayerState } from "../composables/useLayers";

interface Props {
  layers: LayerState[];
  darkTheme?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  darkTheme: false,
});

defineEmits<{
  (e: "toggle-layer", layerName: string): void;
  (e: "show-all"): void;
  (e: "hide-all"): void;
}>();

const isExpanded = ref(true);
const filter = ref("");

const filteredLayers = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return props.layers;
  return props.layers.filter((l) => l.name.toLowerCase().includes(q));
});
</script>

<style scoped>
.dxfk-layer-panel {
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-width: 260px;
  pointer-events: auto;
}

.dxfk-layer-panel--collapsed {
  max-height: none;
}

.dxfk-layer-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
  flex-shrink: 0;
}

.dxfk-layer-panel--collapsed .dxfk-layer-panel-header {
  border-bottom: none;
}

.dxfk-layer-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dxfk-text-color, #212121);
}

.dxfk-layer-panel-collapse {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  color: var(--dxfk-text-secondary, #757575);
  padding: 0 4px;
  line-height: 1;
}

.dxfk-layer-panel-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dxfk-layer-panel-actions {
  display: flex;
  gap: 4px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
  flex-shrink: 0;
}

.dxfk-layer-panel-action {
  padding: 2px 8px;
  font-size: 11px;
  background: none;
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: 3px;
  cursor: pointer;
  color: var(--dxfk-text-secondary, #757575);
  transition: all 0.15s;
}

.dxfk-layer-panel-action:hover {
  border-color: var(--dxfk-primary-color, #1040b0);
  color: var(--dxfk-primary-color, #1040b0);
}

.dxfk-layer-filter-wrapper {
  position: relative;
  padding: 4px 10px;
  border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
  flex-shrink: 0;
}

.dxfk-layer-filter {
  width: 100%;
  padding: 3px 22px 3px 6px;
  font-size: 11px;
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: 3px;
  background: white;
  color: var(--dxfk-text-color, #212121);
  outline: none;
  box-sizing: border-box;
}

.dxfk-layer-filter:focus {
  border-color: var(--dxfk-primary-color, #1040b0);
}

.dxfk-layer-filter::placeholder {
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-filter-clear {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-filter-clear:hover {
  color: var(--dxfk-text-color, #212121);
}

.dxfk-layer-empty {
  padding: 8px 10px;
  font-size: 11px;
  font-style: italic;
  color: var(--dxfk-text-secondary, #757575);
  text-align: center;
}

.dxfk-layer-list {
  overflow-y: auto;
  max-height: 300px;
  padding: 2px 0;
}

.dxfk-layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background-color 0.15s;
  font-size: 12px;
}

.dxfk-layer-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.dxfk-layer-item--hidden {
  opacity: 0.5;
}

.dxfk-layer-item--frozen {
  opacity: 0.35;
  cursor: not-allowed;
}

.dxfk-layer-icon-eye {
  flex-shrink: 0;
  color: var(--dxfk-text-color, #212121);
}

.dxfk-layer-icon-eye--off {
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-icon-frozen {
  flex-shrink: 0;
  color: #5ba3d9;
}

.dxfk-layer-icon-lock {
  flex-shrink: 0;
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-swatch {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.dxfk-layer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dxfk-text-color, #212121);
}

.dxfk-layer-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--dxfk-text-secondary, #757575);
}

/* Dark theme — applied when the panel root carries `.dxfk-dark`. */
.dxfk-layer-panel.dxfk-dark {
  background-color: rgba(30, 30, 30, 0.95);
  border-color: #444;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-header {
  border-bottom-color: #444;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-title {
  color: #e0e0e0;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-collapse {
  color: #aaa;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-actions {
  border-bottom-color: #444;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-action {
  border-color: #555;
  color: #aaa;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-panel-action:hover {
  border-color: #6b8fd4;
  color: #6b8fd4;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-item:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-icon-eye {
  color: #e0e0e0;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-icon-eye--off {
  color: #666;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-name {
  color: #e0e0e0;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-count {
  color: #888;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-swatch {
  border-color: rgba(255, 255, 255, 0.2);
}

@media (max-width: 768px) {
  .dxfk-layer-panel {
    min-width: 150px;
    max-width: 200px;
    max-height: 40%;
  }

  .dxfk-layer-list {
    max-height: 200px;
  }
}
</style>
