# Changelog

## 3.0.0

This release adds a full interaction layer (measurement tools, geometry snap,
rectangle selection, rulers, a properties panel, layer grouping) on top of a
breaking CSS rename that unifies the styling surface with the new `dxf-react` and
`dxf-lit` wrappers.

### Breaking changes

- **All public CSS classes renamed to a unified `.dxfk-*` prefix.** The old names (`.dxf-viewer`, `.viewer-toolbar`, `.toolbar-button`, `.layer-panel`, `.layer-panel-header`, `.layer-item`, `.file-uploader`, `.file-button`, `.dxf-statistics`, `.unsupported-entities`, etc.) are gone. The new prefix is framework-neutral so the `dxf-react` and `dxf-lit` wrappers share the same class surface. Rename one-to-one in your overrides — see [README → Migration from v2.x](./README.md#migration-from-v2x) for the full table.
- **CSS custom properties renamed `--dxf-vuer-*` → `--dxfk-*`.** Same motivation: framework-neutral surface across wrappers. Internal `var(--dxfk-X, fallback)` ensures components still work without `import "dxf-vuer/style.css"`.
- **Dark-theme overrides moved out of `DXFViewer`.** Previously the viewer reached into `ViewerToolbar` and `LayerPanel` via 15 `::v-deep` (`:deep()`) selectors. Those are removed; each child now accepts a `darkTheme` boolean prop and owns its own dark styles locally. If you used `<ViewerToolbar>` or `<LayerPanel>` standalone with `:deep(.toolbar-button)` from a parent, switch to passing `:dark-theme` directly.

### Features

#### Measurement tools

- **Distance / area / angle measurement** — three mutually-exclusive on-canvas tools selected via a single `v-model:measure-mode` (`"none" | "distance" | "area" | "angle"`, default `"none"`). **Distance:** click two points for the Euclidean distance, shown as an HTML label above the midpoint. **Area:** click N vertices for a polygon (live outline + translucent fill + vertex markers) with live area + perimeter at the centroid — closes on double-click, a click on the first vertex, or <kbd>Enter</kbd> (≥3 vertices); <kbd>Backspace</kbd> removes the last vertex; self-intersecting polygons are measured as-is with `selfIntersecting: true`. **Angle:** a 3-point directed angle swept counter-clockwise `[0°, 360°)` with a live ray + arc preview. <kbd>Esc</kbd> cancels any tool. Pan/zoom stay usable; picking and rectangle-selection auto-suspend while a tool is active. New props `showMeasureButton` / `showMeasureAreaButton` / `showMeasureAngleButton`, `measureUnits`, `measureAreaUnits` (`AreaUnits`), `measureAngleUnits` (`AngleUnits` — `deg` / `rad` / `dms`), `measureColor`. New events `measure` / `measure-area` / `measure-angle` / `measure-cancel` + `update:measureMode`. New methods `clearMeasure()` / `setMeasureMode(mode)`. New `ViewerClasses` label slots (`measureLabel` / `measureAreaLabel` / `measureAngleLabel`) and `--dxfk-measure-color`. New types `MeasureMode`, `AreaUnits`, `AngleUnits`, `MeasureResult`, `AreaMeasureResult`, `AngleMeasureResult`.
- **Snap-to-geometry for measurements** — new `snapToGeometry` prop (default `true`). While any measurement mode is active, clicks snap to the nearest endpoint / midpoint / center / quadrant / point-node, and an AutoCAD-style marker glyph (square / triangle / circle / diamond / cross, tinted with `measureColor`) tracks the cursor. Active only during measurement; works with or without `pickingEnabled`. Backed by `findSnapPoint` from `dxf-render`.

#### Selection & highlight

- **Rectangle selection** — new props `rectangleSelection` (default `false`), `rectangleSelectionModifier` (`shift` / `ctrl` / `alt`), `rectangleSelectionMode` (`auto` / `window` / `crossing`). Hold the modifier and drag to select multiple entities; AutoCAD direction-based mode (L→R = window, solid blue; R→L = crossing, dashed green). <kbd>Esc</kbd> cancels. New events `entities-select` / `selection-start` / `selection-end`, new `ViewerClasses.selectionRect`, and `--dxfk-selection-rect-*` CSS custom properties (dark-theme defaults).
- **Precise geometric highlight** — `useHighlight` now traces the visible geometry of the hovered / highlighted entity (line, circle, arc, polyline with bulge, spline, hatch contour, INSERT children) instead of a single bounding box; falls back to bbox edges for TEXT / MTEXT / DIMENSION / ATTRIB / ATTDEF / POINT. `highlight(handles)` / `clearHighlight()` signatures unchanged.

#### Rulers & properties

- **Rulers** — `showRulers` (default `false`), `rulerUnits` (`dxf-units` / `mm` / `inch`). Horizontal + vertical rulers with zoom-adaptive tick step, a cursor position marker, and a corner unit badge. DPI-aware `<canvas>` synced to pan/zoom. New `ViewerClasses` keys `rulerHorizontal` / `rulerVertical` / `rulerCorner`; `RulerUnits` type exported.
- **`<PropertiesPanel>`** — optional read-only properties panel for the entity selected via picking. New props `showPropertiesPanel` (default `false`) and `propertiesPanelPosition`; new `clearSelection()` method and `ViewerClasses.propertiesPanel` slot. Groups properties into General + per-type Geometry + Text. The pure `getEntityProperties(entity)` helper plus `PropertyRow` / `PropertySection` types are exported so consumers can render a custom layout.

#### Layers

- **Controlled layer visibility — `v-model:hidden-layers`** — optional `hiddenLayers` prop + `update:hiddenLayers` emit. When provided, the viewer is controlled (parent owns the state; `persistLayersKey` is ignored); when omitted, behavior is unchanged. Frozen layers never appear in the array, unknown names are ignored, and the initial state on load is not emitted.
- **Layer auto-grouping by prefix** — new `groupLayers?: boolean | GroupLayersByPrefixOptions` prop on `<DXFViewer>` / `<LayerPanel>` (default `false`). Buckets layers by common prefix (`A-WALL`, `A-DOOR` → group `A`) with a collapsible group header, a `visible / total · entities` counter, and a four-state batch eye-toggle. New `.dxfk-layer-group*` hook classes; dark theme supported.
- **Highlight-on-layer-hover** — hovering a `<LayerPanel>` row highlights every entity on that layer via the precise highlight overlay. New `layer-hover(layerName | null)` event (forwarded from `<DXFViewer>`); active when `highlightOnHover` + `pickingEnabled` are on.

#### Styling

- **Stable hook classes documented.** Every overlay and component root carries a single-class, low-specificity `.dxfk-*` selector — safe for plain CSS overrides and Tailwind `@apply`. See [README → Customizing styles](./README.md#customizing-styles).
- **`classes` prop on `DXFViewer`** (Headless UI-style): a map of `.dxfk-*` root slots (`root`, `toolbar`, `layerPanel`, `propertiesPanel`, `rulerHorizontal` / `rulerVertical` / `rulerCorner`, `selectionRect`, `measureLabel` / `measureAreaLabel` / `measureAngleLabel`, overlays). Each key concatenates onto the matching root. New `ViewerClasses` type exported.
- **Flattened nested selectors.** Removed `.warning-header svg`, `.stat-section h4`, `.message-content.error svg` in favour of single-class selectors. All selectors are now specificity `0,1,0`, so Tailwind utility classes can win without `!important`.

#### Composables

- New composables exported for headless integrations: `useMeasurement`, `useAreaMeasurement`, `useAngleMeasurement`, `useSnap`, `useRectangleSelection`. Pure helpers `resolveSelectionMode` / `normaliseScreenRect` / `buildWorldRect` and formatters `formatMeasureValue` / `formatAreaValue` / `formatAngleValue` exported alongside. `useLayers` gains controlled mode (`getControlledHidden` / `onChange` options + `setHiddenLayers` + `hiddenLayerNames`). New `#toolbar` slot scope bindings wire all three measurement tools from a custom toolbar.

### Bug Fixes

- **Layer-panel entity counts now include entities defined inside blocks.** Counts use the flat entity index (`findEntitiesByLayer`), so a layer whose entities live only in block definitions no longer shows `0`.
- **Hidden / frozen layers are no longer interactive.** Entities on a layer turned off (or frozen) can no longer be picked, caught by rectangle selection, or used as snap targets. Programmatic `highlight(handles)` / `zoomToEntity` still work on any layer.
- **Measurement overlays are cleared when a new DXF is loaded.** A completed measurement no longer lingers over the next drawing.
- **Measurement HTML labels follow pan/zoom.** Labels re-project on every `controls.change` instead of freezing at their initial screen position.
- **Standalone `:url` load clears the empty-state overlay** and keeps pan/zoom working. `hasDXFData` now derives from any active source (`dxfData` prop OR data loaded via `url` / `loadDXFFromText` / drag-and-drop) instead of only `props.dxfData`.

### Refactored

- The interaction state machines (pointer-tool base, distance/area/angle measurement, snap, rectangle selection, picking, highlight) were extracted to the new **`dxf-interaction`** package; the composables are now thin Vue bindings over its `createX(...)` factories. No public API change — same composables, exports, types, formatters and reactive surfaces. `dxf-interaction` is added as a regular dependency so it installs transitively (invisible to consumers).
- `DXFViewer.vue` decomposed into focused internal composables (`useViewerUnits`, `useMeasureLabels`, `useCursorCoordinates`, `useDragAndDrop`, `useFullscreen`); the three measurement composables now share an internal `usePointerTool` base (~600 fewer lines). No change to props, emits, slots, methods or behavior.

### Documentation

- README now leads with "Vue 3 DXF viewer component" and a "Why dxf-vuer?" feature list; new "Customizing styles" section (hook-class table, CSS-override / Tailwind / `classes` examples) and a v2.x → v3.0 migration table. npm keywords extended (`vue-dxf`, `vue-dxf-viewer`, `vue-component`, `dxf-vuer`).

### Migration

Drop-in for most projects — only style overrides need rewriting. See the rename table in [README → Migration from v2.x](./README.md#migration-from-v2x).

### Dependencies

- Requires `dxf-render` ≥ 1.7.0 (highlight geometry, geometry snap, rectangle-select, measurement & layer-grouping utilities, ACAD_GROUP associations, shared interaction constants).

## 2.6.0

### Features

- **`persistLayersKey` prop** — opt-in persistence of layer visibility via `localStorage`. When set, hidden layer names are stored under `${persistLayersKey}:${fileName || 'default'}` and restored on the next load of the same file. Stored names that no longer exist in the current DXF are silently ignored. Disabled by default.
- **Keyboard navigation** — arrow keys pan (5% of viewport per press), `+`/`=` and `-`/`_` zoom in/out (×1.2 per press), `0` resets the view. Active when the canvas is focused; new prop `keyboardNavigation` (default `true`) toggles the listener. Canvas is now focusable (`tabindex="0"`).
- **`viewer.zoomToLayer(layerName)`** — imperative method on the viewer ref that fits the camera to all entities of a given layer. Requires `pickingEnabled`.
- **Public composable `useKeyboardNavigation`** — exported for advanced integrations that bypass `<DXFViewer>`.
- **ARIA improvements** — `role="region"` + `aria-label` on the viewer container, `role="toolbar"` + per-button `aria-label`/`aria-pressed` on the toolbar, `role="region"` + `aria-expanded` on the layer panel header, per-layer toggles get `role="button"` + `aria-pressed`/`aria-disabled` and Enter/Space keyboard activation, loading overlay is `role="status" aria-live="polite"`, error overlay is `role="alert" aria-live="assertive"`, viewer container reflects `aria-busy` during loads.

### Dependencies

- Requires `dxf-render` ≥ 1.5.0 (new `getZoomBoxForLayer`, `findEntitiesByLayer`, `findEntitiesByType`).

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
