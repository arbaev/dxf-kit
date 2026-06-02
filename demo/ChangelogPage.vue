<template>
  <div class="changelog-page app" :class="{ dark: isDark }">
    <TopActions v-model:dark="isDark" />

    <main class="changelog-main">
      <nav class="changelog-nav" aria-label="Breadcrumb">
        <a class="changelog-nav-home" href="/">← dxf-kit</a>
        <span class="changelog-nav-sep">/</span>
        <span class="changelog-nav-current">Changelog</span>
      </nav>

      <header class="changelog-header">
        <h1>Changelog</h1>
        <p class="changelog-subtitle">
          Notable changes across the dxf-kit packages. For full release notes and downloads, see the
          <a
            href="https://github.com/arbaev/dxf-kit/releases"
            target="_blank"
            rel="noopener noreferrer"
            @click="trackEvent('external-link', { target: 'github-releases' })"
            >GitHub releases</a
          >.
        </p>
      </header>

      <div class="whats-new-list">
        <div v-for="item in whatsNew" :key="item.text" class="whats-new-item">
          <span class="whats-new-version" :class="`pkg-${item.pkg}`">
            <span class="whats-new-pkg">{{ item.pkg }}</span>
            <span class="whats-new-num">{{ item.version }}</span>
          </span>
          <span class="whats-new-text">{{ item.text }}</span>
        </div>
      </div>

      <a
        class="changelog-releases-link"
        href="https://github.com/arbaev/dxf-kit/releases"
        target="_blank"
        rel="noopener noreferrer"
        @click="trackEvent('external-link', { target: 'github-releases' })"
      >
        View all releases on GitHub
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
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </main>
  </div>
</template>

<script setup lang="ts">
import TopActions from "./components/TopActions.vue";
import { useDarkTheme } from "./composables/useDarkTheme";
import { whatsNew } from "./whatsNew";
import { trackEvent } from "./analytics";

const { isDark } = useDarkTheme();
</script>

<style scoped>
.changelog-page {
  min-height: 100vh;
  position: relative;
}

.changelog-main {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.changelog-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  margin-bottom: var(--spacing-lg);
}

.changelog-nav-home {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.changelog-nav-home:hover {
  text-decoration: underline;
}

.changelog-nav-sep {
  color: var(--text-secondary);
}

.changelog-nav-current {
  color: var(--text-secondary);
}

.changelog-header {
  margin-bottom: var(--spacing-lg);
}

.changelog-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 var(--spacing-sm);
}

.changelog-subtitle {
  color: var(--text-secondary);
  font-size: 0.9375rem;
  line-height: 1.6;
  margin: 0;
}

.changelog-subtitle a {
  color: var(--primary-color);
  text-decoration: none;
}

.changelog-subtitle a:hover {
  text-decoration: underline;
}

/* Mirrors WhatsNewSection's list styling so the entries read identically. */
.whats-new-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.whats-new-version.pkg-dxf-react {
  color: #0b7285;
  background: #e3f7fb;
}

.app.dark .whats-new-version.pkg-dxf-react {
  color: #61dafb;
  background: #0b2a33;
}

.whats-new-version.pkg-dxf-lit {
  color: #5b21b6;
  background: #f1e9fe;
}

.app.dark .whats-new-version.pkg-dxf-lit {
  color: #c4b5fd;
  background: #2a1b46;
}

.whats-new-version.pkg-dxf-interaction {
  color: #b45309;
  background: #fef3e2;
}

.app.dark .whats-new-version.pkg-dxf-interaction {
  color: #fbbf24;
  background: #3a2a10;
}

.whats-new-pkg {
  opacity: 0.85;
}

.whats-new-num {
  opacity: 1;
}

.changelog-releases-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--spacing-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  text-decoration: none;
}

.changelog-releases-link:hover {
  text-decoration: underline;
}
</style>
