# dxf-vuer

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![license](https://img.shields.io/npm/l/dxf-vuer)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Vue 3 component for viewing DXF files in the browser. Thin wrapper around [dxf-render](https://www.npmjs.com/package/dxf-render).

[Live Demo](https://dxf-vuer.netlify.app) | [GitHub](https://github.com/arbaev/dxf-kit) | [Open in StackBlitz](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3)

## Installation

```bash
npm install dxf-vuer dxf-render three
```

Peer dependencies: `vue >= 3.4`, `three >= 0.160`, `dxf-render >= 1.0.0`.

## Quick Start

```vue
<script setup>
import { ref } from 'vue'
import { DXFViewer, parseDxf } from 'dxf-vuer'
import 'dxf-vuer/style.css'

const dxfData = ref(null)

async function loadFile(file) {
  const text = await file.text()
  dxfData.value = parseDxf(text)
}
</script>

<template>
  <input type="file" accept=".dxf" @change="loadFile($event.target.files[0])" />
  <DXFViewer :dxf-data="dxfData" show-reset-button style="width: 100%; height: 600px" />
</template>
```

## Components

| Component | Description |
|-----------|-------------|
| `DXFViewer` | Main viewer: Three.js scene, layer panel, toolbar, error display, drag-and-drop, dark theme, slots |
| `ViewerToolbar` | Toolbar with export, fit-to-view, fullscreen buttons. Has `#extra` slot for custom buttons |
| `FileUploader` | File input button. Emits `file-selected` with `File` |
| `LayerPanel` | Collapsible layer visibility panel with color indicators |
| `UnsupportedEntities` | Collapsible list of unsupported entity types |
| `DXFStatistics` | File statistics (entities, layers, blocks, AutoCAD version) |

## DXFViewer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dxfData` | `DxfData \| null` | `null` | Parsed DXF data object |
| `fileName` | `string` | `""` | File name displayed in the viewer |
| `url` | `string` | `""` | URL to fetch and display a DXF file |
| `showResetButton` | `boolean` | `false` | Show fit-to-view button |
| `showFullscreenButton` | `boolean` | `true` | Show fullscreen toggle button |
| `showExportButton` | `boolean` | `false` | Show export-to-PNG button |
| `showFileName` | `boolean` | `true` | Show file name overlay |
| `showCoordinates` | `boolean` | `false` | Show cursor world coordinates on hover |
| `showZoomLevel` | `boolean` | `false` | Show zoom percentage (100% = fit-to-view) |
| `showDebugInfo` | `boolean` | `false` | Show debug overlay (FPS, draw calls, lines, triangles) |
| `allowDrop` | `boolean` | `false` | Enable drag-and-drop file loading |
| `darkTheme` | `boolean` | `false` | Dark theme for viewer and scene |
| `autoFit` | `boolean` | `true` | Auto-fit camera to drawing on load |
| `fontUrl` | `string` | `""` | Custom font URL for text rendering |
| `fileNamePosition` | `OverlayPosition` | `"top-left"` | Position of file name overlay |
| `toolbarPosition` | `OverlayPosition` | `"top-right"` | Position of toolbar |
| `coordinatesPosition` | `OverlayPosition` | `"bottom-left"` | Position of coordinates overlay |
| `debugPosition` | `OverlayPosition` | `"bottom-center"` | Position of debug overlay |
| `layerPanelPosition` | `OverlayPosition` | `"bottom-right"` | Position of layer panel |
| `overlayPosition` | `OverlayPosition` | `"top-center"` | Position of `#overlay` slot content |

`OverlayPosition` = `"top-left"` | `"top-center"` | `"top-right"` | `"bottom-left"` | `"bottom-center"` | `"bottom-right"`

## DXFViewer Slots

| Slot | Scoped data | Description |
|------|-------------|-------------|
| `#toolbar` | `{ resetView, exportToPNG, toggleFullscreen, isFullscreen }` | Replace entire toolbar |
| `#toolbar-extra` | — | Add buttons to the existing toolbar |
| `#loading` | `{ phase, progress }` | Replace loading screen |
| `#error` | `{ message, retry }` | Replace error screen |
| `#empty-state` | — | Replace "Select a DXF file" placeholder |
| `#overlay` | `{ zoomPercent, cursorX, cursorY }` | Custom overlay (positioned via `overlayPosition` prop) |

```vue
<!-- Add a custom button to the toolbar -->
<DXFViewer :dxf-data="dxfData">
  <template #toolbar-extra>
    <button class="toolbar-button" @click="print">Print</button>
  </template>
</DXFViewer>

<!-- Custom error screen with retry -->
<DXFViewer :dxf-data="dxfData">
  <template #error="{ message, retry }">
    <p>{{ message }}</p>
    <button @click="retry">Try again</button>
  </template>
</DXFViewer>
```

## DXFViewer Events

| Event | Payload | Description |
|-------|---------|-------------|
| `dxf-loaded` | `boolean` | Emitted after load attempt (true = success) |
| `dxf-data` | `DxfData \| null` | Parsed DXF data or null on error |
| `error` | `string` | Error message on parse/render/fetch failure |
| `unsupported-entities` | `string[]` | List of unsupported entity types found |
| `reset-view` | — | Emitted when view is reset to fit |
| `file-dropped` | `string` | File name when a file is dropped |

## Composables

| Composable | Description |
|------------|-------------|
| `useDXFRenderer` | Main orchestrator: parsing, display, resize, layer visibility, dark theme |
| `useThreeScene` | Three.js scene/renderer init with TAA anti-aliasing |
| `useLayers` | Layer visibility state management |

## Re-exports

`dxf-vuer` re-exports everything from `dxf-render` for convenience:

```ts
// All dxf-render exports available directly from dxf-vuer
import { parseDxf, createThreeObjectsFromDXF, resolveEntityColor } from 'dxf-vuer'
```

For the full API of parser and renderer, see the [dxf-render documentation](https://www.npmjs.com/package/dxf-render).

## Migration from v1.x

Most imports work unchanged. Key changes:

- **Install**: `npm install dxf-vuer dxf-render three` (new `dxf-render` peer dep)
- **Parser entry**: `dxf-vuer/parser` → `dxf-render/parser`
- All other imports from `dxf-vuer` continue to work via re-exports

## License

MIT
