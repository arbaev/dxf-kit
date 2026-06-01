import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  plugins: [
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
      },
      formats: ["es"],
      fileName: (format, entryName) => `dxf-interaction-${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: [/^three/, /^dxf-render/],
    },
    sourcemap: false,
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
