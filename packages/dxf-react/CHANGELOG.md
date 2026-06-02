# Changelog

## 0.1.0

Initial release — a React 18+ wrapper for [dxf-render](https://www.npmjs.com/package/dxf-render),
at feature parity with [dxf-vuer](https://www.npmjs.com/package/dxf-vuer).

### Features

- `<DXFViewer>` component — Three.js DXF rendering with an orthographic camera and
  MapControls pan/zoom, dark theme, antialiasing modes, and auto-fit.
- Loading from `dxfData`, `url`, or the imperative ref
  (`loadDXFFromText` / `loadDXFFromData` / `loadDXFFromUrl` / `loadDXFFromBuffer` /
  `loadDXFFromBlob`), with UTF-8 / UTF-16 BOM detection and drag-and-drop.
- Layer panel with prefix grouping, filter, frozen/locked indicators, and
  controlled (`hiddenLayers` + `onHiddenLayersChange`) or uncontrolled
  (`persistLayersKey` localStorage) visibility.
- Entity picking with precise-geometry highlight, semantic associations, and a
  read-only `PropertiesPanel`.
- Rectangle selection (window/crossing, AutoCAD auto-by-direction).
- Measurement tools — distance, area (+ perimeter), and angle — with geometry
  snap, controlled `measureMode`, and `$INSUNITS`-aware unit labels.
- DPI-aware rulers + cursor-coordinate overlay.
- Toolbar, file uploader, statistics and unsupported-entities components.
- Imperative API via `ref`: `highlight`, `clearHighlight`, `zoomToEntity`,
  `zoomToLayer`, `getAssociations`, `getPickingIndex`, `clearMeasure`,
  `setMeasureMode`, `exportToPNG`, `resize`, `resetView`, …
- Render-props (`renderToolbar` / `renderOverlay` / `renderLoading` /
  `renderError` / `renderEmptyState`) and standalone hooks for custom UIs.
- Headless-style theming: `.dxfk-*` hook classes, `--dxfk-*` CSS variables, and a
  `classes` prop — the same style surface as `dxf-vuer`.

### Stats

- 67 unit tests (pure helpers, layer state, formatters, smoke).
