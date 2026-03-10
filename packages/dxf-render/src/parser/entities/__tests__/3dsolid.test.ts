import { describe, it, expect } from "vitest";
import { parse3DSolid, type I3DSolidEntity } from "../3dsolid";
import { createScannerAt } from "../../__tests__/test-helpers";

describe("parse3DSolid", () => {
  it("parses 3DSOLID with layer", () => {
    const { scanner, group } = createScannerAt(
      "0", "3DSOLID",
      "8", "Solids",
      "100", "AcDbModelerGeometry",
      "290", "1",
      "100", "AcDb3dSolid",
      "0", "EOF",
    );
    const entity = parse3DSolid(scanner, group) as I3DSolidEntity;
    expect(entity.type).toBe("3DSOLID");
    expect(entity.layer).toBe("Solids");
  });
});
