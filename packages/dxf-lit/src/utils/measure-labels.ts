import * as THREE from "three";
import {
  measureArea,
  measurePerimeter,
  measureDirectedAngle,
  toDegrees,
  type MeasurePoint,
} from "dxf-render";
import {
  formatMeasureValue,
  formatAreaValue,
  formatAngleValue,
  type MeasureState,
  type MeasureUnits,
  type AreaMeasureState,
  type AreaUnitScales,
  type AngleMeasureState,
} from "dxf-interaction";
import type { AngleUnits } from "../types";

export interface MeasureLabel {
  left: number;
  top: number;
  text: string;
}

export interface AreaLabel {
  left: number;
  top: number;
  areaText: string;
  perimeterText: string;
}

interface ProjectionContext {
  camera: THREE.Camera | null;
  container: HTMLElement | null;
  offset: { x: number; y: number; z: number };
}

/**
 * Screen-space projection + formatting for the three HTML measurement labels.
 * Ported from dxf-react's `useMeasureLabels`: each `compute*` is a pure
 * function the Lit element calls from a getter in `render()`; the host bumps a
 * re-render on `controls.change` so the labels follow camera pan/zoom (the
 * Three.js overlays follow the camera natively).
 */
export function computeMeasureLabel(opts: {
  ctx: ProjectionContext;
  state: MeasureState;
  measureUnitsScale: number;
  currentMeasureUnits: MeasureUnits;
}): MeasureLabel | null {
  const { ctx, state, measureUnitsScale, currentMeasureUnits } = opts;
  if (state.points.length === 0) return null;
  const p1 = state.points[0];
  const p2 = state.points[1] ?? state.hoverWorld;
  if (!p2) return null;
  const { camera, container } = ctx;
  if (!camera || !container) return null;
  const offset = ctx.offset;
  const mid = new THREE.Vector3((p1.x + p2.x) / 2 - offset.x, (p1.y + p2.y) / 2 - offset.y, 0);
  mid.project(camera);
  const rect = container.getBoundingClientRect();
  const left = (mid.x + 1) * 0.5 * rect.width;
  const top = (-mid.y + 1) * 0.5 * rect.height;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const scaled = distance * measureUnitsScale;
  return { left, top, text: formatMeasureValue(scaled, currentMeasureUnits) };
}

export function computeAreaLabel(opts: {
  ctx: ProjectionContext;
  state: AreaMeasureState;
  areaUnitScales: AreaUnitScales;
}): AreaLabel | null {
  const { ctx, state, areaUnitScales } = opts;
  const committed = state.points;
  if (committed.length < 2 && !state.closed) return null;
  const poly = state.closed
    ? committed
    : state.hoverWorld
      ? [...committed, state.hoverWorld]
      : committed;
  if (poly.length < 2) return null;
  const { camera, container } = ctx;
  if (!camera || !container) return null;
  const offset = ctx.offset;
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  cx /= poly.length;
  cy /= poly.length;
  const center = new THREE.Vector3(cx - offset.x, cy - offset.y, 0);
  center.project(camera);
  const rect = container.getBoundingClientRect();
  const left = (center.x + 1) * 0.5 * rect.width;
  const top = (-center.y + 1) * 0.5 * rect.height;
  const showArea = committed.length >= 3;
  const areaRaw = measureArea(poly);
  const perimeterRaw = measurePerimeter(poly);
  return {
    left,
    top,
    areaText: showArea
      ? formatAreaValue(areaRaw * areaUnitScales.areaScale, areaUnitScales.areaLabel)
      : "—",
    perimeterText: formatAreaValue(
      perimeterRaw * areaUnitScales.perimeterScale,
      areaUnitScales.lengthLabel,
    ),
  };
}

export function computeAngleLabel(opts: {
  ctx: ProjectionContext;
  state: AngleMeasureState;
  measureAngleUnits: AngleUnits;
}): MeasureLabel | null {
  const { ctx, state, measureAngleUnits } = opts;
  const pts = state.points;
  const vertex = pts[0];
  if (!vertex) return null;
  let p1: MeasurePoint | null = null;
  let p2: MeasurePoint | null = null;
  if (state.closed && pts.length >= 3) {
    p1 = pts[1];
    p2 = pts[2];
  } else if (pts.length === 2) {
    p1 = pts[1];
    p2 = state.hoverWorld;
  }
  if (!p1 || !p2) return null;
  const { camera, container } = ctx;
  if (!camera || !container) return null;
  const offset = ctx.offset;
  const directed = measureDirectedAngle(vertex, p1, p2);
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const bisector = a1 + directed / 2;
  const v = new THREE.Vector3(vertex.x - offset.x, vertex.y - offset.y, 0);
  v.project(camera);
  const rect = container.getBoundingClientRect();
  const vLeft = (v.x + 1) * 0.5 * rect.width;
  const vTop = (-v.y + 1) * 0.5 * rect.height;
  const pxOut = 44;
  // Screen Y grows downward, so the world-Y bisector component flips sign.
  const left = vLeft + Math.cos(bisector) * pxOut;
  const top = vTop - Math.sin(bisector) * pxOut;
  return { left, top, text: formatAngleValue(toDegrees(directed), measureAngleUnits) };
}
