# Changelog

## 1.5.0

### Features

- **`getZoomBoxForLayer(pickingIndex, layerName, options?)`** → `THREE.Box3 | null` — pure helper that unions bboxes of all picking entries on a given layer. Same options as `getZoomBox` plus `caseSensitive` (default `true`, since DXF layer names are case-sensitive). Feed the result into `fitCameraToBox()` to implement "zoom to layer" in any framework.
- **`findEntitiesByLayer(dxf, layerName, options?)`** → `string[]` — find handles of all entities belonging to a given layer. Walks top-level entities, INSERT ATTRIBs, and entities inside blocks (same coverage as `findEntitiesByText`). Case-sensitive by default; pass `{ caseSensitive: false }` to relax.
- **`findEntitiesByType(dxf, type | type[])`** → `string[]` — find handles by DXF entity type. Accepts a single type or an array; input case is normalized (DXF types are uppercase per spec).

### Stats

- 945 tests across 44 files (was 923 across 41).

## 1.4.0

### Features

- **Picking primitives** — framework-agnostic raycasting building blocks:
  - `buildPickingIndex(dxf)` → `{ entries, byHandle }` — pure function that walks `dxf.entities`, expands INSERTs (with array `columnCount`/`rowCount` support, OCS, `$INSUNITS` scale), and emits one entry per child plus an aggregate entry per INSERT instance. ATTRIBs become independent entries. XLINE/RAY skipped (infinite). Each entry carries a world-space `THREE.Box3`.
  - `createPickingGroup(index, originOffset?)` — builds an invisible `THREE.Group` of bbox meshes (`userData.handle`/`dxfType`/`layerName`) for raycasting. `disposePickingGroup(group)` for cleanup.
  - `buildEntityIndex(dxf)` → `Map<handle, DxfEntity>` — O(1) lookup including INSERT ATTRIBs and entities inside blocks.
  - `extractEntityText(entity)` — pulls displayable text from TEXT/MTEXT/ATTRIB/ATTDEF/DIMENSION/MULTILEADER.
- **Semantic associations** — `buildAssociations(dxf)` returns `EntityAssociation[]` derived strictly from DXF data (no geometric heuristics): MULTILEADER (inline contextData text), LEADER↔TEXT/MTEXT (via DXF code 340 `annotationHandle`), INSERT+ATTRIB (concatenated tag/text), DIMENSION (text override or `actualMeasurement`, `<>` resolved). New exported types `EntityAssociation`, `AssociationKind`, `AssociationSource`.
- **`getZoomBox(pickingIndex, handles, options?)`** → `THREE.Box3 | null` — pure helper that unions bboxes of given handles, subtracts `originOffset`, and pads by `paddingRatio` (default 20%). Feed the result into `fitCameraToBox()` to build "zoom-to-entity" in any framework.
- **`findEntitiesByText(dxf, query, options?)`** → `string[]` — pure full-text search across all entity text content (TEXT/MTEXT/ATTRIB/ATTDEF/DIMENSION/MULTILEADER, including children of INSERT and BLOCK definitions). Case-insensitive substring by default; supports `caseSensitive` and `regex` options.
- **LEADER `annotationHandle`** — LEADER parser now stores DXF code 340 on `DxfLeaderEntity` so consumers can resolve the linked TEXT/MTEXT.

### Stats

- 923 tests across 41 files (was 854 across 36).

## 1.3.0

### Features

- **Configurable antialiasing pipeline**: new `scene/antialiasing.ts` module with framework-agnostic factories — `createRenderer({ aaMode })`, `createComposer({ aaMode, scene, camera, renderer })`, and `isReducedMotionPreferred()`. Six modes: `msaa` (default, hardware), `smaa`, `fxaa`, `taa`, `ssaa`, `none`. New exported type `AntialiasingMode`. Lets React / Svelte / vanilla users use the same AA palette that powers `dxf-vuer`'s `<DXFViewer>`.

### Documentation

- README: new "Antialiasing" section with comparison table and example.
- npm search SEO: deduplicated keywords, added precise search phrases (`dxf-viewer`, `dxf-three`, `dxf-js`, `render-dxf`, `parser`, `viewer`, `blueprint`); homepage now points to the live demo; added the `bugs` field.

### Bug Fixes

- Added `"browser": { "fs": false }` to package.json — eliminates `Could not resolve "fs"` when bundling for the browser (Vite / esbuild / Angular CLI). The Node branch of `opentype.js` (file-system font loading) is now automatically stripped by downstream bundlers.

## 1.2.0

### Features

- **Variable-width polylines**: POLYLINE/LWPOLYLINE now support per-vertex `startWidth`/`endWidth` tapering (DXF codes 40/41). Arrows, tapered segments, donuts, and pipelines with varying diameter render correctly as triangle-strip mesh geometry with proper miter joins at corners.
- **POLYLINE vertex width parsing**: per-vertex codes 40/41 now saved (previously ignored).
- **GIS origin translation**: large GIS coordinates (UTM, state plane) no longer lose precision — `$EXTMIN/$EXTMAX` center is subtracted before writing to Float32Array. `createThreeObjectsFromDXF()` now returns `originOffset`.
- **Touch support**: switched from `OrbitControls` to `MapControls` for native one-finger pan on mobile devices.

### Refactored

- `useOrbitControls` renamed to `useControls` (old name kept as deprecated alias).

### Examples

- New `examples/leaflet-dxf/` — overlay DXF on OpenStreetMap with geo-referencing (parser-only, DXF → GeoJSON). Includes Florence city center sample with UTM grid convergence correction.
- New `examples/dxf-to-pdf/` — export DXF drawings to PDF via Three.js offscreen rendering + jsPDF.
- Examples section added to demo landing page with StackBlitz links for all 5 examples.
- New "Line Types & Widths" showcase sample on demo landing page combining all linetypes and polyline width examples with annotations.

### Stats

- 874 test cases across 37 files (was 854 across 36)

## 1.1.0

### Features

- **Theme-adaptive ACI 250-251**: dark gray colors (ACI 250, 251) now invert to light grays in dark mode, keeping them visible against dark backgrounds. New exports: `isThemeAdaptiveColor()`, `resolveThemeColor()`.

### Bug Fixes

- **Single-point polyline**: polylines with a single vertex are now rendered as points instead of being silently skipped.
- **Layer default visibility**: layers now default to `visible: true`, `frozen: false`, `locked: false` when flags are not explicitly set in the DXF file.
- **Three.js addon imports**: updated import paths from `three/examples/jsm/` to `three/addons/` for Three.js 0.182 compatibility.

## 1.0.3

Initial public release.
