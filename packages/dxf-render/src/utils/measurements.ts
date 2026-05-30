/**
 * Pure measurement utilities: distance, polygon area, angle.
 *
 * Framework-agnostic geometry math intended for use by viewer-level
 * measurement tools (linear ruler, area, angle) and any other consumer
 * that needs to compute CAD measurements from DXF coordinates.
 *
 * No Three.js / Vue / DOM dependencies — kept here so future React and
 * Lit wrappers can reuse the same math 1:1.
 */

import type { DxfVertex } from "@/types/dxf";

/**
 * 2D / 3D point. `z` is optional and treated as `0` when absent.
 * Compatible with `DxfVertex` and `THREE.Vector3`-like objects.
 */
export type MeasurePoint = Pick<DxfVertex, "x" | "y" | "z">;

/**
 * Euclidean distance between two points in 2D or 3D.
 *
 * Symmetric: `measureDistance(a, b) === measureDistance(b, a)`.
 * Returns `0` for identical points and for any non-finite component.
 */
export function measureDistance(p1: MeasurePoint, p2: MeasurePoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = (p2.z ?? 0) - (p1.z ?? 0);
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number.isFinite(d) ? d : 0;
}

/**
 * Signed area of a simple polygon (no self-intersections) via the
 * Shoelace formula. Points are treated as 2D — `z` is ignored.
 *
 * The sign reflects vertex order:
 *   - positive for counter-clockwise (CCW) winding,
 *   - negative for clockwise (CW) winding.
 *
 * Use {@link measureArea} when only the magnitude is needed.
 *
 * Returns `0` for polygons with fewer than 3 points, for any non-finite
 * coordinate, and for degenerate (collinear) polygons.
 *
 * Polygons may be passed open (last vertex != first) or closed (last
 * vertex == first) — both produce the same result.
 */
export function measureSignedArea(points: readonly MeasurePoint[]): number {
  const n = points.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return 0;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Absolute area of a simple polygon (Shoelace). See {@link measureSignedArea}
 * for the signed variant and details on input handling.
 */
export function measureArea(points: readonly MeasurePoint[]): number {
  return Math.abs(measureSignedArea(points));
}

/**
 * Closed-polygon perimeter: the sum of edge lengths around the polygon,
 * including the closing edge from the last vertex back to the first.
 *
 * Distances are 2D/3D (via {@link measureDistance}). Points may be passed
 * open (last vertex != first) — the closing edge is always added.
 *
 * Returns `0` for fewer than 2 points or any non-finite coordinate. For
 * exactly 2 points the result is twice the segment length (the degenerate
 * "there and back" loop).
 */
export function measurePerimeter(points: readonly MeasurePoint[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return 0;
    sum += measureDistance(a, b);
  }
  return sum;
}

/** 2D cross product of vectors (b - a) and (c - a). Sign gives orientation. */
function cross2(
  a: MeasurePoint,
  b: MeasurePoint,
  c: MeasurePoint,
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Does the closed polygon's boundary cross itself? Treated purely in 2D
 * (`z` ignored). Tests every pair of non-adjacent edges for a proper
 * crossing using the orientation (signed-area) sign test.
 *
 * Only *proper* crossings count — edges that merely share a polygon vertex
 * (adjacent edges, and the wrap-around first/last pair) are excluded, and
 * collinear/touching overlaps are conservatively reported as non-crossing.
 * This keeps the result free of false positives at the shared vertices a
 * normal polygon has.
 *
 * Returns `false` for fewer than 4 vertices (a triangle cannot self-cross)
 * and for any non-finite coordinate. Complexity is O(n²) — fine for the
 * small, hand-placed polygons the area-measurement tool produces.
 */
export function polygonSelfIntersects(points: readonly MeasurePoint[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(points[i].x) || !Number.isFinite(points[i].y)) {
      return false;
    }
  }

  const segmentsCross = (
    p1: MeasurePoint,
    p2: MeasurePoint,
    p3: MeasurePoint,
    p4: MeasurePoint,
  ): boolean => {
    const d1 = cross2(p3, p4, p1);
    const d2 = cross2(p3, p4, p2);
    const d3 = cross2(p1, p2, p3);
    const d4 = cross2(p1, p2, p4);
    return (
      ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
    );
  };

  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    // Start j at i+2 so adjacent edges (sharing vertex i+1) are skipped.
    for (let j = i + 2; j < n; j++) {
      // Skip the wrap-around pair that shares vertex 0 with edge i=0.
      if (i === 0 && j === n - 1) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentsCross(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/**
 * Unsigned angle at `vertex` between the rays `vertex → p1` and
 * `vertex → p2`, in radians, in the range `[0, π]`.
 *
 * Computed in 3D when any point carries a `z`. The direction of the
 * angle (CW vs CCW) is not preserved — use `Math.atan2` directly for
 * directed 2D angles.
 *
 * Returns `0` for degenerate input: `vertex` coincides with `p1` or
 * `p2`, or any coordinate is non-finite.
 */
export function measureAngle(
  vertex: MeasurePoint,
  p1: MeasurePoint,
  p2: MeasurePoint,
): number {
  const v1x = p1.x - vertex.x;
  const v1y = p1.y - vertex.y;
  const v1z = (p1.z ?? 0) - (vertex.z ?? 0);
  const v2x = p2.x - vertex.x;
  const v2y = p2.y - vertex.y;
  const v2z = (p2.z ?? 0) - (vertex.z ?? 0);

  const n1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const n2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (n1 === 0 || n2 === 0) return 0;

  const cos = (v1x * v2x + v1y * v2y + v1z * v2z) / (n1 * n2);
  // Clamp to [-1, 1] to guard against fp noise that would otherwise
  // make Math.acos return NaN.
  const clamped = cos < -1 ? -1 : cos > 1 ? 1 : cos;
  const a = Math.acos(clamped);
  return Number.isFinite(a) ? a : 0;
}

/**
 * Directed angle from the ray `vertex → from` to the ray `vertex → to`,
 * swept counter-clockwise, in radians, in the range `[0, 2π)`.
 *
 * Treated purely in 2D (`z` ignored). Unlike {@link measureAngle} (which
 * returns the unsigned `[0, π]` angle), this preserves the sweep direction:
 * swapping `from` and `to` yields `2π − result` (except at the `0` / `2π`
 * boundary). This makes it the right primitive for an interactive 3-point
 * angle tool where moving the cursor past the first ray flips between an
 * acute angle and its reflex (`α` ↔ `360° − α`).
 *
 * Returns `0` for degenerate input: `vertex` coincides with `from` or `to`,
 * or any coordinate is non-finite.
 */
export function measureDirectedAngle(
  vertex: MeasurePoint,
  from: MeasurePoint,
  to: MeasurePoint,
): number {
  const v1x = from.x - vertex.x;
  const v1y = from.y - vertex.y;
  const v2x = to.x - vertex.x;
  const v2y = to.y - vertex.y;
  if (
    !Number.isFinite(v1x) ||
    !Number.isFinite(v1y) ||
    !Number.isFinite(v2x) ||
    !Number.isFinite(v2y)
  ) {
    return 0;
  }
  if ((v1x === 0 && v1y === 0) || (v2x === 0 && v2y === 0)) return 0;

  const TAU = Math.PI * 2;
  const delta = Math.atan2(v2y, v2x) - Math.atan2(v1y, v1x);
  // Normalize into [0, 2π): the double modulo handles the negative branch.
  const d = ((delta % TAU) + TAU) % TAU;
  return Number.isFinite(d) ? d : 0;
}

/** Convert radians to degrees. */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Convert degrees to radians. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
