import * as THREE from "three";
import type { DxfEntity, DxfVertex } from "@/types/dxf";
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isEllipseEntity,
  isPolylineEntity,
  isSplineEntity,
  isPointEntity,
  isSolidEntity,
  is3DFaceEntity,
  isMlineEntity,
  isLeaderEntity,
  isMLeaderEntity,
} from "@/types/dxf";
import type { MeasurePoint } from "@/utils/measurements";
import type { PickingIndex } from "./pickingIndex";

/**
 * Object-snap point kinds, mirroring the classic CAD "object snap" set.
 *
 * - `endpoint` — segment / arc / polyline endpoints, corner vertices
 * - `midpoint` — midpoint of a straight segment or an arc
 * - `center`   — center of a circle / arc / ellipse
 * - `quadrant` — the 0/90/180/270° points of a circle/arc/ellipse
 * - `node`     — a POINT entity
 *
 * `intersection` (crossings between two entities) is intentionally not part of
 * this set — it needs pairwise segment testing and is tracked separately.
 */
export type SnapType =
  | "endpoint"
  | "midpoint"
  | "center"
  | "quadrant"
  | "node";

/** A single snap candidate in world coordinates. */
export interface SnapPoint {
  type: SnapType;
  point: MeasurePoint;
}

/** Result of {@link findSnapPoint}: the chosen snap plus its source entity. */
export interface SnapResult {
  type: SnapType;
  /** Snap location in world coordinates. */
  point: MeasurePoint;
  /** DXF handle of the entity the snap belongs to. */
  handle: string;
  /** Planar (2D) distance from the query position to the snap point. */
  distance: number;
}

export interface FindSnapOptions {
  /** Restrict which snap kinds are considered. Defaults to all kinds. */
  types?: readonly SnapType[];
}

/**
 * Lower number = higher priority when several candidates fall inside the
 * tolerance aperture (matches AutoCAD running-osnap precedence). Ties on
 * priority are broken by the nearer point.
 */
const SNAP_PRIORITY: Record<SnapType, number> = {
  endpoint: 0,
  midpoint: 1,
  center: 2,
  node: 2,
  quadrant: 3,
};

/**
 * Compute the characteristic snap points of a single DXF entity, in world
 * coordinates (with `worldMatrix` applied when provided — pass the
 * `PickingEntry.worldMatrix` so block-instance transforms are honored).
 *
 * Pure / framework-agnostic. INSERT entities yield no snap points here — the
 * caller iterates the child picking entries instead, exactly like
 * `buildHighlightGeometry`.
 *
 * Entity types without precise vertex geometry (TEXT/MTEXT/DIMENSION/ATTRIB/
 * ATTDEF/HATCH/INSERT/XLINE/RAY) return an empty array.
 */
export function getEntitySnapPoints(
  entity: DxfEntity,
  worldMatrix: THREE.Matrix4 | null,
): SnapPoint[] {
  const local = buildLocalSnapPoints(entity);
  if (worldMatrix && local.length > 0) {
    const v = new THREE.Vector3();
    for (const sp of local) {
      v.set(sp.point.x, sp.point.y, sp.point.z ?? 0).applyMatrix4(worldMatrix);
      sp.point = { x: v.x, y: v.y, z: v.z };
    }
  }
  return local;
}

/**
 * Find the best snap point near `worldPos` within `tolerance` (world units).
 *
 * Iterates the picking index, culls entities by their world-space bbox
 * (expanded by `tolerance`, tested in 2D), resolves each surviving entity via
 * `entityIndex` and computes its snap points with the entry's `worldMatrix`.
 * The winner is the highest-priority candidate inside the tolerance, nearest
 * first on priority ties. Returns `null` when nothing is in range.
 *
 * Proximity is measured in the XY plane (the cursor's unprojected world point
 * carries no meaningful z), so entities drawn at a non-zero z still snap.
 */
export function findSnapPoint(
  pickingIndex: PickingIndex,
  entityIndex: Map<string, DxfEntity>,
  worldPos: MeasurePoint,
  tolerance: number,
  options?: FindSnapOptions,
): SnapResult | null {
  if (!Number.isFinite(tolerance) || tolerance <= 0) return null;
  const types = options?.types;
  const tol2 = tolerance * tolerance;

  let bestPriority = Infinity;
  let bestDist2 = Infinity;
  let best: SnapResult | null = null;

  for (const entry of pickingIndex.entries) {
    // INSERT aggregate entries reuse their children's handles, which are
    // emitted as their own entries — skip to avoid double work.
    if (entry.type === "INSERT") continue;

    const b = entry.bbox;
    if (worldPos.x < b.min.x - tolerance || worldPos.x > b.max.x + tolerance) continue;
    if (worldPos.y < b.min.y - tolerance || worldPos.y > b.max.y + tolerance) continue;

    const entity = entityIndex.get(entry.handle);
    if (!entity) continue;

    const candidates = getEntitySnapPoints(entity, entry.worldMatrix ?? null);
    for (const c of candidates) {
      if (types && !types.includes(c.type)) continue;
      const dx = c.point.x - worldPos.x;
      const dy = c.point.y - worldPos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > tol2) continue;

      const pr = SNAP_PRIORITY[c.type];
      if (pr < bestPriority || (pr === bestPriority && d2 < bestDist2)) {
        bestPriority = pr;
        bestDist2 = d2;
        best = {
          type: c.type,
          point: c.point,
          handle: entry.handle,
          distance: Math.sqrt(d2),
        };
      }
    }
  }

  return best;
}

// ─── Per-entity snap points in entity-local coordinates ──────────────────

function buildLocalSnapPoints(entity: DxfEntity): SnapPoint[] {
  if (isLineEntity(entity)) {
    const a = entity.vertices[0];
    const b = entity.vertices[1];
    if (!a || !b) return [];
    return [
      endpoint(a),
      endpoint(b),
      midpoint(a, b),
    ];
  }

  if (isCircleEntity(entity)) {
    return [center(entity.center), ...circleQuadrants(entity.center, entity.radius)];
  }

  if (isArcEntity(entity)) {
    return arcSnapPoints(entity.center, entity.radius, entity.startAngle, entity.endAngle);
  }

  if (isEllipseEntity(entity)) {
    return ellipseSnapPoints(entity);
  }

  if (isPolylineEntity(entity)) {
    // `shape` (DXF flag bit 0) marks a closed polyline.
    return polylineSnapPoints(entity.vertices, entity.shape === true);
  }

  if (isSplineEntity(entity)) {
    const pts = entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints;
    if (!pts || pts.length < 2) return pts?.length ? [endpoint(pts[0])] : [];
    return [endpoint(pts[0]), endpoint(pts[pts.length - 1])];
  }

  if (isSolidEntity(entity)) {
    return entity.points.map(endpoint);
  }

  if (is3DFaceEntity(entity)) {
    return entity.vertices.map(endpoint);
  }

  if (isPointEntity(entity)) {
    return [node(entity.position)];
  }

  if (isMlineEntity(entity)) {
    return polylineSnapPoints(entity.vertices, false);
  }

  if (isLeaderEntity(entity)) {
    return polylineSnapPoints(entity.vertices, false);
  }

  if (isMLeaderEntity(entity)) {
    const out: SnapPoint[] = [];
    for (const branch of entity.leaders ?? []) {
      for (const line of branch.lines ?? []) {
        out.push(...polylineSnapPoints(line.vertices, false));
      }
      if (branch.lastLeaderPoint) out.push(endpoint(branch.lastLeaderPoint));
    }
    return out;
  }

  // TEXT/MTEXT/DIMENSION/ATTRIB/ATTDEF/HATCH/REGION/INSERT/XLINE/RAY — no
  // precise vertex geometry to snap to.
  return [];
}

// ─── Builders ────────────────────────────────────────────────────────────

function endpoint(v: DxfVertex): SnapPoint {
  return { type: "endpoint", point: { x: v.x, y: v.y, z: v.z ?? 0 } };
}

function node(v: DxfVertex): SnapPoint {
  return { type: "node", point: { x: v.x, y: v.y, z: v.z ?? 0 } };
}

function center(v: DxfVertex): SnapPoint {
  return { type: "center", point: { x: v.x, y: v.y, z: v.z ?? 0 } };
}

function midpoint(a: DxfVertex, b: DxfVertex): SnapPoint {
  return {
    type: "midpoint",
    point: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    },
  };
}

/**
 * Endpoint snaps for every vertex plus midpoint snaps for every *straight*
 * segment. Bulge (arc) segments contribute their endpoints but no midpoint in
 * this version — the true arc midpoint needs bulge math and is deferred.
 */
function polylineSnapPoints(
  vertices: ReadonlyArray<DxfVertex & { bulge?: number }>,
  closed: boolean,
): SnapPoint[] {
  const n = vertices.length;
  if (n === 0) return [];
  const out: SnapPoint[] = [];
  for (const v of vertices) out.push(endpoint(v));

  const lastSeg = closed ? n : n - 1;
  for (let i = 0; i < lastSeg; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const bulge = a.bulge ?? 0;
    if (bulge === 0) out.push(midpoint(a, b));
  }
  return out;
}

function circleQuadrants(c: DxfVertex, r: number): SnapPoint[] {
  const z = c.z ?? 0;
  return [
    { type: "quadrant", point: { x: c.x + r, y: c.y, z } },
    { type: "quadrant", point: { x: c.x, y: c.y + r, z } },
    { type: "quadrant", point: { x: c.x - r, y: c.y, z } },
    { type: "quadrant", point: { x: c.x, y: c.y - r, z } },
  ];
}

const TAU = Math.PI * 2;

function arcSnapPoints(
  c: DxfVertex,
  r: number,
  startRad: number,
  endRad: number,
): SnapPoint[] {
  const z = c.z ?? 0;
  const start = normalizeRad(startRad);
  const end = normalizeRad(endRad);
  const sweep = start === end ? TAU : (end - start + TAU) % TAU;

  const out: SnapPoint[] = [center(c)];
  // Endpoints of the arc.
  out.push(endpoint(pointOnCircle(c, r, start, z)));
  out.push(endpoint(pointOnCircle(c, r, end, z)));
  // Midpoint along the arc.
  out.push({ type: "midpoint", point: ptOnCircle(c, r, start + sweep / 2, z) });
  // Cardinal points that the arc actually crosses become quadrant snaps.
  for (const cardinal of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const offset = (cardinal - start + TAU) % TAU;
    if (offset > 0 && offset < sweep) {
      out.push({ type: "quadrant", point: ptOnCircle(c, r, cardinal, z) });
    }
  }
  return out;
}

function ellipseSnapPoints(entity: {
  center: DxfVertex;
  majorAxisEndPoint: DxfVertex;
  axisRatio: number;
  startAngle: number;
  endAngle: number;
}): SnapPoint[] {
  const c = entity.center;
  const z = c.z ?? 0;
  const mx = entity.majorAxisEndPoint.x;
  const my = entity.majorAxisEndPoint.y;
  const ratio = entity.axisRatio || 1;
  // Minor axis vector = major axis rotated +90° and scaled by the ratio.
  const nx = -my * ratio;
  const ny = mx * ratio;

  const at = (theta: number): MeasurePoint => ({
    x: c.x + Math.cos(theta) * mx + Math.sin(theta) * nx,
    y: c.y + Math.cos(theta) * my + Math.sin(theta) * ny,
    z,
  });

  const start = normalizeRad(entity.startAngle);
  const end = normalizeRad(entity.endAngle);
  const full = start === end || Math.abs(((end - start) % TAU)) < 1e-9;
  const sweep = full ? TAU : (end - start + TAU) % TAU;

  const out: SnapPoint[] = [center(c)];
  if (!full) {
    out.push({ type: "endpoint", point: at(start) });
    out.push({ type: "endpoint", point: at(end) });
  }
  // Axis tips (param 0/90/180/270°) that fall within the swept range.
  for (const theta of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const offset = (theta - start + TAU) % TAU;
    if (full || (offset >= 0 && offset <= sweep)) {
      out.push({ type: "quadrant", point: at(theta) });
    }
  }
  return out;
}

function pointOnCircle(c: DxfVertex, r: number, rad: number, z: number): DxfVertex {
  return { x: c.x + r * Math.cos(rad), y: c.y + r * Math.sin(rad), z };
}

function ptOnCircle(c: DxfVertex, r: number, rad: number, z: number): MeasurePoint {
  return { x: c.x + r * Math.cos(rad), y: c.y + r * Math.sin(rad), z };
}

function normalizeRad(r: number): number {
  let n = r % TAU;
  if (n < 0) n += TAU;
  return n;
}
