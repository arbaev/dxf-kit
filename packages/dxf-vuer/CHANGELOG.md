# Changelog

## 2.3.0

### Features

- **Error overlay**: parse/render/fetch errors displayed visually inside the viewer.
- **`showZoomLevel` prop**: display zoom percentage relative to fit-to-view.
- **`showDebugInfo` prop**: debug overlay with FPS, draw calls, lines, triangles.
- **ViewerToolbar component**: extracted toolbar buttons (Export PNG, Fit to View, Fullscreen) into a standalone `ViewerToolbar` component with `#extra` slot for custom buttons.
- **Overlay positioning**: 6-cell CSS Grid (2 rows x 3 columns) for flexible positioning of all overlay elements. New props: `fileNamePosition`, `toolbarPosition`, `coordinatesPosition`, `debugPosition`, `layerPanelPosition`, `overlayPosition` with `OverlayPosition` type.
- **Slots**: 6 named slots for UI customization:
  - `#toolbar` — replace entire toolbar (scoped: `resetView`, `exportToPNG`, `toggleFullscreen`, `isFullscreen`)
  - `#toolbar-extra` — add buttons to the existing toolbar
  - `#loading` — replace loading screen (scoped: `phase`, `progress`)
  - `#error` — replace error screen (scoped: `message`, `retry`)
  - `#empty-state` — replace placeholder
  - `#overlay` — custom overlay with positioning (scoped: `zoomPercent`, `cursorX`, `cursorY`)
- **`retry()` function**: exposed via `#error` slot for retrying failed loads.
- **`OverlayPosition` type**: exported from `dxf-vuer` for TypeScript consumers.

### Bug Fixes

- Warning icon exclamation mark dot not rendering (SVG `<line>` → `<circle>`).

### Refactored

- Extract `useLoadError` composable, consolidate error handling via `handleLoadError`.

## 2.2.0

### Features

- **Touch support**: `touch-action: none` on `.dxf-viewer` container for correct mobile touch handling.
- **GIS origin offset**: uses `originOffset` from dxf-render instead of `group.position` shift for correct large-coordinate handling.

### Refactored

- Import `useControls` instead of deprecated `useOrbitControls`.

### Dependencies

- Requires `dxf-render` ≥ 1.2.0 (new `originOffset` return value, `useControls`).

## 2.1.0

### Features

- **Theme-adaptive layer colors**: layer panel now correctly inverts ACI 250-251 gray colors in dark mode via `resolveThemeColor()`.

### Bug Fixes

- **sRGB color output**: added `OutputPass` to the post-processing pipeline for correct linear→sRGB color conversion.
- **Three.js addon imports**: updated import paths from `three/examples/jsm/` to `three/addons/` for Three.js 0.182 compatibility.

### Dependencies

- Requires `dxf-render` ≥ 1.1.0 (new `resolveThemeColor` export).

## 2.0.2

Initial public release.
