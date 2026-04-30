# Changelog

## 2.5.0

### Features

- **Entity picking** — hover and click individual DXF entities. New events `entity-hover` and `entity-click` fire with `{ handle, type, layer, text?, entity?, association? }`. Backed by `dxf-render`'s `buildPickingIndex` + raycasting against an invisible bbox group; the smallest hit among stacked entities wins. Click is distinguished from pan via a 4-pixel mousedown→up distance threshold.
- **Semantic associations** — picking events automatically include `association?` resolved via `dxf-render`'s `buildAssociations(dxf)`. The built-in highlight expands to all members of MLEADER, LEADER↔TEXT (DXF 340), INSERT+ATTRIB, and DIMENSION groups, so hovering the leader head highlights both the leader line and its text.
- **Imperative picking API on viewer ref** — sync selection with external UI (AG Grid, search box, layer panel):
  - `highlight(handles[])`, `clearHighlight()` — drive the highlight overlay programmatically.
  - `getAssociations()`, `findAssociationsByHandle(handle)` — list / lookup associations.
  - `zoomToEntity(handles[])` — fit camera to the union bbox of given entities with 20% padding.
  - `getPickingIndex()` — access the underlying `PickingIndex` for filtering external search results to scene-visible entities only.
- **New props** — opt-in interactivity, no overhead when disabled:
  - `pickingEnabled` (default `false`) — master switch for raycasting + events.
  - `highlightOnHover` (default `true`) — built-in yellow bbox overlay on hover.
  - `highlightAssociated` (default `true`) — extend hover highlight to all association members.
  - `highlightColor` (default `'#ffaa00'`).
- **Public composables** — `usePicking` and `useHighlight` exported for advanced integrations that bypass `<DXFViewer>`.

### Bug Fixes

- Coordinates overlay no longer disappears when the cursor leaves the canvas (last cursor position is preserved).

### Dependencies

- Requires `dxf-render` ≥ 1.4.0 (new picking, association, and zoom-box primitives).

## 2.4.0

### Features

- **`antialiasing` prop**: choose the AA mode at init time — `msaa` (default, hardware), `smaa`, `fxaa`, `taa`, `ssaa`, or `none`. Default changed from TAA to MSAA for crisper thin lines and text in CAD drawings. Init-time only — recreate the component via `:key` to switch at runtime. Powered by the new `createRenderer` / `createComposer` factories in `dxf-render` 1.3.0; `AntialiasingMode` is now imported from `dxf-render` (still re-exported from `dxf-vuer` for backward compatibility).
- **`showLayerPanel` prop**: hide the layers panel programmatically (default `true`). Position is still controlled by the existing `layerPanelPosition`.
- **Layers panel filter**: text input for searching layers by name. Auto-shown when the drawing has more than 5 layers.
- **`loadDXFFromBuffer` and `loadDXFFromBlob` methods**: load drawings from `ArrayBuffer` or `Blob` for integrations with IndexedDB, S3, Supabase Storage and other binary sources. Auto-detects encoding (UTF-8, UTF-16 LE/BE) by BOM.
- **`prefers-reduced-motion` support**: when the user has enabled "reduce motion" in the OS, the TAA mode renders a single frame and skips the 32-frame jittered accumulation loop. Other AA modes are unaffected.

### Documentation

- npm search SEO: added keywords (`dxf-renderer`, `dxf-three`, `render-dxf`, `parser`), added the `bugs` field.

### Dependencies

- Requires `dxf-render` ≥ 1.3.0 (new AA pipeline factories).

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
