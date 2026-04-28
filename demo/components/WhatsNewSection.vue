<template>
  <section class="whats-new">
    <h2>What's New</h2>
    <div class="whats-new-list">
      <div v-for="item in whatsNew" :key="item.text" class="whats-new-item">
        <span class="whats-new-version" :class="`pkg-${item.pkg}`">
          <span class="whats-new-pkg">{{ item.pkg }}</span>
          <span class="whats-new-num">{{ item.version }}</span>
        </span>
        <span class="whats-new-text">{{ item.text }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type Pkg = "dxf-render" | "dxf-vuer";

interface WhatsNewItem {
  pkg: Pkg;
  version: string;
  text: string;
}

const whatsNew: WhatsNewItem[] = [
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Configurable antialiasing — MSAA (default), SMAA, FXAA, TAA, SSAA, or none — pick the right tradeoff for your drawing",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Layers panel filter — text search by name, auto-shown for drawings with more than 5 layers",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "loadDXFFromBuffer / loadDXFFromBlob — load drawings from storage SDKs, IndexedDB, or fetch().blob() with UTF-8 / UTF-16 BOM auto-detection",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Respects prefers-reduced-motion — TAA accumulation loop is skipped for users who opted into reduced motion",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "showLayerPanel prop — programmatically hide the layers panel",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "Variable-width polylines with per-vertex tapering, arrows, and donuts",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "GIS origin translation — large UTM/state plane coordinates without precision loss",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "Touch support — native one-finger pan on mobile devices",
  },
  {
    pkg: "dxf-render",
    version: "1.1.0",
    text: "Theme-adaptive ACI 250-251 colors — dark grays invert in dark mode",
  },
  {
    pkg: "dxf-vuer",
    version: "1.5.0",
    text: "TAA anti-aliasing — 32-frame temporal accumulation for crisp text and edges",
  },
  {
    pkg: "dxf-vuer",
    version: "1.5.0",
    text: "Instant dark mode — theme switching without full re-render",
  },
  {
    pkg: "dxf-vuer",
    version: "1.4.0",
    text: "MLINE, XLINE, RAY entities — multilines and construction lines",
  },
  {
    pkg: "dxf-vuer",
    version: "1.4.0",
    text: "25 built-in hatch patterns with solid fill optimization (86× faster)",
  },
];
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
</style>
