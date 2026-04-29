import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getZoomBox } from "../getZoomBox";
import type { PickingIndex, PickingEntry } from "@/render/pickingIndex";

function makeEntry(handle: string, min: [number, number, number], max: [number, number, number]): PickingEntry {
  return {
    id: handle,
    handle,
    type: "LINE",
    layer: "0",
    bbox: new THREE.Box3(
      new THREE.Vector3(...min),
      new THREE.Vector3(...max),
    ),
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

describe("getZoomBox", () => {
  it("returns null for empty handles array", () => {
    const idx = makeIndex([makeEntry("A", [0, 0, 0], [10, 10, 0])]);
    expect(getZoomBox(idx, [])).toBeNull();
  });

  it("returns null when none of the handles are in the index", () => {
    const idx = makeIndex([makeEntry("A", [0, 0, 0], [10, 10, 0])]);
    expect(getZoomBox(idx, ["B", "C"])).toBeNull();
  });

  it("returns padded box for a single handle", () => {
    const idx = makeIndex([makeEntry("A", [0, 0, 0], [10, 10, 0])]);
    const box = getZoomBox(idx, ["A"])!;
    // size 10x10 → 20% padding = 2 → box becomes [-2, -2] to [12, 12]
    expect(box.min.x).toBeCloseTo(-2);
    expect(box.min.y).toBeCloseTo(-2);
    expect(box.max.x).toBeCloseTo(12);
    expect(box.max.y).toBeCloseTo(12);
  });

  it("unions multiple handles", () => {
    const idx = makeIndex([
      makeEntry("A", [0, 0, 0], [10, 10, 0]),
      makeEntry("B", [20, -5, 0], [25, 0, 0]),
    ]);
    const box = getZoomBox(idx, ["A", "B"], { paddingRatio: 0 })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(-5);
    expect(box.max.x).toBeCloseTo(25);
    expect(box.max.y).toBeCloseTo(10);
  });

  it("unions all entries that share a handle (e.g. INSERT array instances)", () => {
    const idx = makeIndex([
      // Same handle "X" appears twice (two INSERT instances of the same block)
      { id: "X:0:0", handle: "X", type: "INSERT", layer: "0",
        bbox: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 5, 0)) },
      { id: "X:0:1", handle: "X", type: "INSERT", layer: "0",
        bbox: new THREE.Box3(new THREE.Vector3(10, 0, 0), new THREE.Vector3(15, 5, 0)) },
    ]);
    const box = getZoomBox(idx, ["X"], { paddingRatio: 0 })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(15);
  });

  it("applies origin offset (subtracts it from world bboxes)", () => {
    const idx = makeIndex([makeEntry("A", [1000, 2000, 0], [1010, 2010, 0])]);
    const box = getZoomBox(idx, ["A"], {
      originOffset: { x: 1000, y: 2000 },
      paddingRatio: 0,
    })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(10);
    expect(box.max.y).toBeCloseTo(10);
  });

  it("respects custom paddingRatio", () => {
    const idx = makeIndex([makeEntry("A", [0, 0, 0], [10, 10, 0])]);
    const box = getZoomBox(idx, ["A"], { paddingRatio: 0.5 })!;
    // size 10 → padding 5
    expect(box.min.x).toBeCloseTo(-5);
    expect(box.max.x).toBeCloseTo(15);
  });

  it("uses min padding=1 unit when bbox is degenerate (single point)", () => {
    const idx = makeIndex([makeEntry("A", [5, 5, 0], [5, 5, 0])]);
    const box = getZoomBox(idx, ["A"], { paddingRatio: 0.2 })!;
    // size 0x0 → max(0, 0, 1) * 0.2 = 0.2 padding
    expect(box.min.x).toBeCloseTo(4.8);
    expect(box.max.x).toBeCloseTo(5.2);
  });

  it("ignores unknown handles when mixed with known ones", () => {
    const idx = makeIndex([makeEntry("A", [0, 0, 0], [10, 10, 0])]);
    const box = getZoomBox(idx, ["A", "B", "C"], { paddingRatio: 0 })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(10);
  });
});
