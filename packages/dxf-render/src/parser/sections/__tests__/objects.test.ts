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

  describe("ACAD_GROUP parsing", () => {
    it("parses a single GROUP record with member handles", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "5", "8dd4",                  // handle (lowercase — should be uppercased)
        "100", "AcDbGroup",
        "300", "MyGroup",
        "70", "0",                    // not anonymous
        "71", "1",                    // selectable
        "340", "8dcd",
        "340", "8dce",
        "340", "8dcf",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);

      expect(objects.groups).toBeDefined();
      expect(Object.keys(objects.groups!)).toEqual(["8DD4"]);

      const group = objects.groups!["8DD4"];
      expect(group.handle).toBe("8DD4");
      expect(group.description).toBe("MyGroup");
      expect(group.isUnnamed).toBe(false);
      expect(group.isSelectable).toBe(true);
      expect(group.entityHandles).toEqual(["8DCD", "8DCE", "8DCF"]);
    });

    it("flags anonymous groups via DXF code 70", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "5", "AAAA",
        "300", "",
        "70", "1",                    // anonymous
        "71", "1",
        "340", "BBBB",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      const group = objects.groups!["AAAA"];
      expect(group.isUnnamed).toBe(true);
      expect(group.entityHandles).toEqual(["BBBB"]);
    });

    it("parses GROUP with no member handles", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "5", "CCCC",
        "70", "0",
        "71", "1",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      const group = objects.groups!["CCCC"];
      expect(group.entityHandles).toEqual([]);
      expect(group.isUnnamed).toBe(false);
    });

    it("parses multiple GROUP records in one section", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "5", "111",
        "70", "0",
        "340", "AAA",
        "0", "GROUP",
        "5", "222",
        "70", "1",
        "340", "BBB",
        "340", "CCC",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(Object.keys(objects.groups!).sort()).toEqual(["111", "222"]);
      expect(objects.groups!["111"].entityHandles).toEqual(["AAA"]);
      expect(objects.groups!["222"].entityHandles).toEqual(["BBB", "CCC"]);
      expect(objects.groups!["222"].isUnnamed).toBe(true);
    });

    it("resolves group names via the ACAD_GROUP dictionary", () => {
      // Named Object Dictionary (handle C) maps "ACAD_GROUP" → handle D
      // Groups dictionary (handle D) maps "*A1" → 8DD4, "*A11" → 34A29
      const scanner = createScanner(
        "0", "DICTIONARY",
        "5", "C",
        "100", "AcDbDictionary",
        "3", "ACAD_GROUP",
        "350", "D",
        "3", "ACAD_LAYOUT",
        "350", "1A",
        "0", "DICTIONARY",
        "5", "D",
        "100", "AcDbDictionary",
        "3", "*A1",
        "350", "8DD4",
        "3", "*A11",
        "350", "34A29",
        "0", "GROUP",
        "5", "8DD4",
        "70", "1",
        "71", "1",
        "340", "8DCD",
        "0", "GROUP",
        "5", "34A29",
        "70", "1",
        "71", "1",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups!["8DD4"].name).toBe("*A1");
      expect(objects.groups!["34A29"].name).toBe("*A11");
    });

    it("resolves names even when the groups dictionary appears before the NOD", () => {
      // Groups dictionary (handle D) first, then NOD (handle C). The parser
      // collects all DICTIONARY records before resolving names.
      const scanner = createScanner(
        "0", "DICTIONARY",
        "5", "D",
        "3", "FirstGroup",
        "350", "111",
        "0", "DICTIONARY",
        "5", "C",
        "3", "ACAD_GROUP",
        "350", "D",
        "0", "GROUP",
        "5", "111",
        "70", "0",
        "71", "1",
        "340", "AAA",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups!["111"].name).toBe("FirstGroup");
    });

    it("leaves group.name undefined when no ACAD_GROUP dictionary is present", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "5", "999",
        "70", "1",
        "71", "1",
        "340", "AAA",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups!["999"].name).toBeUndefined();
    });

    it("ignores unrelated dictionaries (no ACAD_GROUP key)", () => {
      const scanner = createScanner(
        "0", "DICTIONARY",
        "5", "C",
        "3", "ACAD_LAYOUT",
        "350", "1A",
        "3", "ACAD_MLINESTYLE",
        "350", "36",
        "0", "GROUP",
        "5", "999",
        "70", "1",
        "71", "1",
        "340", "AAA",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups!["999"].name).toBeUndefined();
    });

    it("skips GROUP records without a handle", () => {
      const scanner = createScanner(
        "0", "GROUP",
        "70", "0",
        "71", "1",
        "340", "AAA",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups).toBeUndefined();
    });

    it("does not surface a groups key when no GROUP records are present", () => {
      const scanner = createScanner(
        "0", "MLEADERSTYLE",
        "5", "1",
        "0", "ENDSEC",
        "0", "EOF",
      );

      const objects = parseObjects(scanner);
      expect(objects.groups).toBeUndefined();
    });
  });
});
