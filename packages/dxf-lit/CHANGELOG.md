# Changelog

## 0.1.0

Initial release — a Web Component (`<dxf-viewer>`) wrapper for
[dxf-render](https://www.npmjs.com/package/dxf-render), built on
[Lit](https://lit.dev/), at feature parity with
[dxf-vuer](https://www.npmjs.com/package/dxf-vuer) and
[dxf-react](https://www.npmjs.com/package/dxf-react).

### Features

- `<dxf-viewer>` custom element — Three.js DXF rendering with an orthographic camera and
  MapControls pan/zoom, dark theme, antialiasing modes, and auto-fit. Works in any stack
  (Angular, Svelte, plain HTML, or no framework).
- Loading from the `url` / `dxf-data` attributes/properties or the imperative methods
  (`loadDXFFromText` / `loadDXFFromData` / `loadDXFFromUrl` / `loadDXFFromBuffer` /
  `loadDXFFromBlob`), with UTF-8 / UTF-16 BOM detection and drag-and-drop.
- Layer panel (`<dxf-layer-panel>`) with prefix grouping, filter, frozen/locked indicators,
  and controlled (`hidden-layers` + `hidden-layers-change`) or uncontrolled
  (`persist-layers-key` localStorage) visibility.
- Entity picking with precise-geometry highlight, semantic associations, and a read-only
  properties panel (`<dxf-properties-panel>`).
- Rectangle selection (window/crossing, AutoCAD auto-by-direction).
- Measurement tools — distance, area (+ perimeter), and angle — with geometry snap,
  `measure-mode`, and `$INSUNITS`-aware unit labels.
- DPI-aware rulers (`<dxf-ruler>`) + cursor-coordinate overlay.
- Imperative API: `highlight`, `clearHighlight`, `zoomToEntity`, `zoomToLayer`,
  `getAssociations`, `getPickingIndex`, `clearMeasure`, `setMeasureMode`, `exportToPNG`,
  `resize`, `resetView`, …
- Web Component conventions — kebab-case attributes (with an explicit-opt-out boolean
  converter for default-true props), Custom Events for state/actions, and flat named slots
  (`toolbar` / `toolbar-extra` / `overlay` / `loading` / `error` / `empty-state`) with the
  built-in UI as fallback.
- Shadow-DOM theming via the shared `--dxfk-*` CSS variables (they pierce the boundary) and
  `::part()` for key nodes — no separate `style.css` is shipped.

### Stats

- 65 unit tests (element registration, attribute ↔ property reflection, Custom Events,
  imperative methods, layer state, pure helpers).
