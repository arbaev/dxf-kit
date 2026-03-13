import * as THREE from "three";
import type { DxfVertex, DxfEntity, DxfPolylineVertex, DxfPolylineEntity } from "@/types/dxf";
import { isPolylineEntity } from "@/types/dxf";
import type { CollectEntityParams } from "../blockTemplateCache";
import type { GeometryCollector } from "../mergeCollectors";
import { createBulgeArc } from "../primitives";
import { resolveEntityColor } from "@/utils/colorResolver";
import { resolveEntityLinetype } from "@/utils/linetypeResolver";
import { buildOcsMatrix, transformOcsPoints } from "@/utils/ocsTransform";
import { EPSILON } from "@/constants";
import { addLineToCollector, applyWorld } from "./helpers";

/**
 * Compute polyline points (with bulge arcs) from entity vertices.
 */
export const computePolylinePoints = (entity: DxfEntity & { vertices: DxfVertex[]; shape?: boolean }): THREE.Vector3[] => {
  const allPoints: THREE.Vector3[] = [];

  for (let i = 0; i < entity.vertices.length - 1; i++) {
    const v1 = entity.vertices[i];
    const v2 = entity.vertices[i + 1];
    if (!v1 || !v2) continue;

    const p1 = new THREE.Vector3(v1.x, v1.y, 0);
    const p2 = new THREE.Vector3(v2.x, v2.y, 0);

    if (i === 0) {
      allPoints.push(p1);
    }

    if (v1.bulge && Math.abs(v1.bulge) > EPSILON) {
      const arcPoints = createBulgeArc(p1, p2, v1.bulge);
      allPoints.push(...arcPoints.slice(1));
    } else {
      allPoints.push(p2);
    }
  }

  // Closing segment for closed polylines (shape = true)
  if (entity.shape && entity.vertices.length > 1) {
    const vLast = entity.vertices[entity.vertices.length - 1];
    const vFirst = entity.vertices[0];
    const pLast = new THREE.Vector3(vLast.x, vLast.y, 0);
    const pFirst = new THREE.Vector3(vFirst.x, vFirst.y, 0);

    if (vLast.bulge && Math.abs(vLast.bulge) > EPSILON) {
      const arcPoints = createBulgeArc(pLast, pFirst, vLast.bulge);
      allPoints.push(...arcPoints.slice(1));
    } else {
      allPoints.push(pFirst);
    }
  }

  return allPoints;
};

/**
 * Resolve per-segment start/end widths for a polyline vertex.
 * Priority: vertex value → entity.width (code 43) → entity defaults → 0.
 * Uses !== undefined checks for vertex values so that explicit 0 is honored
 * (e.g., tapered segments narrowing to zero width).
 */
export function resolveSegmentWidths(
  vertex: DxfPolylineVertex,
  entity: DxfPolylineEntity,
): { startW: number; endW: number } {
  const startW = vertex.startWidth !== undefined
    ? vertex.startWidth
    : (entity.width ?? entity.defaultStartWidth ?? 0);
  const endW = vertex.endWidth !== undefined
    ? vertex.endWidth
    : (vertex.startWidth !== undefined
      ? vertex.startWidth
      : (entity.width ?? entity.defaultEndWidth ?? entity.defaultStartWidth ?? 0));
  return { startW, endW };
}

/**
 * Check if entity has any non-zero width (entity-level or per-vertex).
 */
export function hasAnyWidth(entity: DxfPolylineEntity): boolean {
  if (entity.width || entity.defaultStartWidth || entity.defaultEndWidth) return true;
  return entity.vertices.some(v => !!(v.startWidth || v.endWidth));
}

/**
 * Render a wide polyline as a filled mesh with variable per-segment width.
 * Builds a triangle strip by offsetting the center-line path by ±halfWidth,
 * interpolating width linearly along each segment (tapering support).
 */
const addWidePolylineToCollector = (
  collector: GeometryCollector,
  layer: string,
  color: string,
  entity: DxfPolylineEntity,
  ocsMatrix: THREE.Matrix4 | null,
  worldMatrix?: THREE.Matrix4,
): void => {
  const verts = entity.vertices;
  if (verts.length < 2) return;

  const isClosed = !!entity.shape;
  const segCount = isClosed ? verts.length : verts.length - 1;

  // Phase 1: Build center-line with per-point half-widths
  const allCenters: THREE.Vector3[] = [];
  const allHalfW: number[] = [];

  for (let i = 0; i < segCount; i++) {
    const v1 = verts[i];
    const v2 = verts[(i + 1) % verts.length];
    const { startW, endW } = resolveSegmentWidths(v1, entity);
    const halfStart = startW / 2;
    const halfEnd = endW / 2;

    const p1 = new THREE.Vector3(v1.x, v1.y, 0);
    const p2 = new THREE.Vector3(v2.x, v2.y, 0);

    let segPts: THREE.Vector3[];
    if (v1.bulge && Math.abs(v1.bulge) > EPSILON) {
      segPts = createBulgeArc(p1, p2, v1.bulge);
    } else {
      segPts = [p1, p2];
    }

    // Skip shared junction point for subsequent segments;
    // for the closing segment of closed polylines, also skip the last point (duplicate of first)
    const first = (i === 0) ? 0 : 1;
    const last = (isClosed && i === segCount - 1) ? segPts.length - 1 : segPts.length;

    for (let j = first; j < last; j++) {
      const t = (segPts.length > 1) ? j / (segPts.length - 1) : 0;
      allCenters.push(segPts[j]);
      allHalfW.push(halfStart + (halfEnd - halfStart) * t);
    }
  }

  const n = allCenters.length;
  if (n < 2) return;

  // Phase 2: Transform OCS → WCS
  if (ocsMatrix) for (const p of allCenters) p.applyMatrix4(ocsMatrix);
  if (worldMatrix) for (const p of allCenters) p.applyMatrix4(worldMatrix);

  // Phase 3: Compute miter normals and build left/right offset vertices.
  // At interior points, use miter join (intersection of adjacent offset lines)
  // to maintain constant perpendicular width along each segment.
  // Miter factor is clamped to MITER_LIMIT to prevent spikes at acute angles.
  const MITER_LIMIT = 2;
  const vertices: number[] = [];

  for (let i = 0; i < n; i++) {
    let nx: number, ny: number;
    const isInterior = isClosed || (i > 0 && i < n - 1);

    if (isInterior) {
      const prevIdx = (i - 1 + n) % n;
      const nextIdx = (i + 1) % n;

      // Incoming edge direction
      const dx1 = allCenters[i].x - allCenters[prevIdx].x;
      const dy1 = allCenters[i].y - allCenters[prevIdx].y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      // Outgoing edge direction
      const dx2 = allCenters[nextIdx].x - allCenters[i].x;
      const dy2 = allCenters[nextIdx].y - allCenters[i].y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (len1 < EPSILON && len2 < EPSILON) {
        // Fully degenerate: copy previous offsets or collapse
        if (vertices.length >= 6) {
          const k = vertices.length - 6;
          vertices.push(vertices[k], vertices[k + 1], vertices[k + 2],
            vertices[k + 3], vertices[k + 4], vertices[k + 5]);
        } else {
          const c = allCenters[i];
          vertices.push(c.x, c.y, c.z, c.x, c.y, c.z);
        }
        continue;
      }

      if (len1 < EPSILON) {
        // Only outgoing edge valid
        nx = -dy2 / len2; ny = dx2 / len2;
      } else if (len2 < EPSILON) {
        // Only incoming edge valid
        nx = -dy1 / len1; ny = dx1 / len1;
      } else {
        // Both edges valid: compute miter
        const n1x = -dy1 / len1, n1y = dx1 / len1;
        const n2x = -dy2 / len2, n2y = dx2 / len2;

        let mx = n1x + n2x, my = n1y + n2y;
        const mLen = Math.sqrt(mx * mx + my * my);

        if (mLen < EPSILON) {
          // 180° reversal: use incoming edge normal
          nx = n1x; ny = n1y;
        } else {
          mx /= mLen; my /= mLen;
          const dot = mx * n1x + my * n1y;
          const miterFactor = Math.min(1 / Math.max(dot, EPSILON), MITER_LIMIT);
          // nx,ny already include miter scaling (not unit length)
          nx = mx * miterFactor;
          ny = my * miterFactor;
        }
      }
    } else if (i === 0) {
      // First endpoint: perpendicular to first edge
      const dx = allCenters[1].x - allCenters[0].x;
      const dy = allCenters[1].y - allCenters[0].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < EPSILON) { nx = 0; ny = 1; } else { nx = -dy / len; ny = dx / len; }
    } else {
      // Last endpoint: perpendicular to last edge
      const dx = allCenters[i].x - allCenters[i - 1].x;
      const dy = allCenters[i].y - allCenters[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < EPSILON) { nx = 0; ny = 1; } else { nx = -dy / len; ny = dx / len; }
    }

    const hw = allHalfW[i];
    const c = allCenters[i];

    // Left point, then right point
    vertices.push(
      c.x + nx * hw, c.y + ny * hw, c.z,
      c.x - nx * hw, c.y - ny * hw, c.z,
    );
  }

  // Phase 4: Build triangle strip indices
  const pairCount = vertices.length / 6;
  if (pairCount < 2) return;

  const indices: number[] = [];
  const endI = isClosed ? pairCount : pairCount - 1;

  for (let i = 0; i < endI; i++) {
    const ni = (i + 1) % pairCount;
    const l0 = i * 2, r0 = i * 2 + 1;
    const l1 = ni * 2, r1 = ni * 2 + 1;
    indices.push(l0, r0, l1);
    indices.push(r0, r1, l1);
  }

  collector.addMesh(layer, color, vertices, indices);
};

/**
 * Render a POLYLINE polyface mesh as wireframe edges.
 * Position vertices (vertexFlags & 64 or 128 set, no faceA) define point positions (1-based).
 * Face vertices (faceA defined) reference those positions; negative index = invisible edge.
 */
const addPolyfaceMeshEdges = (
  collector: GeometryCollector,
  layer: string,
  color: string,
  vertices: DxfPolylineVertex[],
  worldMatrix?: THREE.Matrix4,
): void => {
  // Separate position vertices from face vertices
  const positions: THREE.Vector3[] = [];
  const faces: DxfPolylineVertex[] = [];
  for (const v of vertices) {
    if (v.faceA !== undefined) {
      faces.push(v);
    } else {
      positions.push(new THREE.Vector3(v.x, v.y, v.z || 0));
    }
  }
  if (worldMatrix) {
    for (const p of positions) p.applyMatrix4(worldMatrix);
  }
  if (positions.length === 0 || faces.length === 0) return;

  // Each face has up to 4 vertex indices (1-based). Negative = invisible edge.
  for (const face of faces) {
    const idxArr = [face.faceA, face.faceB, face.faceC, face.faceD];
    const faceVerts: number[] = [];
    const visible: boolean[] = [];
    for (const idx of idxArr) {
      if (idx === undefined || idx === 0) continue;
      faceVerts.push(Math.abs(idx));
      visible.push(idx > 0);
    }
    for (let i = 0; i < faceVerts.length; i++) {
      if (!visible[i]) continue;
      const a = faceVerts[i] - 1;
      const b = faceVerts[(i + 1) % faceVerts.length] - 1;
      if (a < 0 || a >= positions.length || b < 0 || b >= positions.length) continue;
      collector.addLineFromPoints(layer, color, [positions[a], positions[b]]);
    }
  }
};

/**
 * Render a 3D polygon mesh (POLYLINE code 70 bit 4) as wireframe edges.
 * Vertices are laid out in an M x N grid. Edges connect adjacent cells
 * horizontally and vertically (no diagonals).
 * shape (bit 0) = closed in M direction, is3dPolygonMeshClosed (bit 5) = closed in N direction.
 */
const addPolygonMeshEdges = (
  collector: GeometryCollector,
  layer: string,
  color: string,
  entity: DxfPolylineEntity,
  worldMatrix?: THREE.Matrix4,
): void => {
  const M = entity.meshMVertexCount!;
  const N = entity.meshNVertexCount!;
  const verts = entity.vertices;
  if (verts.length < M * N) return;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < M * N; i++) {
    const v = verts[i];
    pts.push(new THREE.Vector3(v.x, v.y, v.z || 0));
  }
  if (worldMatrix) {
    for (const p of pts) p.applyMatrix4(worldMatrix);
  }

  const closedM = entity.shape === true;
  const closedN = entity.is3dPolygonMeshClosed === true;

  const idx = (m: number, n: number) => m * N + n;

  // Horizontal edges: along N direction
  for (let m = 0; m < M; m++) {
    const nEnd = closedN ? N : N - 1;
    for (let n = 0; n < nEnd; n++) {
      collector.addLineFromPoints(layer, color, [pts[idx(m, n)], pts[idx(m, (n + 1) % N)]]);
    }
  }
  // Vertical edges: along M direction
  for (let n = 0; n < N; n++) {
    const mEnd = closedM ? M : M - 1;
    for (let m = 0; m < mEnd; m++) {
      collector.addLineFromPoints(layer, color, [pts[idx(m, n)], pts[idx((m + 1) % M, n)]]);
    }
  }
};

/**
 * Collect a LWPOLYLINE or POLYLINE entity into the GeometryCollector.
 * Handles polyface mesh, 3D polygon mesh, wide polyline, and regular polyline.
 * Returns true if collected, false if not handled.
 */
export function collectPolyline(p: CollectEntityParams): boolean {
  const { entity, colorCtx, collector, layer, worldMatrix, overrideColor } = p;

  if (!isPolylineEntity(entity)) return false;
  if (entity.vertices.length === 0) return true; // degenerate: skip silently
  if (entity.vertices.length === 1) {
    // Single-vertex polyline: render as a point
    const entityColor = overrideColor ?? resolveEntityColor(entity, colorCtx.layers, colorCtx.blockColor);
    const v = entity.vertices[0];
    const pt = new THREE.Vector3(v.x, v.y, v.z ?? 0);
    const ocsMatrix = buildOcsMatrix(entity.extrusionDirection);
    if (ocsMatrix) pt.applyMatrix4(ocsMatrix);
    if (worldMatrix) pt.applyMatrix4(worldMatrix);
    collector.addPoint(layer, entityColor, pt.x, pt.y, pt.z);
    return true;
  }

  const entityColor = overrideColor ?? resolveEntityColor(entity, colorCtx.layers, colorCtx.blockColor);
  const ltInfo = resolveEntityLinetype(
    entity, colorCtx.layers, colorCtx.lineTypes,
    colorCtx.globalLtScale, colorCtx.blockLineType, colorCtx.headerLtScale,
  );
  const pattern = ltInfo?.pattern;

  // Polyface mesh: vertices define positions + face indices
  if (entity.isPolyfaceMesh) {
    addPolyfaceMeshEdges(collector, layer, entityColor, entity.vertices, worldMatrix);
    return true;
  }
  // 3D polygon mesh: vertices in M x N grid
  if (entity.is3dPolygonMesh && entity.meshMVertexCount && entity.meshNVertexCount) {
    addPolygonMeshEdges(collector, layer, entityColor, entity, worldMatrix);
    return true;
  }
  // Wide polyline: render as filled mesh (constant or variable width)
  if (hasAnyWidth(entity)) {
    const matrix = buildOcsMatrix(entity.extrusionDirection);
    addWidePolylineToCollector(collector, layer, entityColor, entity, matrix, worldMatrix);
    return true;
  }
  const matrix = buildOcsMatrix(entity.extrusionDirection);
  const allPoints = computePolylinePoints(entity);
  addLineToCollector(collector, layer, entityColor, applyWorld(transformOcsPoints(allPoints, matrix), worldMatrix), pattern);
  return true;
}
