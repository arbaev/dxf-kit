import * as THREE from "three";
import type { DxfEntity, DxfVertex, HatchBoundaryPath } from "@/types/dxf";
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isEllipseEntity,
  isPolylineEntity,
  isSplineEntity,
  isSolidEntity,
  is3DFaceEntity,
  isHatchEntity,
  isRegionEntity,
  isMlineEntity,
  isLeaderEntity,
  isMLeaderEntity,
} from "@/types/dxf";
import {
  generateCirclePoints,
  generateArcPoints,
  generateEllipsePoints,
} from "./curvePoints";
import { computePolylinePoints } from "./collectors/polylineCollector";
import { computeSplinePoints } from "./collectors/splineCollector";
import { boundaryPathToLinePoints } from "./hatch";

/**
 * Geometry returned by `buildHighlightGeometry` — a flat list of polyline
 * point arrays in world coordinates. The caller (e.g. `useHighlight` in
 * dxf-vuer) wraps each polyline in a `THREE.Line` with the highlight
 * material, optionally subtracting an origin offset.
 *
 * Each element of `polylines` is a connected sequence of points (consumed as
 * `THREE.Line`, not `THREE.LineSegments`). A single entity may produce
 * multiple polylines (e.g. a HATCH with several boundary paths).
 *
 * `fallbackToBBox` is `true` when no precise geometry is available for the
 * entity type (TEXT/MTEXT/ATTRIB/ATTDEF/DIMENSION) or the entity is
 * intentionally skipped (XLINE/RAY). The caller should fall back to drawing
 * the entry's bbox edges, matching the legacy highlight behavior.
 */
export interface HighlightGeometry {
  polylines: THREE.Vector3[][];
  fallbackToBBox: boolean;
}

/**
 * Build a list of polyline point arrays that visually trace the geometry of
 * a DXF entity, ready to be rendered as highlight overlay lines. Points are
 * returned in world coordinates (with `worldMatrix` applied if provided).
 *
 * Pure function — does not allocate Three.js render objects. The caller
 * builds `THREE.BufferGeometry` / `THREE.Line` as needed.
 *
 * INSERT entities are NOT expanded here — for an INSERT aggregate the
 * caller should iterate the child picking entries (via `childIds` on the
 * aggregate `PickingEntry`) and call `buildHighlightGeometry` for each.
 */
export function buildHighlightGeometry(
  entity: DxfEntity,
  worldMatrix: THREE.Matrix4 | null,
): HighlightGeometry {
  const localPolylines = buildLocalPolylines(entity);
  if (localPolylines === null) {
    return { polylines: [], fallbackToBBox: true };
  }
  if (localPolylines.length === 0) {
    // Skip (XLINE/RAY) — neither precise geometry nor a bbox fallback makes
    // sense for infinite entities.
    return { polylines: [], fallbackToBBox: false };
  }
  if (worldMatrix) {
    for (const polyline of localPolylines) {
      for (const v of polyline) v.applyMatrix4(worldMatrix);
    }
  }
  return { polylines: localPolylines, fallbackToBBox: false };
}

/**
 * Return value semantics:
 * - `null`  → no precise geometry available, caller should fall back to bbox
 * - `[]`    → entity intentionally skipped (e.g. XLINE/RAY)
 * - `Vector3[][]` → polyline point arrays in entity-local coordinates
 */
function buildLocalPolylines(entity: DxfEntity): THREE.Vector3[][] | null {
  if (isLineEntity(entity)) {
    const v0 = entity.vertices[0];
    const v1 = entity.vertices[1];
    if (!v0 || !v1) return null;
    return [[vec(v0), vec(v1)]];
  }

  if (isCircleEntity(entity)) {
    const c = entity.center;
    return [generateCirclePoints(c.x, c.y, c.z ?? 0, entity.radius)];
  }

  if (isArcEntity(entity)) {
    const c = entity.center;
    return [
      generateArcPoints(c.x, c.y, c.z ?? 0, entity.radius, entity.startAngle, entity.endAngle),
    ];
  }

  if (isEllipseEntity(entity)) {
    const c = entity.center;
    const m = entity.majorAxisEndPoint;
    const pts = generateEllipsePoints(
      c.x, c.y, c.z ?? 0,
      m.x, m.y,
      entity.axisRatio,
      entity.startAngle, entity.endAngle,
    );
    return pts.length > 0 ? [pts] : null;
  }

  if (isPolylineEntity(entity)) {
    const pts = computePolylinePoints(entity);
    return pts.length > 1 ? [pts] : null;
  }

  if (isSplineEntity(entity)) {
    const pts = computeSplinePoints(entity);
    return pts && pts.length > 1 ? [pts] : null;
  }

  if (isSolidEntity(entity)) {
    // SOLID/TRACE vertices in DXF use a zigzag order: 1, 2, 4, 3 traces the
    // outline. For a triangle the 4th vertex repeats the 3rd.
    const p = entity.points;
    const outline = [vec(p[0]), vec(p[1]), vec(p[3]), vec(p[2]), vec(p[0])];
    return [outline];
  }

  if (is3DFaceEntity(entity)) {
    const v = entity.vertices;
    if (v.length < 3) return null;
    const outline = v.map(vec);
    outline.push(vec(v[0])); // close
    return [outline];
  }

  if (isHatchEntity(entity)) {
    const out: THREE.Vector3[][] = [];
    for (const bp of entity.boundaryPaths ?? []) {
      const pts = boundaryPathToLinePoints(bp);
      if (pts.length > 1) out.push(pts);
    }
    return out.length > 0 ? out : null;
  }

  if (isRegionEntity(entity)) {
    if (!entity.contourBoundary?.length) return null;
    const out: THREE.Vector3[][] = [];
    for (const bp of entity.contourBoundary as HatchBoundaryPath[]) {
      const pts = boundaryPathToLinePoints(bp);
      if (pts.length > 1) out.push(pts);
    }
    return out.length > 0 ? out : null;
  }

  if (isMlineEntity(entity)) {
    // Simplification: trace the centerline (vertex chain). The offset element
    // lines from MLINESTYLE are not reconstructed here — the centerline is
    // what the user clicks on most of the time.
    const pts = entity.vertices.map(vec);
    return pts.length > 1 ? [pts] : null;
  }

  if (isLeaderEntity(entity)) {
    const pts = entity.vertices.map(vec);
    return pts.length > 1 ? [pts] : null;
  }

  if (isMLeaderEntity(entity)) {
    const out: THREE.Vector3[][] = [];
    for (const branch of entity.leaders ?? []) {
      for (const line of branch.lines ?? []) {
        const pts = line.vertices.map(vec);
        if (pts.length > 1) out.push(pts);
      }
    }
    return out.length > 0 ? out : null;
  }

  // XLINE / RAY — intentionally skipped (infinite extent).
  if (entity.type === "XLINE" || entity.type === "RAY") {
    return [];
  }

  // TEXT/MTEXT/ATTRIB/ATTDEF/DIMENSION/INSERT/POINT — no precise geometry,
  // caller falls back to drawing the bbox edges.
  return null;
}

function vec(v: DxfVertex): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z ?? 0);
}
