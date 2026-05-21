# dxf-vuer

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![npm downloads](https://img.shields.io/npm/dm/dxf-vuer)](https://www.npmjs.com/package/dxf-vuer)
[![license](https://img.shields.io/npm/l/dxf-vuer)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Vue 3 component for viewing DXF files in the browser. Thin wrapper around [dxf-render](https://www.npmjs.com/package/dxf-render).

[Live Demo](https://dxf-kit.netlify.app) | [GitHub](https://github.com/arbaev/dxf-kit) | [Open in StackBlitz](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3)

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
| `keyboardNavigation`   | `boolean`          | `true`            | Enable keyboard pan/zoom (arrow keys, `+`/`-`, `0`). Listener fires only when the canvas is focused                                                                     |
| `persistLayersKey`     | `string`           | `""`              | When set, layer visibility is persisted to `localStorage` under `${persistLayersKey}:${fileName \|\| "default"}`. Empty string disables persistence                     |
| `classes`              | `ViewerClasses`    | `{}`              | Headless UI-style class map. Each key adds a class onto the matching `.dxfk-*` root element (e.g. `{ toolbar: 'my-toolbar' }`). See [Customizing styles](#customizing-styles) |
| `showRulers`           | `boolean`          | `false`           | Show horizontal + vertical rulers along the top/left edges of the canvas with adaptive tick density, cursor marker, and a corner unit badge                              |
| `rulerUnits`           | `RulerUnits`       | `"mm"`            | Units displayed on ruler tick labels. `"mm"`/`"inch"` convert via `$INSUNITS`; on a Unitless file (`$INSUNITS=0`) raw values are treated as the chosen unit 1:1          |

`OverlayPosition` = `"top-left"` | `"top-center"` | `"top-right"` | `"bottom-left"` | `"bottom-center"` | `"bottom-right"`

`RulerUnits` = `"dxf-units"` | `"mm"` | `"inch"`

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
    <button class="dxfk-toolbar-button" @click="print">Print</button>
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
| `zoomToLayer(layerName: string)`           | Fit the camera to all entities on the given layer. Requires `pickingEnabled`. Layer names are case-sensitive (DXF spec) |
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

For layer-based or type-based focus, the matching helpers are `findEntitiesByLayer` and `findEntitiesByType` (also re-exported from `dxf-render`); pair them with `zoomToLayer` / `highlight`:

```ts
import { findEntitiesByType } from 'dxf-vuer'

// Highlight every dimension on the drawing
viewer.value!.highlight(findEntitiesByType(dxf, 'DIMENSION'))

// Or focus the camera on the WALLS layer (no need to gather handles yourself)
viewer.value!.zoomToLayer('WALLS')
```

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

- **Keyboard navigation** — when `keyboardNavigation` is on (default), the canvas becomes focusable (`tabindex="0"`) and responds to:

  | Keys             | Action                       |
  | ---------------- | ---------------------------- |
  | `←` `↑` `→` `↓`  | Pan by 5% of the viewport    |
  | `+` / `=`        | Zoom in (×1.2)               |
  | `-` / `_`        | Zoom out (÷1.2)              |
  | `0`              | Reset to fit-to-view         |

  Listener bails out when the focused element is an `<input>`, `<textarea>`, or `contenteditable` so it never steals keystrokes from forms inside `#toolbar-extra` or `#overlay`.

- **ARIA** — viewer container exposes `role="region"` + `aria-label` and reflects `aria-busy` while loading. Toolbar is `role="toolbar"`; buttons carry per-action `aria-label`, fullscreen toggle has `aria-pressed`. Layer panel header is keyboard-activatable (Enter/Space) with `aria-expanded`; per-layer toggles are `role="button"` with `aria-pressed` / `aria-disabled`. Loading overlay is `role="status" aria-live="polite"`; error overlay is `role="alert" aria-live="assertive"`.

- **`prefers-reduced-motion`** — when the user has enabled "reduce motion" in their OS, the TAA antialiasing mode renders a single frame without the 32-frame jitter accumulation animation. Other AA modes are unaffected.

## Persisting layer visibility

Set `persistLayersKey` to enable per-file persistence in `localStorage`:

```vue
<DXFViewer
  :dxf-data="dxfData"
  :file-name="currentFileName"
  persist-layers-key="my-app:layers"
/>
```

Hidden layer names are stored under `${persistLayersKey}:${fileName || "default"}`. Different files keep separate visibility configurations. Stored names that no longer exist in the current DXF are silently ignored, so changing files between sessions is safe. Frozen layers are never persisted (they're already hidden by DXF flags).

## Rulers

Set `showRulers` to render a horizontal ruler along the top edge of the canvas and a vertical ruler along the left edge. Both stay synchronized with pan / zoom, ticks adapt density based on the current zoom level, and a cursor marker (a line in `--dxfk-ruler-cursor`) tracks the mouse position on both axes.

```vue
<DXFViewer
  :dxf-data="dxfData"
  :show-rulers="true"
  ruler-units="mm"
/>
```

The 24×24 top-left corner shows the active unit label (`mm` / `in` / `—`).

### `rulerUnits`

| Value         | Conversion                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `"dxf-units"` | None — raw DXF values, corner badge shows `—`                                                              |
| `"mm"` (default) | `value × UNITS_TO_MM[$INSUNITS]`; for a Unitless file (`$INSUNITS = 0`) raw values are treated as mm 1:1 |
| `"inch"`      | Same as `"mm"`, then divided by 25.4                                                                       |

### Caveats

- **Unitless files (`$INSUNITS = 0`)** — the conversion factor is unknown, so `mm` / `inch` fall back to 1:1. Switching between the three modes changes the corner label but the numbers stay identical. If you know the intended unit out-of-band, just pick the right `rulerUnits` and the badge will read correctly.
- **Ruler ticks ≠ dimension labels.** The rulers show the actual coordinates of the geometry. Dimension entities (DIMENSION / MULTILEADER) can carry a `DIMLFAC` multiplier and may display measured lengths that don't equal the geometric distance. The discrepancy is a property of the DXF file, not a ruler bug.
- The cursor marker uses the same NDC → world math as `showCoordinates`, so the marker position always agrees with the X/Y readout in the coordinates overlay.

### Styling

CSS custom properties (override in `:root` or under `.dxfk-dark`):

| Variable                  | Default (light) | Default (dark) | Purpose                                   |
| ------------------------- | --------------- | -------------- | ----------------------------------------- |
| `--dxfk-ruler-size`       | `24px`          | `24px`         | Thickness of both rulers + corner badge   |
| `--dxfk-ruler-bg`         | `#fafafa`       | `#1f1f1f`      | Ruler background                          |
| `--dxfk-ruler-text`       | `#333`          | `#ddd`         | Tick label color                          |
| `--dxfk-ruler-tick`       | `#999`          | `#888`         | Tick lines + inner separator              |
| `--dxfk-ruler-cursor`     | `#1040b0`       | `#ffaa00`      | Cursor marker line                        |

Hook classes (low-specificity, safe to override with plain CSS or Tailwind `@apply`):

| Class                  | Element                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `.dxfk-ruler-h`        | Horizontal ruler container (top edge of canvas)               |
| `.dxfk-ruler-v`        | Vertical ruler container (left edge of canvas)                |
| `.dxfk-ruler-corner`   | 24×24 corner badge showing the unit label                     |

For per-instance class injection, use the `rulerHorizontal` / `rulerVertical` / `rulerCorner` keys in [`classes`](#3-classes-prop-headless-ui-style).

### Layout impact

When `showRulers` is on, the overlay grid receives `padding-top: 24px; padding-left: 24px` so existing overlays (file name, coordinates, debug, toolbar) don't sit underneath the rulers. The canvas itself stays full-size — picking, coordinates, and all NDC math are unchanged. The rulers are just overlays painted on top.

## Customizing styles

`dxf-vuer` exposes three layers of style customization, ordered from least to most invasive. Pick the one that matches your toolchain.

### 1. CSS custom properties

All built-in styles use `--dxfk-*` custom properties with inline `var(..., fallback)` so the components work without importing `dxf-vuer/style.css`. To recolor or rescale globally, override on `:root` or any wrapper container:

```css
:root {
  --dxfk-primary-color: #ff6600;
  --dxfk-border-radius: 8px;
  --dxfk-bg-color: #fafafa;
}
```

Available variables:

| Variable                    | Default     | Used for                                                |
| --------------------------- | ----------- | ------------------------------------------------------- |
| `--dxfk-primary-color`      | `#1040b0`   | Spinner, progress bar, drop zone border, focus rings    |
| `--dxfk-error-color`        | `#f44336`   | Error icon                                              |
| `--dxfk-bg-color`           | `#fafafa`   | Viewer background, DXFStatistics background             |
| `--dxfk-text-color`         | `#212121`   | Primary text                                            |
| `--dxfk-text-secondary`     | `#757575`   | Muted text, labels, captions                            |
| `--dxfk-border-color`       | `#e0e0e0`   | Borders, dividers                                       |
| `--dxfk-border-radius`      | `4px`       | All rounded corners                                     |
| `--dxfk-spacing-xs/sm/md/lg`| `4/8/16/24` | Internal paddings/margins                               |

### 2. Hook classes

Every overlay and component root carries a stable `.dxfk-*` class with **single-class selectors only** (no nesting, low specificity), so you can override them with one declaration and they play nicely with Tailwind `@apply` or scoped global styles.

Stable hook classes:

| Class                          | Element                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `.dxfk-viewer`                 | Root container of `DXFViewer`                                |
| `.dxfk-toolbar`                | Root of `ViewerToolbar`                                      |
| `.dxfk-toolbar-button`         | Each button inside the toolbar                               |
| `.dxfk-layer-panel`            | Root of `LayerPanel`                                         |
| `.dxfk-layer-panel-header`     | Layer panel header (the collapsible bar)                     |
| `.dxfk-layer-panel-action`     | All / None buttons                                           |
| `.dxfk-layer-filter`           | Layer filter `<input>`                                       |
| `.dxfk-layer-item`             | One row per layer                                            |
| `.dxfk-file-uploader`          | Root of `FileUploader`                                       |
| `.dxfk-file-uploader-button`   | Upload button inside `FileUploader`                          |
| `.dxfk-statistics`             | Root of `DXFStatistics`                                      |
| `.dxfk-unsupported`            | Root of `UnsupportedEntities` (amber warning palette)        |
| `.dxfk-file-name-overlay`      | File name display                                            |
| `.dxfk-coordinates-overlay`    | Cursor X/Y + zoom overlay                                    |
| `.dxfk-debug-overlay`          | FPS / draw calls / triangles overlay                         |
| `.dxfk-loading-overlay`        | Loading screen                                               |
| `.dxfk-error-overlay`          | Error screen                                                 |
| `.dxfk-drop-overlay`           | Drag-and-drop target                                         |
| `.dxfk-ruler-h`                | Horizontal ruler (top edge of canvas) — gated by `showRulers`|
| `.dxfk-ruler-v`                | Vertical ruler (left edge of canvas) — gated by `showRulers` |
| `.dxfk-ruler-corner`           | 24×24 badge in the top-left corner showing the unit label    |
| `.dxfk-dark`                   | Modifier — added to `.dxfk-viewer` / `.dxfk-toolbar` / `.dxfk-layer-panel` / `.dxfk-ruler-*` when `darkTheme` is on |

These class names are part of the public API — they won't change between patch / minor versions.

Plain CSS:

```css
.dxfk-toolbar-button {
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
```

Tailwind `@apply` works because the default selectors have specificity `0,1,0`:

```css
.dxfk-toolbar {
  @apply gap-2 rounded-xl bg-white/90 backdrop-blur;
}
.dxfk-toolbar-button {
  @apply border-slate-200 shadow-md hover:border-blue-500;
}
```

### 3. `classes` prop (Headless UI-style)

For utility-CSS workflows (Tailwind / UnoCSS) or for per-instance namespacing without writing global selectors, pass a `classes` map. Each key concatenates onto the matching `.dxfk-*` root element:

```vue
<DXFViewer
  :dxf-data="dxfData"
  :classes="{
    root: 'rounded-2xl shadow-xl',
    toolbar: 'gap-2',
    layerPanel: 'bg-white/95 backdrop-blur',
    loadingOverlay: 'bg-slate-900/60',
    errorOverlay: 'bg-rose-50/95'
  }"
/>
```

Available keys (`ViewerClasses` interface, all optional):

| Key                  | Maps to                                      |
| -------------------- | -------------------------------------------- |
| `root`               | `.dxfk-viewer`                               |
| `toolbar`            | `.dxfk-toolbar` (the default `ViewerToolbar`)|
| `layerPanel`         | `.dxfk-layer-panel`                          |
| `fileNameOverlay`    | `.dxfk-file-name-overlay`                    |
| `coordinatesOverlay` | `.dxfk-coordinates-overlay`                  |
| `debugOverlay`       | `.dxfk-debug-overlay`                        |
| `loadingOverlay`     | `.dxfk-loading-overlay`                      |
| `errorOverlay`       | `.dxfk-error-overlay`                        |
| `dropOverlay`        | `.dxfk-drop-overlay`                         |
| `emptyStateOverlay`  | Empty-state `.dxfk-message-overlay`          |
| `rulerHorizontal`    | `.dxfk-ruler-h`                              |
| `rulerVertical`      | `.dxfk-ruler-v`                              |
| `rulerCorner`        | `.dxfk-ruler-corner`                         |

Standalone components (`FileUploader`, `UnsupportedEntities`, `DXFStatistics`, `LayerPanel`, `ViewerToolbar`) accept a regular `class` attribute thanks to Vue's class fallthrough — no separate `classes` prop is needed when you compose them yourself:

```vue
<ViewerToolbar class="my-toolbar" />
<LayerPanel class="my-layers" :layers="layers" />
```

### Migration from v2.x

In v3.0 every public class was renamed from `dxf-*` / `viewer-*` / `layer-*` to a unified `.dxfk-*` prefix, and CSS variables moved from `--dxf-vuer-*` to `--dxfk-*`. The prefix is framework-neutral so future `dxf-react` / web-component wrappers share the same surface. Rename one-to-one in your overrides:

| v2.x                       | v3.0                            |
| -------------------------- | ------------------------------- |
| `--dxf-vuer-primary-color` | `--dxfk-primary-color`          |
| `--dxf-vuer-bg-color`      | `--dxfk-bg-color`               |
| `--dxf-vuer-spacing-md`    | `--dxfk-spacing-md` _(etc.)_    |
| `.dxf-viewer`              | `.dxfk-viewer`                  |
| `.viewer-toolbar`          | `.dxfk-toolbar`                 |
| `.toolbar-button`          | `.dxfk-toolbar-button`          |
| `.layer-panel`             | `.dxfk-layer-panel`             |
| `.layer-panel-header`      | `.dxfk-layer-panel-header`      |
| `.layer-item`              | `.dxfk-layer-item`              |
| `.action-btn` (All / None) | `.dxfk-layer-panel-action`      |
| `.file-uploader`           | `.dxfk-file-uploader`           |
| `.file-button`             | `.dxfk-file-uploader-button`    |
| `.dxf-statistics`          | `.dxfk-statistics`              |
| `.unsupported-entities`    | `.dxfk-unsupported`             |
| `.dark-theme`              | `.dxfk-dark`                    |

Dark-theme styling no longer relies on `::v-deep` / `:deep()` reaching into `ViewerToolbar` / `LayerPanel` — those components now receive `darkTheme` as a prop and own their dark styles locally. If you previously wrote `.dark-theme :deep(.toolbar-button) { … }`, target `.dxfk-toolbar-button.dxfk-toolbar.dxfk-dark` directly (or just `.dxfk-toolbar.dxfk-dark .dxfk-toolbar-button`) and `:deep()` is no longer needed.

## Composables

| Composable              | Description                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useDXFRenderer`        | Main orchestrator: parsing, display, resize, layer visibility, dark theme                                                                                                                           |
| `useThreeScene`         | Three.js scene/renderer init with configurable antialiasing (MSAA/SMAA/FXAA/TAA/SSAA/none)                                                                                                          |
| `useLayers`             | Layer visibility state management. Accepts `{ getStorageKey?: () => string \| null }` for `localStorage` persistence                                                                                |
| `useKeyboardNavigation` | Wires arrow-key pan, `+`/`-` zoom, and `0` reset on any focusable element. `attach`, `detach`, `setEnabled`                                                                                         |
| `usePicking`            | Builds the picking index + associations, wires pointer listeners to a canvas, emits enriched `PickingEvent`s. Exposes `installPickingData`, `attach`, `getAssociations`, `findAssociationsByHandle` |
| `useHighlight`          | Manages an overlay group of LineSegments per highlighted bbox. `init`, `setColor`, `highlight(entries)`, `clear`, `dispose`                                                                         |

## Re-exports

`dxf-vuer` re-exports everything from `dxf-render` for convenience:

```ts
// All dxf-render exports available directly from dxf-vuer
import { parseDxf, createThreeObjectsFromDXF, resolveEntityColor } from "dxf-vuer";
```

For the full API of parser and renderer, see the [dxf-render documentation](https://www.npmjs.com/package/dxf-render).

## Migration

See [Customizing styles → Migration from v2.x](#migration-from-v2x) for the v3.0 class/variable rename. The `Migration from v1.x` note below applies only to projects upgrading directly from v1 — most projects already past v1.

### Migration from v1.x

Most imports work unchanged. Key changes:

- **Install**: `npm install dxf-vuer dxf-render three` (new `dxf-render` peer dep)
- **Parser entry**: `dxf-vuer/parser` → `dxf-render/parser`
- All other imports from `dxf-vuer` continue to work via re-exports

## License

MIT
