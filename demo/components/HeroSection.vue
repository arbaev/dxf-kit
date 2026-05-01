<template>
  <section class="hero">
    <svg
      class="hero-bg"
      :viewBox="`0 0 ${BG_W} ${BG_H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        v-for="(tri, i) in triangles"
        :key="i"
        :points="tri"
        fill="none"
        stroke="currentColor"
        stroke-width="0.6"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span class="hero-brand">dxf-render · dxf-vuer</span>
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
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { trackEvent } from "../analytics";

const copied = ref(false);

const BG_W = 1200;
const BG_H = 520;

function buildTriangles(): string[] {
  const cols = 14;
  const rows = 6;
  const cellW = BG_W / cols;
  const cellH = BG_H / rows;
  const jitter = 0.42;

  // Random seed per page load so the pattern changes on each refresh
  let seed = (Math.random() * 0xffffffff) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const pt = (c: number, r: number): [number, number] => {
    const onEdge = c === 0 || r === 0 || c === cols || r === rows;
    const jx = onEdge ? 0 : (rand() - 0.5) * 2 * jitter * cellW;
    const jy = onEdge ? 0 : (rand() - 0.5) * 2 * jitter * cellH;
    return [c * cellW + jx, r * cellH + jy];
  };

  const grid: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let c = 0; c <= cols; c++) row.push(pt(c, r));
    grid.push(row);
  }

  const out: string[] = [];
  const fmt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const cc = grid[r + 1][c];
      const d = grid[r + 1][c + 1];
      // Alternate diagonal direction per cell for visual variety
      if ((r + c) % 2 === 0) {
        out.push(`${fmt(a)} ${fmt(b)} ${fmt(d)} ${fmt(a)}`);
        out.push(`${fmt(a)} ${fmt(d)} ${fmt(cc)} ${fmt(a)}`);
      } else {
        out.push(`${fmt(a)} ${fmt(b)} ${fmt(cc)} ${fmt(a)}`);
        out.push(`${fmt(b)} ${fmt(d)} ${fmt(cc)} ${fmt(b)}`);
      }
    }
  }
  return out;
}

const triangles = buildTriangles();

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
  trackEvent("copy-install");
}
</script>

<style scoped>
.hero {
  position: relative;
  text-align: center;
  padding: 3rem var(--spacing-lg) 3rem;
  max-width: var(--content-max-width);
  margin: 0 auto;
}

.hero-bg {
  position: absolute;
  top: calc(-1 * var(--spacing-lg));
  left: 50%;
  transform: translateX(-50%);
  width: 100vw;
  height: clamp(420px, 70vh, 600px);
  pointer-events: none;
  color: var(--primary-color, #4a90d9);
  opacity: 0.22;
  z-index: -1;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, transparent 100%);
}

.hero > *:not(.hero-bg) {
  position: relative;
  z-index: 0;
}

/* Dark theme uses same opacity as light; --primary-color is already redefined for dark in App.vue */

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
}
</style>
