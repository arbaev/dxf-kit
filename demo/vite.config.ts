import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { readFileSync } from "node:fs";
import { arraybufferPlugin } from "../packages/dxf-render/vite-plugins/arraybuffer";

// Dev/preview only, mirroring netlify.toml so `pnpm dev` behaves like production:
//  - map bare framework routes (/vue, /react, /lit, with or without a trailing
//    slash) to their MPA entry HTML — otherwise the dev server's appType:"mpa"
//    has no entry for /vue and returns a bare 404;
//  - serve the branded public/404.html (with a 404 status) for any other unmatched
//    HTML navigation, instead of a blank server 404.
// `vite build` emits the framework pages via rollupOptions.input and copies
// 404.html from publicDir, so this plugin does nothing at build time.
function frameworkRoutes(): Plugin {
  const routes = ["vue", "react", "lit"];
  const notFoundPath = path.resolve(__dirname, "../public/404.html");
  const rewrite = (req: { url?: string }) => {
    const pathname = (req.url ?? "").split("?")[0];
    const seg = pathname.split("/")[1];
    if (routes.includes(seg) && (pathname === `/${seg}` || pathname === `/${seg}/`)) {
      req.url = `/${seg}/index.html`;
    }
  };
  return {
    name: "framework-routes",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
      // This post hook runs *before* Vite's own index-serving middleware, so we
      // must allow-list the real pages and 404 only the rest — otherwise the
      // handler would shadow valid routes and every navigation would render 404.
      const validPages = new Set<string>([
        "/",
        "/index.html",
        ...routes.flatMap((r) => [`/${r}`, `/${r}/`, `/${r}/index.html`]),
      ]);
      return () => {
        server.middlewares.use((req, res, next) => {
          const pathname = (req.url ?? "").split("?")[0];
          const wantsHtml =
            req.method === "GET" && (req.headers.accept ?? "").includes("text/html");
          if (wantsHtml && !validPages.has(pathname)) {
            try {
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/html");
              res.end(readFileSync(notFoundPath, "utf-8"));
              return;
            } catch {
              /* fall through to the default handler if the file is missing */
            }
          }
          next();
        });
      };
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

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
    // MPA: disable the SPA history-fallback so each framework route serves its
    // own HTML instead of being shadowed by the root index.html.
    appType: "mpa",
    plugins: [vue(), frameworkRoutes(), ...(useSourceAliases ? [arraybufferPlugin()] : [])],
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
        // Multi-page build: the neutral landing plus one static HTML per framework
        // wrapper. Each framework page ships its own <head> meta for SEO and mounts
        // the shared FrameworkLanding via /framework-main.ts.
        input: {
          main: path.resolve(__dirname, "index.html"),
          vue: path.resolve(__dirname, "vue/index.html"),
          react: path.resolve(__dirname, "react/index.html"),
          lit: path.resolve(__dirname, "lit/index.html"),
        },
        output: {
          manualChunks: {
            three: ["three", "three/addons/curves/NURBSCurve.js"],
          },
        },
      },
    },
  };
});
