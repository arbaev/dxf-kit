import { useCallback, useMemo, useState } from "react";
import * as THREE from "three";
import {
  measureArea,
  measurePerimeter,
  measureDirectedAngle,
  toDegrees,
  type MeasurePoint,
} from "dxf-render";
import { formatMeasureValue, type MeasureState, type MeasureUnits } from "./useMeasurement";
import { formatAreaValue, type AreaMeasureState, type AreaUnitScales } from "./useAreaMeasurement";
import { formatAngleValue, type AngleMeasureState } from "./useAngleMeasurement";
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

/**
 * Positions and formats the three HTML overlay labels for the measurement tools.
 * Each label is a screen-projected `useMemo` that re-evaluates on camera
 * pan/zoom via the `cameraTick` this hook owns — call {@link bumpCameraTick}
 * from the host's `controls.change`.
 */
export function useMeasureLabels(opts: {
  getCamera: () => THREE.Camera | null;
  getContainer: () => HTMLElement | null;
  getOriginOffset: () => { x: number; y: number; z: number };
  measureState: MeasureState;
  areaState: AreaMeasureState;
  angleState: AngleMeasureState;
  measureUnitsScale: number;
  currentMeasureUnits: MeasureUnits;
  areaUnitScales: AreaUnitScales;
  measureAngleUnits: AngleUnits;
}) {
  const {
    getCamera,
    getContainer,
    getOriginOffset,
    measureState,
    areaState,
    angleState,
    measureUnitsScale,
    currentMeasureUnits,
    areaUnitScales,
    measureAngleUnits,
  } = opts;

  // Bumped on every `controls.change` so the screen-projecting memos recompute
  // when the camera pans / zooms. (Three.js overlays follow the camera natively;
  // this only drags React's render along.)
  const [cameraTick, setCameraTick] = useState(0);
  const bumpCameraTick = useCallback((): void => {
    setCameraTick((t) => t + 1);
  }, []);

  const measureLabel = useMemo<MeasureLabel | null>(() => {
    void cameraTick;
    const st = measureState;
    if (st.points.length === 0) return null;
    const p1 = st.points[0];
    const p2 = st.points[1] ?? st.hoverWorld;
    if (!p2) return null;
    const cam = getCamera();
    const container = getContainer();
    if (!cam || !container) return null;
    const offset = getOriginOffset();
    const mid = new THREE.Vector3((p1.x + p2.x) / 2 - offset.x, (p1.y + p2.y) / 2 - offset.y, 0);
    mid.project(cam);
    const rect = container.getBoundingClientRect();
    const left = (mid.x + 1) * 0.5 * rect.width;
    const top = (-mid.y + 1) * 0.5 * rect.height;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const scaled = distance * measureUnitsScale;
    return { left, top, text: formatMeasureValue(scaled, currentMeasureUnits) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTick, measureState, measureUnitsScale, currentMeasureUnits, getCamera, getContainer, getOriginOffset]);

  const areaLabel = useMemo<AreaLabel | null>(() => {
    void cameraTick;
    const st = areaState;
    const committed = st.points;
    if (committed.length < 2 && !st.closed) return null;
    const poly = st.closed
      ? committed
      : st.hoverWorld
        ? [...committed, st.hoverWorld]
        : committed;
    if (poly.length < 2) return null;
    const cam = getCamera();
    const container = getContainer();
    if (!cam || !container) return null;
    const offset = getOriginOffset();
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p.x;
      cy += p.y;
    }
    cx /= poly.length;
    cy /= poly.length;
    const center = new THREE.Vector3(cx - offset.x, cy - offset.y, 0);
    center.project(cam);
    const rect = container.getBoundingClientRect();
    const left = (center.x + 1) * 0.5 * rect.width;
    const top = (-center.y + 1) * 0.5 * rect.height;
    const scales = areaUnitScales;
    const showArea = committed.length >= 3;
    const areaRaw = measureArea(poly);
    const perimeterRaw = measurePerimeter(poly);
    return {
      left,
      top,
      areaText: showArea ? formatAreaValue(areaRaw * scales.areaScale, scales.areaLabel) : "—",
      perimeterText: formatAreaValue(perimeterRaw * scales.perimeterScale, scales.lengthLabel),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTick, areaState, areaUnitScales, getCamera, getContainer, getOriginOffset]);

  const angleLabel = useMemo<MeasureLabel | null>(() => {
    void cameraTick;
    const st = angleState;
    const pts = st.points;
    const vertex = pts[0];
    if (!vertex) return null;
    let p1: MeasurePoint | null = null;
    let p2: MeasurePoint | null = null;
    if (st.closed && pts.length >= 3) {
      p1 = pts[1];
      p2 = pts[2];
    } else if (pts.length === 2) {
      p1 = pts[1];
      p2 = st.hoverWorld;
    }
    if (!p1 || !p2) return null;
    const cam = getCamera();
    const container = getContainer();
    if (!cam || !container) return null;
    const offset = getOriginOffset();
    const directed = measureDirectedAngle(vertex, p1, p2);
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const bisector = a1 + directed / 2;
    const v = new THREE.Vector3(vertex.x - offset.x, vertex.y - offset.y, 0);
    v.project(cam);
    const rect = container.getBoundingClientRect();
    const vLeft = (v.x + 1) * 0.5 * rect.width;
    const vTop = (-v.y + 1) * 0.5 * rect.height;
    const pxOut = 44;
    // Screen Y grows downward, so the world-Y bisector component flips sign.
    const left = vLeft + Math.cos(bisector) * pxOut;
    const top = vTop - Math.sin(bisector) * pxOut;
    return { left, top, text: formatAngleValue(toDegrees(directed), measureAngleUnits) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTick, angleState, measureAngleUnits, getCamera, getContainer, getOriginOffset]);

  return { bumpCameraTick, measureLabel, areaLabel, angleLabel };
}
