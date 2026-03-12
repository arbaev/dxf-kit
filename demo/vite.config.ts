import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  publicDir: path.resolve(__dirname, "../public"),
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
});
