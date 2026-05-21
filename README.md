# dxf-kit

[![license](https://img.shields.io/npm/l/dxf-render)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Parse and render AutoCAD DXF files in the browser. Custom parser, Three.js rendering, 21 entity types, vector text, hatch patterns.

#### [Core engine `dxf-render`](packages/dxf-render/) | [Vue 3 component `dxf-vuer`](packages/dxf-vuer/) | [Live Demo Viewer](https://dxf-kit.netlify.app)

![screenshot](https://raw.githubusercontent.com/arbaev/dxf-kit/main/docs/dxf-kit-house-plan.jpg)

## Packages

This monorepo contains two npm packages. Choose the one that fits your stack:

### [`dxf-render`](packages/dxf-render/) — framework-agnostic engine

[![npm](https://img.shields.io/npm/v/dxf-render)](https://www.npmjs.com/package/dxf-render)

DXF parser + Three.js renderer. Use with **React, Svelte, vanilla JS**, or as a **parser-only** library in Node.js (zero Three.js dependency).

```bash
npm install dxf-render three
```

```ts
import { parseDxf, createThreeObjectsFromDXF, loadDefaultFont } from "dxf-render";

const dxf = parseDxf(dxfText);
await loadDefaultFont();
const { group } = await createThreeObjectsFromDXF(dxf);
scene.add(group);
```

Parser-only (no Three.js needed):

```ts
import { parseDxf } from "dxf-render/parser";
const dxf = parseDxf(dxfText);
```

[Full documentation →](packages/dxf-render/)

---

### [`dxf-vuer`](packages/dxf-vuer/) — Vue 3 component

[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)

Thin Vue 3 wrapper around `dxf-render`. Drop-in `<DXFViewer>` component with layer panel, dark theme, drag-and-drop, export to PNG, zoom level, error display, debug overlay.

```bash
npm install dxf-vuer dxf-render three
```

```vue
<script setup>
import { ref } from "vue";
import { DXFViewer, parseDxf } from "dxf-vuer";
import "dxf-vuer/style.css";

const dxfData = ref(null);

async function loadFile(file) {
  const text = await file.text();
  dxfData.value = parseDxf(text);
}
</script>

<template>
  <input type="file" accept=".dxf" @change="loadFile($event.target.files[0])" />
  <DXFViewer :dxf-data="dxfData" show-reset-button style="width: 100%; height: 600px" />
</template>
```

[Full documentation →](packages/dxf-vuer/)

## Features

- **22 DXF entity types** — LINE, CIRCLE, ARC, ELLIPSE, SPLINE, POLYLINE, LWPOLYLINE, TEXT, MTEXT, DIMENSION, HATCH, INSERT, SOLID, 3DFACE, LEADER, MULTILEADER, MLINE, XLINE, RAY, ATTDEF, HELIX, REGION (contour via HATCH boundary), plus ATTRIB within blocks
- **Variable-width polylines** — per-vertex `startWidth`/`endWidth` tapering, constant-width, arrows, donuts rendered as mesh geometry with miter joins
- **Standard arrowhead blocks** — DIMENSION endpoints and LEADER tips honour DIMBLK / DIMLDRBLK; all 18 stock AutoCAD blocks rendered with the correct shape (`_ClosedFilled`, `_Open*`, `_Dot*`, `_Origin*`, `_Box*`, `_Datum*`, `_ArchTick`, `_Integral`, `_None`, …)
- **Linetype rendering** — DASHED, HIDDEN, CENTER, PHANTOM, DOT, DASHDOT with LTSCALE support
- **Hatch patterns** — 25 built-in AutoCAD patterns with multi-boundary clipping
- **Vector text** — crisp at any zoom; Liberation Sans/Serif fonts; bold, italic, underline, overline, strikethrough; MTEXT inline scoped formatting (color/font/size/decoration inside `{…}` groups)
- **Picking & associations** — bbox-based raycast, hover/click events, semantic links derived from DXF (LEADER↔TEXT, INSERT+ATTRIB, MLEADER, DIMENSION)
- **Search APIs** — `findEntitiesByText` / `findEntitiesByLayer` / `findEntitiesByType`, paired with `viewer.zoomToEntity` / `zoomToLayer` for find-and-focus UX
- **Dark theme** — instant switching
- **Layer panel** — toggle visibility with color indicators; optional `localStorage` persistence per file
- **Keyboard navigation** — arrow keys pan, `+`/`-` zoom, `0` reset
- **Accessibility** — ARIA roles/labels on toolbar, layer panel, status/error overlays; respects `prefers-reduced-motion`
- **Overlay positioning** — 6-cell grid system for positioning UI overlays (toolbar, coordinates, layers, etc.)
- **Customizable UI** — 6 named slots (`#toolbar`, `#toolbar-extra`, `#loading`, `#error`, `#empty-state`, `#overlay`) with scoped data
- **Customizable styling** — stable `.dxfk-*` hook classes with low specificity (Tailwind `@apply`-friendly), Headless UI-style `classes` prop, `--dxfk-*` CSS custom properties
- **Error display** — parse/render/fetch errors shown in the viewer with retry support
- **Debug overlay** — FPS, draw calls, lines, triangles
- **Zoom level** — percentage display relative to fit-to-view
- **Configurable antialiasing** — choose between MSAA (default, hardware), SMAA, FXAA, TAA, SSAA, or none
- **TypeScript** — strict types, full `.d.ts` declarations

## Acknowledgements

The DXF parser was inspired by [dxf-parser](https://github.com/gdsestimating/dxf-parser) by GDS Estimating, and has since been substantially rewritten with 25 entity handlers, linetype/OCS/hatch systems, and a comprehensive test suite.

## License

MIT
