<template>
  <div class="dxfk-statistics">
    <h3 class="dxfk-statistics-title">File Statistics</h3>

    <div class="dxfk-statistics-grid">
      <div class="dxfk-statistics-section">
        <h4 class="dxfk-statistics-section-title">General</h4>
        <div class="dxfk-statistics-item">
          <span class="dxfk-statistics-label">File Size:</span>
          <span class="dxfk-statistics-value">{{ formatFileSize(statistics.fileSize) }}</span>
        </div>
        <div v-if="statistics.autocadVersion" class="dxfk-statistics-item">
          <span class="dxfk-statistics-label">AutoCAD Version:</span>
          <span class="dxfk-statistics-value">{{ statistics.autocadVersion }}</span>
        </div>
      </div>

      <div class="dxfk-statistics-section">
        <h4 class="dxfk-statistics-section-title">Entities</h4>
        <div class="dxfk-statistics-item">
          <span class="dxfk-statistics-label">Total Entities:</span>
          <span class="dxfk-statistics-value dxfk-statistics-value--highlight">{{ statistics.totalEntities }}</span>
        </div>
        <div
          v-for="(count, type) in sortedEntitiesByType"
          :key="type"
          class="dxfk-statistics-item dxfk-statistics-item--entity-type"
        >
          <span class="dxfk-statistics-label">{{ type }}:</span>
          <span class="dxfk-statistics-value">{{ count }}</span>
        </div>
      </div>

      <div class="dxfk-statistics-section">
        <h4 class="dxfk-statistics-section-title">Structure</h4>
        <div class="dxfk-statistics-item">
          <span class="dxfk-statistics-label">Layers:</span>
          <span class="dxfk-statistics-value">{{ statistics.layersCount }}</span>
        </div>
        <div class="dxfk-statistics-item">
          <span class="dxfk-statistics-label">Blocks:</span>
          <span class="dxfk-statistics-value">{{ statistics.blocksCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DxfStatistics } from "dxf-render";

interface Props {
  statistics: DxfStatistics;
}

const props = defineProps<Props>();

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const sortedEntitiesByType = computed(() => {
  const entries = Object.entries(props.statistics.entitiesByType);
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries);
});
</script>

<style scoped>
.dxfk-statistics {
  background-color: var(--dxfk-bg-color, #fafafa);
  border: 1px solid var(--dxfk-border-color, #e0e0e0);
  border-radius: var(--dxfk-border-radius, 4px);
  padding: var(--dxfk-spacing-md, 16px);
  margin-top: var(--dxfk-spacing-md, 16px);
}

.dxfk-statistics-title {
  margin: 0 0 var(--dxfk-spacing-md, 16px) 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--dxfk-text-color, #212121);
}

.dxfk-statistics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--dxfk-spacing-md, 16px);
}

.dxfk-statistics-section-title {
  margin: 0 0 var(--dxfk-spacing-sm, 8px) 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--dxfk-text-secondary, #757575);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--dxfk-border-color, #e0e0e0);
  padding-bottom: var(--dxfk-spacing-xs, 4px);
}

.dxfk-statistics-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--dxfk-spacing-xs, 4px) 0;
  font-size: 0.875rem;
}

.dxfk-statistics-item--entity-type {
  padding-left: var(--dxfk-spacing-sm, 8px);
  font-size: 0.8125rem;
}

.dxfk-statistics-label {
  color: var(--dxfk-text-secondary, #757575);
  font-weight: 500;
}

.dxfk-statistics-value {
  color: var(--dxfk-text-color, #212121);
  font-weight: 600;
  font-family: "Courier New", monospace;
}

.dxfk-statistics-value--highlight {
  color: var(--dxfk-primary-color, #1040b0);
  font-size: 1rem;
}

@media (max-width: 768px) {
  .dxfk-statistics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
