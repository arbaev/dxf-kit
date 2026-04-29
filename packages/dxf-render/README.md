# dxf-render

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-render)](https://www.npmjs.com/package/dxf-render)
[![license](https://img.shields.io/npm/l/dxf-render)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Framework-agnostic DXF parser and Three.js renderer. Use with React, Svelte, vanilla JS, or any framework.

[Live Demo](https://dxf-vuer.netlify.app) — upload your DXF and see the rendering quality.

Try it now on StackBlitz: [Vanilla TS](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vanilla-ts?file=src/main.ts&title=dxf-render+Vanilla+TS) | [React](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/react?file=src/DxfViewer.tsx&title=dxf-render+React) | [Vue](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3) | [Leaflet + DXF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/leaflet-dxf?file=src/main.ts&title=dxf-render+Leaflet) | [DXF to PDF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/dxf-to-pdf?file=src/main.ts&title=dxf-render+PDF+Export)

For Vue 3 components, see the [dxf-vuer](https://www.npmjs.com/package/dxf-vuer) package.

## Why dxf-render?

- **Most entities** — 21 rendered types including all dimension variants, LEADER, MULTILEADER, MLINE
- **Variable-width polylines** — per-vertex tapering, arrows, donuts rendered as mesh with miter joins
- **Accurate rendering** — linetype patterns, OCS transforms, hatch patterns, proper color resolution
- **Picking & associations** — bbox-based raycast index plus DXF-driven entity links (LEADER↔TEXT, INSERT+ATTRIB, MLEADER, DIMENSION)
- **Two entry points** — full renderer or parser-only (zero deps, works in Node.js)
- **Battle-tested** — 923 tests covering parser, renderer, and utilities
- **Modern stack** — TypeScript native, ES modules, tree-shakeable, Vite-built
- **Framework-agnostic** — works with React, Svelte, Angular, vanilla JS, or any framework

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
  useControls,
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

const frustumSize = 100;
const aspect = myCanvas.clientWidth / myCanvas.clientHeight;
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ canvas: myCanvas });
renderer.setSize(myCanvas.clientWidth, myCanvas.clientHeight);

const { fitCameraToBox } = useCamera();
const { initControls } = useControls();

initControls(camera, myCanvas);
fitCameraToBox(new THREE.Box3().setFromObject(group), camera);
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

### React example

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useControls,
} from "dxf-render";

export function DxfViewer({ dxfText }: { dxfText: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

    const { fitCameraToBox } = useCamera();
    const { initControls } = useControls();
    let disposed = false;

    (async () => {
      await loadDefaultFont();
      const dxf = parseDxf(dxfText);
      const { group } = await createThreeObjectsFromDXF(dxf);
      if (disposed) return;

      scene.add(group);
      initControls(camera, canvas);

      const box = new THREE.Box3().setFromObject(group);
      fitCameraToBox(box, camera);
      renderer.render(scene, camera);
    })();

    return () => {
      disposed = true;
      renderer.dispose();
    };
  }, [dxfText]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "500px" }} />;
}
```

### Svelte example

```svelte
<script>
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import {
    parseDxf,
    createThreeObjectsFromDXF,
    loadDefaultFont,
    useCamera,
    useControls,
  } from "dxf-render";

  export let dxfText;

  let canvas;
  let renderer;

  onMount(async () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2, (frustumSize * aspect) / 2,
      frustumSize / 2, frustumSize / -2, 0.1, 1000,
    );

    const { fitCameraToBox } = useCamera();
    const { initControls } = useControls();

    await loadDefaultFont();
    const dxf = parseDxf(dxfText);
    const { group } = await createThreeObjectsFromDXF(dxf);

    scene.add(group);
    initControls(camera, canvas);

    const box = new THREE.Box3().setFromObject(group);
    fitCameraToBox(box, camera);
    renderer.render(scene, camera);
  });

  onDestroy(() => renderer?.dispose());
</script>

<canvas bind:this={canvas} style="width: 100%; height: 500px;" />
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
- `useControls(camera, domElement)` — pan/zoom controls (no rotation), mobile touch support
- `createRenderer({ aaMode })` — `WebGLRenderer` with the right `antialias` flag for the selected AA mode
- `createComposer({ aaMode, scene, camera, renderer })` — builds the post-processing pipeline (`EffectComposer` + AA pass + `OutputPass`); returns `{ composer: null }` for `msaa`/`none` (use `renderer.render()` directly)
- `isReducedMotionPreferred()` — `true` when the user has enabled "reduce motion" in their OS

### Antialiasing

Six modes available via `AntialiasingMode = "msaa" | "smaa" | "fxaa" | "taa" | "ssaa" | "none"`:

| Mode   | Use case                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `msaa` | Hardware multisampling (default). Crisp geometric edges, almost free runtime cost. Best for CAD with thin lines and text                                                           |
| `smaa` | Edge-detection post-processing. Cheap and works while panning. Note: may fade pixels at corners of 1px lines (line-art limitation)                                                 |
| `fxaa` | Cheapest fullscreen AA — single shader pass. Smooths edges but tends to blur thin lines and small text                                                                             |
| `taa`  | Temporal AA: 32 jittered frames accumulated when the camera stops. Smooth on static views; first frame after movement looks aliased. Skipped when `prefers-reduced-motion: reduce` |
| `ssaa` | Super-sampling: renders at higher resolution and downscales. Reference quality; expensive                                                                                          |
| `none` | No antialiasing. Maximum performance and pixel sharpness                                                                                                                           |

```ts
import * as THREE from "three";
import { createRenderer, createComposer, isReducedMotionPreferred } from "dxf-render";

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(/* ... */);
const renderer = createRenderer({ aaMode: "msaa" });
const { composer, taaPass } = createComposer({ aaMode: "msaa", scene, camera, renderer });

function render() {
  if (taaPass && composer) {
    taaPass.accumulateIndex = -1;
    composer.render();
    if (!isReducedMotionPreferred()) {
      // schedule next jittered frame via requestAnimationFrame...
    }
  } else if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
```

### Picking primitives

Framework-agnostic primitives for building hover/click interactivity. The Vue wrapper (`dxf-vuer`) is implemented on top of these.

```ts
import {
  buildPickingIndex,
  createPickingGroup,
  disposePickingGroup,
  buildEntityIndex,
  extractEntityText,
  buildAssociations,
} from "dxf-render";

const dxf = parseDxf(dxfText);

// 1. Per-entity bounding boxes (expands INSERTs, ATTRIBs, $INSUNITS, OCS)
const pickingIndex = buildPickingIndex(dxf);

// 2. Invisible THREE.Group of BoxGeometry meshes — one per entity
const pickingGroup = createPickingGroup(pickingIndex, originOffset);
scene.add(pickingGroup);

// 3. Resolve entity data and structural links by handle
const entityIndex = buildEntityIndex(dxf); // Map<handle, DxfEntity>
const associations = buildAssociations(dxf); // EntityAssociation[]
```

To zoom the camera to a set of entities, combine `getZoomBox()` with the `fitCameraToBox()` helper from `useCamera()`:

```ts
import { buildPickingIndex, getZoomBox, useCamera } from "dxf-render";

const pickingIndex = buildPickingIndex(dxf);
const { fitCameraToBox } = useCamera();

function zoomTo(handles: string[]) {
  const box = getZoomBox(pickingIndex, handles, { originOffset });
  if (box) fitCameraToBox(box, camera);
}
```

To raycast, temporarily flip the group's `visible` flag (it's `false` by default so it doesn't show up in normal rendering):

```ts
const raycaster = new THREE.Raycaster();
raycaster.setFromCamera(ndc, camera);

pickingGroup.visible = true;
const hits = raycaster.intersectObject(pickingGroup, true);
pickingGroup.visible = false;

if (hits.length > 0) {
  const handle = hits[0].object.userData.handle as string;
  const entity = entityIndex.get(handle);
  console.log("hit", handle, entity?.type, extractEntityText(entity!));
}
```

### Associations

`buildAssociations(dxf)` derives links between entities **strictly from DXF data**, no geometric heuristics:

| Kind            | How it's sourced                                          |
| --------------- | --------------------------------------------------------- |
| `mleader`       | MULTILEADER inline `contextData` text (DXF code 304)      |
| `leader`        | LEADER's `annotationHandle` (DXF code 340) → TEXT/MTEXT   |
| `block-attribs` | INSERT entity with one or more ATTRIB children            |
| `dimension`     | DIMENSION text override (or `actualMeasurement` fallback) |

```ts
interface EntityAssociation {
  id: string; // stable, e.g. "leader:B1"
  kind: AssociationKind; // 'mleader' | 'leader' | 'block-attribs' | 'dimension' | 'group'
  primary: string; // primary entity handle
  members: string[]; // all related handles, including primary
  text?: string;
  source: AssociationSource; // 'inline' | 'handle-ref' | 'attribs' | 'group-dict'
}
```

A handle can participate in multiple associations; index by member if you need reverse lookup:

```ts
import { buildAssociations } from "dxf-render";

const associations = buildAssociations(dxf);
const byHandle = new Map<string, typeof associations>();
for (const a of associations) {
  for (const m of a.members) {
    const list = byHandle.get(m) ?? [];
    list.push(a);
    byHandle.set(m, list);
  }
}

// "Given any entity, what is it linked to?"
const linkedToBd8 = byHandle.get("BD8");
```

> ACAD_GROUP entries from the DXF OBJECTS section are not parsed yet — that source is on the roadmap.

### Text search

`findEntitiesByText(dxf, query, options?)` is a pure utility that returns handles of all entities whose displayable text matches `query`. Searches TEXT, MTEXT, ATTRIB, ATTDEF, DIMENSION text override, and MULTILEADER inline text — across top-level entities, INSERT ATTRIBs, and entities inside blocks.

```ts
import { findEntitiesByText } from "dxf-render";

// Case-insensitive substring (default)
findEntitiesByText(dxf, "PART-001");

// Case-sensitive
findEntitiesByText(dxf, "PART-001", { caseSensitive: true });

// Regex
findEntitiesByText(dxf, "^PART-\\d+$", { regex: true });
```

Returns `string[]` of DXF handles. Pair with the picking primitives + a camera helper for find-and-focus UX:

```ts
const found = findEntitiesByText(dxf, "PART-001");
const box = getZoomBox(pickingIndex, found, { originOffset });
if (box) fitCameraToBox(box, camera);
```

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

POLYLINE/LWPOLYLINE support includes per-vertex variable width (tapering), constant-width segments, arrows, donuts, and bulge arcs — all rendered as triangle-strip mesh geometry with proper miter joins at corners.

## Comparison

| Feature                   | dxf-render                  | dxf-viewer   | dxf-parser | three-dxf |
| ------------------------- | --------------------------- | ------------ | ---------- | --------- |
| DXF parsing               | ✅                          | ✅           | ✅         | ✅        |
| Three.js rendering        | ✅                          | ✅           | ❌         | ✅        |
| Entity types              | 21 rendered                 | ~15          | ~15 parsed | ~8        |
| Variable-width polylines  | ✅ tapering, arrows, donuts | ❌           | —          | ❌        |
| Linetype patterns         | ✅ DASHED, CENTER, DOT...   | ❌ all solid | —          | ❌        |
| All dimension types       | ✅ 7 types                  | linear only  | —          | ❌        |
| LEADER / MULTILEADER      | ✅                          | ❌           | —          | ❌        |
| HATCH patterns            | ✅ 25 built-in              | ✅           | —          | ❌        |
| OCS (Arbitrary Axis)      | ✅ full                     | Z-flip only  | —          | ❌        |
| Vector text (opentype.js) | ✅                          | ✅           | —          | ❌        |
| Geometry merging          | ✅                          | ✅           | —          | ❌        |
| Dark theme                | ✅ instant switch           | bg only      | —          | ❌        |
| TypeScript                | ✅ native                   | .d.ts        | ✅         | ❌        |
| Tests                     | 923 tests                   | 0            | ✅         | 0         |
| Web Worker parsing        | ✅                          | ✅           | ❌         | ❌        |
| Parser-only entry         | ✅ zero deps                | ❌           | ✅         | ❌        |
| Framework                 | agnostic                    | agnostic     | —          | agnostic  |
| Bundle size               | ~960KB                      | ~1.2MB       | ~50KB      | ~30KB     |
| Last updated              | 2026                        | 2024         | 2023       | 2019      |

## Bundle sizes

| File         | Size    | Note                                         |
| ------------ | ------- | -------------------------------------------- |
| Main bundle  | ~960 KB | Includes font + opentype.js + inline worker  |
| Parser chunk | ~50 KB  | Zero dependencies                            |
| Serif font   | ~525 KB | Lazy-loaded only when serif fonts referenced |

## License

MIT
