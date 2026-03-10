# dxf-vuer

[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![license](https://img.shields.io/npm/l/dxf-vuer)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Vue 3 component for viewing DXF files in the browser. Thin wrapper around [dxf-render](https://www.npmjs.com/package/dxf-render).

[Live Demo](https://dxf-vuer.netlify.app) | [GitHub](https://github.com/arbaev/dxf-kit)

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
| `DXFViewer` | Main viewer: Three.js scene, layer panel, toolbar, drag-and-drop, dark theme |
| `FileUploader` | File input button. Emits `file-selected` with `File` |
| `LayerPanel` | Collapsible layer visibility panel with color indicators |
| `UnsupportedEntities` | Collapsible list of unsupported entity types |
| `DXFStatistics` | File statistics (entities, layers, blocks, AutoCAD version) |

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
