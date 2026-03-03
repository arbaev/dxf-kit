# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-03-03

### Added

- **Dark theme** — new `darkTheme` prop: dark scene background (#1a1a1a), ACI 7 rendered as white, dark overlays for all UI elements including layer panel, coordinates, toolbar, and loading spinner
- **Drag-and-drop** — new `allowDrop` prop enables dropping DXF files directly onto the viewer area; visual "Drop DXF file here" overlay during drag; emits `file-dropped` event with file name
- **Export to PNG** — new `exportToPNG()` exposed method and `showExportButton` prop for toolbar button; downloads current view as PNG file
- **Loading by URL** — new `url` prop to fetch and display DXF files from a remote URL; `loadDXFFromUrl()` exposed method
- **Loading progress bar** — progress bar with percentage shown during the rendering phase; separate loading phases: fetching, parsing, rendering
- **`showFullscreenButton` prop** — control visibility of the fullscreen button (default: `true`)
- **`showFileName` prop** — control visibility of the file name overlay (default: `true`)
- **Geometry merging** — entities merged by layer+color into shared `LineSegments`/`Points`/`Mesh` buffers, reducing draw calls by ~78% on complex drawings
- **Block template caching** — frequently used INSERT blocks parsed once and instantiated via matrix transforms; `INSTANCING_THRESHOLD=2`
- **Web Worker parsing** — DXF parsing offloaded to an inline Web Worker to keep UI responsive; automatic fallback to main thread if Workers are unavailable
- **Time-sliced rendering** — entity processing yields to the main thread every ~16ms, preventing UI freezes on large files; cancellation support for fast file switching
- **Shared canvas for text** — single canvas reused for all text/dimension textures, eliminating per-entity DOM allocations
- **Camera fit from header extents** — uses `$EXTMIN`/`$EXTMAX` from DXF header for instant camera fitting instead of computing bounding box from geometry
- Test suite expanded from 465 to 492 cases across 22 files

### Changed

- Coordinates panel moved to bottom-left, layer panel to bottom-right
- Coordinates panel styled consistently with other overlays (light background with border); values displayed in two rows with fixed-width columns
- Main bundle size: ~89 KB → ~145 KB (includes inline Web Worker with parser)
- `preserveDrawingBuffer` enabled on WebGL renderer to support PNG export

## [1.1.0] - 2026-03-02

### Added

- **Linetype rendering** — all DXF line patterns (DASHED, HIDDEN, CENTER, PHANTOM, DOT, DASHDOT etc.) via geometric splitting; resolution chain: entity → ByBlock → ByLayer → LTYPE table; scaling entityScale × $LTSCALE; auto-LTSCALE for large drawings
- **Hatch pattern rendering** — 25 built-in AutoCAD patterns (ANSI31–38, BRICK, DOTS, NET, HEX, GOST_* etc.); pattern scale/angle, dot elements, multi-boundary even-odd clipping (donut shapes), fallback dictionary
- **OCS (Object Coordinate System)** — Arbitrary Axis Algorithm for 10 entity types; correct rendering of mirrored/rotated entities
- **ATTRIB rendering** in INSERT blocks — attribute text with alignment, rotation, individual color
- **Frozen and locked layer support** — snowflake/lock icons in layer panel
- **Paper space filtering** — entities with `inPaperSpace` (DXF code 67=1) skipped during rendering
- **World coordinates display** — new `showCoordinates` prop shows cursor position in drawing units
- **Fullscreen button** in the viewer toolbar
- **Test suite** expanded from 379 to 465 cases across 21 files

### Fixed

- Dashed line patterns invisible on large blueprints (auto-LTSCALE from drawing extents)
- Dimension extension line dashes not scaling with drawing size
- Hatch pattern lines not reaching boundary when base point is far from polygon

### Changed

- Composables directory restructured from `composables/dxf/` to `composables/`
- Main bundle size increased from ~75 KB to ~89 KB

## [1.0.1] - 2026-02-26

### Added

- **Test suite** -- 379 test cases covering all testable business logic (Vitest 4)
  - DXF parser core: scanner, parseHelpers, parseDxf, parseEntities
  - All 21 entity handlers: LINE, CIRCLE, ARC, POINT, ELLIPSE, SOLID, 3DFACE, POLYLINE, LWPOLYLINE, SPLINE, TEXT, MTEXT, ATTDEF, DIMENSION, INSERT, HATCH, LEADER, MULTILEADER, VIEWPORT, IMAGE, WIPEOUT
  - Section parsers: HEADER, TABLES, BLOCKS
  - Utilities: colorResolver, dxfStatistics, 16 type guards
  - Geometry: text formatting, dimension math, hatch clipping, angle conversion
  - Vue composable: useLayers
- **CI pipeline** -- GitHub Actions workflow (`ci.yml`) runs type check, build, and tests on push/PR to main (Node.js 20 + 22)

### Fixed

- TypeScript strict mode errors in test files (unused imports, type narrowing)

## [1.0.0] - 2026-02-25

### Added

- **Vue 3 component library** with five ready-to-use components:
  - `DXFViewer` -- main viewer with Three.js/WebGL rendering, layer panel, loading spinner, file name overlay, and reset button
  - `FileUploader` -- file input button that emits selected DXF files
  - `LayerPanel` -- collapsible layer visibility toggles with color indicators
  - `UnsupportedEntities` -- collapsible list of unsupported entity types found in the file
  - `DXFStatistics` -- file statistics including size, entity counts, layers, blocks, and AutoCAD version
- **Built-in DXF parser** with zero external dependencies -- custom lexer and section parsers handle the full DXF structure (HEADER, TABLES, BLOCKS, ENTITIES)
- **Parser-only entry point** (`dxf-vuer/parser`) that works without Vue or Three.js, suitable for server-side or headless use
- **16 rendered entity types**: LINE, CIRCLE, ARC, ELLIPSE, POINT, POLYLINE, LWPOLYLINE, SPLINE, TEXT, MTEXT, DIMENSION, INSERT, SOLID, 3DFACE, HATCH, LEADER, MULTILEADER
- **4 parsed but not rendered entity types**: ATTDEF, VIEWPORT, IMAGE, WIPEOUT
- **Full TypeScript support** with generated `.d.ts` declarations mirroring the source structure
- **CSS custom properties** (`--dxf-vuer-*` prefix) for theming -- primary color, error color, background, text, borders, border radius, and spacing variables with inline fallbacks so components work without importing global styles
- **Composables** for building custom viewers:
  - `useDXFRenderer` -- main orchestrator for parsing, display, resize, and layer visibility
  - `useThreeScene` -- Three.js scene, renderer, and camera initialization with cleanup
  - `useCamera` -- orthographic camera positioning and fitting
  - `useOrbitControls` -- pan and zoom controls (no rotation), with `minZoom=0.00001` for large drawings
  - `useLayers` -- layer visibility state management
- **Color resolution** with full priority chain: trueColor (code 420) > ACI (1--255) > ByLayer (256) > ByBlock (0); ACI 7 rendered as black on light backgrounds
- **Block support** (INSERT entities) with recursive processing, position/scale/rotation transforms, and `MAX_RECURSION_DEPTH=10` to guard against circular references
- **Canvas-based text rendering** for TEXT and MTEXT entities with MTEXT formatting support, stacked text, and alignment; font size capped at 256 to prevent memory issues
- **Orthographic camera** with pan and zoom via OrbitControls
- **Layer visibility toggling** with per-layer color indicators
- **Material caching** per color for LineBasicMaterial, MeshBasicMaterial, and PointsMaterial
- **Memory management** with recursive disposal of geometries, materials, and textures on unmount; ResizeObserver with debouncing
- **Graceful error handling** -- each entity handler is wrapped in try-catch so a single malformed entity does not break the entire file
- **Dual package exports**: `dxf-vuer` (full library) and `dxf-vuer/parser` (parser only), plus `dxf-vuer/style.css`
- **Demo application** deployed at [dxf-vuer.netlify.app](https://dxf-vuer.netlify.app)

[1.2.0]: https://github.com/arbaev/dxf-vuer/releases/tag/v1.2.0
[1.1.0]: https://github.com/arbaev/dxf-vuer/releases/tag/v1.1.0
[1.0.1]: https://github.com/arbaev/dxf-vuer/releases/tag/v1.0.1
[1.0.0]: https://github.com/arbaev/dxf-vuer/releases/tag/v1.0.0
