import { describe, it, expect } from "vitest";
import {
  replaceSpecialChars,
  parseTextWithUnderline,
  parseMTextContent,
  getMTextLineText,
  getMTextHAlign,
  getTextHAlign,
  getMTextVAlign,
  getTextVAlign,
} from "../mtextParser";

/** Plain text of a parsed MTextLine — concatenation of all run texts. */
const lineText = (line: { runs: { text: string }[] }) => getMTextLineText(line as never);

// ── replaceSpecialChars ──────────────────────────────────────────────────

describe("replaceSpecialChars", () => {
  it("replaces %%d with degree sign (U+00B0)", () => {
    expect(replaceSpecialChars("45%%d")).toBe("45\u00B0");
  });

  it("replaces %%D (uppercase) with degree sign", () => {
    expect(replaceSpecialChars("90%%D")).toBe("90\u00B0");
  });

  it("replaces %%p with plus-minus sign (U+00B1)", () => {
    expect(replaceSpecialChars("%%p0.5")).toBe("\u00B10.5");
  });

  it("replaces %%P (uppercase) with plus-minus sign", () => {
    expect(replaceSpecialChars("%%P0.1")).toBe("\u00B10.1");
  });

  it("replaces %%c with diameter sign (U+2300)", () => {
    expect(replaceSpecialChars("%%c20")).toBe("\u230020");
  });

  it("replaces %%C (uppercase) with diameter sign", () => {
    expect(replaceSpecialChars("%%C50")).toBe("\u230050");
  });

  it("removes underline/overline toggles (%%u, %%U, %%o, %%O)", () => {
    expect(replaceSpecialChars("%%uBold%%U")).toBe("Bold");
    expect(replaceSpecialChars("%%oline%%O")).toBe("line");
  });

  it("converts %%nnn (3-digit code) to character by code", () => {
    // 065 = 'A', 066 = 'B'
    expect(replaceSpecialChars("%%065%%066")).toBe("AB");
  });

  it("handles multiple different special chars in one string", () => {
    expect(replaceSpecialChars("%%c20%%p0.5%%d")).toBe(
      "\u230020\u00B10.5\u00B0",
    );
  });

  it("passes U+2300 (⌀ DIAMETER SIGN) through unchanged", () => {
    expect(replaceSpecialChars("\u230050")).toBe("\u230050");
  });

  it("passes U+2205 (∅ EMPTY SET) through unchanged", () => {
    expect(replaceSpecialChars("\u220530")).toBe("\u220530");
  });

  it("returns plain text unchanged when no special chars are present", () => {
    expect(replaceSpecialChars("Hello World")).toBe("Hello World");
  });

  it("returns empty string unchanged", () => {
    expect(replaceSpecialChars("")).toBe("");
  });

  it("replaces ^I (caret notation tab) with space", () => {
    expect(replaceSpecialChars("MARK^IITEM")).toBe("MARK  ITEM");
    expect(replaceSpecialChars("X-00^I^IREFRIGERATOR")).toBe("X-00    REFRIGERATOR");
  });

  it("replaces ^^ with literal caret", () => {
    expect(replaceSpecialChars("100^^50")).toBe("100^50");
  });

  it("removes other caret notation control chars", () => {
    expect(replaceSpecialChars("text^Mmore")).toBe("textmore");
  });

  it("handles ^^ and ^I together", () => {
    expect(replaceSpecialChars("A^^B^IC")).toBe("A^B  C");
  });

  it("preserves ^I as tab character when preserveTabs=true", () => {
    expect(replaceSpecialChars("MARK^IITEM", true)).toBe("MARK\tITEM");
    expect(replaceSpecialChars("X-00^I^IREFRIGERATOR", true)).toBe("X-00\t\tREFRIGERATOR");
  });

  it("handles ^^ and ^I with preserveTabs=true", () => {
    expect(replaceSpecialChars("A^^B^IC", true)).toBe("A^B\tC");
  });
});

// ── parseTextWithUnderline ───────────────────────────────────────────────

describe("parseTextWithUnderline", () => {
  it("detects underline from %%u prefix", () => {
    const result = parseTextWithUnderline("%%uGREAT ROOM");
    expect(result.text).toBe("GREAT ROOM");
    expect(result.underline).toBe(true);
  });

  it("returns no underline for plain text", () => {
    const result = parseTextWithUnderline("Plain text");
    expect(result.text).toBe("Plain text");
    expect(result.underline).toBe(false);
  });

  it("detects underline with %%U (uppercase)", () => {
    const result = parseTextWithUnderline("%%UROOM NAME");
    expect(result.text).toBe("ROOM NAME");
    expect(result.underline).toBe(true);
  });

  it("replaces other special chars alongside %%u", () => {
    const result = parseTextWithUnderline("%%u45%%d");
    expect(result.text).toBe("45\u00B0");
    expect(result.underline).toBe(true);
  });
});

// ── parseMTextContent ────────────────────────────────────────────────────

describe("parseMTextContent", () => {
  it("parses plain text into a single MTextLine with one run", () => {
    const result = parseMTextContent("Hello World");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(1);
    expect(result[0].runs[0].text).toBe("Hello World");
    expect(result[0].runs[0].color).toBeUndefined();
    expect(result[0].runs[0].height).toBeUndefined();
  });

  it("splits text by \\P into multiple lines", () => {
    const result = parseMTextContent("Line 1\\PLine 2\\PLine 3");
    expect(result).toHaveLength(3);
    expect(lineText(result[0])).toBe("Line 1");
    expect(lineText(result[1])).toBe("Line 2");
    expect(lineText(result[2])).toBe("Line 3");
  });

  it("sets ACI color with \\C<n>; (ACI 1 = red)", () => {
    const result = parseMTextContent("\\C1;Red text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Red text");
    expect(result[0].runs[0].color).toBe("#ff0000");
  });

  it("ACI color persists across lines", () => {
    const result = parseMTextContent("\\C5;Blue\\PStill blue");
    expect(result).toHaveLength(2);
    // ACI 5 = 255 = 0x0000FF = "#0000ff"
    expect(result[0].runs[0].color).toBe("#0000ff");
    expect(result[1].runs[0].color).toBe("#0000ff");
  });

  it("resets color to undefined with \\C0; (ByBlock)", () => {
    const result = parseMTextContent("\\C1;Red\\P\\C0;Default");
    expect(result).toHaveLength(2);
    expect(result[0].runs[0].color).toBe("#ff0000");
    expect(result[1].runs[0].color).toBeUndefined();
  });

  it("resets color to undefined with \\C256; (ByLayer)", () => {
    const result = parseMTextContent("\\C1;Red\\P\\C256;Default");
    expect(result).toHaveLength(2);
    expect(result[0].runs[0].color).toBe("#ff0000");
    expect(result[1].runs[0].color).toBeUndefined();
  });

  it("sets height with \\H<value>; (absolute)", () => {
    const result = parseMTextContent("\\H2.5;Big text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Big text");
    expect(result[0].runs[0].height).toBe(2.5);
  });

  it("sets height with \\H<value>x; (relative multiplier)", () => {
    const result = parseMTextContent("\\H1.5x;Title\\P\\H0.666667x;Body", 240);
    expect(result).toHaveLength(2);
    expect(lineText(result[0])).toBe("Title");
    expect(result[0].runs[0].height).toBeCloseTo(360, 1); // 240 * 1.5
    expect(lineText(result[1])).toBe("Body");
    expect(result[1].runs[0].height).toBeCloseTo(240, 0); // 360 * 0.666667
  });

  it("relative \\Hx; without defaultHeight uses 1 as base", () => {
    const result = parseMTextContent("\\H2x;Double");
    expect(result).toHaveLength(1);
    expect(result[0].runs[0].height).toBe(2); // 1 * 2
  });

  it("sets font, bold, and italic with \\f...;", () => {
    const result = parseMTextContent("\\fArial|b1|i1|c0|p0;Styled");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Styled");
    expect(result[0].runs[0].fontFamily).toBe("Arial");
    expect(result[0].runs[0].bold).toBe(true);
    expect(result[0].runs[0].italic).toBe(true);
  });

  it("converts literal escape sequences: \\\\ -> \\, \\{ -> {, \\} -> }", () => {
    const result = parseMTextContent("A\\\\B\\{C\\}D");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A\\B{C}D");
  });

  it("converts Unicode escapes \\U+XXXX to characters", () => {
    // U+0041 = 'A', U+00E9 = 'e with acute'
    const result = parseMTextContent("\\U+0041\\U+00E9");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A\u00E9");
  });

  it("parses stacked text \\Stop^bottom;", () => {
    const result = parseMTextContent("\\S1^2;");
    expect(result).toHaveLength(1);
    expect(result[0].stackedTop).toBe("1");
    expect(result[0].stackedBottom).toBe("2");
  });

  it("renders \\S3#8; as inline flat fraction text '3/8'", () => {
    const result = parseMTextContent("\\S3#8;");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("3/8");
    expect(result[0].stackedTop).toBeUndefined();
    expect(result[0].stackedBottom).toBeUndefined();
  });

  it("brace-scoped \\H reverts after closing }", () => {
    const result = parseMTextContent(
      "\\H0.5x;Normal\\P{\\H0.7x;inner}rest\\PStill normal",
      18,
    );
    expect(result).toHaveLength(3);
    // Line 0: height = 18 * 0.5 = 9
    expect(result[0].runs[0].height).toBeCloseTo(9);
    // Line 1: "inner" got scoped \H0.7x \u2014 9 * 0.7 = 6.3
    //          "rest" reverts to the outer state (9)
    expect(result[1].runs).toHaveLength(2);
    expect(result[1].runs[0].text).toBe("inner");
    expect(result[1].runs[0].height).toBeCloseTo(6.3);
    expect(result[1].runs[1].text).toBe("rest");
    expect(result[1].runs[1].height).toBeCloseTo(9);
    // Line 2: outer state (9) carries over
    expect(result[2].runs[0].height).toBeCloseTo(9);
  });

  it("applies \\H inside braces (section marker)", () => {
    // Section marker: {\H0.75x;A4.2} with base height 3.0
    const result = parseMTextContent("{\\H0.75x;A4.2}", 3.0);
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("A4.2");
    expect(result[0].runs[0].height).toBeCloseTo(2.25); // 3.0 * 0.75
  });

  it("applies absolute \\H inside braces", () => {
    const result = parseMTextContent("{\\H1.5;Small text}", 5.0);
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Small text");
    expect(result[0].runs[0].height).toBeCloseTo(1.5);
  });

  it("replaces \\~ (non-breaking space) with a regular space", () => {
    const result = parseMTextContent("Hello\\~World");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Hello World");
  });

  it("replaces \\N (column break) with a space", () => {
    const result = parseMTextContent("Col1\\NCol2");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Col1 Col2");
  });

  it("removes grouping braces {}", () => {
    const result = parseMTextContent("{grouped text}");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("grouped text");
  });

  it("sets underline with \\L; \\O sets overline; \\K sets strikethrough", () => {
    const result = parseMTextContent("\\LUnderlined\\OOverlined\\KStrikethrough");
    expect(result).toHaveLength(1);
    // Each format toggle starts a new run
    expect(result[0].runs).toHaveLength(3);
    expect(result[0].runs[0].text).toBe("Underlined");
    expect(result[0].runs[0].underline).toBe(true);
    expect(result[0].runs[1].text).toBe("Overlined");
    expect(result[0].runs[1].underline).toBe(true);
    expect(result[0].runs[1].overline).toBe(true);
    expect(result[0].runs[2].text).toBe("Strikethrough");
    expect(result[0].runs[2].strikethrough).toBe(true);
  });

  it("\\l turns off underline mid-line, creating two runs", () => {
    const result = parseMTextContent("\\LUnderlined\\l Normal");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(2);
    expect(result[0].runs[0].text).toBe("Underlined");
    expect(result[0].runs[0].underline).toBe(true);
    expect(result[0].runs[1].text).toBe(" Normal");
    expect(result[0].runs[1].underline).toBeUndefined();
  });

  it("underline persists across \\P line breaks", () => {
    const result = parseMTextContent("\\LLine 1\\PLine 2");
    expect(result).toHaveLength(2);
    expect(result[0].runs[0].underline).toBe(true);
    expect(result[1].runs[0].underline).toBe(true);
  });

  it("no underline by default", () => {
    const result = parseMTextContent("Normal text");
    expect(result).toHaveLength(1);
    expect(result[0].runs[0].underline).toBeUndefined();
  });

  it("parses \\W width factor and \\Q oblique angle; skips \\T and \\A", () => {
    const result = parseMTextContent("\\W1.5;\\T0.1;\\Q15;\\A1;text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("text");
    expect(result[0].runs[0].widthFactor).toBe(1.5);
    expect(result[0].runs[0].obliqueAngle).toBe(15);
  });

  it("parses paragraph indent \\pi<value>,l<value>;", () => {
    const result = parseMTextContent("\\pi-13.5,l18,t18;indented text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("indented text");
    expect(result[0].firstIndent).toBe(-13.5);
    expect(result[0].leftMargin).toBe(18);
  });

  it("parses paragraph indent \\pi<value>; without left margin", () => {
    const result = parseMTextContent("\\pi2;indented text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("indented text");
    expect(result[0].firstIndent).toBe(2);
    expect(result[0].leftMargin).toBeUndefined();
  });

  it("strips \\pxqc; alignment code", () => {
    const result = parseMTextContent("\\pxqc;centered text");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("centered text");
  });

  it("preserves empty lines from \\P\\P as paragraph spacing", () => {
    const result = parseMTextContent("First\\P\\PLast");
    expect(result).toHaveLength(3);
    expect(lineText(result[0])).toBe("First");
    expect(result[1].runs).toEqual([]); // empty middle line \u2014 no runs
    expect(lineText(result[2])).toBe("Last");
  });

  it("applies DXF special chars (%%d, %%c, etc.) inside MTEXT", () => {
    const result = parseMTextContent("Angle: 45%%d, Dia: %%c20");
    expect(result).toHaveLength(1);
    expect(lineText(result[0])).toBe("Angle: 45\u00B0, Dia: \u230020");
  });

  it("preserves ^I as tab character in MTEXT lines", () => {
    const result = parseMTextContent("X-00^IREFRIGERATOR^I^I\\PX-02^IKITCHEN SINK");
    expect(result).toHaveLength(2);
    expect(lineText(result[0])).toBe("X-00\tREFRIGERATOR\t\t");
    expect(lineText(result[1])).toBe("X-02\tKITCHEN SINK");
  });

  // \u2500\u2500 Inline run scoping \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  it("brace-scoped \\C produces two runs with different colors", () => {
    // Real-world case from 03.Profili.dxf MTEXT D4EC3:
    //   "Profil rama{\C252; Profile frame}"
    // \u2192 "Profil rama" inherits entity color, " Profile frame" uses ACI 252.
    const result = parseMTextContent("Profil rama{\\C252; Profile frame}");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(2);
    expect(result[0].runs[0].text).toBe("Profil rama");
    expect(result[0].runs[0].color).toBeUndefined();
    expect(result[0].runs[1].text).toBe(" Profile frame");
    // ACI 252 → fixed gray hex (sentinels apply only to ACI 7, 250, 251)
    expect(result[0].runs[1].color).toBe("#848484");
  });

  it("scoped color reverts to outer color after closing }", () => {
    const result = parseMTextContent("\\C1;red{\\C5;blue}red-again");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(3);
    expect(result[0].runs[0].text).toBe("red");
    expect(result[0].runs[0].color).toBe("#ff0000");
    expect(result[0].runs[1].text).toBe("blue");
    expect(result[0].runs[1].color).toBe("#0000ff");
    expect(result[0].runs[2].text).toBe("red-again");
    expect(result[0].runs[2].color).toBe("#ff0000");
  });

  it("nested braces nest format scopes", () => {
    const result = parseMTextContent("\\C1;a{\\C5;b{\\C3;c}b}a");
    expect(result).toHaveLength(1);
    const runs = result[0].runs;
    expect(runs).toHaveLength(5);
    expect(runs.map((r) => r.text)).toEqual(["a", "b", "c", "b", "a"]);
    expect(runs.map((r) => r.color)).toEqual([
      "#ff0000", // ACI 1 red
      "#0000ff", // ACI 5 blue
      "#00ff00", // ACI 3 green
      "#0000ff", // back to blue
      "#ff0000", // back to red
    ]);
  });

  it("scoped \\f with bold creates a bold run, restoring after }", () => {
    const result = parseMTextContent("plain{\\fArial|b1;BOLD}rest");
    expect(result).toHaveLength(1);
    const runs = result[0].runs;
    expect(runs).toHaveLength(3);
    expect(runs[0].text).toBe("plain");
    expect(runs[0].bold).toBeUndefined();
    expect(runs[1].text).toBe("BOLD");
    expect(runs[1].bold).toBe(true);
    expect(runs[1].fontFamily).toBe("Arial");
    expect(runs[2].text).toBe("rest");
    expect(runs[2].bold).toBeUndefined();
  });

  it("scoped \\O produces an overline run only inside braces", () => {
    const result = parseMTextContent("a{\\Ob}c");
    expect(result).toHaveLength(1);
    const runs = result[0].runs;
    expect(runs).toHaveLength(3);
    expect(runs[1].text).toBe("b");
    expect(runs[1].overline).toBe(true);
    expect(runs[0].overline).toBeUndefined();
    expect(runs[2].overline).toBeUndefined();
  });

  it("scoped \\K produces a strikethrough run only inside braces", () => {
    const result = parseMTextContent("keep{\\Kgone}still");
    expect(result).toHaveLength(1);
    const runs = result[0].runs;
    expect(runs).toHaveLength(3);
    expect(runs[1].text).toBe("gone");
    expect(runs[1].strikethrough).toBe(true);
    expect(runs[0].strikethrough).toBeUndefined();
    expect(runs[2].strikethrough).toBeUndefined();
  });

  it("inline \\L mid-line creates a second run with underline on", () => {
    const result = parseMTextContent("plain\\Ltail");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(2);
    expect(result[0].runs[0].text).toBe("plain");
    expect(result[0].runs[0].underline).toBeUndefined();
    expect(result[0].runs[1].text).toBe("tail");
    expect(result[0].runs[1].underline).toBe(true);
  });

  it("scoped color does not leak into next paragraph", () => {
    // Closing brace at end of line \u2014 outer color was undefined,
    // so the next line must not carry the inner color.
    const result = parseMTextContent("{\\C1;red}\\Pnext");
    expect(result).toHaveLength(2);
    expect(result[0].runs[0].color).toBe("#ff0000");
    expect(result[1].runs[0].color).toBeUndefined();
  });

  it("inline \\W mid-line flushes run and stretches following text", () => {
    const result = parseMTextContent("plain\\W2;wide");
    expect(result).toHaveLength(1);
    expect(result[0].runs).toHaveLength(2);
    expect(result[0].runs[0].text).toBe("plain");
    expect(result[0].runs[0].widthFactor).toBeUndefined();
    expect(result[0].runs[1].text).toBe("wide");
    expect(result[0].runs[1].widthFactor).toBe(2);
  });

  it("scoped \\W reverts to outer width after closing }", () => {
    const result = parseMTextContent("a{\\W1.5;b}c");
    expect(result).toHaveLength(1);
    const runs = result[0].runs;
    expect(runs).toHaveLength(3);
    expect(runs[0].widthFactor).toBeUndefined();
    expect(runs[1].widthFactor).toBe(1.5);
    expect(runs[2].widthFactor).toBeUndefined();
  });

  it("rejects non-positive \\W values", () => {
    const result = parseMTextContent("\\W0;text");
    expect(result[0].runs[0].widthFactor).toBeUndefined();
  });

  it("defaultWidthFactor seeds initial state — runs without \\W inherit STYLE.widthFactor", () => {
    // Wired from STYLE.widthFactor (DXF code 41) via the third parameter.
    const result = parseMTextContent("plain", undefined, 0.8);
    expect(result[0].runs[0].widthFactor).toBe(0.8);
  });

  it("inline \\W overrides defaultWidthFactor for the following run", () => {
    const result = parseMTextContent("a\\W1.5;b", undefined, 0.8);
    const runs = result[0].runs;
    expect(runs[0].widthFactor).toBe(0.8);
    expect(runs[1].widthFactor).toBe(1.5);
  });

  it("defaultWidthFactor=1 is ignored (no widthFactor field on runs)", () => {
    const result = parseMTextContent("plain", undefined, 1);
    expect(result[0].runs[0].widthFactor).toBeUndefined();
  });

  it("\\Q accepts negative oblique angles", () => {
    const result = parseMTextContent("\\Q-12.5;slanted");
    expect(result[0].runs[0].obliqueAngle).toBe(-12.5);
  });

  it("scoped \\Q reverts after closing }", () => {
    const result = parseMTextContent("a{\\Q20;b}c");
    const runs = result[0].runs;
    expect(runs).toHaveLength(3);
    expect(runs[0].obliqueAngle).toBeUndefined();
    expect(runs[1].obliqueAngle).toBe(20);
    expect(runs[2].obliqueAngle).toBeUndefined();
  });

  it("combines \\W and \\Q on the same run", () => {
    const result = parseMTextContent("\\W2;\\Q15;wq");
    expect(result[0].runs).toHaveLength(1);
    expect(result[0].runs[0].widthFactor).toBe(2);
    expect(result[0].runs[0].obliqueAngle).toBe(15);
  });
});

// ── getMTextHAlign ───────────────────────────────────────────────────────

describe("getMTextHAlign", () => {
  it("returns 'left' when attachmentPoint is undefined", () => {
    expect(getMTextHAlign(undefined)).toBe("left");
  });

  it("returns 'left' when attachmentPoint is 0", () => {
    expect(getMTextHAlign(0)).toBe("left");
  });

  it("returns 'left' for attachment points 1, 4, 7", () => {
    expect(getMTextHAlign(1)).toBe("left");
    expect(getMTextHAlign(4)).toBe("left");
    expect(getMTextHAlign(7)).toBe("left");
  });

  it("returns 'center' for attachment points 2, 5, 8", () => {
    expect(getMTextHAlign(2)).toBe("center");
    expect(getMTextHAlign(5)).toBe("center");
    expect(getMTextHAlign(8)).toBe("center");
  });

  it("returns 'right' for attachment points 3, 6, 9", () => {
    expect(getMTextHAlign(3)).toBe("right");
    expect(getMTextHAlign(6)).toBe("right");
    expect(getMTextHAlign(9)).toBe("right");
  });
});

// ── getTextHAlign ────────────────────────────────────────────────────────

describe("getTextHAlign", () => {
  it("returns 'left' when halign is undefined", () => {
    expect(getTextHAlign(undefined)).toBe("left");
  });

  it("returns 'left' for halign=0 (Left) and halign=3 (Aligned) and halign=5 (Fit)", () => {
    expect(getTextHAlign(0)).toBe("left");
    expect(getTextHAlign(3)).toBe("left");
    expect(getTextHAlign(5)).toBe("left");
  });

  it("returns 'center' for halign=1 (Center) and halign=4 (Middle)", () => {
    expect(getTextHAlign(1)).toBe("center");
    expect(getTextHAlign(4)).toBe("center");
  });

  it("returns 'right' for halign=2 (Right)", () => {
    expect(getTextHAlign(2)).toBe("right");
  });
});

// ── getMTextVAlign ───────────────────────────────────────────────────────

describe("getMTextVAlign", () => {
  it("returns 'top' when attachmentPoint is undefined", () => {
    expect(getMTextVAlign(undefined)).toBe("top");
  });

  it("returns 'top' when attachmentPoint is 0", () => {
    expect(getMTextVAlign(0)).toBe("top");
  });

  it("returns 'top' for attachment points 1, 2, 3", () => {
    expect(getMTextVAlign(1)).toBe("top");
    expect(getMTextVAlign(2)).toBe("top");
    expect(getMTextVAlign(3)).toBe("top");
  });

  it("returns 'middle' for attachment points 4, 5, 6", () => {
    expect(getMTextVAlign(4)).toBe("middle");
    expect(getMTextVAlign(5)).toBe("middle");
    expect(getMTextVAlign(6)).toBe("middle");
  });

  it("returns 'bottom' for attachment points 7, 8, 9", () => {
    expect(getMTextVAlign(7)).toBe("bottom");
    expect(getMTextVAlign(8)).toBe("bottom");
    expect(getMTextVAlign(9)).toBe("bottom");
  });
});

// ── getTextVAlign ────────────────────────────────────────────────────────

describe("getTextVAlign", () => {
  it("returns 'bottom' when valign is undefined (Baseline)", () => {
    expect(getTextVAlign(undefined)).toBe("bottom");
  });

  it("returns 'bottom' for valign=0 (Baseline) and valign=1 (Bottom)", () => {
    expect(getTextVAlign(0)).toBe("bottom");
    expect(getTextVAlign(1)).toBe("bottom");
  });

  it("returns 'middle' for valign=2", () => {
    expect(getTextVAlign(2)).toBe("middle");
  });

  it("returns 'top' for valign=3", () => {
    expect(getTextVAlign(3)).toBe("top");
  });
});
