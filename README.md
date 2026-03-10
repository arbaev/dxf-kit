# dxf-vuer

[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![license](https://img.shields.io/npm/l/dxf-vuer)](https://github.com/arbaev/dxf-vuer/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Vue 3 component for viewing DXF files in the browser. Built-in DXF parser, Three.js rendering, zero external DXF dependencies.

[Live Demo](https://dxf-vuer.netlify.app)

![dxf-vuer screenshot](https://raw.githubusercontent.com/arbaev/dxf-vuer/main/docs/screenshot.png)

## Installation

```bash
npm install dxf-vuer dxf-render three
```

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
  <DXFViewer
    :dxf-data="dxfData"
    show-reset-button
    style="width: 100%; height: 600px"
  />
</template>
```

Or use the imperative API for a better loading UX (shows a spinner):

```vue
<script setup>
import { ref } from 'vue'
import { DXFViewer } from 'dxf-vuer'
import 'dxf-vuer/style.css'

const viewer = ref(null)

async function loadFile(file) {
  const text = await file.text()
  viewer.value.loadDXFFromText(text)
}
</script>

<template>
  <input type="file" accept=".dxf" @change="loadFile($event.target.files[0])" />
  <DXFViewer ref="viewer" show-reset-button style="width: 100%; height: 600px" />
</template>
```

## Features

- **21 DXF entity types** — LINE, CIRCLE, ARC, ELLIPSE, SPLINE, POLYLINE, LWPOLYLINE, TEXT, MTEXT, DIMENSION, HATCH, INSERT, SOLID, 3DFACE, LEADER, MULTILEADER, MLINE, XLINE, RAY, ATTDEF, HELIX, plus ATTRIB within blocks
- **Linetype rendering** — DASHED, HIDDEN, CENTER, PHANTOM, DOT, DASHDOT with LTSCALE support
- **Hatch patterns** — 25 built-in AutoCAD patterns with multi-boundary clipping
- **Vector text** — crisp at any zoom; Liberation Sans/Serif fonts; bold, italic, underline, MTEXT formatting
- **Dark theme** — instant switching via `darkTheme` prop
- **Drag-and-drop** — drop DXF files onto the viewer
- **Export to PNG** — save current view as image
- **Layer panel** — toggle visibility with color indicators
- **Loading progress** — progress bar during rendering
- **TAA anti-aliasing** — smooth edges after idle accumulation
- **CSS custom properties** — theme with `--dxf-vuer-*` variables
- **TypeScript** — strict types, full `.d.ts` declarations

## DXFViewer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dxfData` | `DxfData \| null` | `null` | Parsed DXF data to display |
| `fileName` | `string` | `""` | File name shown in the top-left corner |
| `url` | `string` | `""` | URL to load DXF file from |
| `showResetButton` | `boolean` | `false` | Show a reset-view button |
| `showFullscreenButton` | `boolean` | `true` | Show a fullscreen button |
| `showExportButton` | `boolean` | `false` | Show an export-to-PNG button |
| `showFileName` | `boolean` | `true` | Show the file name overlay |
| `showCoordinates` | `boolean` | `false` | Show world coordinates at cursor position |
| `allowDrop` | `boolean` | `false` | Enable drag-and-drop of DXF files |
| `darkTheme` | `boolean` | `false` | Dark theme for scene and overlays |
| `autoFit` | `boolean` | `true` | Auto-fit camera to content |
| `fontUrl` | `string` | `""` | URL to a custom .ttf/.otf font |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `dxf-loaded` | `boolean` | Emitted after load attempt (true = success) |
| `dxf-data` | `DxfData \| null` | Parsed data after successful load |
| `error` | `string` | Error message on failure |
| `unsupported-entities` | `string[]` | Entity types that could not be rendered |
| `reset-view` | — | User clicked reset button |
| `file-dropped` | `string` | File name when a file is dropped |

### Exposed Methods

| Method | Description |
|--------|-------------|
| `loadDXFFromText(text)` | Parse and display DXF from raw text |
| `loadDXFFromData(data)` | Display pre-parsed DXF data |
| `loadDXFFromUrl(url)` | Fetch and display DXF from URL |
| `resetView()` | Reset camera to fit content |
| `exportToPNG()` | Download current view as PNG |
| `resize()` | Trigger manual resize |

## Other Components

| Component | Description |
|-----------|-------------|
| `FileUploader` | File input button. Emits `file-selected` with `File` |
| `LayerPanel` | Layer visibility toggles with color indicators |
| `UnsupportedEntities` | List of unsupported entity types |
| `DXFStatistics` | Entity counts, layers, blocks, AutoCAD version |

## CSS Customization

```css
:root {
  --dxf-vuer-primary-color: #ff6600;
  --dxf-vuer-bg-color: #ffffff;
  --dxf-vuer-border-color: #cccccc;
  --dxf-vuer-border-radius: 8px;
  --dxf-vuer-text-color: #333333;
}
```

## Using without Vue

The rendering engine is available as a separate package **[dxf-render](https://www.npmjs.com/package/dxf-render)** for React, Svelte, vanilla JS, or parser-only usage in Node.js. See its [README](packages/dxf-render/) for details.

## Migration from v1.x

Most imports work unchanged — `dxf-vuer` re-exports everything from `dxf-render`:

```ts
// Still works
import { parseDxf, DXFViewer } from 'dxf-vuer'
```

**Breaking changes:**
- Install: `npm install dxf-vuer dxf-render three` (new `dxf-render` peer dep)
- Parser-only entry: `dxf-vuer/parser` → `dxf-render/parser`

## Acknowledgements

The DXF parser was inspired by [dxf-parser](https://github.com/gdsestimating/dxf-parser) by GDS Estimating, and has since been substantially rewritten with 25 entity handlers, linetype/OCS/hatch systems, and a comprehensive test suite.

## License

MIT
