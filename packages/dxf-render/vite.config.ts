import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "path";
import { arraybufferPlugin } from "./vite-plugins/arraybuffer";

export default defineConfig({
  plugins: [
    arraybufferPlugin(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
      outDir: "dist",
      // Bundle declarations into one .d.ts per entry: no relative imports left,
      // so types resolve under moduleResolution node16/nodenext (issue #15)
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: false,
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        // Key must not be "parser": with rollupTypes it emits a dist/parser.d.ts stub
        // that shadows the parser/ directory and makes api-extractor recurse forever
        "parser-entry": path.resolve(__dirname, "src/parser-entry.ts"),
      },
      formats: ["es"],
      // Keep the published JS file name dxf-render-parser.es.js for the parser entry
      fileName: (format, entryName) =>
        `dxf-render-${entryName === "parser-entry" ? "parser" : entryName}.${format}.js`,
    },
    rollupOptions: {
      external: [/^three/],
    },
    sourcemap: false,
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
