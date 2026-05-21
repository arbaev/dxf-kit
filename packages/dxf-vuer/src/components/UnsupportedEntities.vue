<template>
  <div v-if="entities.length > 0" class="dxfk-unsupported">
    <div class="dxfk-unsupported-header">
      <svg
        class="dxfk-unsupported-icon"
        width="20"
        height="20"
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
      <span class="dxfk-unsupported-title">Unsupported Elements ({{ entities.length }})</span>
      <button class="dxfk-unsupported-toggle" @click="isExpanded = !isExpanded">
        {{ isExpanded ? "Hide" : "Show" }}
      </button>
    </div>

    <transition name="expand">
      <div v-if="isExpanded" class="dxfk-unsupported-list">
        <div v-for="(entity, index) in entities" :key="index" class="dxfk-unsupported-item">
          <span class="dxfk-unsupported-bullet">&#8226;</span>
          <span class="dxfk-unsupported-text">{{ entity }}</span>
        </div>
      </div>
    </transition>

    <div class="dxfk-unsupported-footer">
      <span class="dxfk-unsupported-note">
        &#8505;&#65039; These elements will not be displayed on the drawing
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

interface Props {
  entities: string[];
}

defineProps<Props>();

const isExpanded = ref(true);
</script>

<style scoped>
/* Intentional warning palette (amber). Override .dxfk-unsupported to recolor. */
.dxfk-unsupported {
  background-color: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: var(--dxfk-border-radius, 4px);
  padding: var(--dxfk-spacing-md, 16px);
  margin: var(--dxfk-spacing-md, 16px);
}

.dxfk-unsupported-header {
  display: flex;
  align-items: center;
  gap: var(--dxfk-spacing-sm, 8px);
  margin-bottom: var(--dxfk-spacing-sm, 8px);
}

.dxfk-unsupported-icon {
  flex-shrink: 0;
  color: #ff9800;
}

.dxfk-unsupported-title {
  flex: 1;
  font-weight: 600;
  color: #856404;
  font-size: 14px;
}

.dxfk-unsupported-toggle {
  padding: 4px 12px;
  font-size: 12px;
  background-color: white;
  border: 1px solid #ffc107;
  border-radius: var(--dxfk-border-radius, 4px);
  color: #856404;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.dxfk-unsupported-toggle:hover {
  background-color: #ffc107;
  color: white;
}

.dxfk-unsupported-list {
  max-height: 200px;
  overflow-y: auto;
  margin-top: var(--dxfk-spacing-sm, 8px);
  padding: var(--dxfk-spacing-sm, 8px);
  background-color: white;
  border-radius: var(--dxfk-border-radius, 4px);
  border: 1px solid #ffc107;
}

.dxfk-unsupported-item {
  display: flex;
  align-items: flex-start;
  gap: var(--dxfk-spacing-sm, 8px);
  padding: 4px 0;
  font-size: 13px;
  color: #856404;
}

.dxfk-unsupported-bullet {
  flex-shrink: 0;
  font-weight: bold;
}

.dxfk-unsupported-text {
  flex: 1;
  word-break: break-word;
}

.dxfk-unsupported-footer {
  margin-top: var(--dxfk-spacing-sm, 8px);
  padding-top: var(--dxfk-spacing-sm, 8px);
  border-top: 1px solid #ffc107;
}

.dxfk-unsupported-note {
  font-size: 12px;
  color: #856404;
  font-style: italic;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.dxfk-unsupported-list::-webkit-scrollbar {
  width: 6px;
}

.dxfk-unsupported-list::-webkit-scrollbar-track {
  background: #fff3cd;
  border-radius: 3px;
}

.dxfk-unsupported-list::-webkit-scrollbar-thumb {
  background: #ffc107;
  border-radius: 3px;
}

.dxfk-unsupported-list::-webkit-scrollbar-thumb:hover {
  background: #ff9800;
}

@media (max-width: 768px) {
  .dxfk-unsupported {
    padding: var(--dxfk-spacing-sm, 8px);
    margin: var(--dxfk-spacing-sm, 8px);
  }

  .dxfk-unsupported-title {
    font-size: 13px;
  }

  .dxfk-unsupported-item {
    font-size: 12px;
  }

  .dxfk-unsupported-list {
    max-height: 150px;
  }
}
</style>
