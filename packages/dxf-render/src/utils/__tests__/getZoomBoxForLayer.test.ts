import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getZoomBoxForLayer } from "../getZoomBoxForLayer";
import type { PickingIndex, PickingEntry } from "@/render/pickingIndex";

function makeEntry(
  handle: string,
  layer: string,
  min: [number, number, number],
  max: [number, number, number],
): PickingEntry {
  return {
    id: handle,
    handle,
    type: "LINE",
    layer,
    bbox: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)),
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

describe("getZoomBoxForLayer", () => {
  it("returns null when layer has no entries", () => {
    const idx = makeIndex([makeEntry("A", "WALLS", [0, 0, 0], [10, 10, 0])]);
    expect(getZoomBoxForLayer(idx, "DOORS")).toBeNull();
  });

  it("returns null for empty layer name", () => {
    const idx = makeIndex([makeEntry("A", "WALLS", [0, 0, 0], [10, 10, 0])]);
    expect(getZoomBoxForLayer(idx, "")).toBeNull();
  });

  it("unions all entries on the layer", () => {
    const idx = makeIndex([
      makeEntry("A", "WALLS", [0, 0, 0], [10, 10, 0]),
      makeEntry("B", "WALLS", [20, -5, 0], [30, 5, 0]),
      makeEntry("C", "DOORS", [100, 100, 0], [110, 110, 0]),
    ]);
    const box = getZoomBoxForLayer(idx, "WALLS", { paddingRatio: 0 })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(-5);
    expect(box.max.x).toBeCloseTo(30);
    expect(box.max.y).toBeCloseTo(10);
  });

  it("is case-sensitive by default", () => {
    const idx = makeIndex([makeEntry("A", "Walls", [0, 0, 0], [10, 10, 0])]);
    expect(getZoomBoxForLayer(idx, "WALLS")).toBeNull();
    expect(getZoomBoxForLayer(idx, "Walls")).not.toBeNull();
  });

  it("supports case-insensitive matching via option", () => {
    const idx = makeIndex([makeEntry("A", "Walls", [0, 0, 0], [10, 10, 0])]);
    const box = getZoomBoxForLayer(idx, "WALLS", { caseSensitive: false, paddingRatio: 0 });
    expect(box).not.toBeNull();
    expect(box!.max.x).toBeCloseTo(10);
  });

  it("forwards padding and originOffset options", () => {
    const idx = makeIndex([makeEntry("A", "L", [1000, 2000, 0], [1010, 2010, 0])]);
    const box = getZoomBoxForLayer(idx, "L", {
      originOffset: { x: 1000, y: 2000 },
      paddingRatio: 0,
    })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(10);
  });

  it("includes all instances when same handle appears multiple times (INSERT array)", () => {
    const idx = makeIndex([
      { id: "X:0:0", handle: "X", type: "INSERT", layer: "BL",
        bbox: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 5, 0)) },
      { id: "X:0:1", handle: "X", type: "INSERT", layer: "BL",
        bbox: new THREE.Box3(new THREE.Vector3(10, 0, 0), new THREE.Vector3(15, 5, 0)) },
    ]);
    const box = getZoomBoxForLayer(idx, "BL", { paddingRatio: 0 })!;
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(15);
  });
});
