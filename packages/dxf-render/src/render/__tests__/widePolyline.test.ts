import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { resolveSegmentWidths, hasAnyWidth } from "@/render/collectors";
import { GeometryCollector } from "@/render/mergeCollectors";
import { collectPolyline } from "@/render/collectors/polylineCollector";
import type { DxfPolylineEntity, DxfPolylineVertex, DxfLayer } from "@/types/dxf";
import type { RenderContext } from "@/render/primitives";
import type { CollectEntityParams } from "@/render/blockTemplateCache";

// Minimal RenderContext for tests
function makeColorCtx(): RenderContext {
  return {
    layers: {
      "0": { name: "0", visible: true, colorIndex: 7, color: 0xffffff, frozen: false },
    } as Record<string, DxfLayer>,
    lineTypes: {},
    globalLtScale: 1,
    headerLtScale: 1,
    materials: null as unknown as RenderContext["materials"],
    defaultTextHeight: 2.5,
  };
}

function makeEntity(
  vertices: DxfPolylineVertex[],
  opts: Partial<DxfPolylineEntity> = {},
): DxfPolylineEntity {
  return {
    type: "LWPOLYLINE",
    vertices,
    ...opts,
  } as DxfPolylineEntity;
}

// =============================================================================
// resolveSegmentWidths
// =============================================================================
describe("resolveSegmentWidths", () => {
  it("uses vertex startWidth/endWidth when set", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0, startWidth: 4, endWidth: 2 };
    const entity = makeEntity([vertex]);
    const { startW, endW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(4);
    expect(endW).toBe(2);
  });

  it("falls back to entity.width when vertex has no width", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0 };
    const entity = makeEntity([vertex], { width: 3 });
    const { startW, endW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(3);
    expect(endW).toBe(3);
  });

  it("falls back to entity defaults when no vertex width or entity.width", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0 };
    const entity = makeEntity([vertex], { defaultStartWidth: 5, defaultEndWidth: 2 });
    const { startW, endW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(5);
    expect(endW).toBe(2);
  });

  it("endWidth falls back to startWidth when only startWidth is set", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0, startWidth: 6 };
    const entity = makeEntity([vertex]);
    const { startW, endW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(6);
    expect(endW).toBe(6);
  });

  it("returns 0 when no widths are set anywhere", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0 };
    const entity = makeEntity([vertex]);
    const { startW, endW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(0);
    expect(endW).toBe(0);
  });

  it("vertex startWidth takes priority over entity.width", () => {
    const vertex: DxfPolylineVertex = { x: 0, y: 0, startWidth: 2 };
    const entity = makeEntity([vertex], { width: 10 });
    const { startW } = resolveSegmentWidths(vertex, entity);
    expect(startW).toBe(2);
  });
});

// =============================================================================
// hasAnyWidth
// =============================================================================
describe("hasAnyWidth", () => {
  it("returns true when entity.width is set", () => {
    const entity = makeEntity([{ x: 0, y: 0 }, { x: 10, y: 0 }], { width: 2 });
    expect(hasAnyWidth(entity)).toBe(true);
  });

  it("returns true when entity.defaultStartWidth is set", () => {
    const entity = makeEntity([{ x: 0, y: 0 }], { defaultStartWidth: 1 });
    expect(hasAnyWidth(entity)).toBe(true);
  });

  it("returns true when entity.defaultEndWidth is set", () => {
    const entity = makeEntity([{ x: 0, y: 0 }], { defaultEndWidth: 1 });
    expect(hasAnyWidth(entity)).toBe(true);
  });

  it("returns true when any vertex has startWidth", () => {
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 3 },
      { x: 10, y: 0 },
    ]);
    expect(hasAnyWidth(entity)).toBe(true);
  });

  it("returns true when any vertex has endWidth", () => {
    const entity = makeEntity([
      { x: 0, y: 0, endWidth: 2 },
      { x: 10, y: 0 },
    ]);
    expect(hasAnyWidth(entity)).toBe(true);
  });

  it("returns false when all widths are zero/undefined", () => {
    const entity = makeEntity([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(hasAnyWidth(entity)).toBe(false);
  });
});

// =============================================================================
// Wide polyline rendering (via collectPolyline + GeometryCollector)
// =============================================================================
describe("addWidePolylineToCollector", () => {
  function collectAndGetMesh(entity: DxfPolylineEntity) {
    const collector = new GeometryCollector();
    const colorCtx = makeColorCtx();
    const params: CollectEntityParams = {
      entity,
      colorCtx,
      collector,
      layer: "0",
    };
    collectPolyline(params);
    // Extract mesh data from the collector
    const meshEntries = [...collector.meshVertices.entries()];
    if (meshEntries.length === 0) return null;
    const [, vArr] = meshEntries[0];
    const iArr = collector.meshIndices.get(meshEntries[0][0])!;
    return {
      vertices: vArr.toArray(),
      indices: iArr.toArray(),
    };
  }

  it("produces symmetric mesh for constant-width polyline", () => {
    const entity = makeEntity(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      { width: 2 },
    );
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    // 2 center points → 4 mesh vertices (2 left + 2 right)
    expect(mesh!.vertices.length).toBe(4 * 3);
    // 1 quad → 2 triangles → 6 indices
    expect(mesh!.indices.length).toBe(6);

    // Left and right should be symmetric around y=0 at halfWidth=1
    // Vertex layout: [left0, right0, left1, right1] each with x,y,z
    expect(mesh!.vertices[1]).toBeCloseTo(1);   // left0.y = +1
    expect(mesh!.vertices[4]).toBeCloseTo(-1);  // right0.y = -1
    expect(mesh!.vertices[7]).toBeCloseTo(1);   // left1.y = +1
    expect(mesh!.vertices[10]).toBeCloseTo(-1); // right1.y = -1
  });

  it("miter join preserves constant width at 90° corner", () => {
    // L-shaped polyline: horizontal → vertical, width=2
    const entity = makeEntity(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      { width: 2 },
    );
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    const v = mesh!.vertices;
    // 3 center points → 6 mesh vertices (3 pairs)
    expect(v.length).toBe(6 * 3);

    // Helper: perpendicular distance from left/right to center-line segment
    function pairWidth(pairIdx: number): number {
      const lx = v[pairIdx * 6], ly = v[pairIdx * 6 + 1];
      const rx = v[pairIdx * 6 + 3], ry = v[pairIdx * 6 + 4];
      return Math.sqrt((lx - rx) ** 2 + (ly - ry) ** 2);
    }

    // Endpoint widths should be exactly 2 (perpendicular to edge)
    expect(pairWidth(0)).toBeCloseTo(2);
    expect(pairWidth(2)).toBeCloseTo(2);

    // Corner miter: left/right distance = 2*sqrt(2) ≈ 2.83 (miter extends along bisector)
    // but the perpendicular width along each adjacent edge should still be 2.
    // Verify: the horizontal segment has left/right paths at y=±1
    expect(v[1]).toBeCloseTo(1);   // pair0 left.y = +1
    expect(v[4]).toBeCloseTo(-1);  // pair0 right.y = -1
    // Corner miter: left at (9,1), right at (11,-1)
    expect(v[7]).toBeCloseTo(1);   // pair1 (corner) left.y = +1
    expect(v[10]).toBeCloseTo(-1); // pair1 (corner) right.y = -1
    // Vertical segment: left/right paths at x=9 and x=11
    expect(v[6]).toBeCloseTo(9);   // pair1 (corner) left.x = 9
    expect(v[9]).toBeCloseTo(11);  // pair1 (corner) right.x = 11
    expect(v[12]).toBeCloseTo(9);  // pair2 (endpoint) left.x = 9
    expect(v[15]).toBeCloseTo(11); // pair2 (endpoint) right.x = 11
  });

  it("produces tapered mesh (startWidth=2, endWidth=0)", () => {
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 2, endWidth: 0 },
      { x: 10, y: 0 },
    ]);
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    // Start: halfW=1, end: halfW=0
    expect(mesh!.vertices[1]).toBeCloseTo(1);   // left0.y = +1
    expect(mesh!.vertices[4]).toBeCloseTo(-1);  // right0.y = -1
    expect(mesh!.vertices[7]).toBeCloseTo(0);   // left1.y = 0 (narrowed)
    expect(mesh!.vertices[10]).toBeCloseTo(0);  // right1.y = 0 (narrowed)
  });

  it("handles per-vertex variable width", () => {
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 4, endWidth: 2 },
      { x: 10, y: 0, startWidth: 2, endWidth: 6 },
      { x: 20, y: 0 },
    ]);
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    // 3 center points → 6 mesh vertices
    expect(mesh!.vertices.length).toBe(6 * 3);
    // 2 quads → 4 triangles → 12 indices
    expect(mesh!.indices.length).toBe(12);

    // First vertex: halfW = 4/2 = 2
    expect(mesh!.vertices[1]).toBeCloseTo(2);   // left0.y
    expect(mesh!.vertices[4]).toBeCloseTo(-2);  // right0.y
    // Second vertex: halfW = 2/2 = 1 (end of first segment = start of second)
    expect(mesh!.vertices[7]).toBeCloseTo(1);   // left1.y
    expect(mesh!.vertices[10]).toBeCloseTo(-1); // right1.y
    // Third vertex: halfW = 6/2 = 3
    expect(mesh!.vertices[13]).toBeCloseTo(3);  // left2.y
    expect(mesh!.vertices[16]).toBeCloseTo(-3); // right2.y
  });

  it("preserves width discontinuity at segment junction (AutoCAD-style arrow)", () => {
    // LWPOLYLINE: thin line (0→0) then triangular arrowhead (120→0).
    // Junction at vertex 1 has prev endW=0 but next startW=120 — the strip
    // must re-emit the junction so the arrow opens at half-width 60, otherwise
    // the arrowhead collapses to zero width and disappears.
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 0, endWidth: 0 },
      { x: 100, y: 0, startWidth: 120, endWidth: 0 },
      { x: 150, y: 0 },
    ]);
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();

    // 4 center points (3 vertices + 1 duplicated junction) → 8 mesh vertices
    expect(mesh!.vertices.length).toBe(8 * 3);

    const v = mesh!.vertices;
    // pair 0 (v0): half-width 0, both at origin
    expect(v[0]).toBeCloseTo(0); expect(v[1]).toBeCloseTo(0);
    expect(v[3]).toBeCloseTo(0); expect(v[4]).toBeCloseTo(0);
    // pair 1 (v1, end of segment 0): half-width 0, both at (100, 0)
    expect(v[6]).toBeCloseTo(100); expect(v[7]).toBeCloseTo(0);
    expect(v[9]).toBeCloseTo(100); expect(v[10]).toBeCloseTo(0);
    // pair 2 (v1 duplicated, start of segment 1): half-width 60, ±y at (100, 0)
    expect(v[12]).toBeCloseTo(100); expect(v[13]).toBeCloseTo(60);
    expect(v[15]).toBeCloseTo(100); expect(v[16]).toBeCloseTo(-60);
    // pair 3 (v2): half-width 0, both at (150, 0)
    expect(v[18]).toBeCloseTo(150); expect(v[19]).toBeCloseTo(0);
    expect(v[21]).toBeCloseTo(150); expect(v[22]).toBeCloseTo(0);
  });

  it("emits zero-width segments as thin lines inside a mixed-width polyline", () => {
    // Same AutoCAD arrow as above. The shaft (segment 0, widths 0/0) must
    // render as a thin line — without it the arrowhead floats in space and
    // the shaft is invisible (zero-area mesh strip).
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 0, endWidth: 0 },
      { x: 100, y: 0, startWidth: 120, endWidth: 0 },
      { x: 150, y: 0 },
    ]);
    const collector = new GeometryCollector();
    const colorCtx = makeColorCtx();
    collectPolyline({ entity, colorCtx, collector, layer: "0" });

    // Mesh present (the arrowhead)
    expect([...collector.meshVertices.entries()].length).toBe(1);

    // Line segments present (the shaft) — exactly one segment, 2 endpoints, 6 floats
    const lineEntries = [...collector.lineSegments.entries()];
    expect(lineEntries.length).toBe(1);
    const lineVerts = lineEntries[0][1].toArray();
    expect(lineVerts.length).toBe(2 * 3); // 1 segment = 2 endpoints
    // (0,0) → (100,0)
    expect(lineVerts[0]).toBeCloseTo(0);
    expect(lineVerts[1]).toBeCloseTo(0);
    expect(lineVerts[3]).toBeCloseTo(100);
    expect(lineVerts[4]).toBeCloseTo(0);
  });

  it("handles bulge arc with variable width", () => {
    const entity = makeEntity([
      { x: 0, y: 0, startWidth: 2, endWidth: 0, bulge: 1 },
      { x: 10, y: 0 },
    ]);
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    // Bulge=1 → semicircle → many intermediate points
    const vertCount = mesh!.vertices.length / 3;
    expect(vertCount).toBeGreaterThan(4); // More than just start+end pair

    // First pair: left and right should be separated by ~2 (halfW=1 on each side)
    const firstLeftX = mesh!.vertices[0], firstLeftY = mesh!.vertices[1];
    const firstRightX = mesh!.vertices[3], firstRightY = mesh!.vertices[4];
    const firstDist = Math.sqrt(
      (firstLeftX - firstRightX) ** 2 + (firstLeftY - firstRightY) ** 2,
    );
    expect(firstDist).toBeCloseTo(2, 0); // startWidth=2

    // Last pair: left and right should collapse (halfW=0)
    const v = mesh!.vertices;
    const lastLeftX = v[v.length - 6], lastLeftY = v[v.length - 5];
    const lastRightX = v[v.length - 3], lastRightY = v[v.length - 2];
    const lastDist = Math.sqrt(
      (lastLeftX - lastRightX) ** 2 + (lastLeftY - lastRightY) ** 2,
    );
    expect(lastDist).toBeLessThan(0.1); // endWidth=0
  });

  it("handles closed polyline with width", () => {
    // Equilateral triangle with constant width
    const entity = makeEntity(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 8.66 },
      ],
      { shape: true, width: 2 },
    );
    const mesh = collectAndGetMesh(entity);
    expect(mesh).not.toBeNull();
    // 3 center points → 6 mesh vertices
    expect(mesh!.vertices.length).toBe(6 * 3);
    // 3 quads (including closing) → 6 triangles → 18 indices
    expect(mesh!.indices.length).toBe(18);
  });

  it("renders zero-width polyline as thin line (no mesh)", () => {
    const entity = makeEntity([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const mesh = collectAndGetMesh(entity);
    // No width → no mesh, rendered as line
    expect(mesh).toBeNull();
  });

  it("scales width by worldMatrix scale (INSERT-scoped polyline)", () => {
    // Reproduces the _ArchTick arrowhead inside a DIMENSION's pre-rendered block:
    // a wide polyline inside an INSERT with uniform scale=10 should render its
    // width scaled by the same factor. The local-space width is 0.4 → world-space
    // width must be 4.
    const entity = makeEntity(
      [{ x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }],
      { width: 0.4 },
    );
    const collector = new GeometryCollector();
    const colorCtx = makeColorCtx();
    const worldMatrix = new THREE.Matrix4().makeScale(10, 10, 1);
    const params: CollectEntityParams = {
      entity,
      colorCtx,
      collector,
      layer: "0",
      worldMatrix,
    };
    collectPolyline(params);

    const meshEntries = [...collector.meshVertices.entries()];
    expect(meshEntries.length).toBe(1);
    const v = meshEntries[0][1].toArray();
    // Endpoint pair distance = width = 0.4 * scale 10 = 4
    const dx = v[0] - v[3];
    const dy = v[1] - v[4];
    expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(4);

    // Endpoint centers also scaled: (-0.5,-0.5)*10 = (-5,-5)
    const cx = (v[0] + v[3]) / 2;
    const cy = (v[1] + v[4]) / 2;
    expect(cx).toBeCloseTo(-5);
    expect(cy).toBeCloseTo(-5);
  });

  it("rotates correctly under worldMatrix rotation", () => {
    // Horizontal width=2 polyline rotated 90° CCW: the centers go vertical,
    // perpendicular offset goes horizontal, width preserved.
    const entity = makeEntity(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      { width: 2 },
    );
    const collector = new GeometryCollector();
    const colorCtx = makeColorCtx();
    const worldMatrix = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
    const params: CollectEntityParams = {
      entity,
      colorCtx,
      collector,
      layer: "0",
      worldMatrix,
    };
    collectPolyline(params);

    const meshEntries = [...collector.meshVertices.entries()];
    expect(meshEntries.length).toBe(1);
    const v = meshEntries[0][1].toArray();

    // pair0 center = (0,0); pair0 left = (-1,0) (perp was +y, rotated → -x),
    // pair0 right = (+1,0).
    expect(v[0]).toBeCloseTo(-1); // left0.x
    expect(v[1]).toBeCloseTo(0);  // left0.y
    expect(v[3]).toBeCloseTo(1);  // right0.x
    expect(v[4]).toBeCloseTo(0);  // right0.y

    // pair1 center = (0,10) (was (10,0) rotated 90°)
    // pair1 left = (-1,10), pair1 right = (+1,10).
    expect(v[6]).toBeCloseTo(-1); // left1.x
    expect(v[7]).toBeCloseTo(10); // left1.y
    expect(v[9]).toBeCloseTo(1);  // right1.x
    expect(v[10]).toBeCloseTo(10); // right1.y
  });
});
