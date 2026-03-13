# Changelog

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
