# dxf-lit

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-lit)](https://www.npmjs.com/package/dxf-lit)
[![license](https://img.shields.io/npm/l/dxf-lit)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

A framework-agnostic **`<dxf-viewer>` Web Component** for rendering AutoCAD **DXF**
drawings in the browser. Built on the [dxf-render](https://www.npmjs.com/package/dxf-render)
Three.js/WebGL engine and the shared
[dxf-interaction](https://www.npmjs.com/package/dxf-interaction) controllers.

One custom element works in **any stack** — Lit, Angular, Svelte, plain HTML, or no
framework at all.

[Live Demo](https://dxf-kit.netlify.app/lit) | [GitHub](https://github.com/arbaev/dxf-kit) | [Open in StackBlitz](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/lit?file=index.html&title=dxf-lit+Web+Component)

## Why dxf-lit?

- **One tag, any framework** — `<dxf-viewer url="…">` is a standard Custom Element.
- **Client-side** — parsing + rendering happen in the browser; no server round-trips.
- **22 entity types**, vector text (opentype.js), layers, and a built-in DXF parser.
- **Interactive** — picking, precise highlight, rectangle selection, distance / area /
  angle measurement with geometry snap, rulers, pan/zoom, fullscreen.
- **Shadow DOM** isolates styles; theme with `--dxfk-*` CSS variables and `::part()`.
- **TypeScript** types included.

## Install

```bash
npm install dxf-lit dxf-render three
```

Peer dependencies: `lit >= 3`, `three >= 0.160`, `dxf-render >= 1.7.0`.

## Usage

```html
<script type="module">
  import "dxf-lit"; // registers <dxf-viewer> (and its sub-components)
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

Give the element a height (it fills its host box).

### Object / array inputs

Attributes are strings. For objects pass a **property**; arrays accept either a
property or a JSON attribute:

```js
const viewer = document.querySelector("dxf-viewer");
viewer.dxfData = parsedDxfObject; // property (object)
viewer.hiddenLayers = ["WALLS"];  // property (array)
// or: <dxf-viewer hidden-layers='["WALLS"]'>
```

### Events

State and actions are surfaced as Custom Events (since native slots can't receive
data) and imperative methods:

```js
viewer.addEventListener("entity-click", (e) => console.log(e.detail)); // PickingEvent
viewer.addEventListener("entities-select", (e) => console.log(e.detail)); // PickingEvent[]
viewer.addEventListener("measure", (e) => console.log(e.detail)); // MeasureResult
viewer.addEventListener("measure-mode-change", (e) => console.log(e.detail));
viewer.addEventListener("hidden-layers-change", (e) => console.log(e.detail));
viewer.addEventListener("dxf-loaded", (e) => console.log(e.detail)); // boolean
```

Other events: `dxf-data`, `error`, `unsupported-entities`, `entity-hover`,
`layer-hover`, `selection-start`, `selection-end`, `measure-area`, `measure-angle`,
`measure-cancel`, `reset-view`, `file-dropped`.

In TypeScript the payload types are re-exported from `dxf-lit`, so handlers can be
typed by casting the event:

```ts
import type { PickingEvent, MeasureResult } from "dxf-lit";

viewer.addEventListener("entity-click", (e) => {
  const pick = (e as CustomEvent<PickingEvent>).detail;
  console.log(pick.type, pick.layer);
});
```

(`AreaMeasureResult`, `AngleMeasureResult`, `RectSelectionResolvedMode` are exported too.)

### Methods

```js
viewer.highlight(["1A2", "1B4"]);
viewer.clearHighlight();
viewer.zoomToEntity(["1A2"]);
viewer.zoomToLayer("WALLS");
viewer.setMeasureMode("distance"); // "none" | "distance" | "area" | "angle"
viewer.clearMeasure();
viewer.resetView();
viewer.exportToPNG();
await viewer.loadDXFFromUrl("/other.dxf");
await viewer.loadDXFFromText(dxfString);
await viewer.loadDXFFromBlob(file); // also loadDXFFromBuffer / loadDXFFromData
viewer.getAssociations();
viewer.findAssociationsByHandle("1A2");
viewer.getPickingIndex();
viewer.clearSelection();
```

Read-only state getters: `loadingPhase`, `loadingProgress`, `errorMessage`,
`zoomPercent`, `debugInfo`.

### Common attributes

`url`, `file-name`, `font-url`, `dark-theme`, `show-rulers`, `show-layer-panel`,
`show-properties-panel`, `show-coordinates`, `show-zoom-level`, `show-reset-button`,
`show-fullscreen-button`, `show-export-button`, `show-measure-button`,
`show-measure-area-button`, `show-measure-angle-button`, `picking-enabled`,
`rectangle-selection`, `measure-mode`, `ruler-units`, `allow-drop`,
`keyboard-navigation`, `highlight-color`, `measure-color`, and `*-position`
overlay placement attributes.

> **Default-true booleans:** to turn one off, write the explicit value
> `show-fullscreen-button="false"` — the bare absence of a boolean attribute can't
> express "off" once the default is on.

## Customizing the UI (slots)

Native Web Component slots are flat — they can't receive data the way Vue scoped
slots / React render-props do. To replace a UI section, drop your own markup in the
matching named slot and wire its behavior through the element's
properties / events / methods:

```html
<dxf-viewer>
  <div slot="toolbar">
    <button id="reset">Reset</button>
  </div>
</dxf-viewer>

<script type="module">
  import "dxf-lit";
  const v = document.querySelector("dxf-viewer");
  document.getElementById("reset").onclick = () => v.resetView();
</script>
```

Slots: `toolbar`, `toolbar-extra`, `overlay`, `loading`, `error`, `empty-state`.
When a slot is empty, the built-in UI renders as fallback.

## Theming

The Shadow DOM encapsulates styles; **no separate `style.css` is shipped**. Override
the `--dxfk-*` CSS custom properties from the light DOM (they pierce the shadow
boundary) and style key nodes via `::part()`:

```css
dxf-viewer {
  --dxfk-primary-color: #ff6600;
  --dxfk-border-radius: 8px;
}
dxf-viewer::part(toolbar) {
  gap: 8px;
}
```

Parts: `canvas`, `toolbar`, `file-name`, `coordinates`, `debug`, `layer-panel`,
`properties-panel`, `ruler-horizontal`, `ruler-vertical`, `ruler-corner`,
`selection-rect`, `measure-label`, `measure-area-label`, `measure-angle-label`,
`loading-overlay`, `error-overlay`, `empty-state-overlay`, `drop-overlay`.

## License

MIT © Timur Arbaev
