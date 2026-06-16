# dxf-kit

[![license](https://img.shields.io/npm/l/dxf-render)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Parse and render AutoCAD DXF files in the browser. Custom parser, Three.js rendering, 22 entity types, vector text, hatch patterns.

Just want to look at a DXF file? Open it in the [Live Demo Viewer](https://dxf-kit.netlify.app) — no install, no upload, everything stays in your browser.

**Try it on StackBlitz:** [Vanilla TS](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vanilla-ts?file=src/main.ts&title=dxf-render+Vanilla+TS) · [React](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/react?file=src/App.tsx&title=dxf-render+React) · [Vue](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3) · [Web Component](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/lit?file=index.html&title=dxf-lit+Web+Component) · [Leaflet + DXF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/leaflet-dxf?file=src/main.ts&title=dxf-render+Leaflet) · [DXF → PDF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/dxf-to-pdf?file=src/main.ts&title=dxf-render+PDF+Export) · [all examples →](https://github.com/arbaev/dxf-kit/tree/main/examples)

![screenshot](https://raw.githubusercontent.com/arbaev/dxf-kit/main/docs/dxf-kit-house-plan.jpg)

[dxf-kit by the numbers](STATS.md) — tests, commits, and lines of code at a glance.

**Contents:** [Packages](#packages) · [Quick Start](#quick-start) · [Features](#features) · [Browser support](#browser-support) · [Acknowledgements](#acknowledgements) · [License](#license)

## Packages

This monorepo publishes **four packages** to install — pick the one that fits your stack. A fifth, `dxf-interaction`, is shared internal plumbing the wrappers pull in automatically — you don't install it directly.

| Package                                        | Description                                                                        | Version                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`dxf-render`](packages/dxf-render/)           | Core engine — DXF parser + Three.js/WebGL renderer (parser-only entry for Node.js) | [![npm](https://img.shields.io/npm/v/dxf-render.svg)](https://www.npmjs.com/package/dxf-render)           |
| [`dxf-vuer`](packages/dxf-vuer/)               | Vue 3 `<DXFViewer>` component + composables                                        | [![npm](https://img.shields.io/npm/v/dxf-vuer.svg)](https://www.npmjs.com/package/dxf-vuer)               |
| [`dxf-react`](packages/dxf-react/)             | React 18+ `<DXFViewer>` component + hooks                                          | [![npm](https://img.shields.io/npm/v/dxf-react.svg)](https://www.npmjs.com/package/dxf-react)             |
| [`dxf-lit`](packages/dxf-lit/)                 | `<dxf-viewer>` Web Component — works in any stack                                  | [![npm](https://img.shields.io/npm/v/dxf-lit.svg)](https://www.npmjs.com/package/dxf-lit)                 |
| [`dxf-interaction`](packages/dxf-interaction/) | Shared interaction controllers — **internal**, used by the wrappers                | [![npm](https://img.shields.io/npm/v/dxf-interaction.svg)](https://www.npmjs.com/package/dxf-interaction) |

## Quick Start

### dxf-render — engine (vanilla or any framework)

```bash
npm install dxf-render three
```

```ts
import { parseDxf, createThreeObjectsFromDXF } from "dxf-render";

const dxf = parseDxf(dxfText);
const { group } = await createThreeObjectsFromDXF(dxf);
scene.add(group);
```

Parser-only (no Three.js needed):

```ts
import { parseDxf } from "dxf-render/parser";
const dxf = parseDxf(dxfText);
```

[Full documentation →](packages/dxf-render/)

<details>
<summary><b>Vue 3 — <code>dxf-vuer</code></b></summary>

<br>

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

</details>

<details>
<summary><b>React 18+ — <code>dxf-react</code></b></summary>

<br>

```bash
npm install dxf-react dxf-render three
```

```tsx
import { useState } from "react";
import { DXFViewer, parseDxf, type DxfData } from "dxf-react";
import "dxf-react/style.css";

export default function App() {
  const [dxfData, setDxfData] = useState<DxfData | null>(null);

  async function loadFile(file: File) {
    setDxfData(parseDxf(await file.text()));
  }

  return (
    <>
      <input
        type="file"
        accept=".dxf"
        onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
      />
      <DXFViewer dxfData={dxfData} showResetButton style={{ width: "100%", height: 600 }} />
    </>
  );
}
```

[Full documentation →](packages/dxf-react/)

</details>

<details>
<summary><b>Web Component — <code>dxf-lit</code></b></summary>

<br>

```bash
npm install dxf-lit dxf-render three
```

```html
<script type="module">
  import "dxf-lit";
</script>

<dxf-viewer
  url="/drawing.dxf"
  show-rulers
  show-layer-panel
  picking-enabled
  dark-theme
  style="height: 600px;"
></dxf-viewer>
```

[Full documentation →](packages/dxf-lit/)

</details>

## Features

### Engine (`dxf-render`)

- **22 DXF entity types** — LINE, CIRCLE, ARC, ELLIPSE, SPLINE, POLYLINE, LWPOLYLINE, TEXT, MTEXT, DIMENSION, HATCH, INSERT, SOLID, 3DFACE, LEADER, MULTILEADER, MLINE, XLINE, RAY, ATTDEF, HELIX, REGION (contour via HATCH boundary), plus ATTRIB within blocks
- **Variable-width polylines** — per-vertex `startWidth`/`endWidth` tapering, constant-width, arrows, donuts rendered as mesh geometry with miter joins
- **Standard arrowhead blocks** — DIMENSION endpoints and LEADER tips honour DIMBLK / DIMLDRBLK; all 18 stock AutoCAD blocks rendered with the correct shape (`_ClosedFilled`, `_Open*`, `_Dot*`, `_Origin*`, `_Box*`, `_Datum*`, `_ArchTick`, `_Integral`, `_None`, …)
- **Linetype rendering** — DASHED, HIDDEN, CENTER, PHANTOM, DOT, DASHDOT with LTSCALE support
- **Hatch patterns** — 29 built-in AutoCAD patterns with multi-boundary clipping
- **Vector text** — crisp at any zoom; Liberation Sans/Serif fonts; bold, italic, underline, overline, strikethrough; MTEXT inline scoped formatting (color/font/size/decoration inside `{…}` groups)
- **Picking & associations** — bbox-based raycast, hover/click events, semantic links derived from DXF (LEADER↔TEXT, INSERT+ATTRIB, MLEADER, DIMENSION, ACAD_GROUP)
- **Search APIs** — `findEntitiesByText` / `findEntitiesByLayer` / `findEntitiesByType`, paired with `zoomToEntity` / `zoomToLayer` for find-and-focus UX
- **Measurement math** — pure `measureDistance` / `measureArea` / `measurePerimeter` / `polygonSelfIntersects` / `measureAngle` / `measureDirectedAngle` utilities (2D/3D, Shoelace polygon area, self-intersection test, unsigned + directed angles)
- **Configurable antialiasing** — choose between MSAA (default, hardware), SMAA, FXAA, TAA, SSAA, or none
- **TypeScript** — strict types, full `.d.ts` declarations

### UI wrappers (`dxf-vuer` / `dxf-react` / `dxf-lit`)

- **Measurement tools** — interactive on-canvas distance (two-point ruler), area (N-point polygon with live area + perimeter), and angle (3-point, directed `[0°, 360°)` with reflex)
- **Dark theme** — instant switching
- **Layer panel** — toggle visibility with color indicators; optional `localStorage` persistence per file
- **Keyboard navigation** — arrow keys pan, `+`/`-` zoom, `0` reset
- **Accessibility** — ARIA roles/labels on toolbar, layer panel, status/error overlays; respects `prefers-reduced-motion`
- **Overlay positioning** — 6-cell grid system for positioning UI overlays (toolbar, coordinates, layers, etc.)
- **Customizable UI** — 6 named regions (toolbar, toolbar-extra, loading, error, empty-state, overlay) — slots in Vue/Lit, render-props in React
- **Customizable styling** — stable `.dxfk-*` hook classes with low specificity (Tailwind `@apply`-friendly), Headless UI-style `classes` prop, `--dxfk-*` CSS custom properties
- **Error display** — parse/render/fetch errors shown in the viewer with retry support
- **Debug overlay** — FPS, draw calls, lines, triangles
- **Zoom level** — percentage display relative to fit-to-view

## Browser support

Rendering requires **WebGL 2** (via Three.js) and runs in all current evergreen browsers — Chrome/Edge, Firefox, and Safari 15+. The parser itself is pure JavaScript with no DOM or WebGL dependency, so it also runs in **Node.js 20+** (import from `dxf-render/parser`). `three` is a peer dependency you install alongside; `opentype.js` is the only bundled runtime dependency.

## Acknowledgements

The DXF parser was inspired by [dxf-parser](https://github.com/gdsestimating/dxf-parser) by GDS Estimating, and has since been substantially rewritten — 22 entity types across 25 handlers, plus linetype/OCS/hatch systems and a comprehensive test suite.

## License

[MIT](LICENSE)
