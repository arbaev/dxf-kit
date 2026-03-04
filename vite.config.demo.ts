import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import fs from "fs";

/** Inline binary files as ArrayBuffer via `?arraybuffer` import suffix. */
function arraybufferPlugin() {
  return {
    name: "vite-plugin-arraybuffer",
    transform(_code: string, id: string) {
      const [filePath, query] = id.split("?");
      if (query !== "arraybuffer") return null;
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");
      return {
        code: [
          `const b=atob("${base64}");`,
          `const u=new Uint8Array(b.length);`,
          `for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);`,
          `export default u.buffer;`,
        ].join(""),
        map: null,
      };
    },
  };
}

// Конфиг для демо-приложения (dev-сервер и сборка для Netlify)
export default defineConfig({
  plugins: [arraybufferPlugin(), vue()],
  root: "demo",
  publicDir: path.resolve(__dirname, "public"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist-demo"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "three/examples/jsm/curves/NURBSCurve.js"],
        },
      },
    },
  },
});
