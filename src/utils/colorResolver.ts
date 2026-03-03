import type { DxfEntity, DxfLayer } from "@/types/dxf";
import { DEFAULT_ENTITY_COLOR, DEFAULT_ENTITY_COLOR_DARK } from "@/constants";
import ACI_PALETTE from "@/parser/acadColorIndex";

export function rgbNumberToHex(rgbNumber: number): string {
  return "#" + (rgbNumber & 0xFFFFFF).toString(16).padStart(6, "0");
}

/**
 * Resolve entity color following AutoCAD priority rules:
 * trueColor (code 420) > colorIndex (code 62) > layerColor
 */
export function resolveEntityColor(
  entity: DxfEntity,
  layers: Record<string, DxfLayer>,
  blockColor?: string,
  darkTheme?: boolean,
): string {
  const colorIndex = entity.colorIndex;
  const trueColor = entity.color;
  const aci7Color = darkTheme ? "#ffffff" : "#000000";
  const defaultColor = darkTheme ? DEFAULT_ENTITY_COLOR_DARK : DEFAULT_ENTITY_COLOR;

  // ByBlock (colorIndex === 0): inherit color from parent INSERT entity
  if (colorIndex === 0) {
    return blockColor ?? defaultColor;
  }

  if (colorIndex !== undefined && colorIndex >= 1 && colorIndex <= 255) {
    // trueColor (code 420) takes priority over ACI
    if (trueColor !== undefined) {
      return rgbNumberToHex(trueColor);
    }
    // ACI 7 and 255 are white in palette, rendered as black on light / white on dark
    if (colorIndex === 7 || colorIndex === 255) {
      return aci7Color;
    }
    return rgbNumberToHex(ACI_PALETTE[colorIndex]);
  }

  // ByLayer (colorIndex === 256, unset, or other)
  const layerName = entity.layer;
  if (layerName && layers[layerName]) {
    const layer = layers[layerName];
    // layer.color is an ACI palette RGB value (from getAcadColor), not trueColor
    if (layer.color !== undefined && layer.color !== 0) {
      const layerColorIndex = layer.colorIndex;
      if (layerColorIndex === 7 || layerColorIndex === 255) {
        return aci7Color;
      }
      return rgbNumberToHex(layer.color);
    }
    if (layer.colorIndex >= 1 && layer.colorIndex <= 255) {
      if (layer.colorIndex === 7 || layer.colorIndex === 255) {
        return aci7Color;
      }
      return rgbNumberToHex(ACI_PALETTE[layer.colorIndex]);
    }
  }

  return defaultColor;
}
