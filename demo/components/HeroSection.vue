<template>
  <section class="hero">
    <span class="hero-brand">dxf-render</span>
    <h1>Render AutoCAD DXF Drawings in&nbsp;the&nbsp;Browser</h1>
    <p class="hero-subtitle">
      TypeScript DXF parser and Three.js WebGL renderer. Use standalone with React, Svelte, or
      vanilla JS — or as a drop-in Vue&nbsp;3 component.
    </p>
    <div class="hero-install-wrapper">
      <code class="hero-install">npm install dxf-vuer dxf-render three</code>
      <button class="copy-btn" aria-label="Copy install command" @click="copyInstallCommand">
        <svg
          v-if="!copied"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
    <div class="hero-stats">
      <div class="hero-stat">
        <span class="hero-stat-value">21</span>
        <span class="hero-stat-label">entity types</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-value">−78%</span>
        <span class="hero-stat-label">draw calls</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-value">874</span>
        <span class="hero-stat-label">tests</span>
      </div>
      <div class="hero-stat-divider" />
      <div class="hero-stat">
        <span class="hero-stat-value">Web Worker</span>
        <span class="hero-stat-label">parsing</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

const copied = ref(false);

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText("npm install dxf-vuer dxf-render three");
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    const el = document.createElement("textarea");
    el.value = "npm install dxf-vuer dxf-render three";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  }
}
</script>

<style scoped>
.hero {
  text-align: center;
  padding: 3rem var(--spacing-lg) 3rem;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.hero-brand {
  display: inline-block;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--accent-bg, #f0f4ff);
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: var(--spacing-md);
  letter-spacing: 0.5px;
}

.hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--text-color);
  margin-bottom: var(--spacing-sm);
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto var(--spacing-md);
  line-height: 1.6;
}

.hero-install-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--input-bg, #f5f5f5);
  overflow: hidden;
  margin: var(--spacing-sm) 0;
}

.hero-install {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: transparent;
  border: none;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.9rem;
  color: var(--text-color);
  user-select: all;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) 10px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.copy-btn:hover {
  color: var(--primary-color);
  background-color: rgba(74, 144, 217, 0.08);
}

.copy-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.copy-btn svg {
  flex-shrink: 0;
}

.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  line-height: 1;
  white-space: nowrap;
}

.hero-stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hero-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
}

@media (max-width: 768px) {
  .hero {
    padding: 2rem var(--spacing-md) 1.5rem;
  }

  .hero h1 {
    font-size: 1.75rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-stats {
    gap: var(--spacing-sm);
  }

  .hero-stat-value {
    font-size: 1.25rem;
  }
}

</style>
