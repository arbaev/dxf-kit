# dxf-interaction

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-interaction)](https://www.npmjs.com/package/dxf-interaction)
[![license](https://img.shields.io/npm/l/dxf-interaction)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Framework-agnostic interaction controllers for DXF viewers built on
[`dxf-render`](https://www.npmjs.com/package/dxf-render) + Three.js.

This package holds the stateful, DOM-driven interaction logic shared by the
official wrappers ([`dxf-vuer`](https://www.npmjs.com/package/dxf-vuer),
[`dxf-react`](https://www.npmjs.com/package/dxf-react) and
[`dxf-lit`](https://www.npmjs.com/package/dxf-lit)): the measurement tools
(distance / area / angle), geometry snapping, picking (hover/click), precise
highlight overlays and window/crossing rectangle selection.

Each controller is a plain factory (`createX(...)`) with no framework binding.
Reactive state is surfaced through callbacks so a thin Vue composable / React
hook / Lit reactive controller can mirror it into `ref` / `useState` /
`requestUpdate()`. The pure geometry math itself lives in `dxf-render` and is
not duplicated here.

> You usually don't install this directly — it ships as a dependency of
> `dxf-vuer` / `dxf-react` / `dxf-lit`. Install it directly only when building
> your own wrapper (e.g. a Solid or Svelte binding) over `dxf-render`.

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
