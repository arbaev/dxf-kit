<template>
  <section class="whats-new">
    <h2>What's New</h2>
    <div class="whats-new-list">
      <div v-for="item in latestWhatsNew" :key="item.text" class="whats-new-item">
        <span class="whats-new-version" :class="`pkg-${item.pkg}`">
          <span class="whats-new-pkg">{{ item.pkg }}</span>
          <span class="whats-new-num">{{ item.version }}</span>
        </span>
        <span class="whats-new-text">{{ item.text }}</span>
      </div>
    </div>
    <a class="whats-new-more" href="/changelog">
      Full changelog
      <svg
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
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </a>
  </section>
</template>

<script setup lang="ts">
import { latestWhatsNew } from "../whatsNew";
</script>

<style scoped>
.whats-new {
  max-width: var(--content-max-width);
  margin: var(--spacing-lg) auto 0;
  text-align: center;
}

.whats-new h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: var(--spacing-md);
}

.whats-new-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.whats-new-item {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
  padding: 6px 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.whats-new-version {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.whats-new-version.pkg-dxf-render {
  color: var(--primary-color);
  background: var(--accent-bg, #f0f4ff);
}

.whats-new-version.pkg-dxf-vuer {
  color: #2e7d32;
  background: #e8f5e9;
}

.app.dark .whats-new-version.pkg-dxf-vuer {
  color: #81c784;
  background: #1b3a1f;
}

.whats-new-pkg {
  opacity: 0.85;
}

.whats-new-num {
  opacity: 1;
}

.whats-new-more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--spacing-md);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  text-decoration: none;
}

.whats-new-more:hover {
  text-decoration: underline;
}

.whats-new-more svg {
  transition: transform 0.15s;
}

.whats-new-more:hover svg {
  transform: translateX(3px);
}
</style>
