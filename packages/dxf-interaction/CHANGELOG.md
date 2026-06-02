# Changelog

## 0.1.0

Initial release — framework-agnostic interaction controllers for DXF viewers
built on [dxf-render](https://www.npmjs.com/package/dxf-render) + Three.js,
extracted from [dxf-vuer](https://www.npmjs.com/package/dxf-vuer) /
[dxf-react](https://www.npmjs.com/package/dxf-react) so every wrapper (and the
[dxf-lit](https://www.npmjs.com/package/dxf-lit) Web Component) shares one source
of truth instead of duplicating ~2400 lines of state-machine code per wrapper.

### Features

- Plain `createX(...)` factories with a callback-based reactive boundary — a thin
  Vue composable / React hook / Lit controller mirrors their state into
  `ref` / `useState` / `@state`:
  - `createPointerTool` — shared pointer pipeline (click-vs-pan, left-button
    steal, overlay lifecycle, screen↔world projection).
  - `createMeasurementController` / `createAreaMeasurementController` /
    `createAngleMeasurementController` — distance / area / angle state machines
    via a `pushState` bridge.
  - `createSnapController` — geometry snap + AutoCAD-style marker glyph (optional
    `onSnapChange` callback).
  - `createRectangleSelectionController` — window / crossing drag via a
    `setScreenRect` bridge.
  - `createPickingController` — raycast hover / click (callback-only).
  - `createHighlightController` — precise-geometry (or bbox) highlight overlay.
- Pure helpers exported: `screenToWorldPoint`, `worldToScreenPoint`,
  `worldPerPixel`, `ensurePositionCapacity`, `isPanGesture`, `isTypingTarget`,
  `resolveSelectionMode`, `normaliseScreenRect`, `buildWorldRect`,
  `formatMeasureValue` / `formatAreaValue` / `formatAngleValue`, plus all related
  types. The pure geometry math itself lives in `dxf-render` and is not duplicated.
- `dxf-render` and `three` are peer dependencies (one shared instance). You
  normally don't install this directly — it ships as a transitive dependency of
  `dxf-vuer` / `dxf-react` / `dxf-lit`; install it explicitly only when building a
  new framework wrapper over `dxf-render`.
