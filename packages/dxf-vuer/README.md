# dxf-vuer

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![license](https://img.shields.io/npm/l/dxf-vuer)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Vue 3 component for viewing DXF files in the browser. Thin wrapper around [dxf-render](https://www.npmjs.com/package/dxf-render).

[Live Demo](https://dxf-vuer.netlify.app) | [GitHub](https://github.com/arbaev/dxf-kit) | [Open in StackBlitz](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3)

![screenshot](https://raw.githubusercontent.com/arbaev/dxf-kit/main/docs/dxf-kit-basic-patterns.jpg)

## Installation

```bash
npm install dxf-vuer dxf-render three
```

Peer dependencies: `vue >= 3.4`, `three >= 0.160`, `dxf-render >= 1.0.0`.

## Quick Start

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

## Components

| Component             | Description                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `DXFViewer`           | Main viewer: Three.js scene, layer panel, toolbar, error display, drag-and-drop, dark theme, slots |
| `ViewerToolbar`       | Toolbar with export, fit-to-view, fullscreen buttons. Has `#extra` slot for custom buttons         |
| `FileUploader`        | File input button. Emits `file-selected` with `File`                                               |
| `LayerPanel`          | Collapsible layer visibility panel with color indicators                                           |
| `UnsupportedEntities` | Collapsible list of unsupported entity types                                                       |
| `DXFStatistics`       | File statistics (entities, layers, blocks, AutoCAD version)                                        |

## DXFViewer Props

| Prop                   | Type               | Default           | Description                                                                                                                                                             |
| ---------------------- | ------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dxfData`              | `DxfData \| null`  | `null`            | Parsed DXF data object                                                                                                                                                  |
| `fileName`             | `string`           | `""`              | File name displayed in the viewer                                                                                                                                       |
| `url`                  | `string`           | `""`              | URL to fetch and display a DXF file                                                                                                                                     |
| `showResetButton`      | `boolean`          | `false`           | Show fit-to-view button                                                                                                                                                 |
| `showFullscreenButton` | `boolean`          | `true`            | Show fullscreen toggle button                                                                                                                                           |
| `showExportButton`     | `boolean`          | `false`           | Show export-to-PNG button                                                                                                                                               |
| `showFileName`         | `boolean`          | `true`            | Show file name overlay                                                                                                                                                  |
| `showCoordinates`      | `boolean`          | `false`           | Show cursor world coordinates on hover                                                                                                                                  |
| `showZoomLevel`        | `boolean`          | `false`           | Show zoom percentage (100% = fit-to-view)                                                                                                                               |
| `showDebugInfo`        | `boolean`          | `false`           | Show debug overlay (FPS, draw calls, lines, triangles)                                                                                                                  |
| `showLayerPanel`       | `boolean`          | `true`            | Show the layers panel (auto-hidden when the drawing has no layers)                                                                                                      |
| `allowDrop`            | `boolean`          | `false`           | Enable drag-and-drop file loading                                                                                                                                       |
| `darkTheme`            | `boolean`          | `false`           | Dark theme for viewer and scene                                                                                                                                         |
| `autoFit`              | `boolean`          | `true`            | Auto-fit camera to drawing on load                                                                                                                                      |
| `antialiasing`         | `AntialiasingMode` | `"msaa"`          | Anti-aliasing mode (init-time only — recreate the component via `:key` to switch)                                                                                       |
| `fontUrl`              | `string`           | `""`              | Custom font URL for text rendering                                                                                                                                      |
| `fileNamePosition`     | `OverlayPosition`  | `"top-left"`      | Position of file name overlay                                                                                                                                           |
| `toolbarPosition`      | `OverlayPosition`  | `"top-right"`     | Position of toolbar                                                                                                                                                     |
| `coordinatesPosition`  | `OverlayPosition`  | `"bottom-left"`   | Position of coordinates overlay                                                                                                                                         |
| `debugPosition`        | `OverlayPosition`  | `"bottom-center"` | Position of debug overlay                                                                                                                                               |
| `layerPanelPosition`   | `OverlayPosition`  | `"bottom-right"`  | Position of layer panel                                                                                                                                                 |
| `overlayPosition`      | `OverlayPosition`  | `"top-center"`    | Position of `#overlay` slot content                                                                                                                                     |
| `pickingEnabled`       | `boolean`          | `false`           | Enable hover/click events + raycasting (off by default — opt-in to interactivity)                                                                                       |
| `highlightOnHover`     | `boolean`          | `true`            | Draw a built-in highlight overlay on the hovered entity. Turn off if you render selection from your own UI                                                              |
| `highlightAssociated`  | `boolean`          | `true`            | When the hovered entity participates in an association (MLEADER / LEADER+TEXT / INSERT+ATTRIB / DIMENSION), highlight all its members instead of just the entity itself |
| `highlightColor`       | `string`           | `"#ffaa00"`       | Color used by the built-in hover highlight                                                                                                                              |

`OverlayPosition` = `"top-left"` | `"top-center"` | `"top-right"` | `"bottom-left"` | `"bottom-center"` | `"bottom-right"`

`AntialiasingMode` = `"msaa"` | `"smaa"` | `"fxaa"` | `"taa"` | `"ssaa"` | `"none"`

| Mode   | Description                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `msaa` | Hardware multisample antialiasing (default). Crisp geometric edges, almost free runtime cost. Best for CAD with thin lines and text                             |
| `smaa` | Edge-detection post-processing AA. Cheap and works while panning. **Note:** can fade pixels at corners of 1px lines — known limitation when applied to line art |
| `fxaa` | Cheapest fullscreen AA — single shader pass. Smooths edges but tends to blur thin lines and small text                                                          |
| `taa`  | Temporal AA: accumulates 32 jittered frames after the camera stops. Very smooth on static views; first frame after movement looks aliased                       |
| `ssaa` | Super-sampling: renders at higher resolution and downscales. Reference quality; expensive — not recommended for interactive use on large drawings               |
| `none` | No antialiasing. Maximum performance and pixel sharpness, with visible staircase aliasing on diagonals                                                          |

`antialiasing` is init-time only — the renderer is built once with the chosen mode. To let users switch at runtime, recreate `<DXFViewer>` via Vue's `:key` attribute:

```vue
<DXFViewer :key="aaMode" :antialiasing="aaMode" :dxf-data="dxfData" />
```

## DXFViewer Slots

| Slot             | Scoped data                                                  | Description                                            |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `#toolbar`       | `{ resetView, exportToPNG, toggleFullscreen, isFullscreen }` | Replace entire toolbar                                 |
| `#toolbar-extra` | —                                                            | Add buttons to the existing toolbar                    |
| `#loading`       | `{ phase, progress }`                                        | Replace loading screen                                 |
| `#error`         | `{ message, retry }`                                         | Replace error screen                                   |
| `#empty-state`   | —                                                            | Replace "Select a DXF file" placeholder                |
| `#overlay`       | `{ zoomPercent, cursorX, cursorY }`                          | Custom overlay (positioned via `overlayPosition` prop) |

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

| Event                  | Payload                | Description                                                                          |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| `dxf-loaded`           | `boolean`              | Emitted after load attempt (true = success)                                          |
| `dxf-data`             | `DxfData \| null`      | Parsed DXF data or null on error                                                     |
| `error`                | `string`               | Error message on parse/render/fetch failure                                          |
| `unsupported-entities` | `string[]`             | List of unsupported entity types found                                               |
| `reset-view`           | —                      | Emitted when view is reset to fit                                                    |
| `file-dropped`         | `string`               | File name when a file is dropped                                                     |
| `entity-hover`         | `PickingEvent \| null` | Hover changed (only when `pickingEnabled`). `null` when the cursor leaves the entity |
| `entity-click`         | `PickingEvent`         | Tap on an entity. Mousedown→up that moves more than 4px is treated as pan, not click |

## DXFViewer Methods (via `ref`)

| Method                                     | Description                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `loadDXFFromText(text: string)`            | Load from a DXF string                                                                      |
| `loadDXFFromData(data: DxfData)`           | Load already-parsed DXF data                                                                |
| `loadDXFFromUrl(url: string)`              | Fetch and load from a URL                                                                   |
| `loadDXFFromBuffer(buffer: ArrayBuffer)`   | Load from an ArrayBuffer (auto-decodes UTF-8 / UTF-16 LE/BE by BOM)                         |
| `loadDXFFromBlob(blob: Blob)`              | Load from a Blob (storage SDKs, drag-and-drop, fetch().blob())                              |
| `resize()`                                 | Trigger viewer resize                                                                       |
| `resetView()`                              | Fit camera to drawing                                                                       |
| `exportToPNG()`                            | Trigger PNG download                                                                        |
| `getRenderer()`                            | Access the underlying Three.js `WebGLRenderer`                                              |
| `highlight(handles: string[])`             | Draw the highlight overlay over the listed entities (e.g. when an external UI selects them) |
| `clearHighlight()`                         | Remove all highlight overlays                                                               |
| `getAssociations()`                        | Return all `EntityAssociation[]` derived from the loaded DXF                                |
| `findAssociationsByHandle(handle: string)` | Return all associations a given handle participates in                                      |
| `zoomToEntity(handles: string[])`          | Fit the camera to the union of the entities' bboxes, with 20% padding. Requires `pickingEnabled` |
| `getPickingIndex()`                        | Returns the underlying `PickingIndex \| null`. Useful for filtering external search results (e.g. from `findEntitiesByText`) to entities that are actually rendered in the scene |

```vue
<script setup>
import { ref } from "vue";
import { DXFViewer } from "dxf-vuer";

const viewer = ref(null);

async function loadFromStorage() {
  const blob = await fetch("https://storage.example.com/file.dxf").then((r) => r.blob());
  viewer.value.loadDXFFromBlob(blob);
}
</script>

<template>
  <DXFViewer ref="viewer" />
</template>
```

## Picking & Associations

Picking lets users hover and click individual DXF entities. Each picking event is optionally enriched with an `association` — a structural link between entities that exists **inside the DXF data itself** (no geometric heuristics).

### Enabling picking

Picking is opt-in. Turn it on with `pickingEnabled`:

```
<DXFViewer
  :dxf-data="dxfData"
  picking-enabled
  @entity-hover="onHover"
  @entity-click="onClick"
/>
```

Both events fire with a `PickingEvent`:

```ts
interface PickingEvent {
  handle: string; // DXF handle, e.g. "BD8"
  pickId?: string; // unique pick id (distinguishes INSERT instances of the same block)
  type: string; // "LINE", "MTEXT", "INSERT", ...
  layer: string;
  text?: string; // shortcut: association.text ?? entity text
  entity?: DxfEntity; // raw parsed entity
  association?: EntityAssociation; // see below
}
```

### How highlighting works

The viewer ships a built-in yellow bbox overlay. Three props control it:

| Prop                  | Effect                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pickingEnabled`      | Master switch. When `false`, no events are emitted and no highlight is drawn                                                                                                                                                            |
| `highlightOnHover`    | When `true`, the viewer draws the highlight overlay on hover. Turn it **off** if you render selection from your own UI (e.g. AG Grid) and only need the events                                                                          |
| `highlightAssociated` | When `true` (default), hovering an entity that participates in an association highlights **all members** (e.g. LEADER + linked MTEXT). When `false`, only the hovered entity is highlighted. Has no effect if `highlightOnHover` is off |

### Associations

`buildAssociations(dxf)` (re-exported from `dxf-render`) extracts these links:

| Kind            | Source                                                    | Members                    |
| --------------- | --------------------------------------------------------- | -------------------------- |
| `mleader`       | MULTILEADER inline `contextData` text                     | the MULTILEADER itself     |
| `leader`        | LEADER ↔ TEXT/MTEXT via DXF code 340 (`annotationHandle`) | LEADER + annotation entity |
| `block-attribs` | INSERT with one or more ATTRIB children                   | INSERT + all ATTRIBs       |
| `dimension`     | DIMENSION text override or `actualMeasurement`            | the DIMENSION itself       |

Real-world note: not every LEADER in a DXF carries the 340 link — it's optional in
the format. `buildAssociations` deliberately doesn't guess via geometry; a future
opt-in spatial heuristic is on the [roadmap](https://github.com/arbaev/dxf-kit/blob/main/todo/roadmap.md).

### Example: console-logging hovers and clicks

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DXFViewer } from "dxf-vuer";
import type { PickingEvent } from "dxf-vuer";
import "dxf-vuer/style.css";

const dxfData = ref(null);

function onHover(e: PickingEvent | null) {
  if (!e) return;
  console.log("hover", e.type, e.handle, e.text, e.association?.kind);
}

function onClick(e: PickingEvent) {
  if (e.association) {
    console.log(
      `Clicked ${e.type}, part of ${e.association.kind} (${e.association.members.length} members)`,
    );
  }
}
</script>

<template>
  <DXFViewer :dxf-data="dxfData" picking-enabled @entity-hover="onHover" @entity-click="onClick" />
</template>
```

### Example: bidirectional sync with an external grid

Useful when the same data is shown both in the viewer and in a table (AG Grid, custom list, etc). The viewer drives the grid via events; the grid drives the viewer via the imperative `highlight()` method.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { DXFViewer } from "dxf-vuer";
import type { PickingEvent } from "dxf-vuer";

const viewer = ref<InstanceType<typeof DXFViewer> | null>(null);
const dxfData = ref(null);
const selectedHandle = ref<string | null>(null);

// 1. Viewer → external state
function onClick(e: PickingEvent) {
  selectedHandle.value = e.handle;
  // ... call your grid's selectByKey() or scroll-into-view here
}

// 2. External state → viewer (call this from a grid row-click handler)
function selectFromGrid(handle: string) {
  selectedHandle.value = handle;
  const all = viewer.value?.findAssociationsByHandle(handle) ?? [];
  // highlight the entity itself plus everything it's associated with,
  // and pan/zoom the camera so the user can see what was selected.
  const handles = all.length > 0 ? Array.from(new Set(all.flatMap((a) => a.members))) : [handle];
  viewer.value?.highlight(handles);
  viewer.value?.zoomToEntity(handles);
}
</script>

<template>
  <DXFViewer
    ref="viewer"
    :dxf-data="dxfData"
    picking-enabled
    :highlight-on-hover="false"
    @entity-click="onClick"
  />
</template>
```

### Example: find-and-zoom (text search)

`findEntitiesByText` is re-exported from `dxf-render`. Combine it with the
viewer's imperative API for a "find in drawing" UX:

```ts
import { findEntitiesByText } from 'dxf-vuer'

function search(query: string) {
  const dxf = viewer.value!.getRenderer ? /* your loaded DxfData */ : null
  if (!dxf) return
  const found = findEntitiesByText(dxf, query) // case-insensitive substring

  // Optionally drop matches that aren't visible (e.g. text inside
  // unreferenced blocks left over by AutoCAD).
  const index = viewer.value!.getPickingIndex()
  const visible = index ? found.filter((h) => index.byHandle.has(h)) : found

  viewer.value!.highlight(visible)
  viewer.value!.zoomToEntity(visible)
}
```

`findEntitiesByText` accepts `{ caseSensitive: true }` or `{ regex: true }`.

### Example: list every association in the file

Handy for sanity-checking a DXF or building a "Notes" panel:

```ts
const all = viewer.value!.getAssociations();

const byKind = all.reduce<Record<string, number>>((acc, a) => {
  acc[a.kind] = (acc[a.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(byKind); // { mleader: 1, leader: 3, 'block-attribs': 18, dimension: 127 }

// Highlight the very first MLEADER in the drawing
const firstMleader = all.find((a) => a.kind === "mleader");
if (firstMleader) viewer.value!.highlight(firstMleader.members);
```

> Picking is implemented as an invisible bbox group on the scene — entities are
> picked by their bounding box, not by exact geometry. Tradeoff: very fast and
> framework-agnostic, but the highlight is a rectangle, not a precise outline.
> Precise per-geometry highlighting is on the roadmap.

## Accessibility

- **`prefers-reduced-motion`** — when the user has enabled "reduce motion" in their OS, the TAA antialiasing mode renders a single frame without the 32-frame jitter accumulation animation. Other AA modes are unaffected.

## Composables

| Composable       | Description                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDXFRenderer` | Main orchestrator: parsing, display, resize, layer visibility, dark theme                                                                                                                           |
| `useThreeScene`  | Three.js scene/renderer init with configurable antialiasing (MSAA/SMAA/FXAA/TAA/SSAA/none)                                                                                                          |
| `useLayers`      | Layer visibility state management                                                                                                                                                                   |
| `usePicking`     | Builds the picking index + associations, wires pointer listeners to a canvas, emits enriched `PickingEvent`s. Exposes `installPickingData`, `attach`, `getAssociations`, `findAssociationsByHandle` |
| `useHighlight`   | Manages an overlay group of LineSegments per highlighted bbox. `init`, `setColor`, `highlight(entries)`, `clear`, `dispose`                                                                         |

## Re-exports

`dxf-vuer` re-exports everything from `dxf-render` for convenience:

```ts
// All dxf-render exports available directly from dxf-vuer
import { parseDxf, createThreeObjectsFromDXF, resolveEntityColor } from "dxf-vuer";
```

For the full API of parser and renderer, see the [dxf-render documentation](https://www.npmjs.com/package/dxf-render).

## Migration from v1.x

Most imports work unchanged. Key changes:

- **Install**: `npm install dxf-vuer dxf-render three` (new `dxf-render` peer dep)
- **Parser entry**: `dxf-vuer/parser` → `dxf-render/parser`
- All other imports from `dxf-vuer` continue to work via re-exports

## License

MIT
