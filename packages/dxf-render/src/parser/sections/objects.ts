import type DxfScanner from "../scanner";
import type { DxfGroup, DxfMLeaderStyle, DxfObjects } from "@/types/dxf";

/**
 * Parse the OBJECTS section. Currently extracts:
 *
 * - MLEADERSTYLE records (color defaults inherited by MULTILEADER entities)
 * - ACAD_GROUP records (named entity groupings) — names are resolved via the
 *   `ACAD_GROUP` dictionary in the Named Object Dictionary
 *
 * Every other object type is skipped (fast-forward to the next code-0 group).
 */
export function parseObjects(scanner: DxfScanner): DxfObjects {
  const mLeaderStyles: Record<string, DxfMLeaderStyle> = {};
  const groups: Record<string, DxfGroup> = {};
  // Raw DICTIONARY records keyed by their handle.
  // `entries` map: dictionary key (code 3) → referenced handle (code 350)
  const dictionaries = new Map<string, { entries: Map<string, string> }>();

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
      if (curr.value === "GROUP") {
        const group = parseGroup(scanner);
        if (group.handle) groups[group.handle] = group;
        curr = scanner.lastReadGroup;
        continue;
      }
      if (curr.value === "DICTIONARY") {
        const dict = parseDictionaryRaw(scanner);
        if (dict.handle) dictionaries.set(dict.handle, { entries: dict.entries });
        curr = scanner.lastReadGroup;
        continue;
      }
    }
    curr = scanner.next();
  }

  // Resolve group names via the ACAD_GROUP dictionary.
  // Find the dictionary that contains an `ACAD_GROUP` entry — its value points
  // to the groups dictionary, whose entries map name → group handle.
  let groupsDictHandle: string | undefined;
  for (const { entries } of dictionaries.values()) {
    const ref = entries.get("ACAD_GROUP");
    if (ref) {
      groupsDictHandle = ref.toUpperCase();
      break;
    }
  }
  if (groupsDictHandle) {
    const groupsDict = dictionaries.get(groupsDictHandle);
    if (groupsDict) {
      for (const [name, groupHandle] of groupsDict.entries) {
        const g = groups[groupHandle.toUpperCase()];
        if (g) g.name = name;
      }
    }
  }

  const result: DxfObjects = { mLeaderStyles };
  if (Object.keys(groups).length > 0) result.groups = groups;
  return result;
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

function parseGroup(scanner: DxfScanner): DxfGroup {
  const group: DxfGroup = {
    handle: "",
    isUnnamed: false,
    isSelectable: false,
    entityHandles: [],
  };

  let curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 5:
        group.handle = String(curr.value).toUpperCase();
        break;
      case 300:
        group.description = String(curr.value);
        break;
      case 70:
        group.isUnnamed = curr.value === 1;
        break;
      case 71:
        group.isSelectable = curr.value === 1;
        break;
      case 340:
        group.entityHandles.push(String(curr.value).toUpperCase());
        break;
      default:
        break;
    }
    curr = scanner.next();
  }

  return group;
}

/**
 * Parse a DICTIONARY object, capturing only the bits we need to resolve
 * group names: the dictionary's own handle (code 5) and its name → handle
 * entries (code 3 / 350 pairs).
 */
function parseDictionaryRaw(
  scanner: DxfScanner,
): { handle: string; entries: Map<string, string> } {
  let handle = "";
  const entries = new Map<string, string>();
  let pendingName: string | undefined;

  let curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 5:
        if (!handle) handle = String(curr.value).toUpperCase();
        break;
      case 3:
        pendingName = String(curr.value);
        break;
      case 350:
      case 360:
        if (pendingName !== undefined) {
          entries.set(pendingName, String(curr.value));
          pendingName = undefined;
        }
        break;
      default:
        break;
    }
    curr = scanner.next();
  }

  return { handle, entries };
}
