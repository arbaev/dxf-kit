<template>
  <section class="examples">
    <h2>Interactive Examples</h2>
    <p class="examples-subtitle">
      Try interactive examples on StackBlitz — no installation required.
    </p>
    <div class="examples-grid">
      <a
        v-for="example in examples"
        :key="example.title"
        :href="example.url"
        target="_blank"
        rel="noopener noreferrer"
        class="example-card"
      >
        <span class="example-icon" v-html="example.icon" />
        <div>
          <h3>{{ example.title }}</h3>
          <p>{{ example.description }}</p>
        </div>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
const STACKBLITZ_BASE = "https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples";

const examples = [
  {
    title: "Vanilla TypeScript",
    description:
      "Minimal setup with dxf-render and Three.js — parse, render, and display a DXF file.",
    url: `${STACKBLITZ_BASE}/vanilla-ts?file=src/main.ts&title=dxf-render+Vanilla+TS`,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  },
  {
    title: "React",
    description: "DXF viewer as a React component with useEffect, useRef, and Three.js rendering.",
    url: `${STACKBLITZ_BASE}/react?file=src/DxfViewer.tsx&title=dxf-render+React`,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>',
  },
  {
    title: "Vue 3",
    description:
      "Drop-in DXF viewer using the dxf-vuer component — dark theme, layers, and export.",
    url: `${STACKBLITZ_BASE}/vue?file=src/App.vue&title=dxf-vuer+Vue+3`,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3l10 19L22 3"/><path d="M6.5 3L12 14.5 17.5 3"/></svg>',
  },
  {
    title: "Leaflet + DXF",
    description:
      "Overlay DXF on OpenStreetMap with geo-referencing — parser-only, no Three.js. Includes Florence city center sample.",
    url: `${STACKBLITZ_BASE}/leaflet-dxf?file=src/main.ts&title=dxf-render+Leaflet`,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  },
  {
    title: "DXF to PDF",
    description:
      "Export DXF drawings to PDF — offscreen Three.js rendering with page size and orientation options.",
    url: `${STACKBLITZ_BASE}/dxf-to-pdf?file=src/main.ts&title=dxf-render+PDF+Export`,
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  },
];
</script>

<style scoped>
.examples {
  max-width: var(--content-max-width);
  margin: var(--spacing-lg) auto 0;
  text-align: center;
}

.examples h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: var(--spacing-sm);
}

.examples-subtitle {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.examples-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
  text-align: left;
}

.example-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--card-bg, white);
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.example-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 3px 12px rgba(74, 144, 217, 0.15);
}

.example-card:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.example-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--accent-bg, #f0f4ff);
  color: var(--primary-color);
}

.example-card h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 2px;
}

.example-card p {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 768px) {
  .examples-grid {
    grid-template-columns: 1fr;
  }
}

</style>
