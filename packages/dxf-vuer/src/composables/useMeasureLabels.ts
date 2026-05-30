import { ref, computed, type Ref } from "vue";
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

/**
 * Positions and formats the three HTML overlay labels for the measurement tools
 * (distance / area / angle). Each label is a screen-projected computed; they
 * re-evaluate on camera pan/zoom via the `cameraTick` this composable owns —
 * call {@link bumpCameraTick} from the host's `controls.change` subscription.
 */
export function useMeasureLabels(opts: {
  getCamera: () => THREE.Camera | null;
  getContainer: () => HTMLElement | null;
  getOriginOffset: () => { x: number; y: number; z: number };
  measureState: Ref<MeasureState>;
  areaState: Ref<AreaMeasureState>;
  angleState: Ref<AngleMeasureState>;
  measureUnitsScale: Ref<number>;
  currentMeasureUnits: Ref<MeasureUnits>;
  areaUnitScales: Ref<AreaUnitScales>;
  measureAngleUnits: () => AngleUnits;
}) {
  // Bumped on every `controls.change` so screen-space-projecting computeds
  // re-evaluate when the camera pans / zooms but no Vue ref otherwise changed.
  // Three.js scene overlays already follow the camera natively — this ref exists
  // purely to drag Vue's reactivity along.
  const cameraTick = ref(0);
  const bumpCameraTick = (): void => {
    cameraTick.value++;
  };

  // HTML-overlay label placed at the midpoint of the in-flight or completed
  // segment. Re-computed reactively against camera position / state changes.
  const measureLabel = computed<{ left: number; top: number; text: string } | null>(() => {
    // Reactive dep on camera pan/zoom — value unused, only the read matters.
    void cameraTick.value;
    const st = opts.measureState.value;
    if (st.points.length === 0) return null;
    const p1 = st.points[0];
    const p2 = st.points[1] ?? st.hoverWorld;
    if (!p2) return null;
    const cam = opts.getCamera();
    const container = opts.getContainer();
    if (!cam || !container) return null;
    const offset = opts.getOriginOffset();
    const mid = new THREE.Vector3(
      (p1.x + p2.x) / 2 - offset.x,
      (p1.y + p2.y) / 2 - offset.y,
      0,
    );
    mid.project(cam);
    const rect = container.getBoundingClientRect();
    const left = (mid.x + 1) * 0.5 * rect.width;
    const top = (-mid.y + 1) * 0.5 * rect.height;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const scaled = distance * opts.measureUnitsScale.value;
    return {
      left,
      top,
      text: formatMeasureValue(scaled, opts.currentMeasureUnits.value),
    };
  });

  // HTML-overlay label for the area tool, placed at the polygon centroid. Shows
  // the perimeter from the "two" state onward and the area once ≥3 vertices are
  // placed (a 2-point shape isn't a polygon yet → area held at "—").
  const areaLabel = computed<{
    left: number;
    top: number;
    areaText: string;
    perimeterText: string;
  } | null>(() => {
    void cameraTick.value;
    const st = opts.areaState.value;
    const committed = st.points;
    if (committed.length < 2 && !st.closed) return null;
    const poly = st.closed
      ? committed
      : st.hoverWorld
        ? [...committed, st.hoverWorld]
        : committed;
    if (poly.length < 2) return null;
    const cam = opts.getCamera();
    const container = opts.getContainer();
    if (!cam || !container) return null;
    const offset = opts.getOriginOffset();
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
    const scales = opts.areaUnitScales.value;
    const showArea = committed.length >= 3;
    const areaRaw = measureArea(poly);
    const perimeterRaw = measurePerimeter(poly);
    return {
      left,
      top,
      areaText: showArea ? formatAreaValue(areaRaw * scales.areaScale, scales.areaLabel) : "—",
      perimeterText: formatAreaValue(perimeterRaw * scales.perimeterScale, scales.lengthLabel),
    };
  });

  // HTML-overlay label for the angle tool, placed just outside the vertex along
  // the angle bisector. Renders the live directed angle once both rays exist.
  const angleLabel = computed<{ left: number; top: number; text: string } | null>(() => {
    void cameraTick.value;
    const st = opts.angleState.value;
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
    const cam = opts.getCamera();
    const container = opts.getContainer();
    if (!cam || !container) return null;
    const offset = opts.getOriginOffset();
    const directed = measureDirectedAngle(vertex, p1, p2);
    const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const bisector = a1 + directed / 2;
    // Project the vertex to screen, then push the label out along the bisector.
    const v = new THREE.Vector3(vertex.x - offset.x, vertex.y - offset.y, 0);
    v.project(cam);
    const rect = container.getBoundingClientRect();
    const vLeft = (v.x + 1) * 0.5 * rect.width;
    const vTop = (-v.y + 1) * 0.5 * rect.height;
    const pxOut = 44;
    // Screen Y grows downward, so the world-Y bisector component flips sign.
    const left = vLeft + Math.cos(bisector) * pxOut;
    const top = vTop - Math.sin(bisector) * pxOut;
    return {
      left,
      top,
      text: formatAngleValue(toDegrees(directed), opts.measureAngleUnits()),
    };
  });

  return { cameraTick, bumpCameraTick, measureLabel, areaLabel, angleLabel };
}
