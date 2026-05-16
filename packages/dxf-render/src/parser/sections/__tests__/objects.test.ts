import { describe, it, expect } from "vitest";
import { createScanner } from "../../__tests__/test-helpers";
import { parseObjects } from "../objects";

describe("parseObjects", () => {
  it("parses a single MLEADERSTYLE record and keys it by uppercase handle", () => {
    // Scanner starts inside the OBJECTS section, right after the section
    // header — parseObjects() calls scanner.next() to read the first group.
    const scanner = createScanner(
      "0", "MLEADERSTYLE",
      "5", "3c063",                // handle (lowercase — should be uppercased)
      "100", "AcDbMLeaderStyle",
      "3", "Standard",
      "91", "-1023410170",         // LeaderLineColor — byACI(6) magenta
      "93", "-1023410170",         // TextColor — byACI(6) magenta
      "94", "-1056964608",         // BlockColor — byBlock
      "0", "ENDSEC",
      "0", "EOF",
    );

    const objects = parseObjects(scanner);

    expect(objects.mLeaderStyles).toBeDefined();
    const styles = objects.mLeaderStyles!;
    expect(Object.keys(styles)).toEqual(["3C063"]);

    const style = styles["3C063"];
    expect(style.handle).toBe("3C063");
    expect(style.name).toBe("Standard");
    expect(style.leaderLineColorRaw).toBe(-1023410170);
    expect(style.textColorRaw).toBe(-1023410170);
    expect(style.blockColorRaw).toBe(-1056964608);
  });

  it("parses multiple MLEADERSTYLE records", () => {
    const scanner = createScanner(
      "0", "MLEADERSTYLE",
      "5", "5C",
      "91", "-1056964608",
      "0", "MLEADERSTYLE",
      "5", "3C063",
      "91", "-1023410170",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const objects = parseObjects(scanner);
    const styles = objects.mLeaderStyles!;
    expect(Object.keys(styles).sort()).toEqual(["3C063", "5C"]);
    expect(styles["5C"].leaderLineColorRaw).toBe(-1056964608);
    expect(styles["3C063"].leaderLineColorRaw).toBe(-1023410170);
  });

  it("skips non-MLEADERSTYLE objects without consuming MLEADERSTYLE that follows", () => {
    // OBJECTS section in real files holds many object types (DICTIONARY,
    // SCALE, ACDBPLACEHOLDER, MLINESTYLE, …). The parser must skip them
    // without disturbing MLEADERSTYLE records that follow.
    const scanner = createScanner(
      "0", "DICTIONARY",
      "5", "C",
      "100", "AcDbDictionary",
      "3", "ACAD_GROUP",
      "350", "D",
      "0", "MLINESTYLE",
      "5", "18",
      "2", "STANDARD",
      "70", "0",
      "0", "MLEADERSTYLE",
      "5", "AAAA",
      "91", "-1023410170",
      "0", "SCALE",
      "5", "BBBB",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const objects = parseObjects(scanner);
    const styles = objects.mLeaderStyles!;
    expect(Object.keys(styles)).toEqual(["AAAA"]);
    expect(styles["AAAA"].leaderLineColorRaw).toBe(-1023410170);
  });

  it("returns an empty map when no MLEADERSTYLE objects are present", () => {
    const scanner = createScanner(
      "0", "DICTIONARY",
      "5", "C",
      "0", "MLINESTYLE",
      "5", "18",
      "0", "ENDSEC",
      "0", "EOF",
    );

    const objects = parseObjects(scanner);
    expect(objects.mLeaderStyles).toEqual({});
  });
});
