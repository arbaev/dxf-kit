import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
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

// Конфиг сборки библиотеки (npm-пакет)
export default defineConfig({
  plugins: [
    arraybufferPlugin(),
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
        parser: path.resolve(__dirname, "src/parser-entry.ts"),
      },
      formats: ["es"],
      fileName: (format, entryName) => `dxf-vuer-${entryName}.${format}.js`,
      cssFileName: "style",
    },
    rollupOptions: {
      external: ["vue", /^three/],
    },
    sourcemap: false,
    cssCodeSplit: false,
  },
});
