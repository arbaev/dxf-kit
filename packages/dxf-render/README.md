# dxf-render

[![CI](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arbaev/dxf-kit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dxf-render)](https://www.npmjs.com/package/dxf-render)
[![license](https://img.shields.io/npm/l/dxf-render)](https://github.com/arbaev/dxf-kit/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Framework-agnostic DXF parser and Three.js renderer. Use with React, Svelte, vanilla JS, or any framework.

[Live Demo](https://dxf-kit.netlify.app) — upload your DXF and see the rendering quality.

Try it now on StackBlitz: [Vanilla TS](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vanilla-ts?file=src/main.ts&title=dxf-render+Vanilla+TS) | [React](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/react?file=src/DxfViewer.tsx&title=dxf-render+React) | [Vue](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/vue?file=src/App.vue&title=dxf-vuer+Vue+3) | [Leaflet + DXF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/leaflet-dxf?file=src/main.ts&title=dxf-render+Leaflet) | [DXF to PDF](https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples/dxf-to-pdf?file=src/main.ts&title=dxf-render+PDF+Export)

For Vue 3 components, see the [dxf-vuer](https://www.npmjs.com/package/dxf-vuer) package.

## Why dxf-render?

- **Most entities** — 22 rendered types including all dimension variants, LEADER, MULTILEADER, MLINE, REGION (contour via HATCH boundary)
- **Variable-width polylines** — per-vertex tapering, arrows, donuts rendered as mesh with miter joins
- **Accurate rendering** — linetype patterns, OCS transforms, hatch patterns, proper color resolution
- **Picking & associations** — bbox-based raycast index plus DXF-driven entity links (LEADER↔TEXT, INSERT+ATTRIB, MLEADER, DIMENSION, ACAD_GROUP)
- **Two entry points** — full renderer or parser-only (zero deps, works in Node.js)
- **Battle-tested** — 1141 tests covering parser, renderer, and utilities
- **Modern stack** — TypeScript native, ES modules, tree-shakeable, Vite-built
- **Framework-agnostic** — works with React, Svelte, Angular, vanilla JS, or any framework

## Installation

```bash
# Full renderer (parser + Three.js rendering)
npm install dxf-render three

# Parser only (no Three.js needed)
npm install dxf-render
```

## Quick Start

### Parse and render

```ts
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useControls,
} from "dxf-render";
import * as THREE from "three";

// Parse DXF text
const dxf = parseDxf(dxfText);

// Load embedded font for text rendering
await loadDefaultFont();

// Create Three.js objects
const { group, materials } = await createThreeObjectsFromDXF(dxf);

// Set up scene
const scene = new THREE.Scene();
scene.add(group);

const frustumSize = 100;
const aspect = myCanvas.clientWidth / myCanvas.clientHeight;
const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ canvas: myCanvas });
renderer.setSize(myCanvas.clientWidth, myCanvas.clientHeight);

const { fitCameraToBox } = useCamera();
const { initControls } = useControls();

initControls(camera, myCanvas);
fitCameraToBox(new THREE.Box3().setFromObject(group), camera);
renderer.render(scene, camera);
```

### Parser only

```ts
import { parseDxf } from "dxf-render/parser";
import type { DxfData } from "dxf-render/parser";
import { isLineEntity } from "dxf-render/parser";

const dxf: DxfData = parseDxf(dxfText);

for (const entity of dxf.entities) {
  if (isLineEntity(entity)) {
    console.log(entity.startPoint, entity.endPoint);
  }
}
```

### Async parsing (Web Worker)

```ts
import { parseDxfAsync, terminateParserWorker } from "dxf-render";

// Parses in a Web Worker, falls back to sync if Workers unavailable
const dxf = await parseDxfAsync(dxfText);

// Cleanup when done
terminateParserWorker();
```

### React example

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  parseDxf,
  createThreeObjectsFromDXF,
  loadDefaultFont,
  useCamera,
  useControls,
} from "dxf-render";

export function DxfViewer({ dxfText }: { dxfText: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );

    const { fitCameraToBox } = useCamera();
    const { initControls } = useControls();
    let disposed = false;

    (async () => {
      await loadDefaultFont();
      const dxf = parseDxf(dxfText);
      const { group } = await createThreeObjectsFromDXF(dxf);
      if (disposed) return;

      scene.add(group);
      initControls(camera, canvas);

      const box = new THREE.Box3().setFromObject(group);
      fitCameraToBox(box, camera);
      renderer.render(scene, camera);
    })();

    return () => {
      disposed = true;
      renderer.dispose();
    };
  }, [dxfText]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "500px" }} />;
}
```

### Svelte example

```svelte
<script>
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import {
    parseDxf,
    createThreeObjectsFromDXF,
    loadDefaultFont,
    useCamera,
    useControls,
  } from "dxf-render";

  export let dxfText;

  let canvas;
  let renderer;

  onMount(async () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2, (frustumSize * aspect) / 2,
      frustumSize / 2, frustumSize / -2, 0.1, 1000,
    );

    const { fitCameraToBox } = useCamera();
    const { initControls } = useControls();

    await loadDefaultFont();
    const dxf = parseDxf(dxfText);
    const { group } = await createThreeObjectsFromDXF(dxf);

    scene.add(group);
    initControls(camera, canvas);

    const box = new THREE.Box3().setFromObject(group);
    fitCameraToBox(box, camera);
    renderer.render(scene, camera);
  });

  onDestroy(() => renderer?.dispose());
</script>

<canvas bind:this={canvas} style="width: 100%; height: 500px;" />
```

## API

### Entry points

| Import              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `dxf-render`        | Full API: parser + renderer + scene helpers + utils |
| `dxf-render/parser` | Parser only, zero dependencies                      |

### Parser

- `parseDxf(text: string): DxfData` — synchronous DXF parser
- `parseDxfAsync(text: string): Promise<DxfData>` — async parser via Web Worker
- `terminateParserWorker(): void` — terminate the parser Web Worker

### Renderer

- `createThreeObjectsFromDXF(dxf, options?): Promise<CreateDXFSceneResult>` — create Three.js objects from parsed DXF data
  - `options.signal` — `AbortSignal` for cancellation
  - `options.onProgress` — progress callback (0–1)
  - `options.darkTheme` — dark theme mode
  - `options.font` — custom opentype.js Font object
- `MaterialCacheStore` — material cache with `switchTheme()` for instant dark mode

### Scene helpers

- `useCamera(domElement)` — orthographic camera with `fitCameraToBox()`
- `useControls(camera, domElement)` — pan/zoom controls (no rotation), mobile touch support
- `createRenderer({ aaMode })` — `WebGLRenderer` with the right `antialias` flag for the selected AA mode
- `createComposer({ aaMode, scene, camera, renderer })` — builds the post-processing pipeline (`EffectComposer` + AA pass + `OutputPass`); returns `{ composer: null }` for `msaa`/`none` (use `renderer.render()` directly)
- `isReducedMotionPreferred()` — `true` when the user has enabled "reduce motion" in their OS

### Antialiasing

Six modes available via `AntialiasingMode = "msaa" | "smaa" | "fxaa" | "taa" | "ssaa" | "none"`:

| Mode   | Use case                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `msaa` | Hardware multisampling (default). Crisp geometric edges, almost free runtime cost. Best for CAD with thin lines and text                                                           |
| `smaa` | Edge-detection post-processing. Cheap and works while panning. Note: may fade pixels at corners of 1px lines (line-art limitation)                                                 |
| `fxaa` | Cheapest fullscreen AA — single shader pass. Smooths edges but tends to blur thin lines and small text                                                                             |
| `taa`  | Temporal AA: 32 jittered frames accumulated when the camera stops. Smooth on static views; first frame after movement looks aliased. Skipped when `prefers-reduced-motion: reduce` |
| `ssaa` | Super-sampling: renders at higher resolution and downscales. Reference quality; expensive                                                                                          |
| `none` | No antialiasing. Maximum performance and pixel sharpness                                                                                                                           |

```ts
import * as THREE from "three";
import { createRenderer, createComposer, isReducedMotionPreferred } from "dxf-render";

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(/* ... */);
const renderer = createRenderer({ aaMode: "msaa" });
const { composer, taaPass } = createComposer({ aaMode: "msaa", scene, camera, renderer });

function render() {
  if (taaPass && composer) {
    taaPass.accumulateIndex = -1;
    composer.render();
    if (!isReducedMotionPreferred()) {
      // schedule next jittered frame via requestAnimationFrame...
    }
  } else if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
```

### Picking primitives

Framework-agnostic primitives for building hover/click interactivity. The Vue wrapper (`dxf-vuer`) is implemented on top of these.

```ts
import {
  buildPickingIndex,
  createPickingGroup,
  disposePickingGroup,
  buildEntityIndex,
  extractEntityText,
  buildAssociations,
} from "dxf-render";

const dxf = parseDxf(dxfText);

// 1. Per-entity bounding boxes (expands INSERTs, ATTRIBs, $INSUNITS, OCS).
//    Each entry also exposes `worldMatrix` (composed parent-INSERT × OCS)
//    and INSERT aggregates expose `childIds` listing all child pick ids.
const pickingIndex = buildPickingIndex(dxf);

// 2. Invisible THREE.Group of BoxGeometry meshes — one per entity
const pickingGroup = createPickingGroup(pickingIndex, originOffset);
scene.add(pickingGroup);

// 3. Resolve entity data and structural links by handle
const entityIndex = buildEntityIndex(dxf); // Map<handle, DxfEntity>
const associations = buildAssociations(dxf); // EntityAssociation[]
```

To zoom the camera to a set of entities, combine `getZoomBox()` with the `fitCameraToBox()` helper from `useCamera()`:

```ts
import { buildPickingIndex, getZoomBox, useCamera } from "dxf-render";

const pickingIndex = buildPickingIndex(dxf);
const { fitCameraToBox } = useCamera();

function zoomTo(handles: string[]) {
  const box = getZoomBox(pickingIndex, handles, { originOffset });
  if (box) fitCameraToBox(box, camera);
}
```

For "zoom to layer", use `getZoomBoxForLayer()` — same semantics, but unions every entry on the named layer. Layer names are case-sensitive by default:

```ts
import { getZoomBoxForLayer } from "dxf-render";

const box = getZoomBoxForLayer(pickingIndex, "WALLS", { originOffset });
if (box) fitCameraToBox(box, camera);

// Forgiving lookup
getZoomBoxForLayer(pickingIndex, "walls", { originOffset, caseSensitive: false });
```

To raycast, temporarily flip the group's `visible` flag (it's `false` by default so it doesn't show up in normal rendering):

```ts
const raycaster = new THREE.Raycaster();
raycaster.setFromCamera(ndc, camera);

pickingGroup.visible = true;
const hits = raycaster.intersectObject(pickingGroup, true);
pickingGroup.visible = false;

if (hits.length > 0) {
  const handle = hits[0].object.userData.handle as string;
  const entity = entityIndex.get(handle);
  console.log("hit", handle, entity?.type, extractEntityText(entity!));
}
```

### Highlight geometry

`buildHighlightGeometry(entity, worldMatrix)` is a pure helper that returns polyline point arrays tracing the **visible geometry** of a DXF entity — the building block for hover/selection overlays that follow the actual lines, circles, arcs, polyline bulges, splines, and hatch contours instead of a bounding box.

```ts
import { buildHighlightGeometry, type HighlightGeometry } from "dxf-render";

const entry = pickingIndex.byHandle.get(handle)?.[0];
const entity = entityIndex.get(handle);
if (!entry || !entity) return;

const geom: HighlightGeometry = buildHighlightGeometry(entity, entry.worldMatrix ?? null);

if (geom.fallbackToBBox) {
  // No precise outline available (TEXT, MTEXT, ATTRIB, ATTDEF, DIMENSION,
  // POINT, INSERT) — draw the entry's bbox edges instead.
} else {
  for (const polyline of geom.polylines) {
    // Each polyline is a connected sequence of world-space points, ready
    // to be wrapped in THREE.Line / THREE.BufferGeometry.
  }
}
```

Coverage: LINE, CIRCLE, ARC, ELLIPSE, POLYLINE / LWPOLYLINE (with bulge tessellation), SPLINE (NURBS or fit-point Catmull-Rom), SOLID, 3DFACE, HATCH (all boundary edge types), REGION (via the HATCH-borrowed `contourBoundary`), MLINE (centerline), LEADER, MULTILEADER (one polyline per leader line). XLINE/RAY return empty polylines with `fallbackToBBox: false` — they are intentionally skipped (infinite extent).

INSERT aggregates return `fallbackToBBox: true` here — to highlight the contents of an INSERT instance, walk the aggregate's `PickingEntry.childIds` and call `buildHighlightGeometry` for each child entry. `dxf-vuer`'s `useHighlight` composable does exactly that.

### Snap to geometry

Two pure helpers implement CAD-style **object snap** — finding the characteristic points of nearby geometry (endpoint, midpoint, center, quadrant, point-node) so a measurement / drawing tool can make clicks "stick" to real geometry. No Three.js / DOM dependencies; they back the measurement snap in `dxf-vuer` and are reused 1:1 by future React/Lit wrappers.

```ts
import {
  getEntitySnapPoints,
  findSnapPoint,
  type SnapPoint,
  type SnapResult,
  type SnapType,
} from "dxf-render";

// Low level: snap points of a single entity, in world coordinates.
// Pass the PickingEntry.worldMatrix so block-instance transforms are applied.
const points: SnapPoint[] = getEntitySnapPoints(entity, entry.worldMatrix ?? null);
// → [{ type: "endpoint", point: { x, y, z } }, { type: "midpoint", ... }, ...]

// High level: the best snap near a world position, across the whole drawing.
const snap: SnapResult | null = findSnapPoint(
  pickingIndex,
  entityIndex,        // from buildEntityIndex(dxf)
  { x: 104.1, y: 0 }, // cursor in DXF world coords (add originOffset back first)
  0.5,                // tolerance in world units (convert from a pixel aperture)
);

if (snap) {
  console.log(snap.type, snap.point, snap.handle, snap.distance);
  // e.g. "endpoint" { x: 104, y: 0, z: 0 } "A" 0.1
}
```

`findSnapPoint` bbox-culls `pickingIndex.entries` (2D, expanded by `tolerance`), resolves each surviving entity through `entityIndex`, computes its snap points with the entry's `worldMatrix`, and returns the best candidate within tolerance. INSERT aggregate entries are skipped (their children are separate entries), so block instances snap through their own transform.

When several candidates fall inside the aperture, priority decides (matching AutoCAD running-osnap), and the nearest breaks ties:

```
endpoint  <  midpoint  <  center = node  <  quadrant
```

Per-entity coverage of `getEntitySnapPoints`:

| Snap | Entities |
| ---- | -------- |
| `endpoint` | LINE, POLYLINE/LWPOLYLINE & MLINE & LEADER & MULTILEADER vertices, ARC/ELLIPSE arc ends, SOLID/3DFACE corners, SPLINE first/last fit (or control) point |
| `midpoint` | LINE, straight POLYLINE/MLINE/LEADER/MULTILEADER segments, ARC arc-midpoint |
| `center` | CIRCLE, ARC, ELLIPSE |
| `quadrant` | CIRCLE (0/90/180/270°), ARC (only cardinals within the sweep), ELLIPSE (axis tips within the sweep) |
| `node` | POINT |

Notes:

- Returns `[]` for TEXT/MTEXT/DIMENSION/ATTRIB/ATTDEF/HATCH/REGION/INSERT/XLINE/RAY — no precise vertex geometry to snap to.
- Proximity is measured in the **XY plane** (the cursor's unprojected world point carries no meaningful z), so entities drawn at a non-zero z still snap; the returned `point` keeps the geometry's true z.
- `tolerance` is in world units. Consumers driven by a screen cursor should convert a pixel aperture to world units (constant for an orthographic camera) — `dxf-vuer`'s `useSnap` does this and also draws the marker glyph.
- `findSnapPoint` returns `null` for a non-positive / non-finite `tolerance`.
- **Not yet handled:** polyline bulge-segment midpoints and entity-intersection snaps (crossings between two entities).

### Rectangle selection

`findEntriesInRect(pickingIndex, rect, options?)` returns every `PickingEntry` whose bounding box satisfies a window- or crossing-style rectangle test. Pure data — no DOM events, no Three.js raycasting. The same helper powers the `entities-select` event in `dxf-vuer` and is intended for future React/Lit wrappers to reuse 1:1.

```ts
import { findEntriesInRect, type WorldRect } from "dxf-render";

const rect: WorldRect = {
  minX: 100, minY: 200,
  maxX: 500, maxY: 600,
};

// AutoCAD convention: window = bbox fully inside, crossing = bbox overlaps.
const entries = findEntriesInRect(pickingIndex, rect, { mode: "crossing" });
for (const entry of entries) {
  console.log(entry.handle, entry.type, entry.layer);
}
```

Options:

- `mode: "window" | "crossing"` — default `"crossing"`. `"window"` keeps only entries fully inside the rect; `"crossing"` keeps anything that overlaps.
- `granularity: "aggregate" | "leaf"` — default `"aggregate"`. With `"aggregate"`, INSERT instances are returned as a single entry (the aggregate cover) and their child entries are skipped — mirroring AutoCAD's "an INSERT is one selectable block". `"leaf"` does the opposite: aggregates are skipped, every child entity is returned individually.

`rect` lives in the **same world-coordinate space as `PickingEntry.bbox`** (raw DXF world, BEFORE any `originOffset` subtraction). Consumers that compute the rectangle from canvas mouse positions need to add `originOffset` back to the unprojected world point before calling.

XLINE and RAY are intentionally absent from the picking index (infinite extent) and so are silently ignored. The result preserves the insertion order of `pickingIndex.entries`.

### Associations

`buildAssociations(dxf)` derives links between entities **strictly from DXF data**, no geometric heuristics:

| Kind            | How it's sourced                                                              |
| --------------- | ----------------------------------------------------------------------------- |
| `mleader`       | MULTILEADER inline `contextData` text (DXF code 304)                          |
| `leader`        | LEADER's `annotationHandle` (DXF code 340) → TEXT/MTEXT                       |
| `block-attribs` | INSERT entity with one or more ATTRIB children                                |
| `dimension`     | DIMENSION text override (or `actualMeasurement` fallback)                     |
| `group`         | ACAD_GROUP record from the OBJECTS section; name resolved via ACAD_GROUP dict |

```ts
interface EntityAssociation {
  id: string; // stable, e.g. "leader:B1"
  kind: AssociationKind; // 'mleader' | 'leader' | 'block-attribs' | 'dimension' | 'group'
  primary: string; // primary handle (see note below for group)
  members: string[]; // related handles — see note below for group
  text?: string;
  source: AssociationSource; // 'inline' | 'handle-ref' | 'attribs' | 'group-dict'
}
```

For `mleader` / `leader` / `block-attribs` / `dimension`, `primary` is a real
entity handle and `members` includes it. **For `kind: "group"`, `primary` is
the handle of the GROUP object itself** — not a renderable entity — so it is
excluded from `members`, which contains only the member entity handles. Calling
`viewer.highlight([association.primary])` for a group has no visible effect;
use `association.members` instead.

A handle can participate in multiple associations; index by member if you need reverse lookup:

```ts
import { buildAssociations } from "dxf-render";

const associations = buildAssociations(dxf);
const byHandle = new Map<string, typeof associations>();
for (const a of associations) {
  for (const m of a.members) {
    const list = byHandle.get(m) ?? [];
    list.push(a);
    byHandle.set(m, list);
  }
}

// "Given any entity, what is it linked to?"
const linkedToBd8 = byHandle.get("BD8");
```

ACAD_GROUP records are exposed at `dxf.objects.groups` (typed as
`Record<string, DxfGroup>`) for consumers that want the raw data without going
through `buildAssociations`. Each `DxfGroup` carries its `handle`, optional
`name` and `description`, `isUnnamed` / `isSelectable` flags, and
`entityHandles[]`.

### Text search

`findEntitiesByText(dxf, query, options?)` is a pure utility that returns handles of all entities whose displayable text matches `query`. Searches TEXT, MTEXT, ATTRIB, ATTDEF, DIMENSION text override, and MULTILEADER inline text — across top-level entities, INSERT ATTRIBs, and entities inside blocks.

```ts
import { findEntitiesByText } from "dxf-render";

// Case-insensitive substring (default)
findEntitiesByText(dxf, "PART-001");

// Case-sensitive
findEntitiesByText(dxf, "PART-001", { caseSensitive: true });

// Regex
findEntitiesByText(dxf, "^PART-\\d+$", { regex: true });
```

Returns `string[]` of DXF handles. Pair with the picking primitives + a camera helper for find-and-focus UX:

```ts
const found = findEntitiesByText(dxf, "PART-001");
const box = getZoomBox(pickingIndex, found, { originOffset });
if (box) fitCameraToBox(box, camera);
```

`findEntitiesByLayer(dxf, layerName, options?)` and `findEntitiesByType(dxf, type | type[])` cover the two other common queries — same coverage (top-level entities, INSERT ATTRIBs, entities inside blocks), no picking index needed:

```ts
import { findEntitiesByLayer, findEntitiesByType } from "dxf-render";

// All entities on the WALLS layer (case-sensitive by default — DXF spec)
findEntitiesByLayer(dxf, "WALLS");
findEntitiesByLayer(dxf, "walls", { caseSensitive: false });

// All TEXT + MTEXT handles
findEntitiesByType(dxf, ["TEXT", "MTEXT"]);

// Single type
findEntitiesByType(dxf, "DIMENSION");
```

### Measurements

Framework-agnostic geometry math for CAD measurement tools (linear ruler, area, angle). No Three.js / DOM dependencies — these back the distance / area / angle measurement tools in `dxf-vuer` and are reused 1:1 by future React/Lit wrappers.

```ts
import {
  measureDistance,
  measureArea,
  measureSignedArea,
  measurePerimeter,
  polygonSelfIntersects,
  measureAngle,
  measureDirectedAngle,
  toDegrees,
  toRadians,
  type MeasurePoint,
} from "dxf-render";

// Euclidean distance (2D or 3D; missing z is treated as 0)
measureDistance({ x: 0, y: 0 }, { x: 3, y: 4 }); // → 5
measureDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 2 }); // → 3

// Polygon area via Shoelace; z is ignored
const square: MeasurePoint[] = [
  { x: 0, y: 0 }, { x: 10, y: 0 },
  { x: 10, y: 10 }, { x: 0, y: 10 },
];
measureArea(square);        // → 100
measureSignedArea(square);  // → +100 (CCW); negative for CW winding
measurePerimeter(square);   // → 40 (closed loop, includes the last → first edge)

// Self-intersection test (proper crossings only)
polygonSelfIntersects(square); // → false
polygonSelfIntersects([
  { x: 0, y: 0 }, { x: 2, y: 2 },
  { x: 2, y: 0 }, { x: 0, y: 2 }, // bow-tie
]); // → true

// Unsigned angle at the vertex between two rays, in radians [0, π]
const a = measureAngle(
  { x: 0, y: 0 }, // vertex
  { x: 1, y: 0 }, // p1
  { x: 0, y: 1 }, // p2
);
toDegrees(a); // → 90

// Directed angle: CCW sweep from the first ray to the second, in [0, 2π)
const v = { x: 0, y: 0 };
toDegrees(measureDirectedAngle(v, { x: 1, y: 0 }, { x: 0, y: 1 })); // → 90
toDegrees(measureDirectedAngle(v, { x: 0, y: 1 }, { x: 1, y: 0 })); // → 270 (the reflex)
```

`MeasurePoint` is `{ x: number; y: number; z?: number }` — compatible with `DxfVertex` and `THREE.Vector3`-like objects, so you can pass DXF coordinates or unprojected canvas points directly.

Degenerate inputs are handled safely:

- `measureDistance` returns `0` for identical points and for any non-finite coordinate.
- `measureArea` / `measureSignedArea` return `0` for fewer than 3 points, for collinear polygons, and for non-finite coordinates. Open polygons (last vertex ≠ first) and closed polygons (last vertex == first) yield the same value.
- `measurePerimeter` returns `0` for fewer than 2 points or non-finite coordinates; it always adds the closing edge, so open and closed inputs yield the same value.
- `polygonSelfIntersects` returns `false` for fewer than 4 vertices and for non-finite coordinates. Only *proper* edge crossings count — edges that merely share a polygon vertex (or touch collinearly) are not flagged.
- `measureAngle` clamps the cosine into `[-1, 1]` to absorb floating-point noise that would otherwise push `Math.acos` out of its domain, and returns `0` when `vertex` coincides with `p1` or `p2`.
- `measureDirectedAngle` returns the directed counter-clockwise sweep in `[0, 2π)` (2D — `z` ignored). It preserves direction, so `measureDirectedAngle(v, b, a)` equals `2π − measureDirectedAngle(v, a, b)` (off the `0`/`2π` boundary) — use it when the sweep direction matters (e.g. an angle tool that distinguishes an angle from its reflex). Returns `0` for a coincident vertex or non-finite coordinates.

### Interaction constants

Framework-agnostic pixel / timing budgets for pointer tools (picking, rectangle selection, snap, measurement). They're exported so a wrapper — `dxf-vuer` or your own React / Lit binding — shares one source of truth instead of re-declaring the literals. Most consumers never need these; they matter when you build a custom interaction layer on top of the picking / snap / measurement primitives.

```ts
import {
  CLICK_DISTANCE_THRESHOLD_PX,   // 4  — px move above which a press is a pan, not a click
  DOUBLE_CLICK_MS,               // 350 — max gap between taps for a double-click
  DOUBLE_CLICK_DISTANCE_PX,      // 6  — max px gap between taps for a double-click
  ORIGIN_SNAP_RADIUS_PX,         // 12 — px radius to click-close an area polygon on its first vertex
  SNAP_TOLERANCE_PX,             // 12 — object-snap aperture
  SNAP_MARKER_PX,                // 11 — on-screen snap marker glyph size
  ANGLE_ARC_RADIUS_FRACTION,     // 0.4 — angle arc radius as a fraction of the shorter ray
  ANGLE_ARC_MIN_PX,              // 24 — arc radius lower clamp (px)
  ANGLE_ARC_MAX_PX,              // 80 — arc radius upper clamp (px)
  ANGLE_ARC_SEGMENTS_PER_TURN,   // 64 — arc tessellation per full turn
  MEASUREMENT_OVERLAY_RENDER_ORDER, // 999  — measurement overlay renderOrder
  SNAP_OVERLAY_RENDER_ORDER,        // 1000 — snap marker renderOrder (above measurement)
} from "dxf-render";
```

`SNAP_TOLERANCE_PX` / `SNAP_MARKER_PX` are screen pixels — convert the aperture to world units before calling `findSnapPoint` (constant scale for an orthographic camera). The render-order pair encodes a layering invariant: the snap marker always draws above the measurement overlays.

### Fonts

- `loadDefaultFont(): Promise<Font>` — load embedded Liberation Sans Regular
- `loadFont(url: string): Promise<Font>` — load custom .ttf/.otf font
- `getDefaultFont(): Font | null` — get loaded default font

### Utils

- `resolveEntityColor()` — resolve entity color with full priority chain
- `resolveEntityLinetype()` — resolve entity linetype
- `collectDXFStatistics()` — collect file statistics
- `getInsUnitsScale()` — unit conversion factor
- `measureDistance()` / `measureArea()` / `measureSignedArea()` / `measurePerimeter()` / `polygonSelfIntersects()` / `measureAngle()` — see [Measurements](#measurements)

### Types

Full TypeScript types exported: `DxfData`, `DxfEntity`, `DxfLayer`, `DxfHeader`, and 25+ entity-specific types with type guards (`isLineEntity`, `isCircleEntity`, etc.).

## Supported entities

22 rendered entity types: LINE, CIRCLE, ARC, ELLIPSE, POINT, POLYLINE, LWPOLYLINE, SPLINE, TEXT, MTEXT, DIMENSION, INSERT, SOLID, 3DFACE, HATCH, LEADER, MULTILEADER, MLINE, XLINE, RAY, ATTDEF, REGION, plus ATTRIB within INSERT blocks and HELIX via SPLINE.

REGION entities are rendered without decoding their ACIS modeler data: when a HATCH lists the REGION as a source object via DXF codes 97/330, the REGION borrows that HATCH's already-parsed boundary edges (lines, arcs, ellipses, splines, polyline vertices) for its visible contour. Color, layer and linetype come from the REGION itself; OCS from the HATCH. REGIONs with no HATCH referencing them are silently skipped.

POLYLINE/LWPOLYLINE support includes per-vertex variable width (tapering), constant-width segments, arrows, donuts, and bulge arcs — all rendered as triangle-strip mesh geometry with proper miter joins at corners.

### Dimension & leader arrowheads

DIMENSION endpoints and LEADER tips honour the DXF block referenced by the DIMSTYLE (codes 342 / 341 for DIMBLK / DIMLDRBLK) or by the header `$DIMBLK`. All 18 standard AutoCAD block names are recognised and rendered with the correct shape:

- **Arrow-shaped**: `_ClosedFilled` (AutoCAD default), `_Closed` / `_ClosedBlank`, `_Open` / `_Open30` / `_OpenArrow`, `_DatumFilled` / `_DatumBlank`
- **Ticks**: `_ArchTick`, `_Oblique`, `_Small`, `_Tick`
- **Dots**: `_Dot`, `_DotSmall`, `_DotBlank`, `_DotSmallBlank`
- **Rings**: `_Origin`, `_Origin2`
- **Boxes**: `_Box`, `_BoxFilled`
- **Other**: `_Integral`, `_None`

Names are matched case-insensitively, with an optional leading underscore. Unknown DIMBLK names fall back to `_ClosedFilled` (matching AutoCAD's default), but for LEADERs an unknown DIMLDRBLK name first tries to render the user-defined block geometry. `DIMTSZ > 0` forces tick rendering regardless of DIMBLK. The "outside arrows" flip for short dim lines only applies to direction-dependent arrow-shape kinds — dots, ticks, boxes and origin rings always sit at the endpoint.

## Comparison

| Feature                   | dxf-render                  | dxf-viewer   | dxf-parser | three-dxf |
| ------------------------- | --------------------------- | ------------ | ---------- | --------- |
| DXF parsing               | ✅                          | ✅           | ✅         | ✅        |
| Three.js rendering        | ✅                          | ✅           | ❌         | ✅        |
| Entity types              | 22 rendered                 | ~15          | ~15 parsed | ~8        |
| Variable-width polylines  | ✅ tapering, arrows, donuts | ❌           | —          | ❌        |
| Linetype patterns         | ✅ DASHED, CENTER, DOT...   | ❌ all solid | —          | ❌        |
| All dimension types       | ✅ 7 types                  | linear only  | —          | ❌        |
| Standard arrowhead blocks | ✅ 18 kinds (DIMBLK)        | ❌           | —          | ❌        |
| LEADER / MULTILEADER      | ✅                          | ❌           | —          | ❌        |
| HATCH patterns            | ✅ 25 built-in              | ✅           | —          | ❌        |
| OCS (Arbitrary Axis)      | ✅ full                     | Z-flip only  | —          | ❌        |
| Vector text (opentype.js) | ✅                          | ✅           | —          | ❌        |
| Geometry merging          | ✅                          | ✅           | —          | ❌        |
| Dark theme                | ✅ instant switch           | bg only      | —          | ❌        |
| TypeScript                | ✅ native                   | .d.ts        | ✅         | ❌        |
| Tests                     | 1141 tests                  | 0            | ✅         | 0         |
| Web Worker parsing        | ✅                          | ✅           | ❌         | ❌        |
| Parser-only entry         | ✅ zero deps                | ❌           | ✅         | ❌        |
| Framework                 | agnostic                    | agnostic     | —          | agnostic  |
| Bundle size               | ~960KB                      | ~1.2MB       | ~50KB      | ~30KB     |
| Last updated              | 2026                        | 2024         | 2023       | 2019      |

## Bundle sizes

| File         | Size    | Note                                         |
| ------------ | ------- | -------------------------------------------- |
| Main bundle  | ~960 KB | Includes font + opentype.js + inline worker  |
| Parser chunk | ~50 KB  | Zero dependencies                            |
| Serif font   | ~525 KB | Lazy-loaded only when serif fonts referenced |

## License

MIT
