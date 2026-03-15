<template>
  <section class="whats-new">
    <h2>What's New</h2>
    <div class="whats-new-list">
      <div v-for="item in whatsNew" :key="item.text" class="whats-new-item">
        <span class="whats-new-version">{{ item.version }}</span>
        <span class="whats-new-text">{{ item.text }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const whatsNew = [
  {
    version: "1.2.0",
    text: "Variable-width polylines with per-vertex tapering, arrows, and donuts",
  },
  {
    version: "1.2.0",
    text: "GIS origin translation — large UTM/state plane coordinates without precision loss",
  },
  { version: "1.2.0", text: "Touch support — native one-finger pan on mobile devices" },
  { version: "1.1.0", text: "Theme-adaptive ACI 250-251 colors — dark grays invert in dark mode" },
  {
    version: "1.5.0",
    text: "TAA anti-aliasing — 32-frame temporal accumulation for crisp text and edges",
  },
  { version: "1.5.0", text: "Instant dark mode — theme switching without full re-render" },
  { version: "1.4.0", text: "MLINE, XLINE, RAY entities — multilines and construction lines" },
  {
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
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-color);
  background: var(--accent-bg, #f0f4ff);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
