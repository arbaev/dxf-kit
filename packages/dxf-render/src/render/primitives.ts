import * as THREE from "three";
import type { Font } from "opentype.js";
import type { DxfLayer, DxfLineType, DxfStyle, DxfDimStyle, DxfMLeaderStyle } from "@/types/dxf";
import { MaterialCacheStore } from "./materialCache";
import { isThemeAdaptiveColor } from "@/utils/colorResolver";
import { applyLinetypePattern, type PatternGeometry } from "@/utils/linetypeResolver";
import {
  EPSILON,
  CIRCLE_SEGMENTS,
  MIN_ARC_SEGMENTS,
  DEGREES_TO_RADIANS_DIVISOR,
  POINT_MARKER_SIZE,
  LINETYPE_DOT_SIZE,
} from "@/constants";

/** Color resolution context — needed by ALL entity handlers */
export interface ColorContext {
  layers: Record<string, DxfLayer>;
  blockColor?: string;
}

/** Linetype resolution context */
export interface LinetypeContext {
  lineTypes: Record<string, DxfLineType>;
  globalLtScale: number;
  headerLtScale: number;
  blockLineType?: string;
}

/** Text rendering context */
export interface TextContext {
  font: Font;
  serifFont?: Font;
  styles?: Record<string, DxfStyle>;
  defaultTextHeight: number;
  mirrText?: boolean;
}

/** Dimension rendering context */
export interface DimensionContext {
  dimVars: import("./dimensions").DimVars;
  dimStyles?: Record<string, DxfDimStyle>;
  headerDimlunit?: number;
  headerDimdec?: number;
  headerDimadec?: number;
  headerDimzin?: number;
  headerDimtad?: number;
  headerDimtih?: number;
  headerDimtoh?: number;
  headerDimgap?: number;
  headerDimtmove?: number;
  blockHandleToName?: Map<string, string>;
}

/** Full rendering context — composition of all sub-contexts */
export interface RenderContext extends ColorContext, LinetypeContext {
  materials: MaterialCacheStore;
  font?: Font; // Vector text font (null = canvas fallback)
  serifFont?: Font; // Lazy-loaded serif font for serif text styles
  styles?: Record<string, DxfStyle>; // STYLE table for font classification
  defaultTextHeight: number; // $TEXTSIZE from header (fallback for entities without explicit height)
  mirrText?: boolean; // $MIRRTEXT: true = mirror text with geometry, false (default) = keep readable
  pdMode?: number; // $PDMODE header variable (point display mode)
  pointDisplaySize?: number; // Computed PDSIZE in drawing units
  dimVars?: import("./dimensions").DimVars; // Resolved dimension variables
  dimStyles?: Record<string, DxfDimStyle>; // DIMSTYLE table for dimension formatting
  mLeaderStyles?: Record<string, DxfMLeaderStyle>; // MLEADERSTYLE objects keyed by handle (uppercase)
  headerDimlunit?: number; // $DIMLUNIT from header (fallback for dimension formatting)
  headerDimdec?: number; // $DIMDEC from header (fallback for decimal places / architectural fraction precision)
  headerDimadec?: number; // $DIMADEC from header (fallback for angular dimension decimal places)
  headerDimzin?: number; // $DIMZIN from header (fallback for zero-suppression flags)
  headerDimtad?: number; // $DIMTAD from header (text vertical position relative to dim line)
  headerDimtih?: number; // $DIMTIH from header (text inside arc/dim — aligned or horizontal)
  headerDimtoh?: number; // $DIMTOH from header (text outside arc/dim — aligned or horizontal)
  headerDimgap?: number; // $DIMGAP from header (gap between dim line and text, break-radius around text)
  headerDimtmove?: number; // $DIMTMOVE from header (text movement strategy when user moves text)
  blockHandleToName?: Map<string, string>; // BLOCK_RECORD handle → name (for DIMBLK resolution)
  styleHandleToName?: Map<string, string>; // STYLE handle → name (for DIMTXSTY resolution)
  xlineClipSize?: number; // Half-length for clipping XLINE/RAY to drawing extents
  originOffset?: { x: number; y: number; z: number }; // Subtracted from coords for Float32 precision
}

/** @deprecated Use RenderContext instead */
export type EntityColorContext = RenderContext;

export const degreesToRadians = (degrees: number): number =>
  (degrees * Math.PI) / DEGREES_TO_RADIANS_DIVISOR;

export const getLineMaterial = (
  color: string,
  store: MaterialCacheStore,
): THREE.LineBasicMaterial => {
  let mat = store.line.get(color);
  if (!mat) {
    const resolved = isThemeAdaptiveColor(color) ? store.resolveColor(color) : color;
    mat = new THREE.LineBasicMaterial({ color: resolved, depthTest: false, depthWrite: false });
    store.line.set(color, mat);
    if (isThemeAdaptiveColor(color)) store.trackThemeMaterial(mat, color);
  }
  return mat;
};

export const getMeshMaterial = (
  color: string,
  store: MaterialCacheStore,
): THREE.MeshBasicMaterial => {
  let mat = store.mesh.get(color);
  if (!mat) {
    const resolved = isThemeAdaptiveColor(color) ? store.resolveColor(color) : color;
    mat = new THREE.MeshBasicMaterial({ color: resolved, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    store.mesh.set(color, mat);
    if (isThemeAdaptiveColor(color)) store.trackThemeMaterial(mat, color);
  }
  return mat;
};

export const getPointsMaterial = (
  color: string,
  store: MaterialCacheStore,
): THREE.PointsMaterial => {
  let mat = store.points.get(color);
  if (!mat) {
    const resolved = isThemeAdaptiveColor(color) ? store.resolveColor(color) : color;
    mat = new THREE.PointsMaterial({
      color: resolved,
      size: POINT_MARKER_SIZE,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    });
    store.points.set(color, mat);
    if (isThemeAdaptiveColor(color)) store.trackThemeMaterial(mat, color);
  }
  return mat;
};

/**
 * Create a line from points. When a linetype pattern is provided,
 * the polyline is split into dash/gap segments (LineSegments) and
 * dot positions (Points). Without a pattern, a regular continuous Line is returned.
 */
export const createLine = (
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial,
  pattern?: number[],
): THREE.Object3D => {
  if (pattern && pattern.length > 0) {
    const pg: PatternGeometry = applyLinetypePattern(points, pattern);
    const hasSegments = pg.segments.length >= 6;
    const hasDots = pg.dots.length >= 3;

    if (hasSegments || hasDots) {
      // If only segments (no dots), return LineSegments directly
      if (hasSegments && !hasDots) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(pg.segments, 3));
        return new THREE.LineSegments(geometry, material);
      }

      // If dots present, group segments + points together
      const group = new THREE.Group();

      if (hasSegments) {
        const segGeo = new THREE.BufferGeometry();
        segGeo.setAttribute("position", new THREE.Float32BufferAttribute(pg.segments, 3));
        group.add(new THREE.LineSegments(segGeo, material));
      }

      if (hasDots) {
        const dotGeo = new THREE.BufferGeometry();
        dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(pg.dots, 3));
        const dotMat = new THREE.PointsMaterial({
          color: material.color,
          size: LINETYPE_DOT_SIZE,
          sizeAttenuation: false,
          depthTest: false,
          depthWrite: false,
        });
        group.add(new THREE.Points(dotGeo, dotMat));
      }

      return group;
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, material);
};

/**
 * Create an arc from two points with a bulge coefficient.
 * bulge = tan(angle/4), where angle is the central arc angle.
 */
export const createBulgeArc = (
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  bulge: number,
): THREE.Vector3[] => {
  if (Math.abs(bulge) < EPSILON) {
    return [p1, p2];
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chordLength = Math.sqrt(dx * dx + dy * dy);

  if (chordLength < EPSILON) {
    return [p1, p2];
  }

  // Central angle: bulge = tan(theta/4) => theta = 4 * atan(bulge)
  const theta = 4 * Math.atan(bulge);

  // Radius: r = chordLength / (2 * sin(theta/2))
  const radius = chordLength / (2 * Math.sin(theta / 2));

  // Distance from chord midpoint to circle center (signed).
  // Sign is automatically correct since theta and radius carry the bulge sign.
  const h = radius * Math.cos(theta / 2);

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const chordDirX = dx / chordLength;
  const chordDirY = dy / chordLength;

  // Perpendicular to chord (rotated 90 degrees CCW)
  const perpX = -chordDirY;
  const perpY = chordDirX;

  // Center offset: for bulge > 0 and theta < pi, center is to the right of chord;
  // for theta > pi, center flips to the left (and vice versa for negative bulge)
  const centerX = midX + perpX * h;
  const centerY = midY + perpY * h;

  const startAngle = Math.atan2(p1.y - centerY, p1.x - centerX);
  const endAngle = Math.atan2(p2.y - centerY, p2.x - centerX);

  let sweepAngle = endAngle - startAngle;

  // Normalize to [-pi, pi]
  while (sweepAngle > Math.PI) sweepAngle -= 2 * Math.PI;
  while (sweepAngle < -Math.PI) sweepAngle += 2 * Math.PI;

  // Adjust direction based on bulge sign
  if (bulge > 0 && sweepAngle < 0) {
    sweepAngle += 2 * Math.PI;
  } else if (bulge < 0 && sweepAngle > 0) {
    sweepAngle -= 2 * Math.PI;
  }

  const segments = Math.max(
    MIN_ARC_SEGMENTS,
    Math.floor((Math.abs(sweepAngle) * CIRCLE_SEGMENTS) / (2 * Math.PI)),
  );

  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const currentAngle = startAngle + sweepAngle * t;
    const x = centerX + Math.abs(radius) * Math.cos(currentAngle);
    const y = centerY + Math.abs(radius) * Math.sin(currentAngle);
    points.push(new THREE.Vector3(x, y, 0));
  }

  return points;
};

export const setLayerName = (obj: THREE.Object3D | THREE.Object3D[], layerName: string) => {
  if (Array.isArray(obj)) {
    obj.forEach((o) => {
      o.userData.layerName = layerName;
    });
  } else {
    obj.userData.layerName = layerName;
  }
};
