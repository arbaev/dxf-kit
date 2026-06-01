<template>
  <div class="mini-viewer">
    <DXFViewer
      :url="url"
      :dark-theme="dark"
      :auto-fit="true"
      :show-reset-button="true"
      :show-zoom-level="true"
      :show-coordinates="false"
      :picking-enabled="false"
    />
  </div>
</template>

<script setup lang="ts">
import { DXFViewer } from "dxf-vuer";
import "dxf-vuer/style.css";

// Compact live viewer for the framework landing pages. Loads a bundled sample
// straight from the `url` prop (the engine fetches + parses on mount). All
// wrappers render through the same dxf-render engine, so this faithfully shows
// what a React/Lit page would render too.
defineProps<{ url: string; dark: boolean }>();
</script>

<style scoped>
.mini-viewer {
  /* DXFViewer's root is `flex: 1` with no explicit height — it needs a flex
     parent to fill (the main demo's .viewer-container does the same). Without
     `display: flex` the viewer collapses to 0 height → only the frame shows. */
  display: flex;
  height: 380px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

@media (max-width: 768px) {
  .mini-viewer {
    height: 300px;
  }
}
</style>
