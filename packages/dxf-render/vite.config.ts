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
        parser: path.resolve(__dirname, "src/parser-entry.ts"),
      },
      formats: ["es"],
      fileName: (format, entryName) => `dxf-render-${entryName}.${format}.js`,
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
