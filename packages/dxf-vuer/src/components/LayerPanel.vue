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

        <!-- Grouped mode -->
        <template v-if="groups">
          <div
            v-for="group in realGroups"
            :key="`g:${group.prefix}`"
            class="dxfk-layer-group"
            :class="{ 'dxfk-layer-group--collapsed': !isGroupExpanded(group.prefix) }"
            role="group"
            :aria-label="`Layer group ${group.prefix}`"
          >
            <div
              class="dxfk-layer-group-header"
              role="button"
              tabindex="0"
              :aria-expanded="isGroupExpanded(group.prefix)"
              :aria-label="isGroupExpanded(group.prefix) ? `Collapse group ${group.prefix}` : `Expand group ${group.prefix}`"
              @click="toggleGroupCollapse(group.prefix)"
              @keydown.enter.prevent="toggleGroupCollapse(group.prefix)"
              @keydown.space.prevent="toggleGroupCollapse(group.prefix)"
            >
              <button
                class="dxfk-layer-group-collapse"
                tabindex="-1"
                :title="isGroupExpanded(group.prefix) ? 'Collapse' : 'Expand'"
                :aria-label="isGroupExpanded(group.prefix) ? 'Collapse' : 'Expand'"
              >
                {{ isGroupExpanded(group.prefix) ? '−' : '+' }}
              </button>
              <span class="dxfk-layer-group-name" :title="group.prefix">{{ group.prefix }}</span>
              <span class="dxfk-layer-group-count">
                {{ getGroupVisibleCount(group) }} / {{ group.layers.length }} · {{ getGroupTotalEntities(group) }}
              </span>
              <button
                class="dxfk-layer-group-toggle"
                :class="`dxfk-layer-group-toggle--${getGroupVisState(group)}`"
                :disabled="getGroupVisState(group) === 'all-frozen'"
                :aria-pressed="getGroupVisState(group) !== 'all-hidden'"
                :aria-disabled="getGroupVisState(group) === 'all-frozen'"
                :aria-label="`Toggle visibility of group ${group.prefix}`"
                :title="getGroupVisState(group) === 'all-hidden' ? 'Show all in group' : 'Hide all in group'"
                @click.stop="handleGroupToggle(group)"
              >
                <!-- Mixed: half-filled eye -->
                <svg
                  v-if="getGroupVisState(group) === 'mixed'"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <path d="M12 4v16" stroke-width="1.5" />
                  <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <!-- All hidden: eye-off -->
                <svg
                  v-else-if="getGroupVisState(group) === 'all-hidden'"
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
                <!-- All visible / all frozen: eye-open -->
                <svg
                  v-else
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
              </button>
            </div>

            <div v-if="isGroupExpanded(group.prefix)" class="dxfk-layer-group-body">
              <div
                v-for="layer in group.layers"
                :key="layer.name"
                class="dxfk-layer-item dxfk-layer-item--in-group"
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
                <svg v-if="layer.frozen" class="dxfk-layer-icon-frozen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="2" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
                  <line x1="12" y1="2" x2="9" y2="5" />
                  <line x1="12" y1="2" x2="15" y2="5" />
                  <line x1="12" y1="22" x2="9" y2="19" />
                  <line x1="12" y1="22" x2="15" y2="19" />
                </svg>
                <svg v-else-if="layer.visible" class="dxfk-layer-icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else class="dxfk-layer-icon-eye dxfk-layer-icon-eye--off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                <svg v-if="layer.locked && !layer.frozen" class="dxfk-layer-icon-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span class="dxfk-layer-swatch" :style="{ backgroundColor: layer.color }"></span>
                <span class="dxfk-layer-name" :title="layer.name">{{ layer.name }}</span>
                <span class="dxfk-layer-count">{{ layer.entityCount }}</span>
              </div>
            </div>
          </div>

          <!-- Ungrouped tail: flat items with no header -->
          <div
            v-for="layer in ungroupedLayers"
            :key="`u:${layer.name}`"
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
            <svg v-if="layer.frozen" class="dxfk-layer-icon-frozen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
              <line x1="12" y1="2" x2="9" y2="5" />
              <line x1="12" y1="2" x2="15" y2="5" />
              <line x1="12" y1="22" x2="9" y2="19" />
              <line x1="12" y1="22" x2="15" y2="19" />
            </svg>
            <svg v-else-if="layer.visible" class="dxfk-layer-icon-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <svg v-else class="dxfk-layer-icon-eye dxfk-layer-icon-eye--off" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <svg v-if="layer.locked && !layer.frozen" class="dxfk-layer-icon-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span class="dxfk-layer-swatch" :style="{ backgroundColor: layer.color }"></span>
            <span class="dxfk-layer-name" :title="layer.name">{{ layer.name }}</span>
            <span class="dxfk-layer-count">{{ layer.entityCount }}</span>
          </div>
        </template>

        <!-- Flat mode (default) -->
        <template v-else>
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
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { groupLayersByPrefix } from "dxf-render";
import type { GroupLayersByPrefixOptions, LayerGroup } from "dxf-render";
import type { LayerState } from "../composables/useLayers";

interface Props {
  layers: LayerState[];
  darkTheme?: boolean;
  /**
   * Group layers by name prefix (`A-WALL`, `A-DOOR` → group `A`).
   * `false` (default) renders the existing flat list.
   * `true` enables grouping with utility defaults (`separator: /[-_]/`, `minGroupSize: 2`).
   * An options object overrides those defaults.
   */
  groupLayers?: boolean | GroupLayersByPrefixOptions;
}

const props = withDefaults(defineProps<Props>(), {
  darkTheme: false,
  groupLayers: false,
});

const emit = defineEmits<{
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

const groupingOptions = computed<GroupLayersByPrefixOptions | null>(() => {
  if (!props.groupLayers) return null;
  return typeof props.groupLayers === "object" ? props.groupLayers : {};
});

const groups = computed<LayerGroup<LayerState>[] | null>(() => {
  const opts = groupingOptions.value;
  if (!opts) return null;
  return groupLayersByPrefix(filteredLayers.value, opts);
});

const realGroups = computed<LayerGroup<LayerState>[]>(() =>
  groups.value?.filter((g) => g.prefix !== "") ?? [],
);

const ungroupedLayers = computed<LayerState[]>(
  () => groups.value?.find((g) => g.prefix === "")?.layers ?? [],
);

const collapsedGroups = reactive<Record<string, boolean>>({});

function toggleGroupCollapse(prefix: string) {
  collapsedGroups[prefix] = !collapsedGroups[prefix];
}

function isGroupExpanded(prefix: string): boolean {
  return !collapsedGroups[prefix];
}

type GroupVisState = "all-visible" | "all-hidden" | "mixed" | "all-frozen";

function getGroupVisState(group: LayerGroup<LayerState>): GroupVisState {
  const toggleable = group.layers.filter((l) => !l.frozen);
  if (toggleable.length === 0) return "all-frozen";
  let visible = 0;
  for (const l of toggleable) if (l.visible) visible++;
  if (visible === 0) return "all-hidden";
  if (visible === toggleable.length) return "all-visible";
  return "mixed";
}

function getGroupVisibleCount(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) if (l.visible && !l.frozen) n++;
  return n;
}

function getGroupTotalEntities(group: LayerGroup<LayerState>): number {
  let n = 0;
  for (const l of group.layers) n += l.entityCount;
  return n;
}

function handleGroupToggle(group: LayerGroup<LayerState>) {
  const state = getGroupVisState(group);
  if (state === "all-frozen") return;
  const shouldShow = state === "all-hidden";
  for (const l of group.layers) {
    if (l.frozen) continue;
    if (l.visible !== shouldShow) {
      emit("toggle-layer", l.name);
    }
  }
}
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

.dxfk-layer-item--in-group {
  padding-left: 22px;
}

.dxfk-layer-group {
  border-top: 1px solid var(--dxfk-border-color, #e0e0e0);
}

.dxfk-layer-group:first-child {
  border-top: none;
}

.dxfk-layer-group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 4px 4px;
  cursor: pointer;
  user-select: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--dxfk-text-secondary, #757575);
  background-color: rgba(0, 0, 0, 0.025);
  transition: background-color 0.15s;
}

.dxfk-layer-group-header:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.dxfk-layer-group-collapse {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-group-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dxfk-text-color, #212121);
  letter-spacing: 0.02em;
}

.dxfk-layer-group-count {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 500;
  color: var(--dxfk-text-secondary, #757575);
  white-space: nowrap;
}

.dxfk-layer-group-toggle {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dxfk-text-color, #212121);
  border-radius: 3px;
  transition: background-color 0.15s;
}

.dxfk-layer-group-toggle:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.06);
}

.dxfk-layer-group-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.dxfk-layer-group-toggle--all-hidden {
  color: var(--dxfk-text-secondary, #757575);
}

.dxfk-layer-group-toggle--mixed {
  color: var(--dxfk-text-color, #212121);
  opacity: 0.7;
}

.dxfk-layer-group-body {
  padding: 2px 0;
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

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group {
  border-top-color: #444;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-header {
  background-color: rgba(255, 255, 255, 0.04);
  color: #aaa;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-header:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-name {
  color: #e0e0e0;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-count,
.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-collapse {
  color: #888;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-toggle {
  color: #e0e0e0;
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-toggle:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
}

.dxfk-layer-panel.dxfk-dark .dxfk-layer-group-toggle--all-hidden {
  color: #666;
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
