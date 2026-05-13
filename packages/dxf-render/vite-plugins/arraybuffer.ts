import fs from "fs";

/**
 * Inline binary files as an ArrayBuffer via the `?arraybuffer` import suffix.
 *
 * Implementation: at `resolveId` we replace the source with a virtual-module
 * id (prefixed with `\0`). This bypasses Vite's built-in asset middleware,
 * which would otherwise serve `.ttf?arraybuffer` as a static file in dev and
 * never give the plugin a chance to transform it. The matching `load` hook
 * reads the real file from disk and emits a tiny JS module whose default
 * export is the file's contents as ArrayBuffer.
 */
export function arraybufferPlugin() {
  const PREFIX = "\0arraybuffer:";

  return {
    name: "vite-plugin-arraybuffer",
    enforce: "pre" as const,

    async resolveId(this: { resolve: (s: string, i?: string, o?: object) => Promise<{ id: string } | null> }, source: string, importer?: string) {
      const qIndex = source.indexOf("?");
      if (qIndex < 0) return null;
      const query = source.slice(qIndex + 1);
      if (!new URLSearchParams(query).has("arraybuffer")) return null;
      const bare = source.slice(0, qIndex);
      const resolved = await this.resolve(bare, importer, { skipSelf: true });
      if (!resolved) return null;
      return PREFIX + resolved.id;
    },

    load(id: string) {
      if (!id.startsWith(PREFIX)) return null;
      const filePath = id.slice(PREFIX.length);
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");
      return [
        `const b=atob("${base64}");`,
        `const u=new Uint8Array(b.length);`,
        `for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);`,
        `export default u.buffer;`,
      ].join("");
    },
  };
}
