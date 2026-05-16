# Changelog

## 1.6.0

### Features

- **Standard AutoCAD arrowhead blocks** — full support for all 18 standard names at DIMENSION endpoints and on LEADER/MULTILEADER tips: `_ClosedFilled` (default), `_Closed` / `_ClosedBlank`, `_Open` / `_Open30` / `_OpenArrow`, `_DatumFilled` / `_DatumBlank`, `_ArchTick`, `_Oblique`, `_Small`, `_Tick`, `_Dot` / `_DotSmall` / `_DotBlank` / `_DotSmallBlank`, `_Origin` / `_Origin2`, `_Box` / `_BoxFilled`, `_Integral`, `_None`. New `render/arrowheads.ts` module owns the geometry; `DimVars.arrowKind` (discriminated `ArrowKind` union) replaces the previous `useTicks` boolean. The "outside arrows" flip for short dim lines now only fires for direction-dependent arrow-shape kinds — dots, ticks, boxes and origin rings sit at the endpoint as-is. For LEADERs an unknown DIMLDRBLK name falls back to the user-defined block geometry.
- **REGION entities** — parsed (minimally; ACIS modeler data skipped) and rendered as their own contour. When a HATCH lists the REGION's handle in its boundary path source objects (DXF codes 97/330), the REGION borrows the HATCH's already-parsed boundary edges as its visible curve. Drawn with the REGION's own color/layer/linetype (OCS comes from the HATCH). Pickable too. New parser pass `linkRegionsToHatchBoundaries`; new renderer `collectors/regionCollector.ts`.
- **`STYLE.widthFactor` (DXF code 41)** — now honored across TEXT, ATTRIB, ATTDEF, MTEXT and DIMENSION text. A STYLE explicitly authored as narrow (e.g. ISO-25 with `widthFactor=0.8`) no longer renders at width factor 1. Priority chain: `entity.xScale` / `entity.scale` → `STYLE.widthFactor` → `1.0`. MTEXT seeds the initial format-state `widthFactor` from STYLE; inline `\W<n>;` still overrides. DIMENSION text resolves via DIMSTYLE.DIMTXSTY (code 340) → STYLE → widthFactor, threaded through the dim-line gap calculation so breaks stay correct under stretch.
- **MTEXT inline scoped formatting `{…}`** — `\C`, `\H`, `\f`, `\L\l`, `\O\o`, `\K\k` inside brace groups now apply only to that scope and revert on the closing brace. Previously every formatting code inside braces was stripped. The line model was replaced with a runs model: each `MTextLine` carries an ordered array of `MTextRun` segments, each with its own color/height/bold/italic/font/underline/overline/strikethrough. Word-wrap, tabs and 9-point attachment alignment now operate across all runs of a line. Overline (`\O`) and strikethrough (`\K`) decorations are also drawn (previously silently stripped). New exports: `MTextRun` interface and `getMTextLineText(line)` helper.
- **MTEXT inline `\W<n>;` (width factor) and `\Q<n>;` (obliquing angle)** — `\W2;` makes glyphs twice as wide; `\Q15;` shears them by 15° (positive slants right). Both codes participate in brace scoping and combine with other formatting. Word-wrap and inter-run advance account for the width factor.
- **Angular dimension precision (`DIMADEC`)** — DIMSTYLE code 179 and header `$DIMADEC` are now read; angular dim labels use them for decimal places instead of the linear `DIMDEC`.
- **Radial dimension state-machine** — radial dims are now rendered through a proper layout state-machine driven by `DIMTIH` (74), `DIMTOH` (73), `DIMTAD` (77), `DIMGAP` (147), `DIMTMOVE` (279) and `DIMUPT` (288), instead of a hard-coded ANSI horizontal layout. Aligned mode (ISO default): dim line follows the radius angle with DIMTAD-driven break/continue around text and DIMTMOVE-driven connectors. Horizontal mode (ANSI): preserved. New DIMSTYLE fields: `dimtad`, `dimgap`, `dimtmove`, `dimupt`, `dimatfit`. New header keys: `$DIMTAD`, `$DIMTIH`, `$DIMTOH`, `$DIMTMOVE`.
- **Binary DXF detection** — `parseDxf` now rejects AutoCAD Binary DXF files with a clear message (`"Binary DXF format is not supported. Save the file as ASCII (text) DXF and try again."`) instead of failing later with a cryptic scanner error. Detection is a single `startsWith("AutoCAD Binary DXF")` on the decoded text and works for sync `parseDxf`, async `parseDxfAsync`, and the Vue `loadDXFFromBuffer` pipeline.

### Bug Fixes

- **ATTRIB/ATTDEF FIT/ALIGNED** — `horizontalJustification = 3` (ALIGNED) or `= 5` (FIT) now render correctly between the two alignment points instead of being anchored at the second one. Affects both `renderAttribs` (inside INSERT) and `collectAttdefEntity`.
- **Wide LWPOLYLINE/POLYLINE with a width discontinuity at a vertex** — e.g. an arrow drawn as two segments (`0/0` then `120/0`). The junction is now re-emitted as a duplicate center point so the wider segment opens at its real start width instead of inheriting the previous segment's end width. Zero-width segments inside an otherwise-wide polyline are also rendered as thin lines (a zero-area mesh strip is invisible).
- **Wide LWPOLYLINE/POLYLINE inside a scaled INSERT** — thickness now scales with the parent matrix. Previously `halfWidth` stayed in entity-local units while the path was transformed, so a polyline inside an INSERT with scale 225 (typical for pre-rendered dim blocks with `_ArchTick` arrowheads) kept its 0.4-unit thickness and rendered sub-pixel.
- **Nested DIMENSION inside a block** — now uses its pre-rendered associated block (`entity.block`) when present, instead of falling through to the DIMSTYLE-synthesizing path. The dispatch in `insertCollector.ts` previously ignored `entity.block` for in-block dimensions — only the top-level dispatch checked it. New `processDimensionEntity` helper shared by all three call sites.
- **DIMENSION with a pre-rendered associated block (`entity.block`)** — rendered through the block instead of synthesized from DIMSTYLE rules. AutoCAD/Revit/Civil3D stash WYSIWYG dim geometry (lines, arrowheads, MTEXT) into anonymous `*D###` / `DIMBLOCKn-…` blocks; reading those directly bypasses any `DIMTXT × DIMSCALE` mismatch in the source DIMSTYLE. Fallback to the DIMSTYLE path when the dim has no block or the block is empty.
- **Render order** — solid fills (HATCH, SOLID, 3DFACE) no longer cover block outlines that were added to the scene before flush. Each material kind now carries an explicit `renderOrder` (`MESH=0`, `LINE=1`, `OVERLAY=2`); a stable sort runs after `GeometryCollector.flush()` so hatches draw first, then outlines, then text/arrows, regardless of when each object joined the group.
- **MULTILEADER entities from real AutoCAD-2018 files now render** — `CONTEXT_DATA` parser used wrong section codes (301/302 instead of 302/304) and squashed every closing `}` under one case; `entity.leaders` ended up empty and `entity.text` was overwritten with the literal `"LEADER_LINE{"`. Codes are now correctly paired per-level. `leaderCollector` no longer drops a LEADER_LINE that carries only the arrow-tip vertex.
- **MULTILEADER `textHeight` and `arrowSize`** — read from the correct DXF codes. `textHeight` now comes from CONTEXT_DATA code `41` (was reading `40` = OverallContentScale ≈ 1.0, making labels invisible on multi-thousand-unit drawings); `arrowSize` from entity-level code `42`.
- **MULTILEADER line and text colors** — honor AutoCAD's CmEntityColor / MLEADERSTYLE precedence chain. Entity-level color codes (`91` LeaderLineColor, top-scope `90` TextColor, `340` styleHandle, `90` PropertyOverrideFlag) are now parsed. New `parser/sections/objects.ts` reads `MLEADERSTYLE` records out of OBJECTS. `decodeCmEntityColor(raw)` decodes the 32-bit `AcCmEntityColor` value. `resolveMLeaderColor` walks: entity-override → MLEADERSTYLE → fallback. Separate `lineColor` and `textColor` are derived per MULTILEADER.
- **Spline-shaped MULTILEADER leaders** — `LeaderLineType` flag at entity-level code `170` (0=invisible, 1=straight, 2=spline) is now parsed. Spline mode interpolates a LEADER_LINE with 3+ points as a Catmull-Rom curve; the common 1-vertex case builds a cubic Bezier whose end-tangent at the landing follows the LEADER's `doglegVector`, so the curve enters the dogleg shelf tangentially. Arrow direction follows the curve's tangent at the tip.
- **Aligned radial dims with text outside the arc and diametric dims with off-segment text** — now extend the dim line past each arrow base by `arrowSize × OUTSIDE_ARROW_TAIL_RATIO`, so the arrow reads as a shaft + head instead of a bare triangle.
- **Diametric dimensions with off-segment text honor DIMTOH** — `DIMTOH=0` (ISO default) extends the diameter line past the nearest endpoint outward to the far edge of the text and rotates the text to match the diameter direction. The previous leader + horizontal text + shelf path is preserved for explicit `DIMTOH=1` (ANSI).
- **Diametric dimensions with on-segment text** — projected-onto-segment text (`t ∈ [0,1]`) renders aligned to the diameter regardless of perpendicular distance from the line. The previous `perpDist < textHeight` constraint forced default-position dims with a normal DIMTAD=1 offset into the wrong "leader + horizontal text" branch.
- **Aligned-text radial dim text position** — mirrored across the radius axis when the source CAD wrote `textPos` on the perp side opposite to the readable rotation's "above". Previously the readability flip silently inverted the perpendicular convention, putting glyph ascenders pointing at the line.
- **`DIMTIH` and `DIMTOH` read only from DIMSTYLE** — header `$DIMTIH`/`$DIMTOH` are AutoCAD's editor-current values for creating new dimensions, not defaults for rendering existing ones. Missing DIMSTYLE fields now propagate as `undefined` (interpreted as 0 / ISO aligned).
- **DIMCLRT for specialized dimension types** — angular, radial, diametric, ordinate now use DIMSTYLE's `DIMCLRT` for text color instead of inheriting the dim entity's geometry color. New `textColor` field on `DimensionTypeParams` wired through `addDimensionTextToCollector` in all four specialized helpers.
- **TEXT/MTEXT/ATTRIB/ATTDEF bold/italic via `styleName`** — STYLE-table parser now reads ACAD XDATA descriptor (code 1071) and unpacks bits 24 (italic) and 25 (bold) into `DxfStyle.bold` / `DxfStyle.italic`. Text collectors look them up at emit time so e.g. `arial b` (fontFile `Arial Bold.ttf`) renders through faux-bold. MTEXT inline `\f...|b0|i0;` still overrides per-run.
- **DIMSTYLE DIMCLRD (code 176) and DIMCLRE (code 177)** — parsed and applied so dim line / arrows / extension lines pick up the colors configured in the style instead of always inheriting the dimension entity's color. Values `0` (BYBLOCK) and `256` (BYLAYER) fall back to entity color. ACI 7/255/250/251 routed through theme-adaptive sentinels.
- **Per-entity XDATA DSTYLE override: DIMDEC (271) and DIMADEC (179)** — override chain is now `entity XDATA → DIMSTYLE → header → default` for these two as well. Previously only DIMTXT/DIMASZ/DIMSCALE were handled.
- **Short linear/rotated/aligned dimensions flip arrows outward** — when dim line length is below `2.5 × arrowSize`, arrowheads are placed with tips at the extension lines pointing inward and bases sitting outside; the dim line extends past each arrow base by a tail so each side reads as a proper arrow. Previously inward-pointing arrows formed a "bowtie" / diamond for tiny dimensions.
- **Dimension labels in decimal mode honor `DIMDEC` and `DIMZIN`** — `formatDimNumber` previously ignored `DIMDEC` and rendered with hardcoded 4-place precision. DIMZIN bit 2 (`& 4`) suppresses leading zeros, bit 3 (`& 8`) trailing zeros; when DIMZIN is absent the previous strip-trailing default is preserved.
- **DIMCLRT and MTEXT inline `\C<index>;`** — route ACI 7/255 and grays 250/251 through theme-adaptive sentinels (`ACI7_COLOR`, `\0ACI250/251`) instead of resolving directly to a literal hex. A new `aciToColor()` helper centralizes the rule.
- **LWPOLYLINE parser no longer aborts on code 91 (Vertex Identifier)** — previously fell into the `default` branch, returned a truncated vertex list, then re-entered with another partial run padded with `{x: undefined, y: undefined}` vertices. Three.js rendered the `undefined` coords as stray lines reaching to the world origin.
- **HATCH solid fills with elliptic-arc boundary edges (edge type 3)** — DXF stores start/end angles in **degrees** for edge type 3 (codes 50/51), unlike the ELLIPSE entity (codes 41/42) which uses radians. Values were previously passed as radians, so triangulated fills collapsed.
- **Layer flag bit 2** — bit 0x02 ("frozen by default in new viewports") no longer hides layers in model space; only bit 0x01 controls `frozen` per the DXF spec.
- **Architectural dimension fractions honor `DIMDEC`** — fraction denominator is `2^DIMDEC` instead of a hardcoded 16 (1/16"). E.g. `DIMDEC=3` renders `6'-1 3/8"` instead of `6'-1 5/16"`. `DIMDEC=0` rounds to whole inches. Defaults to 1/16" when not specified.
- **Entities on layer "0" inside a block inherit the parent INSERT's effective color** — per AutoCAD convention. Includes ATTRIBs attached to INSERT. The cached block template fast path stores a `BYBLOCK_COLOR` sentinel for layer-0 ByLayer entities and resolves it to `insertColor` at instantiation.
- **`arraybufferPlugin` rewritten** to use `resolveId` + virtual modules instead of `transform`. Now works in Vite dev server (Vite's built-in asset middleware previously intercepted `.ttf?arraybuffer` requests before the plugin could run). Production output unchanged.

### Stats

- 1141 tests across 52 files (was 945 across 44).

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
