# dxf-render

[![npm](https://img.shields.io/npm/v/dxf-render)](https://www.npmjs.com/package/dxf-render)
[![license](https://img.shields.io/npm/l/dxf-render)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Framework-agnostic DXF parser and Three.js renderer. Use with React, Svelte, vanilla JS, or any framework.

For Vue 3 components, see the [dxf-vuer](https://www.npmjs.com/package/dxf-vuer) package.

## Installation

```bash
# Full renderer (parser + Three.js rendering)
npm install dxf-render three

# Parser only (no Three.js needed)
npm install dxf-render
```

## Quick Start

### Parse and render

```ts
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useOrbitControls,
} from "dxf-render";
import * as THREE from "three";

// Parse DXF text
const dxf = parseDxf(dxfText);

// Load embedded font for text rendering
await loadDefaultFont();

// Create Three.js objects
const { group, materials } = await createThreeObjectsFromDXF(dxf);

// Set up scene
const scene = new THREE.Scene();
scene.add(group);

const renderer = new THREE.WebGLRenderer({ canvas: myCanvas });
const camera = useCamera(renderer.domElement);
useOrbitControls(camera, renderer.domElement);

renderer.render(scene, camera);
```

### Parser only

```ts
import { parseDxf } from "dxf-render/parser";
import type { DxfData } from "dxf-render/parser";
import { isLineEntity } from "dxf-render/parser";

const dxf: DxfData = parseDxf(dxfText);

for (const entity of dxf.entities) {
  if (isLineEntity(entity)) {
    console.log(entity.startPoint, entity.endPoint);
  }
}
```

### Async parsing (Web Worker)

```ts
import { parseDxfAsync, terminateParserWorker } from "dxf-render";

// Parses in a Web Worker, falls back to sync if Workers unavailable
const dxf = await parseDxfAsync(dxfText);

// Cleanup when done
terminateParserWorker();
```

## API

### Entry points

| Import              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `dxf-render`        | Full API: parser + renderer + scene helpers + utils |
| `dxf-render/parser` | Parser only, zero dependencies                      |

### Parser

- `parseDxf(text: string): DxfData` — synchronous DXF parser
- `parseDxfAsync(text: string): Promise<DxfData>` — async parser via Web Worker
- `terminateParserWorker(): void` — terminate the parser Web Worker

### Renderer

- `createThreeObjectsFromDXF(dxf, options?): Promise<CreateDXFSceneResult>` — create Three.js objects from parsed DXF data
  - `options.signal` — `AbortSignal` for cancellation
  - `options.onProgress` — progress callback (0–1)
  - `options.darkTheme` — dark theme mode
  - `options.font` — custom opentype.js Font object
- `MaterialCacheStore` — material cache with `switchTheme()` for instant dark mode

### Scene helpers

- `useCamera(domElement)` — orthographic camera with `fitCameraToBox()`
- `useOrbitControls(camera, domElement)` — pan/zoom controls (no rotation)

### Fonts

- `loadDefaultFont(): Promise<Font>` — load embedded Liberation Sans Regular
- `loadFont(url: string): Promise<Font>` — load custom .ttf/.otf font
- `getDefaultFont(): Font | null` — get loaded default font

### Utils

- `resolveEntityColor()` — resolve entity color with full priority chain
- `resolveEntityLinetype()` — resolve entity linetype
- `collectDXFStatistics()` — collect file statistics
- `getInsUnitsScale()` — unit conversion factor

### Types

Full TypeScript types exported: `DxfData`, `DxfEntity`, `DxfLayer`, `DxfHeader`, and 25+ entity-specific types with type guards (`isLineEntity`, `isCircleEntity`, etc.).

## Supported entities

21 rendered entity types: LINE, CIRCLE, ARC, ELLIPSE, POINT, POLYLINE, LWPOLYLINE, SPLINE, TEXT, MTEXT, DIMENSION, INSERT, SOLID, 3DFACE, HATCH, LEADER, MULTILEADER, MLINE, XLINE, RAY, ATTDEF, plus ATTRIB within INSERT blocks and HELIX via SPLINE.

## Bundle sizes

| File         | Size    | Note                                         |
| ------------ | ------- | -------------------------------------------- |
| Main bundle  | ~960 KB | Includes font + opentype.js + inline worker  |
| Parser chunk | ~50 KB  | Zero dependencies                            |
| Serif font   | ~525 KB | Lazy-loaded only when serif fonts referenced |

## License

MIT
