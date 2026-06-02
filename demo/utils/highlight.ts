// Minimal, dependency-free syntax highlighter for the demo's CodeBlock.
// One unified tokenizer covers every language the demo shows (ts / tsx / vue /
// html): the markup snippets embed `<script>` blocks, so a single pass that
// understands both JS keywords and markup tags highlights all of them well.
// It is deliberately small — tuned for the short, well-formed snippets in
// frameworks.ts, not a general-purpose parser.

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "const",
  "let",
  "var",
  "function",
  "class",
  "extends",
  "return",
  "new",
  "await",
  "async",
  "interface",
  "as",
  "in",
  "of",
  "for",
  "if",
  "else",
  "void",
  "this",
  "true",
  "false",
  "null",
  "undefined",
]);

// Token classes, in priority order. Comments and strings win over everything so
// their contents are never re-tokenized; tags are matched before bare words so
// `<DXFViewer` / `</script>` colour as markup rather than identifiers.
const TOKEN_RE = new RegExp(
  [
    /(?<comment>\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->)/.source,
    /(?<string>`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.source,
    /(?<punct><\/?)(?<tag>[a-zA-Z][\w.-]*)/.source,
    /(?<tagend>\/?>)/.source,
    /(?<number>\b\d+(?:\.\d+)?\b)/.source,
    /(?<word>[A-Za-z_$][\w$]*)/.source,
  ].join("|"),
  "g",
);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function span(cls: string, text: string): string {
  return `<span class="tok-${cls}">${esc(text)}</span>`;
}

/** Turn a code snippet into safe, span-wrapped HTML for `v-html`. */
export function highlight(code: string): string {
  let out = "";
  let last = 0;

  for (const m of code.matchAll(TOKEN_RE)) {
    const g = (m.groups ?? {}) as Record<string, string | undefined>;
    const i = m.index ?? 0;
    out += esc(code.slice(last, i));

    if (g.comment !== undefined) {
      out += span("cm", m[0]);
    } else if (g.string !== undefined) {
      out += span("st", m[0]);
    } else if (g.tag !== undefined) {
      out += span("pn", g.punct ?? "") + span("tg", g.tag);
    } else if (g.tagend !== undefined) {
      out += span("pn", m[0]);
    } else if (g.number !== undefined) {
      out += span("nm", m[0]);
    } else if (g.word !== undefined) {
      if (KEYWORDS.has(m[0])) {
        out += span("kw", m[0]);
      } else if (code[i + m[0].length] === "(") {
        // identifier immediately followed by "(" reads as a call
        out += span("fn", m[0]);
      } else {
        out += esc(m[0]);
      }
    }

    last = i + m[0].length;
  }

  out += esc(code.slice(last));
  return out;
}
