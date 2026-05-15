import * as THREE from "three";
import { EPSILON, ARROW_BASE_WIDTH_DIVISOR } from "@/constants";

/**
 * Standard AutoCAD arrowhead block kinds.
 *
 * "arrow-shape" forms (closed/open/datum) are direction-dependent and benefit
 * from the outside-arrows flip on short dim lines. Symmetric forms (dot/tick/
 * box/origin/integral/none) are placed at the endpoint without a flip.
 *
 * `closed-filled` is the AutoCAD default and the fallback for unknown blocks.
 */
export type ArrowKind =
  | "closed-filled"
  | "closed-blank"
  | "open"
  | "open30"
  | "open-arrow"
  | "datum-filled"
  | "datum-blank"
  | "tick"
  | "dot"
  | "dot-small"
  | "dot-blank"
  | "dot-small-blank"
  | "origin"
  | "origin2"
  | "box"
  | "box-filled"
  | "integral"
  | "none";

const ARROW_SHAPES = new Set<ArrowKind>([
  "closed-filled",
  "closed-blank",
  "open",
  "open30",
  "open-arrow",
  "datum-filled",
  "datum-blank",
]);

/** Direction-dependent arrowhead — placed at the tip oriented along (from → tip). */
export const isArrowShape = (kind: ArrowKind): boolean => ARROW_SHAPES.has(kind);

/**
 * Classify a DXF block name as one of the standard AutoCAD arrowhead kinds.
 * Names are matched case-insensitively, with an optional leading underscore
 * (DXF stores them as `_Dot`, `_DotSmall`, etc.; some authoring tools strip
 * the underscore).
 *
 * Returns `undefined` for names not recognised as standard — callers either
 * fall back to `"closed-filled"` or attempt to render the user-defined block
 * geometry (e.g. LEADER's custom DIMLDRBLK pointing at a non-standard block).
 *
 * Empty / null / undefined name → `undefined` as well (no standard kind known).
 */
export const classifyArrowBlock = (name: string | undefined | null): ArrowKind | undefined => {
  if (!name) return undefined;
  let n = name.toLowerCase();
  if (n.startsWith("_")) n = n.slice(1);

  switch (n) {
    case "closedfilled":
      return "closed-filled";
    case "closed":
      return "closed-blank";
    case "closedblank":
      return "closed-blank";
    case "open":
      return "open";
    case "open30":
      return "open30";
    case "openarrow":
    case "open90":
      return "open-arrow";
    case "datumfilled":
      return "datum-filled";
    case "datumblank":
      return "datum-blank";
    case "dot":
      return "dot";
    case "dotsmall":
      return "dot-small";
    case "dotblank":
      return "dot-blank";
    case "dotsmallblank":
      return "dot-small-blank";
    case "origin":
      return "origin";
    case "origin2":
      return "origin2";
    case "box":
      return "box";
    case "boxfilled":
      return "box-filled";
    case "integral":
      return "integral";
    case "none":
      return "none";
    case "archtick":
    case "oblique":
    case "small":
    case "tick":
      return "tick";
    default:
      return undefined;
  }
};

interface ArrowheadParams {
  /** Point at the tail end (used to compute direction for arrow-shaped kinds). */
  from: THREE.Vector3;
  /** Tip / endpoint where the arrowhead sits. Symmetric kinds are centred here. */
  tip: THREE.Vector3;
  /** Final arrowhead size in drawing units (already DIMSCALE-scaled). */
  size: number;
  kind: ArrowKind;
  /** Material for line / contour parts. */
  lineMaterial: THREE.LineBasicMaterial;
  /** Material for filled (mesh) parts. */
  fillMaterial: THREE.Material;
}

const DOT_SEGMENTS = 24;

const buildDir = (from: THREE.Vector3, tip: THREE.Vector3) => {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > EPSILON) {
    return { dirX: dx / len, dirY: dy / len };
  }
  return { dirX: 1, dirY: 0 };
};

const filledTriangle = (
  tip: THREE.Vector3,
  from: THREE.Vector3,
  size: number,
  mat: THREE.Material,
): THREE.Mesh => {
  const { dirX, dirY } = buildDir(from, tip);
  const width = size / ARROW_BASE_WIDTH_DIVISOR;
  const perpX = dirY;
  const perpY = -dirX;

  const positions = new Float32Array([
    tip.x, tip.y, tip.z,
    tip.x - dirX * size + perpX * width, tip.y - dirY * size + perpY * width, tip.z,
    tip.x - dirX * size - perpX * width, tip.y - dirY * size - perpY * width, tip.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2]);
  return new THREE.Mesh(geometry, mat);
};

const triangleOutline = (
  tip: THREE.Vector3,
  from: THREE.Vector3,
  size: number,
  mat: THREE.LineBasicMaterial,
): THREE.LineSegments => {
  const { dirX, dirY } = buildDir(from, tip);
  const width = size / ARROW_BASE_WIDTH_DIVISOR;
  const perpX = dirY;
  const perpY = -dirX;

  const b1x = tip.x - dirX * size + perpX * width;
  const b1y = tip.y - dirY * size + perpY * width;
  const b2x = tip.x - dirX * size - perpX * width;
  const b2y = tip.y - dirY * size - perpY * width;

  const positions = new Float32Array([
    tip.x, tip.y, tip.z, b1x, b1y, tip.z,
    b1x, b1y, tip.z, b2x, b2y, tip.z,
    b2x, b2y, tip.z, tip.x, tip.y, tip.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, mat);
};

/**
 * Open arrowhead: two strokes from `tip` back to the base corners,
 * without the closing base segment. `widthDivisor` controls flare —
 * 4 ≈ 30° (default _Open / _Open30), 2 ≈ 90° (_OpenArrow).
 */
const openArrowStrokes = (
  tip: THREE.Vector3,
  from: THREE.Vector3,
  size: number,
  widthDivisor: number,
  mat: THREE.LineBasicMaterial,
): THREE.LineSegments => {
  const { dirX, dirY } = buildDir(from, tip);
  const width = size / widthDivisor;
  const perpX = dirY;
  const perpY = -dirX;

  const b1x = tip.x - dirX * size + perpX * width;
  const b1y = tip.y - dirY * size + perpY * width;
  const b2x = tip.x - dirX * size - perpX * width;
  const b2y = tip.y - dirY * size - perpY * width;

  const positions = new Float32Array([
    tip.x, tip.y, tip.z, b1x, b1y, tip.z,
    tip.x, tip.y, tip.z, b2x, b2y, tip.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, mat);
};

const filledDot = (
  centre: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
): THREE.Mesh => {
  const positions: number[] = [centre.x, centre.y, centre.z];
  for (let i = 0; i <= DOT_SEGMENTS; i++) {
    const a = (i / DOT_SEGMENTS) * Math.PI * 2;
    positions.push(centre.x + radius * Math.cos(a), centre.y + radius * Math.sin(a), centre.z);
  }
  const indices: number[] = [];
  for (let i = 1; i <= DOT_SEGMENTS; i++) indices.push(0, i, i + 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(geometry, mat);
};

const dotOutline = (
  centre: THREE.Vector3,
  radius: number,
  mat: THREE.LineBasicMaterial,
): THREE.Line => {
  const positions: number[] = [];
  for (let i = 0; i <= DOT_SEGMENTS; i++) {
    const a = (i / DOT_SEGMENTS) * Math.PI * 2;
    positions.push(centre.x + radius * Math.cos(a), centre.y + radius * Math.sin(a), centre.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Line(geometry, mat);
};

const tickStroke = (
  tip: THREE.Vector3,
  from: THREE.Vector3,
  size: number,
  mat: THREE.LineBasicMaterial,
): THREE.LineSegments => {
  // _ArchTick block: 45° oblique line through `tip`, length = size on each
  // side of `tip` along the (dir + perp) diagonal. Direction is taken from
  // (from → tip), perpendicular is rotated 90° CCW.
  const { dirX, dirY } = buildDir(from, tip);
  const half = size * 0.5;
  // Diagonal (dir + perp) normalised to length `half`.
  const dx = (dirX + dirY) * half;
  const dy = (dirY - dirX) * half;
  const positions = new Float32Array([
    tip.x - dx, tip.y - dy, tip.z,
    tip.x + dx, tip.y + dy, tip.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, mat);
};

const filledBox = (
  centre: THREE.Vector3,
  half: number,
  from: THREE.Vector3,
  tip: THREE.Vector3,
  mat: THREE.Material,
): THREE.Mesh => {
  // Box is axis-aligned to the arrow direction so it reads as a marker on the
  // dim line rather than a tilted square.
  const { dirX, dirY } = buildDir(from, tip);
  const perpX = dirY;
  const perpY = -dirX;

  const corners: number[] = [];
  const sx = [+1, +1, -1, -1];
  const sy = [+1, -1, -1, +1];
  for (let i = 0; i < 4; i++) {
    corners.push(
      centre.x + dirX * half * sx[i] + perpX * half * sy[i],
      centre.y + dirY * half * sx[i] + perpY * half * sy[i],
      centre.z,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return new THREE.Mesh(geometry, mat);
};

const boxOutline = (
  centre: THREE.Vector3,
  half: number,
  from: THREE.Vector3,
  tip: THREE.Vector3,
  mat: THREE.LineBasicMaterial,
): THREE.LineSegments => {
  const { dirX, dirY } = buildDir(from, tip);
  const perpX = dirY;
  const perpY = -dirX;

  const sx = [+1, +1, -1, -1];
  const sy = [+1, -1, -1, +1];
  const cx: number[] = [];
  const cy: number[] = [];
  for (let i = 0; i < 4; i++) {
    cx.push(centre.x + dirX * half * sx[i] + perpX * half * sy[i]);
    cy.push(centre.y + dirY * half * sx[i] + perpY * half * sy[i]);
  }
  const positions = new Float32Array([
    cx[0], cy[0], centre.z, cx[1], cy[1], centre.z,
    cx[1], cy[1], centre.z, cx[2], cy[2], centre.z,
    cx[2], cy[2], centre.z, cx[3], cy[3], centre.z,
    cx[3], cy[3], centre.z, cx[0], cy[0], centre.z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, mat);
};

const integralStroke = (
  tip: THREE.Vector3,
  from: THREE.Vector3,
  size: number,
  mat: THREE.LineBasicMaterial,
): THREE.Line => {
  // _Integral: stylised ∫ — two half-circles forming an S-curve along the
  // arrow direction. Total extent = size along dir, height = size/2 across.
  const { dirX, dirY } = buildDir(from, tip);
  const perpX = dirY;
  const perpY = -dirX;
  const half = size * 0.5;
  const r = size * 0.25;

  // Centres of the two half-arcs (one above, one below the baseline)
  const c1x = tip.x - dirX * (half * 0.5) + perpX * r;
  const c1y = tip.y - dirY * (half * 0.5) + perpY * r;
  const c2x = tip.x - dirX * size + dirX * (half * 0.5) - perpX * r;
  const c2y = tip.y - dirY * size + dirY * (half * 0.5) - perpY * r;

  const baseAngle = Math.atan2(dirY, dirX);
  const positions: number[] = [];
  const segs = 12;
  // Upper half-arc (centred at c1, sweeps from baseline through +perp)
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = baseAngle + Math.PI * (1 - t);
    positions.push(c1x + r * Math.cos(a), c1y + r * Math.sin(a), tip.z);
  }
  // Lower half-arc (centred at c2, sweeps from baseline through -perp)
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = baseAngle + Math.PI * (1 + t);
    positions.push(c2x + r * Math.cos(a), c2y + r * Math.sin(a), tip.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Line(geometry, mat);
};

/**
 * Build the geometry for one of the standard AutoCAD arrowhead kinds.
 *
 * Returns an array of THREE objects (mixed Line / LineSegments / Mesh) — the
 * caller is responsible for adding them to a parent group and tagging
 * `userData.dimPart` if needed for DIMCLRD vs DIMCLRE split.
 *
 * `from` is only consulted for direction-dependent (arrow-shape) and
 * direction-aligned (tick, box) kinds. For pure dots / origin / integral
 * the symbol is rotation-invariant.
 */
export const createArrowhead = (p: ArrowheadParams): THREE.Object3D[] => {
  const { from, tip, size, kind, lineMaterial, fillMaterial } = p;

  switch (kind) {
    case "none":
      return [];

    case "closed-filled":
    case "datum-filled":
      return [filledTriangle(tip, from, size, fillMaterial)];

    case "closed-blank":
    case "datum-blank":
      return [triangleOutline(tip, from, size, lineMaterial)];

    case "open":
    case "open30":
      return [openArrowStrokes(tip, from, size, ARROW_BASE_WIDTH_DIVISOR, lineMaterial)];

    case "open-arrow":
      return [openArrowStrokes(tip, from, size, 2, lineMaterial)];

    case "tick":
      return [tickStroke(tip, from, size, lineMaterial)];

    case "dot":
      return [filledDot(tip, size / 2, fillMaterial)];

    case "dot-small":
      return [filledDot(tip, size / 4, fillMaterial)];

    case "dot-blank":
      return [dotOutline(tip, size / 2, lineMaterial)];

    case "dot-small-blank":
      return [dotOutline(tip, size / 4, lineMaterial)];

    case "origin":
      return [dotOutline(tip, size / 2, lineMaterial)];

    case "origin2":
      return [
        dotOutline(tip, size / 2, lineMaterial),
        dotOutline(tip, size / 4, lineMaterial),
      ];

    case "box":
      return [boxOutline(tip, size / 4, from, tip, lineMaterial)];

    case "box-filled":
      return [filledBox(tip, size / 4, from, tip, fillMaterial)];

    case "integral":
      return [integralStroke(tip, from, size, lineMaterial)];
  }
};
