import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  screenToWorldPoint,
  worldToScreenPoint,
  worldPerPixel,
  ensurePositionCapacity,
  isPanGesture,
} from "../usePointerTool";

/** Symmetric orthographic frustum, matching `useCamera` defaults. */
function makeCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-100, 100, 50, -50, -2000, 2000);
  cam.position.set(0, 0, 100);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

// 200×100 canvas → 1 screen px == 1 world unit for the frustum above.
const rect = { left: 0, top: 0, width: 200, height: 100 };
const NO_OFFSET = { x: 0, y: 0 };

describe("screenToWorldPoint", () => {
  const cam = makeCamera();

  it("maps the viewport centre to the frustum centre", () => {
    const p = screenToWorldPoint(100, 50, rect, cam, NO_OFFSET);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBe(0);
  });

  it("maps the right / top edges to the frustum bounds", () => {
    const right = screenToWorldPoint(200, 50, rect, cam, NO_OFFSET);
    expect(right.x).toBeCloseTo(100, 6);
    // Screen y grows downward; the top edge (y=0 px) maps to +top.
    const top = screenToWorldPoint(100, 0, rect, cam, NO_OFFSET);
    expect(top.y).toBeCloseTo(50, 6);
  });

  it("adds the origin offset back into world space", () => {
    const p = screenToWorldPoint(100, 50, rect, cam, { x: 1000, y: 2000 });
    expect(p.x).toBeCloseTo(1000, 6);
    expect(p.y).toBeCloseTo(2000, 6);
  });

  it("accounts for a non-zero canvas rect offset", () => {
    const shifted = { left: 40, top: 20, width: 200, height: 100 };
    const p = screenToWorldPoint(140, 70, shifted, cam, NO_OFFSET);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });
});

describe("worldToScreenPoint", () => {
  const cam = makeCamera();

  it("round-trips with screenToWorldPoint", () => {
    const offset = { x: 1234, y: -567 };
    for (const [sx, sy] of [
      [100, 50],
      [10, 90],
      [199, 1],
    ]) {
      const world = screenToWorldPoint(sx, sy, rect, cam, offset);
      const back = worldToScreenPoint(world, rect, cam, offset);
      expect(back.x).toBeCloseTo(sx, 4);
      expect(back.y).toBeCloseTo(sy, 4);
    }
  });
});

describe("worldPerPixel", () => {
  it("returns the world-units-per-pixel scale for an ortho camera", () => {
    const cam = makeCamera();
    // 200 world units across 200 px → 1 unit/px.
    expect(worldPerPixel(rect, cam)).toBeCloseTo(1, 6);
  });

  it("scales with the frustum width", () => {
    const cam = new THREE.OrthographicCamera(-500, 500, 50, -50, -2000, 2000);
    cam.position.set(0, 0, 100);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    // 1000 world units across 200 px → 5 units/px.
    expect(worldPerPixel(rect, cam)).toBeCloseTo(5, 6);
  });

  it("guards against a zero-width rect", () => {
    expect(worldPerPixel({ left: 0, top: 0, width: 0, height: 100 }, makeCamera())).toBe(1);
  });
});

describe("ensurePositionCapacity", () => {
  it("allocates a fresh buffer with a minimum of 4 vertices", () => {
    const geom = new THREE.BufferGeometry();
    const arr = ensurePositionCapacity(geom, 3);
    // max(3, 4) * 3 = 12
    expect(arr.length).toBe(12);
    expect(geom.getAttribute("position")).toBeTruthy();
  });

  it("reuses the existing buffer when it is already large enough", () => {
    const geom = new THREE.BufferGeometry();
    const first = ensurePositionCapacity(geom, 8); // length 24
    const second = ensurePositionCapacity(geom, 5); // 15 <= 24 → reuse
    expect(second).toBe(first);
  });

  it("grows the buffer when more vertices are needed", () => {
    const geom = new THREE.BufferGeometry();
    const first = ensurePositionCapacity(geom, 4); // length 12
    const second = ensurePositionCapacity(geom, 10); // 30 > 12 → new
    expect(second).not.toBe(first);
    expect(second.length).toBe(30);
  });
});

describe("isPanGesture", () => {
  it("treats sub-threshold movement as a click", () => {
    expect(isPanGesture(0, 0)).toBe(false);
    expect(isPanGesture(3, 0)).toBe(false);
    expect(isPanGesture(2, 2)).toBe(false); // hypot ≈ 2.83
  });

  it("treats movement at or beyond the threshold as a pan", () => {
    expect(isPanGesture(4, 0)).toBe(true);
    expect(isPanGesture(0, 4)).toBe(true);
    expect(isPanGesture(3, 3)).toBe(true); // hypot ≈ 4.24
  });
});
