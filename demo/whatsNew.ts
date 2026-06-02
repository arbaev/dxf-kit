// Shared "What's New" changelog data. The home page (WhatsNewSection) shows
// only the latest release wave; the full history lives on the /changelog page.

export type Pkg = "dxf-render" | "dxf-vuer";

export interface WhatsNewItem {
  pkg: Pkg;
  version: string;
  text: string;
}

export const whatsNew: WhatsNewItem[] = [
  {
    pkg: "dxf-vuer",
    version: "3.0.0",
    text: "classes prop on <DXFViewer> — Headless UI-style class map for ~10 root elements (root, toolbar, layerPanel, fileNameOverlay, coordinatesOverlay, debugOverlay, loadingOverlay, errorOverlay, dropOverlay, emptyStateOverlay). Tailwind / utility-CSS finally first-class, no :deep() workarounds.",
  },
  {
    pkg: "dxf-vuer",
    version: "3.0.0",
    text: "Stable .dxfk-* hook classes — every overlay and component root has a single-class, low-specificity selector (specificity 0,1,0) safe for plain CSS overrides and Tailwind @apply. Documented in README → Customizing styles. Breaking: classes and CSS variables renamed (.dxf-viewer → .dxfk-viewer, --dxf-vuer-* → --dxfk-*), child components own their dark-theme styles via a darkTheme prop instead of parent :deep() — see migration table.",
  },
  {
    pkg: "dxf-render",
    version: "1.6.0",
    text: "REGION entities now render their contour by borrowing the boundary edges of any HATCH that references them as a source object (DXF codes 97/330) — no ACIS decoding needed. The REGION becomes pickable too, so hatched details with a REGION outline (common in AutoCAD-built profile drawings) finally show their visible boundary and fire entity-hover / entity-click events.",
  },
  {
    pkg: "dxf-render",
    version: "1.6.0",
    text: "Standard AutoCAD arrowhead blocks at DIMENSION endpoints and on LEADER / MULTILEADER tips — all 18 names now supported: filled / blank dots, ticks, boxes, origin rings, integral, open arrows at 30° / 90°, datum, and none. Previously only ticks were recognised; everything else collapsed to a default triangle.",
  },
  {
    pkg: "dxf-render",
    version: "1.6.0",
    text: "MTEXT inline scoped formatting — \\C, \\H, \\f, \\L\\l, \\O\\o, \\K\\k inside brace groups {…} now apply only to that scope and revert on the closing brace. Each line is a list of MTextRun segments with per-run color / height / bold / italic / font / underline / overline / strikethrough. \\W<n>; (width factor) and \\Q<n>; (obliquing angle) are now honored too.",
  },
  {
    pkg: "dxf-vuer",
    version: "2.6.0",
    text: "persistLayersKey prop — remember which layers were hidden across reloads via localStorage, scoped per file",
  },
  {
    pkg: "dxf-vuer",
    version: "2.6.0",
    text: "viewer.zoomToLayer(layerName) — fit the camera to a single layer; ARIA roles/labels added to toolbar, layer panel, and status overlays",
  },
  {
    pkg: "dxf-render",
    version: "1.5.0",
    text: "getZoomBoxForLayer / findEntitiesByLayer / findEntitiesByType — three pure utilities for layer- and type-based zoom and search",
  },
  {
    pkg: "dxf-vuer",
    version: "2.5.0",
    text: "Hover and click individual entities — entity-hover / entity-click events with handle, type, layer, text, and full parsed entity payload",
  },
  {
    pkg: "dxf-vuer",
    version: "2.5.0",
    text: "Semantic associations — events and the built-in highlight automatically expand to all members of MLEADER, LEADER↔TEXT (DXF 340), INSERT+ATTRIB, and DIMENSION groups",
  },
  {
    pkg: "dxf-vuer",
    version: "2.5.0",
    text: "Imperative API on viewer ref — highlight(handles[]), clearHighlight(), getAssociations(), findAssociationsByHandle(), zoomToEntity(handles[]), getPickingIndex() — sync selection, camera, and search results with AG Grid or any external UI",
  },
  {
    pkg: "dxf-vuer",
    version: "2.5.0",
    text: "New props pickingEnabled, highlightOnHover, highlightAssociated, highlightColor — opt-in interactivity, no overhead when disabled",
  },
  {
    pkg: "dxf-render",
    version: "1.4.0",
    text: "Picking primitives — buildPickingIndex(dxf), createPickingGroup(index, offset), buildEntityIndex(dxf), extractEntityText(entity) — framework-agnostic raycasting building blocks",
  },
  {
    pkg: "dxf-render",
    version: "1.4.0",
    text: "getZoomBox(pickingIndex, handles, options?) and findEntitiesByText(dxf, query, options?) — pure utilities for zoom-to-entity and full-text search across all entity text content",
  },
  {
    pkg: "dxf-render",
    version: "1.4.0",
    text: "buildAssociations(dxf) — pure function deriving entity links strictly from DXF data (no geometric heuristics): MLEADER, LEADER, INSERT+ATTRIB, DIMENSION",
  },
  {
    pkg: "dxf-render",
    version: "1.4.0",
    text: "LEADER parser now extracts annotationHandle (DXF code 340) for linking to TEXT/MTEXT annotations",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Configurable antialiasing — MSAA (default), SMAA, FXAA, TAA, SSAA, or none — pick the right tradeoff for your drawing",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Layers panel filter — text search by name, auto-shown for drawings with more than 5 layers",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "loadDXFFromBuffer / loadDXFFromBlob — load drawings from storage SDKs, IndexedDB, or fetch().blob() with UTF-8 / UTF-16 BOM auto-detection",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "Respects prefers-reduced-motion — TAA accumulation loop is skipped for users who opted into reduced motion",
  },
  {
    pkg: "dxf-vuer",
    version: "2.4.0",
    text: "showLayerPanel prop — programmatically hide the layers panel",
  },
  {
    pkg: "dxf-render",
    version: "1.3.0",
    text: "Configurable antialiasing pipeline — framework-agnostic factories createRenderer / createComposer / isReducedMotionPreferred for use in React, Svelte, or vanilla JS, with the same AA palette that powers dxf-vuer",
  },
  {
    pkg: "dxf-render",
    version: "1.3.0",
    text: "Browser bundling fix — package.json browser.fs=false eliminates 'Could not resolve fs' errors with Vite/esbuild/Angular CLI by stripping opentype.js's Node-only file-system branch",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "Variable-width polylines with per-vertex tapering, arrows, and donuts",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "GIS origin translation — large UTM/state plane coordinates without precision loss",
  },
  {
    pkg: "dxf-render",
    version: "1.2.0",
    text: "Touch support — native one-finger pan on mobile devices",
  },
  {
    pkg: "dxf-render",
    version: "1.1.0",
    text: "Theme-adaptive ACI 250-251 colors — dark grays invert in dark mode",
  },
  {
    pkg: "dxf-vuer",
    version: "1.5.0",
    text: "TAA anti-aliasing — 32-frame temporal accumulation for crisp text and edges",
  },
  {
    pkg: "dxf-vuer",
    version: "1.5.0",
    text: "Instant dark mode — theme switching without full re-render",
  },
  {
    pkg: "dxf-vuer",
    version: "1.4.0",
    text: "MLINE, XLINE, RAY entities — multilines and construction lines",
  },
  {
    pkg: "dxf-vuer",
    version: "1.4.0",
    text: "25 built-in hatch patterns with solid fill optimization (86× faster)",
  },
];

// The most recent release wave, shown on the home page. Everything else is
// archived on the /changelog page.
const LATEST_VERSIONS = new Set(["dxf-vuer@3.0.0", "dxf-render@1.6.0"]);

export const latestWhatsNew: WhatsNewItem[] = whatsNew.filter((item) =>
  LATEST_VERSIONS.has(`${item.pkg}@${item.version}`),
);
