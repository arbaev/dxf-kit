import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { arraybufferPlugin } from "../packages/dxf-render/vite-plugins/arraybuffer";

// In dev (`pnpm dev`), resolve dxf-vuer/dxf-render to their source files
// instead of the pre-built dist bundles. Without these aliases, changes
// inside packages/*/src require a full `pnpm build` before they show up
// in the demo; with them, Vite's HMR picks up edits directly.
// Production builds (`pnpm build:demo`) skip the aliases and import dist
// — matching what end users get.
// The arraybufferPlugin is also dev-only: dxf-render's source imports
// fonts via `?arraybuffer`, which is a custom suffix defined by that
// plugin. Without it the .ttf files import as something opentype.js
// can't parse ("buffer is not an object").
export default defineConfig(({ command }) => {
  const useSourceAliases = command === "serve";
  return {
    plugins: useSourceAliases ? [vue(), arraybufferPlugin()] : [vue()],
    publicDir: path.resolve(__dirname, "../public"),
    resolve: {
      alias: useSourceAliases
        ? {
            "dxf-vuer/style.css": path.resolve(__dirname, "../packages/dxf-vuer/src/styles.css"),
            "dxf-vuer": path.resolve(__dirname, "../packages/dxf-vuer/src/index.ts"),
            "dxf-render": path.resolve(__dirname, "../packages/dxf-render/src/index.ts"),
            // dxf-render's source files use the "@/" alias to refer to their
            // own ./src — reproduce it here so Vite can follow those imports.
            // dxf-vuer's source doesn't use "@/", so no conflict.
            "@/": path.resolve(__dirname, "../packages/dxf-render/src") + "/",
          }
        : {},
    },
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: path.resolve(__dirname, "../dist-demo"),
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ["three", "three/addons/curves/NURBSCurve.js"],
          },
        },
      },
    },
  };
});
