<template>
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
</template>

<script setup lang="ts">
import { trackEvent } from "../analytics";

// Two-way bound dark-theme flag — owned by the page via useDarkTheme().
const isDark = defineModel<boolean>("dark", { required: true });
</script>

<style scoped>
/* Geometry mirrors the neutral landing; colours use CSS vars so the `.dark`
   token override on the page root flips them automatically (no hardcoded white). */
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
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--card-bg, white);
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.top-action-btn:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.top-action-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
</style>
