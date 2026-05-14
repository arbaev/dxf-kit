import { aciToColor } from "@/utils/colorResolver";

/**
 * MTEXT run: a contiguous span of characters within a line sharing one set of
 * formatting attributes. Created on every inline format change ({}, \C, \H,
 * \f, \L\l, \O\o, \K\k) so each segment can be rendered independently.
 */
export interface MTextRun {
  text: string;
  color?: string;
  height?: number;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
  /** Horizontal stretch factor (DXF `\W<n>;`, analogous to TEXT code 41). */
  widthFactor?: number;
  /** Glyph slant in degrees (DXF `\Q<n>;`, analogous to TEXT code 51). */
  obliqueAngle?: number;
}

/**
 * MTEXT line: an ordered list of runs plus paragraph-level attributes.
 * Stacked fractions (\S) are stored on the line, not on a run, because \S
 * is a single self-contained segment that doesn't nest inside braces.
 */
export interface MTextLine {
  runs: MTextRun[];
  leftMargin?: number;
  firstIndent?: number;
  stackedTop?: string;
  stackedBottom?: string;
}

/**
 * Replace DXF special characters:
 * %%d -> deg, %%p -> +/-, %%c -> diameter, %%nnn -> char by code, %%u/%%o -> remove
 * ^I -> tab (space), ^^ -> literal caret, ^X -> remove other control chars
 *
 * @param preserveTabs When true, ^I becomes \t (real tab) instead of two spaces.
 *   Used by MTEXT parser to enable tab stop calculations.
 */
export const replaceSpecialChars = (text: string, preserveTabs = false): string =>
  text
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/%%[cC]/g, "⌀")
    .replace(/%%[uUoO]/g, "") // toggle underline/overline — remove
    .replace(/%%(\d{3})/g, (_, code) => String.fromCharCode(parseInt(code)))
    // DXF caret notation: ^I = tab, ^^ = literal caret, ^X = control char
    .replace(/\^\^/g, "\x04")
    .replace(/\^I/g, preserveTabs ? "\t" : "  ")
    .replace(/\^[A-Z]/g, "")
    .replace(/\x04/g, "^");

/**
 * Parse TEXT entity content: replace special chars and detect %%u underline.
 * Returns cleaned text and whether the text has underline formatting.
 */
export function parseTextWithUnderline(rawText: string): { text: string; underline: boolean } {
  const underline = /%%[uU]/i.test(rawText);
  return { text: replaceSpecialChars(rawText), underline };
}

/** Concatenate run texts to recover the plain text of an MTextLine. */
export const getMTextLineText = (line: MTextLine): string =>
  line.runs.map((r) => r.text).join("");

interface FormatState {
  color: string | undefined;
  height: number | undefined;
  bold: boolean;
  italic: boolean;
  fontFamily: string | undefined;
  underline: boolean;
  overline: boolean;
  strikethrough: boolean;
  widthFactor: number | undefined;
  obliqueAngle: number | undefined;
}

const initialState = (): FormatState => ({
  color: undefined,
  height: undefined,
  bold: false,
  italic: false,
  fontFamily: undefined,
  underline: false,
  overline: false,
  strikethrough: false,
  widthFactor: undefined,
  obliqueAngle: undefined,
});

const cloneState = (s: FormatState): FormatState => ({ ...s });

const snapshotRun = (text: string, s: FormatState): MTextRun => {
  const run: MTextRun = { text };
  if (s.color !== undefined) run.color = s.color;
  if (s.height !== undefined) run.height = s.height;
  if (s.bold) run.bold = true;
  if (s.italic) run.italic = true;
  if (s.fontFamily !== undefined) run.fontFamily = s.fontFamily;
  if (s.underline) run.underline = true;
  if (s.overline) run.overline = true;
  if (s.strikethrough) run.strikethrough = true;
  if (s.widthFactor !== undefined) run.widthFactor = s.widthFactor;
  if (s.obliqueAngle !== undefined) run.obliqueAngle = s.obliqueAngle;
  return run;
};

const restorePlaceholders = (s: string): string =>
  s.replace(/\x01/g, "\\").replace(/\x02/g, "{").replace(/\x03/g, "}");

/**
 * Parse MTEXT formatting into an array of lines, each composed of one or more
 * formatted runs. Brace groups {…} create a scope: format changes inside the
 * group apply only to that scope and are popped on the matching `}`.
 *
 * Supported inline codes: \P (line break), \C<n>;/\c<n>; (ACI color),
 * \H<n>[x]; (height, absolute or relative multiplier), \f<name>|...;
 * (font + bold/italic flags), \L/\l (underline on/off),
 * \O/\o (overline on/off), \K/\k (strikethrough on/off),
 * \S<top><sep><bot>; (stacked fraction; `#` separator becomes inline "a/b"),
 * \W<n>; (width factor, horizontal stretch),
 * \Q<n>; (obliquing angle in degrees),
 * \p…; (paragraph indent/left margin), \~ (NBSP), \N (column break -> space),
 * \U+XXXX (Unicode), %%d/%%p/%%c/%%nnn (special chars), ^I (tab), ^^ (caret).
 * Codes \T (tracking) and \A (per-run baseline shift) are accepted and skipped.
 */
export const parseMTextContent = (rawText: string, defaultHeight?: number): MTextLine[] => {
  // Protect literal \\, \{, \} from formatting parser via placeholders.
  let text = rawText.replace(/\\\\/g, "\x01").replace(/\\\{/g, "\x02").replace(/\\\}/g, "\x03");
  // Unicode escapes \U+XXXX -> character (done before special-char pass so the
  // resulting characters can't be misread as %% sequences)
  text = text.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
  text = replaceSpecialChars(text, true);

  const state = initialState();
  const stack: FormatState[] = [];

  const lines: MTextLine[] = [];
  let line: MTextLine = { runs: [] };
  let runText = "";

  const flushRun = () => {
    if (runText.length === 0) return;
    line.runs.push(snapshotRun(restorePlaceholders(runText), state));
    runText = "";
  };

  const pushLine = () => {
    flushRun();
    lines.push(line);
    line = { runs: [] };
  };

  for (let i = 0; i < text.length; ) {
    const ch = text[i];

    if (ch === "{") {
      flushRun();
      stack.push(cloneState(state));
      i++;
      continue;
    }

    if (ch === "}") {
      flushRun();
      const popped = stack.pop();
      if (popped) Object.assign(state, popped);
      i++;
      continue;
    }

    if (ch !== "\\") {
      runText += ch;
      i++;
      continue;
    }

    // ── command starting with '\' ─────────────────────────────────────
    const rest = text.slice(i);

    // \P — line break
    if (rest.startsWith("\\P")) {
      pushLine();
      i += 2;
      continue;
    }
    // \~ — non-breaking space (rendered as regular space)
    if (rest.startsWith("\\~")) {
      runText += " ";
      i += 2;
      continue;
    }
    // \N — column break (treat as space)
    if (rest.startsWith("\\N")) {
      runText += " ";
      i += 2;
      continue;
    }

    // \C<n>; / \c<n>; — ACI color
    const colorMatch = rest.match(/^\\[cC](\d+);/);
    if (colorMatch) {
      flushRun();
      const idx = parseInt(colorMatch[1]);
      if (idx === 0 || idx === 256) {
        state.color = undefined; // ByBlock/ByLayer — inherit from entity
      } else if (idx >= 1 && idx <= 255) {
        state.color = aciToColor(idx);
      }
      i += colorMatch[0].length;
      continue;
    }

    // \H<num>[x]; — height (absolute or relative multiplier)
    const heightMatch = rest.match(/^\\H([\d.]+)(x?);/i);
    if (heightMatch) {
      flushRun();
      const v = parseFloat(heightMatch[1]);
      const relative = heightMatch[2] === "x" || heightMatch[2] === "X";
      state.height = relative ? (state.height ?? defaultHeight ?? 1) * v : v;
      i += heightMatch[0].length;
      continue;
    }

    // \f<name>|b<0|1>|i<0|1>|c<n>|p<n>; — font + bold/italic
    const fontMatch = rest.match(/^\\f([^;]*);/);
    if (fontMatch) {
      flushRun();
      const params = fontMatch[1];
      const semi = params.indexOf("|");
      const name = (semi === -1 ? params : params.slice(0, semi)).trim();
      if (name) state.fontFamily = name;
      const bMatch = params.match(/\|b(\d)/);
      const iMatch = params.match(/\|i(\d)/);
      if (bMatch) state.bold = bMatch[1] === "1";
      if (iMatch) state.italic = iMatch[1] === "1";
      i += fontMatch[0].length;
      continue;
    }

    // \L / \l — underline on / off
    if (rest.startsWith("\\L")) {
      flushRun();
      state.underline = true;
      i += 2;
      continue;
    }
    if (rest.startsWith("\\l")) {
      flushRun();
      state.underline = false;
      i += 2;
      continue;
    }
    // \O / \o — overline on / off
    if (rest.startsWith("\\O")) {
      flushRun();
      state.overline = true;
      i += 2;
      continue;
    }
    if (rest.startsWith("\\o")) {
      flushRun();
      state.overline = false;
      i += 2;
      continue;
    }
    // \K / \k — strikethrough on / off
    if (rest.startsWith("\\K")) {
      flushRun();
      state.strikethrough = true;
      i += 2;
      continue;
    }
    if (rest.startsWith("\\k")) {
      flushRun();
      state.strikethrough = false;
      i += 2;
      continue;
    }

    // \S<top><sep><bottom>; — stacked fraction (or inline a/b with `#`)
    const stackedMatch = rest.match(/^\\S([^^/#;]*)([\^/#])([^;]*);/);
    if (stackedMatch) {
      const top = stackedMatch[1].trim();
      const sep = stackedMatch[2];
      const bottom = stackedMatch[3].trim();
      if (sep === "#") {
        runText += `${top}/${bottom}`;
      } else {
        flushRun();
        line.stackedTop = top;
        line.stackedBottom = bottom;
      }
      i += stackedMatch[0].length;
      continue;
    }

    // \p<params>; — paragraph indent / left margin / alignment
    const paragraphMatch = rest.match(/^\\p([^;]*);/);
    if (paragraphMatch) {
      const params = paragraphMatch[1];
      const iMatchPara = params.match(/i([+-]?[\d.]+)/);
      if (iMatchPara) line.firstIndent = parseFloat(iMatchPara[1]);
      const lMatchPara = params.match(/l([\d.]+)/);
      if (lMatchPara) line.leftMargin = parseFloat(lMatchPara[1]);
      i += paragraphMatch[0].length;
      continue;
    }

    // \W<num>; — width factor (horizontal stretch). Positive values only.
    const widthMatch = rest.match(/^\\W([\d.]+);/);
    if (widthMatch) {
      flushRun();
      const v = parseFloat(widthMatch[1]);
      if (Number.isFinite(v) && v > 0) state.widthFactor = v;
      i += widthMatch[0].length;
      continue;
    }

    // \Q<num>; — obliquing angle in degrees (glyph slant).
    const obliqueMatch = rest.match(/^\\Q(-?[\d.]+);/);
    if (obliqueMatch) {
      flushRun();
      const v = parseFloat(obliqueMatch[1]);
      if (Number.isFinite(v)) state.obliqueAngle = v;
      i += obliqueMatch[0].length;
      continue;
    }

    // \T / \A — tracking / per-run baseline shift (not yet implemented, skip).
    const skipMatch = rest.match(/^\\[TA][^;]*;/i);
    if (skipMatch) {
      i += skipMatch[0].length;
      continue;
    }

    // Unknown \<letter>...; — consume up to and including the next ';'
    const unknownTerminated = rest.match(/^\\[a-zA-Z][^;]*;/);
    if (unknownTerminated) {
      i += unknownTerminated[0].length;
      continue;
    }
    // Unknown \<letter> without semicolon — drop the two chars
    const unknownShort = rest.match(/^\\[a-zA-Z]/);
    if (unknownShort) {
      i += 2;
      continue;
    }

    // Lone backslash at end of input — treat as literal
    runText += ch;
    i++;
  }

  pushLine();
  return lines;
};

/**
 * Determine horizontal alignment from MTEXT attachmentPoint (code 71)
 * 1,4,7 = Left; 2,5,8 = Center; 3,6,9 = Right
 */
export const getMTextHAlign = (attachmentPoint?: number): "left" | "center" | "right" => {
  if (!attachmentPoint) return "left";
  const col = (attachmentPoint - 1) % 3; // 0=left, 1=center, 2=right
  if (col === 1) return "center";
  if (col === 2) return "right";
  return "left";
};

/**
 * Determine horizontal alignment from TEXT halign (code 72)
 * 0 = Left, 1 = Center, 2 = Right, 3 = Aligned, 4 = Middle, 5 = Fit
 */
export const getTextHAlign = (halign?: number): "left" | "center" | "right" => {
  if (halign === 1 || halign === 4) return "center";
  if (halign === 2) return "right";
  return "left";
};

/**
 * Determine vertical alignment from MTEXT attachmentPoint (code 71)
 * 1-3 = Top; 4-6 = Middle; 7-9 = Bottom
 */
export const getMTextVAlign = (attachmentPoint?: number): "top" | "middle" | "bottom" => {
  if (!attachmentPoint) return "top";
  const row = Math.ceil(attachmentPoint / 3); // 1=top, 2=middle, 3=bottom
  if (row === 2) return "middle";
  if (row === 3) return "bottom";
  return "top";
};

/**
 * Determine vertical alignment from TEXT valign (code 73)
 * 0 = Baseline, 1 = Bottom, 2 = Middle, 3 = Top
 */
export const getTextVAlign = (valign?: number): "top" | "middle" | "bottom" => {
  if (valign === 3) return "top";
  if (valign === 2) return "middle";
  return "bottom"; // 0=Baseline ~ bottom, 1=Bottom
};
