# Changelog

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
