import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  type ArrowKind,
  classifyArrowBlock,
  isArrowShape,
  createArrowhead,
} from "../arrowheads";

const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const fillMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });

const buildHead = (kind: ArrowKind, size = 4): THREE.Object3D[] =>
  createArrowhead({
    from: new THREE.Vector3(0, 0, 0),
    tip: new THREE.Vector3(4, 0, 0),
    size,
    kind,
    lineMaterial: lineMat,
    fillMaterial: fillMat,
  });

const positionsOf = (obj: THREE.Object3D): number[] => {
  const geo = (obj as THREE.Mesh).geometry as THREE.BufferGeometry;
  const attr = geo.getAttribute("position") as THREE.BufferAttribute;
  return Array.from(attr.array);
};

describe("classifyArrowBlock", () => {
  const cases: Array<[string, ArrowKind | undefined]> = [
    ["_ClosedFilled", "closed-filled"],
    ["ClosedFilled", "closed-filled"],
    ["_closed", "closed-blank"],
    ["_ClosedBlank", "closed-blank"],
    ["_Open", "open"],
    ["_Open30", "open30"],
    ["_OpenArrow", "open-arrow"],
    ["_Open90", "open-arrow"],
    ["_DatumFilled", "datum-filled"],
    ["_DatumBlank", "datum-blank"],
    ["_Dot", "dot"],
    ["_DotSmall", "dot-small"],
    ["_DotBlank", "dot-blank"],
    ["_DotSmallBlank", "dot-small-blank"],
    ["_Origin", "origin"],
    ["_Origin2", "origin2"],
    ["_Box", "box"],
    ["_BoxFilled", "box-filled"],
    ["_Integral", "integral"],
    ["_None", "none"],
    ["_ArchTick", "tick"],
    ["_Oblique", "tick"],
    ["_Small", "tick"],
    ["_Tick", "tick"],
  ];

  for (const [name, expected] of cases) {
    it(`classifies "${name}" as ${expected}`, () => {
      expect(classifyArrowBlock(name)).toBe(expected);
    });
  }

  it("is case-insensitive", () => {
    expect(classifyArrowBlock("_dotsmall")).toBe("dot-small");
    expect(classifyArrowBlock("DotSmall")).toBe("dot-small");
    expect(classifyArrowBlock("DOTSMALL")).toBe("dot-small");
  });

  it("returns undefined for unknown names", () => {
    expect(classifyArrowBlock("hl_arrow2")).toBeUndefined();
    expect(classifyArrowBlock("_MyCustomBlock")).toBeUndefined();
  });

  it("returns undefined for empty / nullish input", () => {
    expect(classifyArrowBlock("")).toBeUndefined();
    expect(classifyArrowBlock(undefined)).toBeUndefined();
    expect(classifyArrowBlock(null)).toBeUndefined();
  });
});

describe("isArrowShape", () => {
  it("is true for direction-dependent arrow forms", () => {
    expect(isArrowShape("closed-filled")).toBe(true);
    expect(isArrowShape("closed-blank")).toBe(true);
    expect(isArrowShape("open")).toBe(true);
    expect(isArrowShape("open30")).toBe(true);
    expect(isArrowShape("open-arrow")).toBe(true);
    expect(isArrowShape("datum-filled")).toBe(true);
    expect(isArrowShape("datum-blank")).toBe(true);
  });

  it("is false for symmetric / endpoint-centred forms", () => {
    expect(isArrowShape("tick")).toBe(false);
    expect(isArrowShape("dot")).toBe(false);
    expect(isArrowShape("dot-small")).toBe(false);
    expect(isArrowShape("dot-blank")).toBe(false);
    expect(isArrowShape("dot-small-blank")).toBe(false);
    expect(isArrowShape("origin")).toBe(false);
    expect(isArrowShape("origin2")).toBe(false);
    expect(isArrowShape("box")).toBe(false);
    expect(isArrowShape("box-filled")).toBe(false);
    expect(isArrowShape("integral")).toBe(false);
    expect(isArrowShape("none")).toBe(false);
  });
});

describe("createArrowhead", () => {
  it("returns empty array for kind=none", () => {
    expect(buildHead("none")).toEqual([]);
  });

  it("creates filled triangle Mesh for closed-filled", () => {
    const heads = buildHead("closed-filled");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Mesh);
    const positions = positionsOf(heads[0]);
    // 3 vertices × 3 components
    expect(positions).toHaveLength(9);
    // First vertex is the tip
    expect(positions.slice(0, 3)).toEqual([4, 0, 0]);
  });

  it("creates filled triangle Mesh for datum-filled", () => {
    const heads = buildHead("datum-filled");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Mesh);
  });

  it("creates LineSegments outline for closed-blank", () => {
    const heads = buildHead("closed-blank");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.LineSegments);
    // 3 edges × 2 vertices × 3 components
    expect(positionsOf(heads[0])).toHaveLength(18);
  });

  it("creates two open strokes for open / open30", () => {
    const heads = buildHead("open");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.LineSegments);
    // 2 strokes × 2 vertices × 3 components = 12
    expect(positionsOf(heads[0])).toHaveLength(12);
  });

  it("creates filled dot Mesh for dot (radius = size/2)", () => {
    const heads = buildHead("dot", 4);
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Mesh);
    const positions = positionsOf(heads[0]);
    // First vertex is centre
    expect(positions.slice(0, 3)).toEqual([4, 0, 0]);
    // Find max radial distance from centre — should equal size/2 = 2
    let maxR = 0;
    for (let i = 3; i < positions.length; i += 3) {
      const dx = positions[i] - 4;
      const dy = positions[i + 1] - 0;
      maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
    }
    expect(maxR).toBeCloseTo(2, 5);
  });

  it("creates filled dot Mesh for dot-small (radius = size/4)", () => {
    const heads = buildHead("dot-small", 4);
    const positions = positionsOf(heads[0]);
    let maxR = 0;
    for (let i = 3; i < positions.length; i += 3) {
      const dx = positions[i] - 4;
      const dy = positions[i + 1] - 0;
      maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
    }
    expect(maxR).toBeCloseTo(1, 5); // size/4 = 1
  });

  it("creates Line outline for dot-blank (radius = size/2)", () => {
    const heads = buildHead("dot-blank", 4);
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Line);
    // First vertex sits on the circle, not at centre
    const positions = positionsOf(heads[0]);
    const dx = positions[0] - 4;
    const dy = positions[1] - 0;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(2, 5);
  });

  it("creates two concentric Line outlines for origin2", () => {
    const heads = buildHead("origin2", 4);
    expect(heads).toHaveLength(2);
    expect(heads[0]).toBeInstanceOf(THREE.Line);
    expect(heads[1]).toBeInstanceOf(THREE.Line);

    const measureR = (obj: THREE.Object3D) => {
      const pos = positionsOf(obj);
      const dx = pos[0] - 4;
      const dy = pos[1] - 0;
      return Math.sqrt(dx * dx + dy * dy);
    };
    // First ring is the larger one (size/2), second is the inner (size/4)
    expect(measureR(heads[0])).toBeCloseTo(2, 5);
    expect(measureR(heads[1])).toBeCloseTo(1, 5);
  });

  it("creates LineSegments outline for box", () => {
    const heads = buildHead("box");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.LineSegments);
    // 4 edges × 2 vertices × 3 components
    expect(positionsOf(heads[0])).toHaveLength(24);
  });

  it("creates filled Mesh for box-filled", () => {
    const heads = buildHead("box-filled");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Mesh);
  });

  it("creates tick LineSegments with size-scaled diagonal length", () => {
    const heads = buildHead("tick", 4);
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.LineSegments);
    const positions = positionsOf(heads[0]);
    // 1 segment, 2 endpoints
    expect(positions).toHaveLength(6);
    // _ArchTick block: line from (-0.5,-0.5) to (0.5,0.5), so total length is
    // size*sqrt(2); each endpoint sits at size*sqrt(2)/2 from the tip.
    const dx1 = positions[0] - 4;
    const dy1 = positions[1] - 0;
    expect(Math.sqrt(dx1 * dx1 + dy1 * dy1)).toBeCloseTo(2 * Math.SQRT2, 5);
  });

  it("creates an integral curve as a single Line", () => {
    const heads = buildHead("integral");
    expect(heads).toHaveLength(1);
    expect(heads[0]).toBeInstanceOf(THREE.Line);
  });

  it("scales arrowhead geometry proportionally to size", () => {
    const small = buildHead("closed-filled", 1);
    const big = buildHead("closed-filled", 10);
    const smallPos = positionsOf(small[0]);
    const bigPos = positionsOf(big[0]);
    // Tip-to-base distance along x — ratio should match size ratio (10x)
    const smallReach = Math.abs(smallPos[0] - smallPos[3]);
    const bigReach = Math.abs(bigPos[0] - bigPos[3]);
    expect(bigReach / smallReach).toBeCloseTo(10, 3);
  });
});
