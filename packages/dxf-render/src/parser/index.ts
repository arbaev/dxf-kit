import DxfScanner from "./scanner";
import type { DxfData } from "@/types/dxf";
import { parseHeader } from "./sections/header";
import { parseTables } from "./sections/tables";
import { parseBlocks } from "./sections/blocks";
import { parseEntities } from "./sections/entities";
import { parseObjects } from "./sections/objects";
import { linkRegionsToHatchBoundaries } from "./linkRegions";

/**
 * Sentinel at the start of every Binary DXF file (followed by \r\n\x1A\0).
 * Pure ASCII, so it survives intact through both UTF-8 and UTF-16 decoders —
 * detecting it on the decoded string catches all entry paths.
 */
const BINARY_DXF_SENTINEL = "AutoCAD Binary DXF";

export function parseDxf(dxfText: string): DxfData {
  // Reject Binary DXF early: the line-based scanner reads garbled token codes
  // from the binary stream and eventually throws a cryptic "Unexpected end of
  // input … code <mojibake>". Better to fail fast with a clear message.
  if (dxfText.startsWith(BINARY_DXF_SENTINEL)) {
    throw new Error("Binary DXF format is not supported. Save the file as ASCII (text) DXF and try again.");
  }

  const dxf = {} as DxfData;
  const dxfLinesArray = dxfText.split(/\r\n|\r|\n/g);
  const scanner = new DxfScanner(dxfLinesArray);

  if (!scanner.hasNext()) throw new Error("Empty file");

  let curr = scanner.next();

  while (!scanner.isEOF()) {
    if (curr.code === 0 && curr.value === "SECTION") {
      curr = scanner.next();

      if (curr.code !== 2) {
        curr = scanner.next();
        continue;
      }

      if (curr.value === "HEADER") {
        dxf.header = parseHeader(scanner);
        curr = scanner.lastReadGroup;
      } else if (curr.value === "BLOCKS") {
        dxf.blocks = parseBlocks(scanner) as DxfData["blocks"];
        curr = scanner.lastReadGroup;
      } else if (curr.value === "ENTITIES") {
        dxf.entities = parseEntities(scanner, false) as DxfData["entities"];
        curr = scanner.lastReadGroup;
      } else if (curr.value === "TABLES") {
        dxf.tables = parseTables(scanner) as DxfData["tables"];
        curr = scanner.lastReadGroup;
      } else if (curr.value === "OBJECTS") {
        dxf.objects = parseObjects(scanner);
        curr = scanner.lastReadGroup;
      }
    } else {
      curr = scanner.next();
    }
  }

  if (!dxf.entities) dxf.entities = [];

  linkRegionsToHatchBoundaries(dxf.entities);
  if (dxf.blocks) {
    for (const blockName in dxf.blocks) {
      linkRegionsToHatchBoundaries(dxf.blocks[blockName].entities);
    }
  }

  return dxf;
}
