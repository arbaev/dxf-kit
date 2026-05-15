import type DxfScanner from "../scanner";
import type { DxfMLeaderStyle, DxfObjects } from "@/types/dxf";

/**
 * Parse the OBJECTS section. Currently extracts only MLEADERSTYLE records;
 * every other object type is skipped (fast-forward to the next code-0 group).
 *
 * MLEADERSTYLE carries color defaults that MULTILEADER entities inherit when
 * their PropertyOverrideFlag (code 90) bits for color are not set.
 */
export function parseObjects(scanner: DxfScanner): DxfObjects {
  const mLeaderStyles: Record<string, DxfMLeaderStyle> = {};

  let curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) {
      if (curr.value === "ENDSEC") break;
      if (curr.value === "MLEADERSTYLE") {
        const style = parseMLeaderStyle(scanner);
        if (style.handle) mLeaderStyles[style.handle.toUpperCase()] = style;
        curr = scanner.lastReadGroup;
        continue;
      }
    }
    curr = scanner.next();
  }

  return { mLeaderStyles };
}

function parseMLeaderStyle(scanner: DxfScanner): DxfMLeaderStyle {
  const style: DxfMLeaderStyle = { handle: "" };

  let curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 5:
        style.handle = String(curr.value).toUpperCase();
        break;
      case 3:
        // MLeaderStyleDescription (often "Standard"). Useful for debugging.
        style.name = String(curr.value);
        break;
      case 91:
        style.leaderLineColorRaw = curr.value as number;
        break;
      case 93:
        style.textColorRaw = curr.value as number;
        break;
      case 94:
        style.blockColorRaw = curr.value as number;
        break;
      default:
        break;
    }
    curr = scanner.next();
  }

  return style;
}
