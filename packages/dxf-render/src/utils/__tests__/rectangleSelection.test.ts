import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { findEntriesInRect, type WorldRect } from "../rectangleSelection";
import type { PickingIndex, PickingEntry } from "@/render/pickingIndex";

function makeEntry(
  id: string,
  handle: string,
  type: string,
  min: [number, number, number],
  max: [number, number, number],
  extra: Partial<PickingEntry> = {},
): PickingEntry {
  return {
    id,
    handle,
    type,
    layer: "0",
    bbox: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)),
    ...extra,
  };
}

function makeIndex(entries: PickingEntry[]): PickingIndex {
  const byHandle = new Map<string, PickingEntry[]>();
  const byId = new Map<string, PickingEntry>();
  for (const e of entries) {
    const list = byHandle.get(e.handle);
    if (list) list.push(e);
    else byHandle.set(e.handle, [e]);
    byId.set(e.id, e);
  }
  return { entries, byHandle, byId };
}

const rect = (minX: number, minY: number, maxX: number, maxY: number): WorldRect => ({
  minX, minY, maxX, maxY,
});

describe("findEntriesInRect", () => {
  describe("crossing mode (default)", () => {
    it("includes entries whose bbox is fully inside the rect", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [2, 2, 0], [8, 8, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("includes entries whose bbox partially overlaps the rect", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [5, 5, 0], [15, 15, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("includes entries whose bbox completely contains the rect", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [-100, -100, 0], [100, 100, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("excludes entries entirely outside the rect", () => {
      const idx = makeIndex([
        makeEntry("A", "A", "LINE", [0, 0, 0], [5, 5, 0]),
        makeEntry("B", "B", "LINE", [20, 20, 0], [25, 25, 0]),
      ]);
      const result = findEntriesInRect(idx, rect(10, 10, 15, 15));
      expect(result).toEqual([]);
    });

    it("treats edge touching as crossing (>=, <=)", () => {
      // bbox: [10, 0]→[20, 10], rect: [0, 0]→[10, 10]. They touch at x=10.
      const idx = makeIndex([makeEntry("A", "A", "LINE", [10, 0, 0], [20, 10, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("returns empty for an empty index", () => {
      const idx = makeIndex([]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result).toEqual([]);
    });

    it("returns empty when rect is far from any entry", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [0, 0, 0], [10, 10, 0])]);
      const result = findEntriesInRect(idx, rect(1000, 1000, 1010, 1010));
      expect(result).toEqual([]);
    });
  });

  describe("window mode", () => {
    it("includes entries whose bbox is fully inside the rect", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [2, 2, 0], [8, 8, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("excludes entries whose bbox only partially overlaps", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [5, 5, 0], [15, 15, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result).toEqual([]);
    });

    it("excludes entries whose bbox contains the rect", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [-100, -100, 0], [100, 100, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result).toEqual([]);
    });

    it("excludes bbox exactly touching the rect edge from outside", () => {
      // bbox [10..20] vs rect [0..10]. min.x=10 == maxX=10 means right edge of rect
      // is at left edge of bbox — fully inside requires bbox.max.x <= maxX,
      // which 20 <= 10 fails. Correctly excluded.
      const idx = makeIndex([makeEntry("A", "A", "LINE", [10, 0, 0], [20, 10, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result).toEqual([]);
    });

    it("includes bbox whose edges coincide exactly with the rect (treats touching as inside)", () => {
      const idx = makeIndex([makeEntry("A", "A", "LINE", [0, 0, 0], [10, 10, 0])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });

    it("mixes hits and misses correctly", () => {
      const idx = makeIndex([
        makeEntry("A", "A", "LINE", [1, 1, 0], [5, 5, 0]),     // inside
        makeEntry("B", "B", "LINE", [5, 5, 0], [15, 15, 0]),   // crossing
        makeEntry("C", "C", "LINE", [20, 20, 0], [30, 30, 0]), // outside
      ]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });
  });

  describe("INSERT granularity", () => {
    // Simulate a single INSERT instance with two children + the aggregate.
    // Top-level entry: id === handle (no `@`)
    // INSERT children: id has `@instance` suffix, no `childIds`
    // INSERT aggregate: id has `@instance` suffix, `childIds` populated
    const buildInsertIndex = () =>
      makeIndex([
        makeEntry("TOP", "TOP", "LINE", [1, 1, 0], [3, 3, 0]),
        makeEntry("C1@INST1", "C1", "LINE", [2, 2, 0], [4, 4, 0]),
        makeEntry("C2@INST1", "C2", "TEXT", [3, 3, 0], [5, 5, 0]),
        makeEntry("INST1@INST1", "INST1", "INSERT", [2, 2, 0], [5, 5, 0], {
          childIds: ["C1@INST1", "C2@INST1"],
        }),
      ]);

    it("aggregate mode (default): returns top-level entries + INSERT aggregate, skips INSERT children", () => {
      const idx = buildInsertIndex();
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10));
      expect(result.map((e) => e.id).sort()).toEqual(["INST1@INST1", "TOP"]);
    });

    it("leaf mode: returns top-level entries + every INSERT child, skips aggregate", () => {
      const idx = buildInsertIndex();
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { granularity: "leaf" });
      expect(result.map((e) => e.id).sort()).toEqual(["C1@INST1", "C2@INST1", "TOP"]);
    });

    it("aggregate mode + window: still hides children", () => {
      const idx = buildInsertIndex();
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result.map((e) => e.id).sort()).toEqual(["INST1@INST1", "TOP"]);
    });

    it("leaf mode skips aggregate even when aggregate fits the rect", () => {
      const idx = buildInsertIndex();
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), {
        granularity: "leaf",
        mode: "window",
      });
      expect(result.find((e) => e.type === "INSERT")).toBeUndefined();
    });
  });

  describe("preserves input order", () => {
    it("returns entries in the order they appear in pickingIndex.entries", () => {
      const idx = makeIndex([
        makeEntry("Z", "Z", "LINE", [0, 0, 0], [1, 1, 0]),
        makeEntry("A", "A", "LINE", [0, 0, 0], [1, 1, 0]),
        makeEntry("M", "M", "LINE", [0, 0, 0], [1, 1, 0]),
      ]);
      const result = findEntriesInRect(idx, rect(-1, -1, 2, 2));
      expect(result.map((e) => e.id)).toEqual(["Z", "A", "M"]);
    });
  });

  describe("3D bbox handling", () => {
    it("ignores Z and matches purely on XY (default behaviour)", () => {
      // bbox is 3D but rect is 2D — z is not consulted in the AABB test.
      const idx = makeIndex([makeEntry("A", "A", "LINE", [0, 0, -1000], [10, 10, 1000])]);
      const result = findEntriesInRect(idx, rect(0, 0, 10, 10), { mode: "window" });
      expect(result.map((e) => e.id)).toEqual(["A"]);
    });
  });
});
