import type { DxfEntity, DxfLayer } from "@/types/dxf";
import ACI_PALETTE from "@/parser/acadColorIndex";

/** Sentinel value for ACI 7/255 colors — theme-dependent (black on light, white on dark) */
export const ACI7_COLOR = "\0ACI7";

/** Resolve ACI 7 sentinel to actual hex color based on theme */
export const resolveAci7Hex = (darkTheme?: boolean): string =>
  darkTheme ? "#ffffff" : "#000000";

/** Check if a color key is a theme-adaptive sentinel (starts with \0) */
export const isThemeAdaptiveColor = (color: string): boolean =>
  color.charCodeAt(0) === 0;

/**
 * Resolve any theme-adaptive sentinel to a concrete hex color.
 * ACI 7/255: black on light, white on dark.
 * ACI 250-251: dark grays that invert to light grays in dark mode
 * so they remain visible against a dark background.
 */
export function resolveThemeColor(sentinel: string, darkTheme?: boolean): string {
  if (sentinel === ACI7_COLOR) return darkTheme ? "#ffffff" : "#000000";
  // Sentinel format: "\0ACI<index>"
  const idx = parseInt(sentinel.slice(4));
  const rgb = ACI_PALETTE[idx];
  if (!darkTheme || rgb === undefined) {
    return rgb !== undefined ? rgbNumberToHex(rgb) : "#000000";
  }
  // Invert grayscale: R=G=B, so just invert the red channel
  const r = (rgb >> 16) & 0xFF;
  const inv = 255 - r;
  return "#" + ((inv << 16) | (inv << 8) | inv).toString(16).padStart(6, "0");
}

export function rgbNumberToHex(rgbNumber: number): string {
  return "#" + (rgbNumber & 0xFFFFFF).toString(16).padStart(6, "0");
}

/**
 * Return a theme-adaptive sentinel for ACI grayscale colors
 * that would be invisible on a dark background (ACI 250-252).
 */
const aciGraySentinel = (colorIndex: number): string | null => {
  if (colorIndex >= 250 && colorIndex <= 251) return "\0ACI" + colorIndex;
  return null;
};

/**
 * Map an ACI (AutoCAD Color Index, 1-255) to a color string.
 * Indices 7/255 and 250/251 return theme-adaptive sentinels — the rest
 * are converted directly to hex from the ACI palette. Use this anywhere
 * an ACI index is the source of a color so the theme switch keeps working.
 */
export function aciToColor(colorIndex: number): string {
  if (colorIndex === 7 || colorIndex === 255) return ACI7_COLOR;
  const gray = aciGraySentinel(colorIndex);
  if (gray) return gray;
  return rgbNumberToHex(ACI_PALETTE[colorIndex]);
}

/**
 * Resolve entity color following AutoCAD priority rules:
 * trueColor (code 420) > colorIndex (code 62) > layerColor
 *
 * Returns sentinel strings for theme-dependent colors (ACI 7/255 and
 * dark grays 250-251) instead of concrete hex values. This allows
 * materials to be updated at runtime without full re-render.
 */
export function resolveEntityColor(
  entity: DxfEntity,
  layers: Record<string, DxfLayer>,
  blockColor?: string,
): string {
  const colorIndex = entity.colorIndex;
  const trueColor = entity.color;

  // ByBlock (colorIndex === 0): inherit color from parent INSERT entity
  if (colorIndex === 0) {
    return blockColor ?? ACI7_COLOR;
  }

  if (colorIndex !== undefined && colorIndex >= 1 && colorIndex <= 255) {
    // trueColor (code 420) takes priority over ACI
    if (trueColor !== undefined) {
      return rgbNumberToHex(trueColor);
    }
    return aciToColor(colorIndex);
  }

  // ByLayer (colorIndex === 256, unset, or other)
  const layerName = entity.layer;

  // Special case: an entity on layer "0" inside a BLOCK (or an ATTRIB attached
  // to an INSERT) inherits its parent INSERT's effective color. AutoCAD treats
  // layer "0" inside blocks as a sentinel for "use the inserter's color".
  if ((!layerName || layerName === "0") && blockColor !== undefined) {
    return blockColor;
  }

  if (layerName && layers[layerName]) {
    const layer = layers[layerName];
    // layer.color is an ACI palette RGB value (from getAcadColor), not trueColor
    if (layer.color !== undefined && layer.color !== 0) {
      return aciToColor(layer.colorIndex);
    }
    if (layer.colorIndex >= 1 && layer.colorIndex <= 255) {
      return aciToColor(layer.colorIndex);
    }
  }

  return ACI7_COLOR;
}
