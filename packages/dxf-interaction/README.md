# dxf-interaction

Framework-agnostic interaction controllers for DXF viewers built on
[`dxf-render`](https://www.npmjs.com/package/dxf-render) + Three.js.

This package holds the stateful, DOM-driven interaction logic shared by the
official wrappers ([`dxf-vuer`](https://www.npmjs.com/package/dxf-vuer) and
[`dxf-react`](https://www.npmjs.com/package/dxf-react)): the measurement tools
(distance / area / angle), geometry snapping, picking (hover/click), precise
highlight overlays and window/crossing rectangle selection.

Each controller is a plain factory (`createX(...)`) with no framework binding.
Reactive state is surfaced through callbacks so a thin Vue composable / React
hook can mirror it into `ref`/`useState`. The pure geometry math itself lives in
`dxf-render` and is not duplicated here.

> You usually don't install this directly — it ships as a dependency of
> `dxf-vuer` / `dxf-react`. Use it directly only when building a custom wrapper
> (e.g. a Lit web component) over `dxf-render`.

## Install

```bash
npm install dxf-interaction dxf-render three
```

`dxf-render` and `three` are peer dependencies (one shared instance).

## What's inside

| Factory | Responsibility |
| --- | --- |
| `createPointerTool` | Shared pointer pipeline (click-vs-pan, left-button steal, overlay lifecycle, screen↔world projection) |
| `createMeasurementController` | Two-point linear distance |
| `createAreaMeasurementController` | N-point polygon area + perimeter |
| `createAngleMeasurementController` | Three-point directed angle |
| `createSnapController` | Endpoint/midpoint/center/quadrant/node snapping + marker glyph |
| `createPickingController` | Raycast hover/click against the picking index |
| `createHighlightController` | Precise geometry (or bbox) highlight overlay |
| `createRectangleSelectionController` | Window/crossing drag selection |

Pure helpers (`screenToWorldPoint`, `worldPerPixel`, `resolveSelectionMode`,
`formatMeasureValue`, …) and all related types are re-exported too.

## License

MIT © Timur Arbaev
