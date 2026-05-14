import type { Font, Glyph } from "opentype.js";
import { getTriangulatedGlyph, type GlyphData } from "./glyphCache";
import type { GeometryCollector } from "../mergeCollectors";
import type { MTextLine, MTextRun } from "./mtextParser";
import { cleanDimensionMText } from "../dimensions";
import { classifyFont } from "./fontClassifier";

/** DXF TEXT horizontal alignment (code 72) */
export const enum HAlign {
  LEFT = 0,
  CENTER = 1,
  RIGHT = 2,
  ALIGNED = 3,
  MIDDLE = 4,
  FIT = 5,
}

/** DXF TEXT vertical alignment (code 73) */
export const enum VAlign {
  BASELINE = 0,
  BOTTOM = 1,
  MIDDLE = 2,
  TOP = 3,
}

interface TextMetrics {
  glyphs: Glyph[];
  glyphData: (GlyphData | null)[];
  /** Total advance width in font units */
  totalAdvance: number;
  /** Visual bounding box in font units */
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** Cache for measureText results keyed by "fontFamily::text" */
const measureTextCache = new Map<string, TextMetrics>();

/** Clear measureText cache (call between file reloads to prevent unbounded growth) */
export function clearMeasureTextCache(): void {
  measureTextCache.clear();
}

/**
 * Measure text: collect glyphs, compute total advance and visual bounds.
 * All values are in font units (divide by unitsPerEm to normalize).
 * Results are cached by font+text key.
 */
function measureText(font: Font, text: string): TextMetrics {
  const cacheKey = (font.names?.fontFamily?.en ?? "font") + "::" + text;
  const cached = measureTextCache.get(cacheKey);
  if (cached) return cached;
  const glyphs = font.stringToGlyphs(text);
  const glyphDataArr: (GlyphData | null)[] = [];

  let totalAdvance = 0; // normalized (unitsPerEm = 1)
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  let hasVisibleGlyphs = false;
  const invEm = 1 / font.unitsPerEm;

  for (let i = 0; i < glyphs.length; i++) {
    const gd = getTriangulatedGlyph(font, text[i]);
    glyphDataArr.push(gd);

    if (gd && gd.positions.length > 0) {
      const gxMin = totalAdvance + gd.bounds.xMin;
      const gxMax = totalAdvance + gd.bounds.xMax;
      if (gxMin < xMin) xMin = gxMin;
      if (gxMax > xMax) xMax = gxMax;
      if (gd.bounds.yMin < yMin) yMin = gd.bounds.yMin;
      if (gd.bounds.yMax > yMax) yMax = gd.bounds.yMax;
      hasVisibleGlyphs = true;
    }

    // Use GlyphData advance (correct for both font and custom glyphs)
    totalAdvance += gd ? gd.advance : (glyphs[i].advanceWidth ?? 0) * invEm;
    if (i < glyphs.length - 1) {
      totalAdvance += font.getKerningValue(glyphs[i], glyphs[i + 1]) * invEm;
    }
  }

  if (!hasVisibleGlyphs) {
    xMin = 0;
    xMax = totalAdvance;
    yMin = font.descender * invEm;
    yMax = font.ascender * invEm;
  }

  const result: TextMetrics = {
    glyphs,
    glyphData: glyphDataArr,
    totalAdvance,
    bounds: { xMin, xMax, yMin, yMax },
  };
  measureTextCache.set(cacheKey, result);
  return result;
}

/**
 * Measure text width in world units.
 */
export function measureTextWidth(
  font: Font,
  text: string,
  height: number,
  widthFactor: number = 1,
): number {
  const m = measureText(font, text);
  // DXF height = cap height; scale to em units for correct measurement
  const capRatio = getCapHeightRatio(font);
  return (m.bounds.xMax - m.bounds.xMin) * (height / capRatio) * widthFactor;
}

// ── Parameter interfaces ──────────────────────────────────────────────

export interface TextParams {
  collector: GeometryCollector;
  layer: string;
  color: string;
  font: Font;
  text: string;
  height: number;
  posX: number;
  posY: number;
  posZ: number;
  rotation?: number;
  hAlign?: number;
  vAlign?: number;
  widthFactor?: number;
  endPosX?: number;
  endPosY?: number;
  transform?: readonly number[];
  bold?: boolean;
  italic?: boolean;
  obliqueAngle?: number;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
}

export interface MTextParams {
  collector: GeometryCollector;
  layer: string;
  color: string;
  font: Font;
  lines: MTextLine[];
  defaultHeight: number;
  posX: number;
  posY: number;
  posZ: number;
  rotation?: number;
  attachmentPoint?: number;
  width?: number;
  serifFont?: Font;
  lineSpacingFactor?: number;
}

export interface DimensionTextParams {
  collector: GeometryCollector;
  layer: string;
  color: string;
  font: Font;
  rawText: string;
  height: number;
  posX: number;
  posY: number;
  posZ: number;
  rotation?: number;
  hAlign?: "left" | "center" | "right";
  transform?: readonly number[];
}

// ── addTextToCollector ────────────────────────────────────────────────

/**
 * Add TEXT entity glyphs to GeometryCollector as triangulated mesh.
 */
export function addTextToCollector(p: TextParams): void {
  const {
    collector, layer, color, font, text, height,
    posZ, transform, bold,
    widthFactor = 1,
    hAlign = HAlign.LEFT,
    vAlign = VAlign.BASELINE,
    endPosX, endPosY,
    obliqueAngle, italic,
  } = p;
  let { posX, posY, rotation = 0 } = p;
  if (!text || height <= 0) return;

  const m = measureText(font, text);
  if (m.glyphs.length === 0) return;

  // DXF text height = cap height (visual height of uppercase letters).
  // Font glyph data is normalized to em square (unitsPerEm = 1), so we need
  // to scale by height/capHeightRatio to make cap height match DXF height.
  const capRatio = getCapHeightRatio(font);
  const emScale = height / capRatio;
  let scaleX = emScale * widthFactor;
  let scaleY = emScale;

  const boundsWidth = m.bounds.xMax - m.bounds.xMin;

  // FIT/ALIGNED: compute scale and rotation from two alignment points
  if (
    endPosX !== undefined &&
    endPosY !== undefined &&
    (hAlign === HAlign.ALIGNED || hAlign === HAlign.FIT)
  ) {
    const dx = endPosX - posX;
    const dy = endPosY - posY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    rotation = Math.atan2(dy, dx);

    if (boundsWidth > 0 && dist > 0) {
      const fitScale = dist / boundsWidth;
      if (hAlign === HAlign.ALIGNED) {
        // Uniform scale to fit distance
        scaleX = fitScale;
        scaleY = fitScale;
      } else {
        // FIT: scale only X, keep Y = height
        scaleX = fitScale;
      }
    }
  }

  // Horizontal origin offset (in normalized font units: divided by unitsPerEm)
  // DXF insertion point = advance origin (not visual edge), so LEFT uses 0.
  let originX = 0;
  switch (hAlign) {
    case HAlign.LEFT:
      originX = 0;
      break;
    case HAlign.CENTER:
      originX = (m.bounds.xMax + m.bounds.xMin) / 2;
      break;
    case HAlign.RIGHT:
      originX = m.bounds.xMax;
      break;
    case HAlign.MIDDLE:
      originX = (m.bounds.xMax + m.bounds.xMin) / 2;
      break;
    case HAlign.ALIGNED:
    case HAlign.FIT:
      originX = m.bounds.xMin;
      break;
  }

  // Vertical origin offset (in normalized font units)
  let originY = 0;
  switch (vAlign) {
    case VAlign.BASELINE:
      originY = 0;
      break;
    case VAlign.BOTTOM:
      originY = m.bounds.yMin;
      break;
    case VAlign.MIDDLE:
      originY = (m.bounds.yMax + m.bounds.yMin) / 2;
      break;
    case VAlign.TOP:
      // Use cap height (font metric) instead of glyph-specific bounds.yMax.
      // DXF MTEXT "Top" attachment means insertion point is at the cap height line,
      // not the visual top of the specific characters. This ensures consistent
      // positioning regardless of whether text is uppercase or lowercase.
      originY = capRatio;
      break;
  }
  // MIDDLE (hAlign=4) also centers vertically
  if (hAlign === HAlign.MIDDLE) {
    originY = (m.bounds.yMax + m.bounds.yMin) / 2;
  }

  // Rotation transform
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Oblique angle shear: obliqueAngle (degrees) > faux italic > none
  const shear = obliqueAngle ? Math.tan((obliqueAngle * Math.PI) / 180) : (italic ? ITALIC_SLANT : 0);

  // Emit glyphs into collector
  let xCursor = 0; // normalized advance cursor (unitsPerEm = 1)
  const allPositions: number[] = [];
  const allIndices: number[] = [];
  const invEm = 1 / font.unitsPerEm;

  for (let i = 0; i < m.glyphs.length; i++) {
    const gd = m.glyphData[i];

    if (gd && gd.positions.length > 0) {
      const vertexOffset = allPositions.length / 3;

      for (let j = 0; j < gd.positions.length; j += 3) {
        // All values normalized (unitsPerEm = 1)
        const glyphX = gd.positions[j] + xCursor - originX;
        const glyphY = gd.positions[j + 1] - originY;
        // Oblique / italic shear X by Y
        const localX = (shear ? glyphX + glyphY * shear : glyphX) * scaleX;
        const localY = glyphY * scaleY;
        // Rotation + translation to world coordinates
        let wx = posX + localX * cos - localY * sin;
        let wy = posY + localX * sin + localY * cos;
        let wz = posZ;
        // Apply block INSERT transform if provided (Matrix4 elements)
        if (transform) {
          const tx = transform[0] * wx + transform[4] * wy + transform[8] * wz + transform[12];
          const ty = transform[1] * wx + transform[5] * wy + transform[9] * wz + transform[13];
          const tz = transform[2] * wx + transform[6] * wy + transform[10] * wz + transform[14];
          wx = tx;
          wy = ty;
          wz = tz;
        }
        allPositions.push(wx, wy, wz);
      }

      for (const idx of gd.indices) {
        allIndices.push(idx + vertexOffset);
      }

      // Faux bold: duplicate triangles shifted along text direction
      if (bold) {
        const boldVertexOffset = allPositions.length / 3;
        for (let j = 0; j < gd.positions.length; j += 3) {
          const glyphX = gd.positions[j] + xCursor - originX;
          const glyphY = gd.positions[j + 1] - originY;
          const localX =
            ((shear ? glyphX + glyphY * shear : glyphX) + BOLD_OFFSET) * scaleX;
          const localY = glyphY * scaleY;
          let wx = posX + localX * cos - localY * sin;
          let wy = posY + localX * sin + localY * cos;
          let wz = posZ;
          if (transform) {
            const tx = transform[0] * wx + transform[4] * wy + transform[8] * wz + transform[12];
            const ty = transform[1] * wx + transform[5] * wy + transform[9] * wz + transform[13];
            const tz = transform[2] * wx + transform[6] * wy + transform[10] * wz + transform[14];
            wx = tx;
            wy = ty;
            wz = tz;
          }
          allPositions.push(wx, wy, wz);
        }
        for (const idx of gd.indices) {
          allIndices.push(idx + boldVertexOffset);
        }
      }
    }

    // Use GlyphData advance (correct for both font and custom glyphs)
    xCursor += gd ? gd.advance : (m.glyphs[i].advanceWidth ?? 0) * invEm;
    if (i < m.glyphs.length - 1) {
      xCursor += font.getKerningValue(m.glyphs[i], m.glyphs[i + 1]) * invEm;
    }
  }

  if (allPositions.length >= 9 && allIndices.length >= 3) {
    collector.addOverlayMesh(layer, color, allPositions, allIndices);
  }

  // Emit underline / strikethrough / overline segments
  if (m.totalAdvance > 0) {
    const capRatio = getCapHeightRatio(font);
    if (p.underline) {
      emitTextDecoration(collector, layer, color, m, originX, originY,
        scaleX, scaleY, -UNDERLINE_OFFSET, posX, posY, posZ, cos, sin, transform);
    }
    if (p.strikethrough) {
      emitTextDecoration(collector, layer, color, m, originX, originY,
        scaleX, scaleY, capRatio * STRIKETHROUGH_RATIO, posX, posY, posZ, cos, sin, transform);
    }
    if (p.overline) {
      emitTextDecoration(collector, layer, color, m, originX, originY,
        scaleX, scaleY, capRatio + OVERLINE_OFFSET, posX, posY, posZ, cos, sin, transform);
    }
  }
}

/**
 * Emit a horizontal decoration line spanning the text bounds at the given
 * Y position in normalized font units (baseline = 0, cap height = capRatio).
 * Applies the same scaling, rotation and transform as the parent text run.
 */
function emitTextDecoration(
  collector: GeometryCollector,
  layer: string,
  color: string,
  m: TextMetrics,
  originX: number,
  originY: number,
  scaleX: number,
  scaleY: number,
  yFontUnits: number,
  posX: number,
  posY: number,
  posZ: number,
  cos: number,
  sin: number,
  transform?: readonly number[],
): void {
  const x1 = (m.bounds.xMin - originX) * scaleX;
  const x2 = (m.bounds.xMax - originX) * scaleX;
  const localY = (yFontUnits - originY) * scaleY;

  let wx1 = posX + x1 * cos - localY * sin;
  let wy1 = posY + x1 * sin + localY * cos;
  let wz1 = posZ;
  let wx2 = posX + x2 * cos - localY * sin;
  let wy2 = posY + x2 * sin + localY * cos;
  let wz2 = posZ;

  if (transform) {
    const t1x = transform[0] * wx1 + transform[4] * wy1 + transform[8] * wz1 + transform[12];
    const t1y = transform[1] * wx1 + transform[5] * wy1 + transform[9] * wz1 + transform[13];
    const t1z = transform[2] * wx1 + transform[6] * wy1 + transform[10] * wz1 + transform[14];
    wx1 = t1x; wy1 = t1y; wz1 = t1z;
    const t2x = transform[0] * wx2 + transform[4] * wy2 + transform[8] * wz2 + transform[12];
    const t2y = transform[1] * wx2 + transform[5] * wy2 + transform[9] * wz2 + transform[13];
    const t2z = transform[2] * wx2 + transform[6] * wy2 + transform[10] * wz2 + transform[14];
    wx2 = t2x; wy2 = t2y; wz2 = t2z;
  }

  collector.addLineSegments(layer, color, [wx1, wy1, wz1, wx2, wy2, wz2]);
}

// ── Faux bold/italic constants ─────────────────────────────────────────

/** Default cap height ratio when OS/2 table is unavailable */
const DEFAULT_CAP_HEIGHT_RATIO = 0.7;

/** Cache for per-font cap height ratio */
const capHeightCache = new WeakMap<Font, number>();

/**
 * Get the cap height ratio (capHeight / unitsPerEm) for a font.
 * DXF text height defines the cap height (height of uppercase letters),
 * so we scale by 1/capHeightRatio to convert from DXF height to em scale.
 */
function getCapHeightRatio(font: Font): number {
  let ratio = capHeightCache.get(font);
  if (ratio !== undefined) return ratio;
  const os2 = (font as { tables?: { os2?: { sCapHeight?: number } } }).tables?.os2;
  const capHeight = os2?.sCapHeight;
  ratio = (capHeight && capHeight > 0 && font.unitsPerEm > 0)
    ? capHeight / font.unitsPerEm
    : DEFAULT_CAP_HEIGHT_RATIO;
  capHeightCache.set(font, ratio);
  return ratio;
}

/** Italic slant: tan(12°) ≈ 0.2126 */
const ITALIC_SLANT = Math.tan((12 * Math.PI) / 180);
/** Bold offset as fraction of height (normalized units) */
const BOLD_OFFSET = 0.02;
/** Underline position below baseline as fraction of height (normalized units) */
const UNDERLINE_OFFSET = 0.15;
/** Overline position above cap height as fraction of height (normalized units) */
const OVERLINE_OFFSET = 0.1;
/** Strikethrough position as fraction of cap height (0.5 = center of cap) */
const STRIKETHROUGH_RATIO = 0.5;

// ── MTEXT support ──────────────────────────────────────────────────────

/** DXF standard MTEXT line spacing: factor * 5/3 of text height */
const DXF_LINE_SPACING_BASE = 5 / 3;
const STACKED_RATIO = 0.6;
/** Small gap between main text and stacked fraction, as ratio of height */
const STACKED_H_GAP = 0.1;
/**
 * AutoCAD default MTEXT tab stop multiplier: 4 × textHeight.
 * With an Arial-compatible font (Liberation Sans) this matches AutoCAD behaviour.
 */
const TAB_STOP_MULTIPLIER = 4;

/**
 * Map MTEXT horizontal alignment string to HAlign enum.
 */
function mtextHAlignToEnum(hAlign: "left" | "center" | "right"): number {
  if (hAlign === "center") return HAlign.CENTER;
  if (hAlign === "right") return HAlign.RIGHT;
  return HAlign.LEFT;
}

/**
 * Resolve the effective font for a run, applying serif/sans classification
 * when a serif fallback font is supplied and the run carries a fontFamily.
 */
function resolveRunFont(run: MTextRun, font: Font, serifFont: Font | undefined): Font {
  if (serifFont && run.fontFamily) {
    return classifyFont(run.fontFamily) === "serif" ? serifFont : font;
  }
  return font;
}

/** Measure a run's advance width in world units, given its effective font/height. */
function measureRunWidth(
  run: MTextRun,
  font: Font,
  serifFont: Font | undefined,
  defaultHeight: number,
): number {
  if (!run.text) return 0;
  const f = resolveRunFont(run, font, serifFont);
  const h = run.height ?? defaultHeight;
  const emScale = h / getCapHeightRatio(f);
  const widthFactor = run.widthFactor ?? 1;
  return measureText(f, run.text).totalAdvance * emScale * widthFactor;
}

/** Build runs by slicing a base run with a new text value (preserves all formatting). */
const sliceRun = (run: MTextRun, text: string): MTextRun => ({ ...run, text });

/**
 * Word-wrap a line's runs to fit within maxWidth (world units). Splits each
 * run's text on spaces, measures each token with the run's own font/height,
 * and greedily packs tokens into wrapped lines. Format boundaries are
 * preserved: contiguous tokens from the same run on the same wrapped line
 * are coalesced back into a single MTextRun.
 */
function wrapLineRunsToWidth(
  line: MTextLine,
  font: Font,
  serifFont: Font | undefined,
  defaultHeight: number,
  maxWidth: number,
): MTextLine[] {
  type Token = { runIdx: number; text: string; isSpace: boolean; adv: number };
  const tokens: Token[] = [];
  for (let r = 0; r < line.runs.length; r++) {
    const run = line.runs[r];
    if (!run.text) continue;
    const f = resolveRunFont(run, font, serifFont);
    const h = run.height ?? defaultHeight;
    const emScale = h / getCapHeightRatio(f);
    const widthFactor = run.widthFactor ?? 1;
    // Split keeping space groups: " word1  word2 " -> ["", " ", "word1", "  ", "word2", " "]
    const parts = run.text.split(/( +)/);
    for (const part of parts) {
      if (part === "") continue;
      tokens.push({
        runIdx: r,
        text: part,
        isSpace: part.charAt(0) === " ",
        adv: measureText(f, part).totalAdvance * emScale * widthFactor,
      });
    }
  }
  if (tokens.length === 0) return [line];

  // Greedy wrap. 2% tolerance matches sCapHeight rounding (see legacy comment).
  const wrapped: Token[][] = [[]];
  let currentAdv = 0;
  for (const tok of tokens) {
    const isFirstOnLine = wrapped[wrapped.length - 1].length === 0;
    if (
      !tok.isSpace &&
      !isFirstOnLine &&
      currentAdv + tok.adv > maxWidth * 1.02
    ) {
      wrapped.push([tok]);
      currentAdv = tok.adv;
    } else if (tok.isSpace && isFirstOnLine) {
      // Skip leading spaces on a wrapped continuation line
      continue;
    } else {
      wrapped[wrapped.length - 1].push(tok);
      currentAdv += tok.adv;
    }
  }

  return wrapped
    .filter((toks) => toks.length > 0)
    .map((toks, wi) => {
      const runs: MTextRun[] = [];
      let bufRunIdx = -1;
      let buf = "";
      for (const tok of toks) {
        if (tok.runIdx !== bufRunIdx) {
          if (buf) runs.push(sliceRun(line.runs[bufRunIdx], buf));
          bufRunIdx = tok.runIdx;
          buf = tok.text;
        } else {
          buf += tok.text;
        }
      }
      if (buf) runs.push(sliceRun(line.runs[bufRunIdx], buf));
      return {
        runs,
        leftMargin: line.leftMargin,
        // Only the first wrapped line keeps the first-line indent
        firstIndent: wi === 0 ? line.firstIndent : undefined,
      };
    });
}

/** Split a line's runs at every '\t' boundary. Returns an array of segments,
 * each segment being a list of (run-sliced) runs that render between two
 * consecutive tab stops. Trailing empty segments (from trailing tabs) are
 * preserved so the caller can drop them as column-width padding.
 */
function splitRunsByTab(runs: MTextRun[]): MTextRun[][] {
  const segments: MTextRun[][] = [[]];
  for (const run of runs) {
    if (!run.text) continue;
    const parts = run.text.split("\t");
    if (parts[0]) segments[segments.length - 1].push(sliceRun(run, parts[0]));
    for (let p = 1; p < parts.length; p++) {
      segments.push([]);
      if (parts[p]) segments[segments.length - 1].push(sliceRun(run, parts[p]));
    }
  }
  return segments;
}

interface StackedTextParams {
  collector: GeometryCollector;
  layer: string;
  color: string;
  font: Font;
  mainText: string;
  stackedTop: string;
  stackedBottom: string;
  height: number;
  posX: number;
  posY: number;
  posZ: number;
  rotation: number;
  hAlign: "left" | "center" | "right";
  transform?: readonly number[];
  bold?: boolean;
  italic?: boolean;
}

/**
 * Emit stacked text (main text + fraction) into collector.
 * Handles horizontal alignment for the combined width.
 */
function emitStackedText(p: StackedTextParams): void {
  const {
    collector, layer, color, font,
    mainText, stackedTop, stackedBottom,
    height, posX, posY, posZ, rotation, hAlign,
    transform, bold, italic,
  } = p;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const stackedHeight = height * STACKED_RATIO;

  // Measure advance widths in world units (using em scale for cap height correction)
  const capRatio = getCapHeightRatio(font);
  const mainEmScale = height / capRatio;
  const stackedEmScale = stackedHeight / capRatio;
  const mainAdvance = mainText ? measureText(font, mainText).totalAdvance * mainEmScale : 0;
  const topAdvance = stackedTop ? measureText(font, stackedTop).totalAdvance * stackedEmScale : 0;
  const bottomAdvance = stackedBottom
    ? measureText(font, stackedBottom).totalAdvance * stackedEmScale
    : 0;
  const stackedWidth = Math.max(topAdvance, bottomAdvance);
  const gap = mainText ? mainEmScale * STACKED_H_GAP : 0;
  const totalWidth = mainAdvance + gap + stackedWidth;

  // Horizontal alignment offset (in local text direction)
  let offsetX = 0;
  if (hAlign === "center") offsetX = -totalWidth / 2;
  else if (hAlign === "right") offsetX = -totalWidth;

  // Visual center of the main text line
  const normAsc = font.ascender / font.unitsPerEm;
  const halfAsc = normAsc * mainEmScale * 0.5;
  // Center point: shift down from top by halfAsc
  const centerOffsetY = -halfAsc;
  const centerX = posX - centerOffsetY * sin;
  const centerY = posY + centerOffsetY * cos;

  // Start position with alignment offset applied in rotated direction
  let curX = centerX + offsetX * cos;
  let curY = centerY + offsetX * sin;

  // Emit main text (LEFT-aligned, vertically centered on the stacked block center)
  if (mainText) {
    addTextToCollector({
      collector, layer, color, font, text: mainText, height,
      posX: curX, posY: curY, posZ,
      rotation, hAlign: HAlign.LEFT, vAlign: VAlign.MIDDLE,
      transform, bold, italic,
    });
    curX += (mainAdvance + gap) * cos;
    curY += (mainAdvance + gap) * sin;
  }
  // Gap between top and bottom fractions (in world units)
  const vGap = height * 0.02;

  // Top fraction: baseline positioned above center
  if (stackedTop) {
    const topOffsetY = vGap;
    const topX = curX - topOffsetY * sin;
    const topY = curY + topOffsetY * cos;
    addTextToCollector({
      collector, layer, color, font, text: stackedTop, height: stackedHeight,
      posX: topX, posY: topY, posZ,
      rotation, hAlign: HAlign.LEFT, vAlign: VAlign.BASELINE,
      transform, bold, italic,
    });
  }

  // Bottom fraction: baseline positioned below center
  if (stackedBottom) {
    const stackedAsc = normAsc * stackedHeight;
    const bottomOffsetY = -vGap - stackedAsc;
    const bottomX = curX - bottomOffsetY * sin;
    const bottomY = curY + bottomOffsetY * cos;
    addTextToCollector({
      collector, layer, color, font, text: stackedBottom, height: stackedHeight,
      posX: bottomX, posY: bottomY, posZ,
      rotation, hAlign: HAlign.LEFT, vAlign: VAlign.BASELINE,
      transform, bold, italic,
    });
  }
}

/** Effective height of a run, falling back to defaultHeight. */
const runHeight = (run: MTextRun, defaultHeight: number): number =>
  run.height ?? defaultHeight;

/** Total advance of a list of runs in world units. */
function measureRunsWidth(
  runs: MTextRun[],
  font: Font,
  serifFont: Font | undefined,
  defaultHeight: number,
): number {
  let total = 0;
  for (const r of runs) total += measureRunWidth(r, font, serifFont, defaultHeight);
  return total;
}

/**
 * Emit a single MTEXT line composed of one or more formatted runs.
 * Total line width is measured across all runs so the alignment offset
 * positions the whole line correctly; runs are then placed left-to-right
 * with accumulated xCursor.
 */
function emitMTextLine(
  runs: MTextRun[],
  fallbackColor: string,
  font: Font,
  serifFont: Font | undefined,
  defaultHeight: number,
  collector: GeometryCollector,
  layer: string,
  posX: number,
  posY: number,
  posZ: number,
  rotation: number,
  cos: number,
  sin: number,
  hAlign: "left" | "center" | "right",
  vAlign: number,
): void {
  if (runs.length === 0) return;

  const totalWidth = measureRunsWidth(runs, font, serifFont, defaultHeight);
  let startOffset = 0;
  if (hAlign === "center") startOffset = -totalWidth / 2;
  else if (hAlign === "right") startOffset = -totalWidth;

  let xCursor = startOffset;
  for (const run of runs) {
    if (!run.text) continue;
    const f = resolveRunFont(run, font, serifFont);
    const h = runHeight(run, defaultHeight);
    const wx = posX + xCursor * cos;
    const wy = posY + xCursor * sin;
    addTextToCollector({
      collector,
      layer,
      color: run.color ?? fallbackColor,
      font: f,
      text: run.text,
      height: h,
      posX: wx,
      posY: wy,
      posZ,
      rotation,
      hAlign: HAlign.LEFT,
      vAlign,
      bold: run.bold,
      italic: run.italic,
      underline: run.underline,
      overline: run.overline,
      strikethrough: run.strikethrough,
      widthFactor: run.widthFactor,
      obliqueAngle: run.obliqueAngle,
    });
    xCursor += measureRunWidth(run, font, serifFont, defaultHeight);
  }
}

/**
 * Strip trailing runs whose text is only whitespace tabs and runs that become
 * empty after rstrip — trailing tabs in MTEXT are column-width padding, not
 * visible content. Returns a new array; original runs are not mutated.
 */
function stripTrailingTabs(runs: MTextRun[]): MTextRun[] {
  if (runs.length === 0) return runs;
  const out = runs.slice();
  while (out.length > 0) {
    const last = out[out.length - 1];
    const stripped = last.text.replace(/\t+$/, "");
    if (stripped === last.text) break;
    if (stripped === "") out.pop();
    else { out[out.length - 1] = sliceRun(last, stripped); break; }
  }
  return out;
}

/**
 * Add MTEXT entity lines to GeometryCollector as triangulated mesh.
 * Handles multiline text with word wrapping, 9 attachment points,
 * stacked text (fractions), and inline run-level formatting.
 */
export function addMTextToCollector(p: MTextParams): void {
  const {
    collector, layer, color, font, lines, defaultHeight,
    posX, posY, posZ,
    rotation = 0,
    attachmentPoint = 1,
    width, serifFont, lineSpacingFactor,
  } = p;
  if (lines.length === 0 || defaultHeight <= 0) return;
  const lineSpacing = (lineSpacingFactor || 1) * DXF_LINE_SPACING_BASE;

  // 1. Tab expansion + Word wrapping
  // Tab stop = 4 × textHeight (AutoCAD default)
  const tabStopWidth = TAB_STOP_MULTIPLIER * defaultHeight;
  const expandedLines: MTextLine[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    // Skip wrapping for stacked lines (typically short fractions)
    if (line.stackedTop || line.stackedBottom) {
      expandedLines.push(line);
      continue;
    }

    const hasTabs = line.runs.some((r) => r.text.includes("\t"));
    let processedRuns = line.runs;
    // Tab-containing lines define columnar layout (tables, schedules).
    // Strip trailing tabs as column-width padding.
    if (hasTabs) processedRuns = stripTrailingTabs(processedRuns);

    // Word wrap (only when width constraint is set and line has no tabs)
    if (!hasTabs && width && width > 0) {
      const margin = line.leftMargin || 0;
      const effectiveWidth = width - margin;
      const wrapped = wrapLineRunsToWidth(
        line,
        font,
        serifFont,
        defaultHeight,
        effectiveWidth > 0 ? effectiveWidth : width,
      );
      for (const w of wrapped) expandedLines.push(w);
    } else {
      expandedLines.push({ ...line, runs: processedRuns });
    }
  }

  if (expandedLines.length === 0) return;

  // 2. Compute total block height. Use the tallest run on each line as the
  //    line's effective height (matters when a line mixes run heights).
  const lineHeightFor = (line: MTextLine): number => {
    let h = 0;
    for (const r of line.runs) h = Math.max(h, runHeight(r, defaultHeight));
    return h > 0 ? h : defaultHeight;
  };

  let totalHeight = 0;
  for (const line of expandedLines) totalHeight += lineHeightFor(line) * lineSpacing;
  const lastLineHeight = lineHeightFor(expandedLines[expandedLines.length - 1]);
  totalHeight = totalHeight - lastLineHeight * lineSpacing + lastLineHeight;

  // 3. Determine alignment from attachment point (1-9)
  const col = (attachmentPoint - 1) % 3; // 0=left, 1=center, 2=right
  const row = Math.ceil(attachmentPoint / 3); // 1=top, 2=middle, 3=bottom
  const hAlign: "left" | "center" | "right" = col === 1 ? "center" : col === 2 ? "right" : "left";

  // Vertical offset and VAlign depend on the attachment row.
  let groupYOffset = 0;
  let rowVAlign = VAlign.TOP;
  if (row === 2) {
    groupYOffset = (totalHeight - lastLineHeight) / 2;
    rowVAlign = VAlign.MIDDLE;
  } else if (row === 3) {
    groupYOffset = totalHeight - lastLineHeight;
    rowVAlign = VAlign.BOTTOM;
  }

  // 4. Emit each line
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  let lineYOffset = 0; // accumulates downward (negative Y in local coords)
  for (const line of expandedLines) {
    const lineHeight = lineHeightFor(line);
    // Stacked lines (\S) currently use the first run's formatting for the
    // main text and fraction. Mixing formatting around \S is rare and not
    // representable in the legacy emitStackedText model.
    const firstRun = line.runs[0];

    // Paragraph indentation: leftMargin + firstIndent (in drawing units)
    const indentX = (line.leftMargin || 0) + (line.firstIndent || 0);
    // Local offset from insertion point (in text-local coordinates)
    const localY = groupYOffset + lineYOffset;
    // Apply rotation to get world position, including paragraph indent
    const worldX = posX - localY * sin + indentX * cos;
    const worldY = posY + localY * cos + indentX * sin;

    if (line.stackedTop || line.stackedBottom) {
      const mainText = line.runs.map((r) => r.text).join("");
      const stackedFont = firstRun ? resolveRunFont(firstRun, font, serifFont) : font;
      const stackedColor = firstRun?.color ?? color;
      emitStackedText({
        collector, layer, color: stackedColor, font: stackedFont,
        mainText, stackedTop: line.stackedTop || "", stackedBottom: line.stackedBottom || "",
        height: lineHeight, posX: worldX, posY: worldY, posZ, rotation, hAlign,
        bold: firstRun?.bold, italic: firstRun?.italic,
      });
    } else if (line.runs.some((r) => r.text.includes("\t"))) {
      // Render tab-separated segments at exact tab stop positions.
      // Tab grid = multiples of tabStopWidth (4 × defaultHeight).
      const segments = splitRunsByTab(line.runs);
      let segLocalX = 0;
      for (let si = 0; si < segments.length; si++) {
        const seg = segments[si];
        if (seg.length > 0) {
          const segWX = worldX + segLocalX * cos;
          const segWY = worldY + segLocalX * sin;
          emitMTextLine(
            seg, color, font, serifFont, defaultHeight,
            collector, layer, segWX, segWY, posZ, rotation, cos, sin,
            "left", rowVAlign,
          );
          segLocalX += measureRunsWidth(seg, font, serifFont, defaultHeight);
        }
        // Advance to next tab stop after each segment except the last
        if (si < segments.length - 1) {
          segLocalX = Math.ceil((segLocalX + 1e-6) / tabStopWidth) * tabStopWidth;
        }
      }
    } else {
      emitMTextLine(
        line.runs, color, font, serifFont, defaultHeight,
        collector, layer, worldX, worldY, posZ, rotation, cos, sin,
        hAlign, rowVAlign,
      );
    }

    lineYOffset -= lineHeight * lineSpacing;
  }
}

// ── DIMENSION text support ──────────────────────────────────────────────

/** Stacked fraction regex: prefix \S top^bottom; or top/bottom; or top#bottom; suffix */
const STACKED_REGEX = /^(.*?)\\S([^^/#;]*)[\^/#]([^;]*);(.*)$/;

/**
 * Measure dimension text width in world units.
 * Cleans MTEXT formatting, handles stacked fractions (\S).
 */
export function measureDimensionTextWidth(font: Font, rawText: string, height: number): number {
  const cleaned = cleanDimensionMText(rawText);
  const stackedMatch = cleaned.match(STACKED_REGEX);

  if (stackedMatch) {
    const mainText = stackedMatch[1].trim();
    const topText = stackedMatch[2].trim();
    const bottomText = stackedMatch[3].trim();
    const suffixText = stackedMatch[4]?.trim() || "";

    const stackedHeight = height * STACKED_RATIO;
    const capRatio = getCapHeightRatio(font);
    const mainEmScale = height / capRatio;
    const stackedEmScale = stackedHeight / capRatio;
    const mainAdvance = mainText ? measureText(font, mainText).totalAdvance * mainEmScale : 0;
    const topAdvance = topText ? measureText(font, topText).totalAdvance * stackedEmScale : 0;
    const bottomAdvance = bottomText
      ? measureText(font, bottomText).totalAdvance * stackedEmScale
      : 0;
    const stackedWidth = Math.max(topAdvance, bottomAdvance);
    const gap = mainText ? mainEmScale * STACKED_H_GAP : 0;
    const suffixAdvance = suffixText ? measureText(font, suffixText).totalAdvance * mainEmScale : 0;

    return mainAdvance + gap + stackedWidth + suffixAdvance;
  }

  // Plain text: strip remaining \S patterns
  const plain = cleaned.replace(/\\S[^;]*;/g, "").trim();
  return measureTextWidth(font, plain, height);
}

/**
 * Add DIMENSION text to GeometryCollector as triangulated mesh.
 * Cleans MTEXT formatting, applies baseline gap above the dimension line,
 * and handles stacked fractions (\S format).
 */
export function addDimensionTextToCollector(p: DimensionTextParams): void {
  const {
    collector, layer, color, font, rawText, height,
    posX, posY, posZ,
    rotation = 0,
    hAlign = "center",
    transform,
  } = p;
  const cleaned = cleanDimensionMText(rawText);
  if (!cleaned.trim() || height <= 0) return;

  const stackedMatch = cleaned.match(STACKED_REGEX);

  if (stackedMatch) {
    const mainText = stackedMatch[1].trim();
    const topText = stackedMatch[2].trim();
    const bottomText = stackedMatch[3].trim();
    const suffixText = stackedMatch[4]?.trim() || "";
    const stackedHeight = height * STACKED_RATIO;

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Measure widths to compute horizontal alignment (using em scale)
    const capRatio = getCapHeightRatio(font);
    const mainEmScale = height / capRatio;
    const stackedEmScale = stackedHeight / capRatio;
    const mainAdvance = mainText ? measureText(font, mainText).totalAdvance * mainEmScale : 0;
    const topAdvance = topText ? measureText(font, topText).totalAdvance * stackedEmScale : 0;
    const bottomAdvance = bottomText
      ? measureText(font, bottomText).totalAdvance * stackedEmScale
      : 0;
    const stackedWidth = Math.max(topAdvance, bottomAdvance);
    const gap = mainText ? mainEmScale * STACKED_H_GAP : 0;
    const suffixAdvance = suffixText ? measureText(font, suffixText).totalAdvance * mainEmScale : 0;
    const totalWidth = mainAdvance + gap + stackedWidth + suffixAdvance;

    // Horizontal alignment offset
    let offsetX = 0;
    if (hAlign === "center") offsetX = -totalWidth / 2;
    else if (hAlign === "right") offsetX = -totalWidth;

    let curX = posX + offsetX * cos;
    let curY = posY + offsetX * sin;

    // Emit main text centered on posY
    if (mainText) {
      addTextToCollector({
        collector, layer, color, font, text: mainText, height,
        posX: curX, posY: curY, posZ,
        rotation, hAlign: HAlign.LEFT, vAlign: VAlign.MIDDLE,
        transform,
      });
      curX += (mainAdvance + gap) * cos;
      curY += (mainAdvance + gap) * sin;
    }

    // Fractions: centered vertically around posY (= dimension midpoint).
    // Extra gap so digits don't touch the horizontal separator line.
    const vGap = mainEmScale * 0.12;
    const topMetrics = topText ? measureText(font, topText) : null;
    const bottomMetrics = bottomText ? measureText(font, bottomText) : null;
    const topVisualH = topMetrics
      ? (topMetrics.bounds.yMax - topMetrics.bounds.yMin) * stackedEmScale
      : 0;
    const bottomVisualH = bottomMetrics
      ? (bottomMetrics.bounds.yMax - bottomMetrics.bounds.yMin) * stackedEmScale
      : 0;
    const totalStackH = topVisualH + vGap + bottomVisualH;
    const halfStack = totalStackH / 2;

    if (topText && topMetrics) {
      const topBaseY = halfStack - topMetrics.bounds.yMax * stackedEmScale;
      const topCenterX = (stackedWidth - topAdvance) / 2;
      const topX = curX + topCenterX * cos - topBaseY * sin;
      const topY = curY + topCenterX * sin + topBaseY * cos;
      addTextToCollector({
        collector, layer, color, font, text: topText, height: stackedHeight,
        posX: topX, posY: topY, posZ,
        rotation, hAlign: HAlign.LEFT, vAlign: VAlign.BASELINE,
        transform,
      });
    }

    if (bottomText && bottomMetrics) {
      const bottomBaseY = -halfStack - bottomMetrics.bounds.yMin * stackedEmScale;
      const bottomCenterX = (stackedWidth - bottomAdvance) / 2;
      const bottomX = curX + bottomCenterX * cos - bottomBaseY * sin;
      const bottomY = curY + bottomCenterX * sin + bottomBaseY * cos;
      addTextToCollector({
        collector, layer, color, font, text: bottomText, height: stackedHeight,
        posX: bottomX, posY: bottomY, posZ,
        rotation, hAlign: HAlign.LEFT, vAlign: VAlign.BASELINE,
        transform,
      });
    }

    // Horizontal separator line between numerator and denominator
    // Line extends slightly beyond digits (overshoot) and is centered
    if (topText && bottomText) {
      const overshoot = stackedWidth * 0.08;
      const lineX1 = -overshoot;
      const lineX2 = stackedWidth + overshoot;
      let wx1 = curX + lineX1 * cos;
      let wy1 = curY + lineX1 * sin;
      let wz1 = posZ;
      let wx2 = curX + lineX2 * cos;
      let wy2 = curY + lineX2 * sin;
      let wz2 = posZ;
      if (transform) {
        const t1x = transform[0] * wx1 + transform[4] * wy1 + transform[8] * wz1 + transform[12];
        const t1y = transform[1] * wx1 + transform[5] * wy1 + transform[9] * wz1 + transform[13];
        const t1z = transform[2] * wx1 + transform[6] * wy1 + transform[10] * wz1 + transform[14];
        wx1 = t1x; wy1 = t1y; wz1 = t1z;
        const t2x = transform[0] * wx2 + transform[4] * wy2 + transform[8] * wz2 + transform[12];
        const t2y = transform[1] * wx2 + transform[5] * wy2 + transform[9] * wz2 + transform[13];
        const t2z = transform[2] * wx2 + transform[6] * wy2 + transform[10] * wz2 + transform[14];
        wx2 = t2x; wy2 = t2y; wz2 = t2z;
      }
      collector.addLineSegments(layer, color, [wx1, wy1, wz1, wx2, wy2, wz2]);
    }

    // Suffix text after stacked fraction (e.g. the " in 9\S1/2;")
    if (suffixText) {
      const suffX = curX + stackedWidth * cos;
      const suffY = curY + stackedWidth * sin;
      addTextToCollector({
        collector, layer, color, font, text: suffixText, height,
        posX: suffX, posY: suffY, posZ,
        rotation, hAlign: HAlign.LEFT, vAlign: VAlign.MIDDLE,
        transform,
      });
    }
  } else {
    const plain = cleaned.replace(/\\S[^;]*;/g, "").trim();
    if (!plain) return;

    const hAlignEnum = mtextHAlignToEnum(hAlign);
    addTextToCollector({
      collector, layer, color, font, text: plain, height,
      posX, posY, posZ,
      rotation, hAlign: hAlignEnum, vAlign: VAlign.MIDDLE,
      transform,
    });
  }
}
