import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  plugins: [
    vue(),
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
      fileName: (format, entryName) => `dxf-vuer-${entryName}.${format}.js`,
      cssFileName: "style",
    },
    rollupOptions: {
      external: ["vue", /^three/, /^dxf-render/],
    },
    sourcemap: false,
    cssCodeSplit: false,
  },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
