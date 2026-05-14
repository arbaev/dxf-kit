import { describe, it, expect } from "vitest";
import { parseRegion, type IRegionEntity } from "../region";
import { createScannerAt } from "../../__tests__/test-helpers";

describe("parseRegion", () => {
  it("parses REGION with layer and handle", () => {
    const { scanner, group } = createScannerAt(
      "0", "REGION",
      "5", "151",
      "8", "Profil kontura",
      "100", "AcDbEntity",
      "100", "AcDbModelerGeometry",
      "290", "1",
      "0", "EOF",
    );
    const entity = parseRegion(scanner, group) as IRegionEntity;
    expect(entity.type).toBe("REGION");
    expect(entity.handle).toBe("151");
    expect(entity.layer).toBe("Profil kontura");
  });

  it("parses REGION with color index", () => {
    const { scanner, group } = createScannerAt(
      "0", "REGION",
      "8", "Layer1",
      "62", "5",
      "0", "EOF",
    );
    const entity = parseRegion(scanner, group);
    expect(entity.type).toBe("REGION");
    expect(entity.colorIndex).toBe(5);
  });
});
