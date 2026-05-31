// Single source of truth for every framework wrapper of the dxf-render engine.
// Consumed by the "Works with your stack" tabs on the neutral landing, the
// per-framework landing pages, and the footer npm links. Adding a new wrapper
// (e.g. promoting Lit from "coming-soon" to "stable") means editing data here —
// no markup changes.

export type FrameworkId = "vanilla" | "vue" | "react" | "lit";

export interface FrameworkInfo {
  id: FrameworkId;
  /** Display name, e.g. "React". */
  label: string;
  /** "stable" wrappers are published; "coming-soon" are pre-announced. */
  status: "stable" | "coming-soon";
  /** npm package name (the wrapper, or dxf-render itself for vanilla). */
  npmPackage: string;
  /** npm page URL, or null if the package is not published yet. */
  npmUrl: string | null;
  /** Install command shown in a copyable code line. */
  install: string;
  /** Minimal, idiomatic integration snippet. */
  snippet: string;
  /** Prism-style language hint for the code block. */
  lang: "ts" | "tsx" | "vue" | "html";
  /** StackBlitz "open in editor" URL, or null if none yet. */
  stackblitzUrl: string | null;
  /** Dedicated landing route, or null if the framework has no page of its own. */
  route: string | null;
  /** Inline SVG icon markup. */
  icon: string;
  /** Hero subtitle on the framework's landing page. */
  blurb: string;
  /** Per-page SEO metadata (also baked statically into the page's HTML head). */
  meta: { title: string; description: string };
}

const STACKBLITZ_BASE = "https://stackblitz.com/github/arbaev/dxf-kit/tree/main/examples";

const ICON_VANILLA =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
const ICON_VUE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3l10 19L22 3"/><path d="M6.5 3L12 14.5 17.5 3"/></svg>';
const ICON_REACT =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></svg>';
const ICON_LIT =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2c1.2 3.6 4.8 5 4.8 8.6A4.8 4.8 0 0 1 7.2 10.6c0-1.4.6-2.4 1.2-3 .4 1.8 1.8 2.3 1.8 2.3C9 7 12 5 12 2z"/></svg>';

export const FRAMEWORKS: FrameworkInfo[] = [
  {
    id: "vanilla",
    label: "Vanilla JS",
    status: "stable",
    npmPackage: "dxf-render",
    npmUrl: "https://www.npmjs.com/package/dxf-render",
    install: "npm install dxf-render three",
    lang: "ts",
    snippet: `import * as THREE from "three";
import { parseDxf, createThreeObjectsFromDXF, useCamera } from "dxf-render";

// Parse the DXF text and build a Three.js group from it
const dxf = parseDxf(await (await fetch("/drawing.dxf")).text());
const { group } = await createThreeObjectsFromDXF(dxf);

const scene = new THREE.Scene();
scene.add(group);

const renderer = new THREE.WebGLRenderer({ canvas });
const camera = new THREE.OrthographicCamera(/* left, right, top, bottom */);
useCamera().fitCameraToBox(new THREE.Box3().setFromObject(group), camera);
renderer.render(scene, camera);`,
    stackblitzUrl: `${STACKBLITZ_BASE}/vanilla-ts?file=src/main.ts&title=dxf-render+Vanilla+TS`,
    route: null,
    icon: ICON_VANILLA,
    blurb:
      "Use the dxf-render engine directly with Three.js — no framework, full control over the scene.",
    meta: {
      title: "DXF Viewer in JavaScript — dxf-render | dxf-kit",
      description:
        "Render AutoCAD DXF drawings in the browser with dxf-render — a framework-agnostic TypeScript parser and Three.js/WebGL renderer.",
    },
  },
  {
    id: "vue",
    label: "Vue 3",
    status: "stable",
    npmPackage: "dxf-vuer",
    npmUrl: "https://www.npmjs.com/package/dxf-vuer",
    install: "npm install dxf-vuer dxf-render three",
    lang: "vue",
    snippet: `<script setup lang="ts">
import { DXFViewer } from "dxf-vuer";
import "dxf-vuer/style.css";
<\/script>

<template>
  <DXFViewer url="/drawing.dxf" show-rulers show-layer-panel dark-theme />
</template>`,
    stackblitzUrl: `${STACKBLITZ_BASE}/vue?file=src/App.vue&title=dxf-vuer+Vue+3`,
    route: "/vue",
    icon: ICON_VUE,
    blurb:
      "A drop-in Vue 3 component for the dxf-render engine. Reactive props, v-model, and slots — the full viewer in one tag.",
    meta: {
      title: "Vue 3 DXF Viewer Component — dxf-vuer | dxf-kit",
      description:
        "Render AutoCAD DXF drawings in Vue 3 with dxf-vuer — a drop-in <DXFViewer> component over a Three.js/WebGL engine. Layers, measure, export, dark theme.",
    },
  },
  {
    id: "react",
    label: "React",
    status: "stable",
    npmPackage: "dxf-react",
    npmUrl: "https://www.npmjs.com/package/dxf-react",
    install: "npm install dxf-react dxf-render three",
    lang: "tsx",
    snippet: `import { DXFViewer } from "dxf-react";
import "dxf-react/style.css";

export default function Viewer() {
  return <DXFViewer url="/drawing.dxf" showRulers showLayerPanel darkTheme />;
}`,
    stackblitzUrl: `${STACKBLITZ_BASE}/react?file=src/App.tsx&title=dxf-react+React`,
    route: "/react",
    icon: ICON_REACT,
    blurb:
      "A React component for the dxf-render engine. Typed props, refs, and callbacks — the full viewer in one tag.",
    meta: {
      title: "React DXF Viewer Component — dxf-react | dxf-kit",
      description:
        "Render AutoCAD DXF drawings in React with dxf-react — a <DXFViewer> component over a Three.js/WebGL engine. Layers, measure, export, dark theme.",
    },
  },
  {
    id: "lit",
    label: "Lit / Web Component",
    status: "coming-soon",
    npmPackage: "dxf-lit",
    npmUrl: null,
    install: "npm install dxf-lit dxf-render three",
    lang: "html",
    snippet: `<!-- Coming soon: a framework-agnostic Web Component -->
<script type="module">
  import "dxf-lit";
<\/script>

<dxf-viewer url="/drawing.dxf" show-rulers dark-theme></dxf-viewer>`,
    stackblitzUrl: null,
    route: "/lit",
    icon: ICON_LIT,
    blurb:
      "A framework-agnostic Web Component built on dxf-render. Use it in any stack — Lit, plain HTML, or no framework at all.",
    meta: {
      title: "DXF Viewer Web Component (Lit) — dxf-lit | dxf-kit",
      description:
        "A framework-agnostic <dxf-viewer> Web Component for AutoCAD DXF drawings, built on a Three.js/WebGL engine. Coming soon.",
    },
  },
];

export function getFramework(id: string): FrameworkInfo | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

/** Sample DXF (in /public) auto-loaded by the compact viewer on landing pages. */
export const DEMO_SAMPLE_URL = "/samples/electric.dxf";

export const GITHUB_URL = "https://github.com/arbaev/dxf-kit";
