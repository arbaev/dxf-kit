# dxf-react

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-react)](https://www.npmjs.com/package/dxf-react)
[![license](https://img.shields.io/npm/l/dxf-react)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

React component for viewing DXF files in the browser. Thin wrapper around [dxf-render](https://www.npmjs.com/package/dxf-render) — the same engine that powers [dxf-vuer](https://www.npmjs.com/package/dxf-vuer).

[Live Demo](https://dxf-kit.netlify.app) | [GitHub](https://github.com/arbaev/dxf-kit)

## Installation

```bash
npm install dxf-react dxf-render three
```

Peer dependencies: `react >= 18`, `react-dom >= 18`, `three >= 0.160`, `dxf-render >= 1.6.0`.

## Quick Start

```tsx
import { useRef } from "react";
import { DXFViewer, type DXFViewerHandle } from "dxf-react";
import "dxf-react/style.css";

export function App() {
  const viewer = useRef<DXFViewerHandle>(null);

  async function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    viewer.current?.loadDXFFromText(await file.text());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <input type="file" accept=".dxf" onChange={loadFile} />
      <div style={{ flex: 1, display: "flex" }}>
        <DXFViewer ref={viewer} fileName="drawing.dxf" showResetButton />
      </div>
    </div>
  );
}
```

You can also pass a parsed `dxfData` object or a `url` prop instead of using the ref:

```tsx
import { DXFViewer, parseDxf } from "dxf-react";

const dxfData = parseDxf(text);
// ...
<DXFViewer dxfData={dxfData} />
<DXFViewer url="/drawings/floor-plan.dxf" />
```

> `dxf-react` is a client-only component (WebGL/canvas). In SSR frameworks like
> Next.js App Router, render it in a client component (`"use client"`).

## Components

| Component             | Description                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ |
| `DXFViewer`           | Main viewer: Three.js scene, layer panel, toolbar, rulers, measurement, drag-and-drop, dark theme, render-props |
| `ViewerToolbar`       | Toolbar with export, fit-to-view, fullscreen + measurement buttons. Accepts an `extra` slot |
| `FileUploader`        | `.dxf` file input button. Fires `onFileSelected(file)`                               |
| `LayerPanel`          | Collapsible layer-visibility panel with color swatches + prefix grouping             |
| `PropertiesPanel`     | Read-only property inspector for the clicked entity                                  |
| `UnsupportedEntities` | Collapsible list of unsupported entity types                                         |
| `DXFStatistics`       | File statistics (entities, layers, blocks, AutoCAD version)                          |

## DXFViewer props (selected)

The full, typed prop list lives in the bundled `.d.ts` (`DXFViewerProps`). Highlights:

- **Data:** `dxfData`, `url`, `fileName`, `fontUrl`
- **Visibility toggles:** `showResetButton`, `showFullscreenButton`, `showExportButton`,
  `showFileName`, `showCoordinates`, `showZoomLevel`, `showDebugInfo`, `showRulers`,
  `showLayerPanel`, `showPropertiesPanel`, `showMeasureButton` / `…AreaButton` / `…AngleButton`
- **Behavior:** `autoFit`, `allowDrop`, `darkTheme`, `keyboardNavigation`, `antialiasing`
- **Interaction:** `pickingEnabled`, `highlightOnHover`, `highlightAssociated`, `highlightColor`,
  `rectangleSelection`, `rectangleSelectionModifier`, `rectangleSelectionMode`
- **Measurement (controlled):** `measureMode` + `onMeasureModeChange`, `measureUnits`,
  `measureAreaUnits`, `measureAngleUnits`, `measureColor`, `snapToGeometry`
- **Layers:** `groupLayers`, `persistLayersKey`, `hiddenLayers` (controlled) + `onHiddenLayersChange`
- **Rulers:** `rulerUnits`
- **Styling:** `classes` (a `ViewerClasses` map of `.dxfk-*` hook classes), `*Position` overlay placement

### Events (callback props)

`onDxfLoaded`, `onDxfData`, `onError`, `onUnsupportedEntities`, `onResetView`,
`onFileDropped`, `onEntityHover`, `onEntityClick`, `onEntitiesSelect`,
`onSelectionStart`, `onSelectionEnd`, `onLayerHover`, `onHiddenLayersChange`,
`onMeasureModeChange`, `onMeasure`, `onMeasureArea`, `onMeasureAngle`, `onMeasureCancel`.

### Render-props (custom UI)

`renderToolbar(ctx)`, `toolbarExtra`, `renderOverlay(ctx)`, `renderLoading(ctx)`,
`renderError(ctx)`, `renderEmptyState()` — the React analogues of dxf-vuer's scoped slots.

### Imperative API (`ref`)

```tsx
const viewer = useRef<DXFViewerHandle>(null);
// loadDXFFromText / Data / Url / Buffer / Blob, resetView, resize, exportToPNG,
// getRenderer, highlight, clearHighlight, clearSelection, zoomToEntity, zoomToLayer,
// getAssociations, findAssociationsByHandle, getPickingIndex, clearMeasure, setMeasureMode
```

## Hooks

Every interaction is also exposed as a standalone hook for building a custom UI:
`useDXFRenderer`, `useThreeScene`, `useLayers`, `usePicking`, `useHighlight`, `useSnap`,
`useRectangleSelection`, `useMeasurement`, `useAreaMeasurement`, `useAngleMeasurement`.
All of `dxf-render` is re-exported from `dxf-react` for convenience.

## Customizing styles

All public elements carry stable, low-specificity `.dxfk-*` hook classes, and the
theme is driven by `--dxfk-*` CSS custom properties (override them on `:root` or a
wrapper). The `classes` prop merges extra class names onto each part (Headless-UI
style). This surface is shared with `dxf-vuer`.

## License

MIT © Timur Arbaev
