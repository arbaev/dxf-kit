import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { arraybufferPlugin } from "../../packages/dxf-render/vite-plugins/arraybuffer";

// Dev playground for dxf-react. Mirrors the Vue demo's strategy: during `serve`
// it aliases dxf-react / dxf-render to their source so edits hot-reload without
// a rebuild; a production `build` drops the aliases and consumes the published
// dist like a real consumer.
export default defineConfig(({ command }) => {
  const useSourceAliases = command === "serve";
  const alias: Record<string, string> = useSourceAliases
    ? {
        "dxf-react/style.css": path.resolve(__dirname, "../../packages/dxf-react/src/styles.css"),
        "dxf-react": path.resolve(__dirname, "../../packages/dxf-react/src/index.ts"),
        "dxf-render": path.resolve(__dirname, "../../packages/dxf-render/src/index.ts"),
        "@/": path.resolve(__dirname, "../../packages/dxf-render/src") + "/",
      }
    : {};
  return {
    // Production build is served from /react/ on dxf-kit.netlify.app; dev stays at /.
    base: useSourceAliases ? "/" : "/react/",
    plugins: useSourceAliases ? [react(), arraybufferPlugin()] : [react()],
    resolve: { alias },
    build: {
      // Emit into the Vue demo's publish dir so a single Netlify deploy serves
      // both: the Vue demo at / and this React playground at /react/.
      outDir: path.resolve(__dirname, "../../dist-demo/react"),
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      open: true,
    },
  };
});
