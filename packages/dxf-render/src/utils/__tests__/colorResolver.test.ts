import { describe, it, expect } from "vitest";
import { rgbNumberToHex, resolveEntityColor, ACI7_COLOR, resolveAci7Hex, isThemeAdaptiveColor, resolveThemeColor, aciToColor, decodeCmEntityColor, resolveMLeaderColor } from "@/utils/colorResolver";
import type { DxfEntity, DxfLayer } from "@/types/dxf";

// Helper to create a minimal DxfEntity for testing color resolution.
// Uses DxfUnknownEntity (type: string) since we only care about color-related fields.
function makeEntity(
  overrides: Partial<{ colorIndex: number; color: number; layer: string }> = {},
): DxfEntity {
  return { type: "LINE", vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }], ...overrides } as DxfEntity;
}

// Helper to create a DxfLayer record keyed by layer name.
function makeLayer(
  name: string,
  overrides: Partial<Omit<DxfLayer, "name">> = {},
): Record<string, DxfLayer> {
  return {
    [name]: {
      name,
      visible: true,
      colorIndex: 0,
      color: 0,
      frozen: false,
      ...overrides,
    },
  };
}

// ── rgbNumberToHex ─────────────────────────────────────────────────────

describe("rgbNumberToHex", () => {
  it("converts red (0xFF0000 / 16711680) to '#ff0000'", () => {
    expect(rgbNumberToHex(0xFF0000)).toBe("#ff0000");
  });

  it("converts zero to '#000000'", () => {
    expect(rgbNumberToHex(0)).toBe("#000000");
  });

  it("converts blue (0x0000FF / 255) to '#0000ff'", () => {
    expect(rgbNumberToHex(0x0000FF)).toBe("#0000ff");
  });

  it("masks high bits beyond 24-bit RGB", () => {
    // JavaScript bitwise AND coerces to 32-bit signed int first, then masks to 24 bits.
    // -1 as a 32-bit signed int is 0xFFFFFFFF; masked with 0xFFFFFF gives 0xFFFFFF.
    expect(rgbNumberToHex(-1)).toBe("#ffffff");
    // 0xFF123456: bits 31-24 are 0xFF, masked to lower 24 bits gives 0x123456.
    expect(rgbNumberToHex(0xFF123456)).toBe("#123456");
  });
});

// ── resolveAci7Hex ─────────────────────────────────────────────────────

describe("resolveAci7Hex", () => {
  it("returns black on light theme", () => {
    expect(resolveAci7Hex(false)).toBe("#000000");
  });

  it("returns white on dark theme", () => {
    expect(resolveAci7Hex(true)).toBe("#ffffff");
  });

  it("returns black when darkTheme is undefined", () => {
    expect(resolveAci7Hex(undefined)).toBe("#000000");
  });
});

// ── ACI7_COLOR sentinel ────────────────────────────────────────────────

describe("ACI7_COLOR sentinel", () => {
  it("is a non-empty string that is not a valid hex color", () => {
    expect(ACI7_COLOR).toBeTruthy();
    expect(ACI7_COLOR).not.toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ── isThemeAdaptiveColor ───────────────────────────────────────────────

describe("isThemeAdaptiveColor", () => {
  it("returns true for ACI7_COLOR sentinel", () => {
    expect(isThemeAdaptiveColor(ACI7_COLOR)).toBe(true);
  });

  it("returns true for ACI 250 sentinel", () => {
    const entity = makeEntity({ colorIndex: 250 });
    const color = resolveEntityColor(entity, {});
    expect(isThemeAdaptiveColor(color)).toBe(true);
  });

  it("returns false for regular hex color", () => {
    expect(isThemeAdaptiveColor("#ff0000")).toBe(false);
  });
});

// ── resolveThemeColor ─────────────────────────────────────────────────

describe("resolveThemeColor", () => {
  it("resolves ACI7 to black on light, white on dark", () => {
    expect(resolveThemeColor(ACI7_COLOR, false)).toBe("#000000");
    expect(resolveThemeColor(ACI7_COLOR, true)).toBe("#ffffff");
  });

  it("resolves ACI 250 to dark gray on light, light gray on dark", () => {
    const sentinel = "\0ACI250";
    expect(resolveThemeColor(sentinel, false)).toBe("#333333");
    expect(resolveThemeColor(sentinel, true)).toBe("#cccccc");
  });

  it("resolves ACI 251 to inverted gray in dark mode", () => {
    const sentinel = "\0ACI251";
    const light = resolveThemeColor(sentinel, false);
    const dark = resolveThemeColor(sentinel, true);
    expect(light).not.toBe(dark);
    // Dark mode should be lighter than light mode
    expect(parseInt(dark.slice(1, 3), 16)).toBeGreaterThan(parseInt(light.slice(1, 3), 16));
  });
});

// ── aciToColor ────────────────────────────────────────────────────────

describe("aciToColor", () => {
  it("returns ACI7_COLOR sentinel for index 7 (white-on-light / black-on-dark)", () => {
    expect(aciToColor(7)).toBe(ACI7_COLOR);
  });

  it("returns ACI7_COLOR sentinel for index 255", () => {
    expect(aciToColor(255)).toBe(ACI7_COLOR);
  });

  it("returns dark-gray sentinel for index 250", () => {
    const color = aciToColor(250);
    expect(isThemeAdaptiveColor(color)).toBe(true);
    expect(color).toBe("\0ACI250");
  });

  it("returns dark-gray sentinel for index 251", () => {
    const color = aciToColor(251);
    expect(isThemeAdaptiveColor(color)).toBe(true);
    expect(color).toBe("\0ACI251");
  });

  it("returns concrete hex for chromatic ACI indices", () => {
    // ACI 1 is red — should be a literal hex, not a sentinel
    const color = aciToColor(1);
    expect(isThemeAdaptiveColor(color)).toBe(false);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// ── resolveEntityColor — ACI 250-252 sentinels ────────────────────────

describe("resolveEntityColor — dark gray sentinels", () => {
  it("returns sentinel for ACI 250", () => {
    const color = resolveEntityColor(makeEntity({ colorIndex: 250 }), {});
    expect(isThemeAdaptiveColor(color)).toBe(true);
    expect(color).not.toBe(ACI7_COLOR);
  });

  it("returns sentinel for ACI 251", () => {
    const color = resolveEntityColor(makeEntity({ colorIndex: 251 }), {});
    expect(isThemeAdaptiveColor(color)).toBe(true);
  });

  it("returns regular hex for ACI 252 (not adaptive)", () => {
    const color = resolveEntityColor(makeEntity({ colorIndex: 252 }), {});
    expect(isThemeAdaptiveColor(color)).toBe(false);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("trueColor overrides ACI 250 sentinel", () => {
    const entity = makeEntity({ colorIndex: 250, color: 0xFF0000 });
    const color = resolveEntityColor(entity, {});
    expect(color).toBe("#ff0000");
  });

  it("returns sentinel for ByLayer with layer colorIndex 250", () => {
    const layers = { "L1": { colorIndex: 250, color: 0x333333 } as unknown as DxfLayer };
    const entity = makeEntity({ layer: "L1" });
    const color = resolveEntityColor(entity, layers);
    expect(isThemeAdaptiveColor(color)).toBe(true);
  });
});

// ── resolveEntityColor ─────────────────────────────────────────────────

describe("resolveEntityColor", () => {
  // -- ByBlock (colorIndex === 0) --

  it("returns blockColor when colorIndex is 0 (ByBlock) and blockColor is provided", () => {
    const entity = makeEntity({ colorIndex: 0 });
    const result = resolveEntityColor(entity, {}, "#abcdef");
    expect(result).toBe("#abcdef");
  });

  it("returns ACI7_COLOR when colorIndex is 0 (ByBlock) and no blockColor", () => {
    const entity = makeEntity({ colorIndex: 0 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  // -- ACI color (1-255) --

  it("returns ACI red for colorIndex=1 without trueColor", () => {
    const entity = makeEntity({ colorIndex: 1 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe("#ff0000");
  });

  it("returns ACI blue for colorIndex=5 without trueColor", () => {
    const entity = makeEntity({ colorIndex: 5 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe("#0000ff");
  });

  it("returns trueColor when both colorIndex and trueColor (code 420) are set", () => {
    const entity = makeEntity({ colorIndex: 1, color: 0x00FF00 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe("#00ff00");
  });

  it("returns ACI7_COLOR for colorIndex=7 (theme-dependent sentinel)", () => {
    const entity = makeEntity({ colorIndex: 7 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  it("returns ACI7_COLOR for colorIndex=255 (same rule as ACI 7)", () => {
    const entity = makeEntity({ colorIndex: 255 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  // -- ByLayer (colorIndex=256, undefined, or out of range) --

  it("resolves color from layer when colorIndex=256 (ByLayer) and layer has color", () => {
    const layers = makeLayer("Walls", { colorIndex: 1, color: 0xFF0000 });
    const entity = makeEntity({ colorIndex: 256, layer: "Walls" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe("#ff0000");
  });

  it("returns ACI7_COLOR when ByLayer and layer colorIndex is 7", () => {
    const layers = makeLayer("Default", { colorIndex: 7, color: 0xFFFFFF });
    const entity = makeEntity({ colorIndex: 256, layer: "Default" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe(ACI7_COLOR);
  });

  it("resolves ACI color from layer when colorIndex is undefined and layer has colorIndex", () => {
    // layer.color is 0, so the fallback path using layer.colorIndex is used
    const layers = makeLayer("Red", { colorIndex: 1, color: 0 });
    const entity = makeEntity({ layer: "Red" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe("#ff0000");
  });

  it("returns ACI7_COLOR when no colorIndex and no matching layer", () => {
    const entity = makeEntity({ layer: "NonExistent" });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  it("returns ACI7_COLOR when entity has no colorIndex and no layer", () => {
    const entity = makeEntity({});
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  // -- ACI7_COLOR sentinel for ByLayer --

  it("returns ACI7_COLOR for ByLayer with layer colorIndex=7", () => {
    const layers = makeLayer("Default", { colorIndex: 7, color: 0xFFFFFF });
    const entity = makeEntity({ colorIndex: 256, layer: "Default" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe(ACI7_COLOR);
  });

  it("returns ACI7_COLOR for ByLayer with ACI-only layer colorIndex=7", () => {
    const layers = makeLayer("Default", { colorIndex: 7, color: 0 });
    const entity = makeEntity({ layer: "Default" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe(ACI7_COLOR);
  });

  it("returns ACI7_COLOR for ByBlock without blockColor", () => {
    const entity = makeEntity({ colorIndex: 0 });
    const result = resolveEntityColor(entity, {});
    expect(result).toBe(ACI7_COLOR);
  });

  // -- Layer "0" inside a block inherits from INSERT (AutoCAD convention) --

  it("layer \"0\" with ByLayer inherits blockColor when set", () => {
    // Regression: AEC Gridline Bubble — ATTRIBs/ARC on layer "0" inside an
    // INSERT on a green-coded layer must render green, not white.
    const layers = makeLayer("0", { colorIndex: 7, color: 0 });
    const entity = makeEntity({ layer: "0" }); // no explicit color → ByLayer
    const result = resolveEntityColor(entity, layers, "#00ff00");
    expect(result).toBe("#00ff00");
  });

  it("empty layer name with ByLayer inherits blockColor when set", () => {
    const entity = makeEntity({ layer: "" });
    const result = resolveEntityColor(entity, {}, "#123456");
    expect(result).toBe("#123456");
  });

  it("layer \"0\" with ByLayer falls back to ACI 7 when no blockColor", () => {
    // Top-level entity on layer "0" — backward-compatible: white/black.
    const layers = makeLayer("0", { colorIndex: 7, color: 0 });
    const entity = makeEntity({ layer: "0" });
    const result = resolveEntityColor(entity, layers);
    expect(result).toBe(ACI7_COLOR);
  });

  it("layer \"0\" with explicit colorIndex=5 uses entity color, not blockColor", () => {
    // Explicit color always wins, even on layer "0".
    const layers = makeLayer("0", { colorIndex: 7, color: 0 });
    const entity = makeEntity({ layer: "0", colorIndex: 5 });
    const result = resolveEntityColor(entity, layers, "#00ff00");
    // ACI 5 = blue (0x0000FF)
    expect(result).toBe("#0000ff");
  });

  it("layer \"0\" with ByBlock uses blockColor (regression-protect existing path)", () => {
    // colorIndex=0 (ByBlock) → blockColor branch fires first, layer-0 branch never reached.
    const entity = makeEntity({ layer: "0", colorIndex: 0 });
    const result = resolveEntityColor(entity, {}, "#abcdef");
    expect(result).toBe("#abcdef");
  });

  it("non-zero layer with ByLayer ignores blockColor, uses layer color", () => {
    // Layer "WALL" entity inside a block keeps the WALL layer color, not INSERT's.
    const layers = makeLayer("WALL", { colorIndex: 3, color: 0x00FF00 });
    const entity = makeEntity({ layer: "WALL" });
    const result = resolveEntityColor(entity, layers, "#ff0000");
    expect(result).toBe("#00ff00");
  });
});

// ── decodeCmEntityColor ───────────────────────────────────────────────

describe("decodeCmEntityColor", () => {
  it("decodes 0xC0000000 as byLayer", () => {
    // -1073741824 in two's complement === 0xC0000000
    expect(decodeCmEntityColor(-1073741824)).toEqual({ method: "byLayer" });
  });

  it("decodes 0xC1000000 as byBlock", () => {
    // -1056964608 === 0xC1000000
    expect(decodeCmEntityColor(-1056964608)).toEqual({ method: "byBlock" });
  });

  it("decodes 0xC2RRGGBB as byColor with RGB in low 24 bits", () => {
    // 0xC2FF00FF — magenta as truecolor.
    // 0xC2000000 = -1040187392; + 0xFF00FF (16711935) = -1023475457
    const dec = decodeCmEntityColor(-1023475457);
    expect(dec).toEqual({ method: "byColor", rgb: 0xFF00FF });
  });

  it("decodes 0xC3000006 as byACI with index 6 (magenta)", () => {
    // -1023410170 === 0xC3000006 — the value seen in 2018.dxf for MLEADER LeaderLineColor
    expect(decodeCmEntityColor(-1023410170)).toEqual({ method: "byACI", aci: 6 });
  });

  it("decodes 0xC3000001 as byACI with index 1 (red)", () => {
    // 0xC3 << 24 | 1 = -1023410175
    expect(decodeCmEntityColor(-1023410175)).toEqual({ method: "byACI", aci: 1 });
  });

  it("decodes 0xC4000000 as byPen", () => {
    // -1006632960 === 0xC4000000
    expect(decodeCmEntityColor(-1006632960)).toEqual({ method: "byPen" });
  });

  it("decodes 0xC5000000 as foreground", () => {
    // -989855744 === 0xC5000000
    expect(decodeCmEntityColor(-989855744)).toEqual({ method: "foreground" });
  });

  it("decodes 0xC8000000 as none", () => {
    // -939524096 === 0xC8000000
    expect(decodeCmEntityColor(-939524096)).toEqual({ method: "none" });
  });

  it("returns unknown for high bytes outside 0xC0..0xC8", () => {
    // 0x00000006 — no color-method byte
    expect(decodeCmEntityColor(6)).toEqual({ method: "unknown" });
  });

  it("returns null for undefined input", () => {
    expect(decodeCmEntityColor(undefined)).toBeNull();
  });

  it("returns null for NaN input", () => {
    expect(decodeCmEntityColor(Number.NaN)).toBeNull();
  });
});

// ── resolveMLeaderColor ──────────────────────────────────────────────

describe("resolveMLeaderColor", () => {
  // Reference values from 2018.dxf MULTILEADER handle 47020.
  const MAGENTA_RAW = -1023410170; // 0xC3000006 — byACI(6)
  const BY_LAYER_RAW = -1073741824; // 0xC0000000

  const greenLayer = makeLayer("0-13", { colorIndex: 3, color: 0x00FF00 });

  it("uses entity color when override bit is set (matches 2018.dxf scenario inverted)", () => {
    const entity = makeEntity({ layer: "0-13" });
    const result = resolveMLeaderColor(
      MAGENTA_RAW, true, undefined,
      entity, greenLayer,
    );
    // ACI 6 = magenta (0xFF00FF) — concrete hex (ACI 6 is chromatic, not theme-adaptive)
    expect(result).toBe("#ff00ff");
  });

  it("falls back to style color when override bit is clear", () => {
    // This is the 2018.dxf case: entity carries byACI(6) but override bit is OFF,
    // so AutoCAD reads from the style. Both entity-level and style happen to be
    // byACI(6) → magenta either way, but the logic must pick the style.
    const entity = makeEntity({ layer: "0-13", colorIndex: 0xFF00 });
    const result = resolveMLeaderColor(
      MAGENTA_RAW, false, MAGENTA_RAW,
      entity, greenLayer,
    );
    expect(result).toBe("#ff00ff");
  });

  it("entity color is ignored when override bit is clear and style raw differs", () => {
    // Verifies the entity → style precedence: override OFF means entity color
    // doesn't apply. Style says byACI(1) = red — that wins.
    const entity = makeEntity({ layer: "0-13" });
    const result = resolveMLeaderColor(
      MAGENTA_RAW, false, -1023410175, // style raw = 0xC3000001 = byACI(1) = red
      entity, greenLayer,
    );
    expect(result).toBe("#ff0000");
  });

  it("byLayer entity color falls through to resolveEntityColor (layer color wins)", () => {
    // entity-override active but method is byLayer → no direct color produced,
    // style absent → resolveEntityColor returns layer color (ACI 3 = green).
    const entity = makeEntity({ layer: "0-13" });
    const result = resolveMLeaderColor(
      BY_LAYER_RAW, true, undefined,
      entity, greenLayer,
    );
    expect(result).toBe("#00ff00");
  });

  it("byColor entity color produces concrete RGB hex", () => {
    const entity = makeEntity({ layer: "0-13" });
    const raw = -1023475457; // 0xC2FF00FF — byColor RGB(255,0,255)
    const result = resolveMLeaderColor(
      raw, true, undefined,
      entity, greenLayer,
    );
    expect(result).toBe("#ff00ff");
  });

  it("no entity raw and no style: fully falls back to layer color", () => {
    const entity = makeEntity({ layer: "0-13" });
    const result = resolveMLeaderColor(
      undefined, false, undefined,
      entity, greenLayer,
    );
    expect(result).toBe("#00ff00");
  });

  it("byACI 7 returns ACI7 sentinel (theme-adaptive)", () => {
    const entity = makeEntity({ layer: "0-13" });
    // 0xC3000007 — byACI(7)
    const raw = -1023410169;
    const result = resolveMLeaderColor(
      raw, true, undefined,
      entity, greenLayer,
    );
    expect(result).toBe(ACI7_COLOR);
  });
});
