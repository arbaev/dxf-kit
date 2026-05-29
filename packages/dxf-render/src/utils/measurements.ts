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

/** Convert radians to degrees. */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Convert degrees to radians. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
