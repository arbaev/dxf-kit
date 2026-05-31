import { useRef, useState } from "react";
import * as THREE from "three";
import {
  measureDirectedAngle,
  toDegrees,
  ANGLE_ARC_RADIUS_FRACTION,
  ANGLE_ARC_MIN_PX,
  ANGLE_ARC_MAX_PX,
  ANGLE_ARC_SEGMENTS_PER_TURN,
  type MeasurePoint,
} from "dxf-render";
import type { AngleUnits } from "../types";
import {
  createPointerTool,
  ensurePositionCapacity,
  isTypingTarget,
  type PointerTool,
} from "./usePointerTool";

/** Result of a completed (3-point) angle measurement. */
export interface AngleMeasureResult {
  vertex: MeasurePoint;
  p1: MeasurePoint;
  p2: MeasurePoint;
  /** Directed angle swept CCW from ray `vertex→p1` to `vertex→p2`, radians `[0, 2π)`. */
  radians: number;
  /** The same angle in degrees `[0, 360)`. */
  degrees: number;
  /** True when the measured angle is reflex (> 180°). */
  reflex: boolean;
  /** The display-unit mode active at the moment of measurement. */
  units: AngleUnits;
}

export interface AngleMeasureState {
  /** 0–3 committed points: `[vertex]`, `[vertex, p1]`, or `[vertex, p1, p2]`. */
  points: MeasurePoint[];
  hoverWorld: MeasurePoint | null;
  closed: boolean;
}

export interface AngleMeasureCallbacks {
  onResult?: (result: AngleMeasureResult) => void;
  onChange?: (state: AngleMeasureState) => void;
  onCancel?: () => void;
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

const emptyState = (): AngleMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
});

export interface AngleMeasurementController {
  attach: PointerTool<AngleMeasureCallbacks>["attach"];
  detach: () => void;
  setEnabled: (on: boolean) => void;
  setUnits: (next: AngleUnits) => void;
  setColor: (color: string) => void;
  clear: () => void;
  dispose: () => void;
}

/**
 * 3-point angle-measurement state machine on top of {@link createPointerTool}.
 * The authoritative `stateRef` is mirrored to React state via `pushState` for
 * the HTML label.
 */
function createAngleMeasurementController(
  pushState: (state: AngleMeasureState) => void,
): AngleMeasurementController {
  const stateRef = { current: emptyState() };
  const tool = createPointerTool<AngleMeasureCallbacks>();

  let units: AngleUnits = "deg";

  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let markerMaterial: THREE.PointsMaterial | null = null;
  let rayLine: THREE.Line | null = null;
  let arcLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;

  const displayRays = (): {
    vertex: MeasurePoint | null;
    r1: MeasurePoint | null;
    r2: MeasurePoint | null;
  } => {
    const s = stateRef.current;
    const pts = s.points;
    if (pts.length === 1) {
      return { vertex: pts[0], r1: s.closed ? null : s.hoverWorld, r2: null };
    }
    if (pts.length === 2) {
      return { vertex: pts[0], r1: pts[1], r2: s.closed ? null : s.hoverWorld };
    }
    if (pts.length >= 3) {
      return { vertex: pts[0], r1: pts[1], r2: pts[2] };
    }
    return { vertex: null, r1: null, r2: null };
  };

  const refreshOverlay = (): void => {
    tool.ensureOverlay();
    if (!rayLine || !arcLine || !markerPoints) return;

    const offset = tool.getOffset();
    const committed = stateRef.current.points;
    const { vertex, r1, r2 } = displayRays();

    // Ray polyline: [r1, vertex, r2], skipping endpoints that aren't set yet.
    const rayPts: MeasurePoint[] = [];
    if (vertex) {
      if (r1) rayPts.push(r1);
      rayPts.push(vertex);
      if (r2) rayPts.push(r2);
    }
    if (rayPts.length >= 2) {
      const arr = ensurePositionCapacity(rayLine.geometry, rayPts.length);
      for (let i = 0; i < rayPts.length; i++) {
        arr[i * 3] = rayPts[i].x - offset.x;
        arr[i * 3 + 1] = rayPts[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = rayLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      rayLine.geometry.setDrawRange(0, rayPts.length);
      rayLine.geometry.computeBoundingSphere();
      rayLine.visible = true;
    } else {
      rayLine.visible = false;
    }

    // Directed arc between the two rays (needs both rays present).
    if (vertex && r1 && r2) {
      const len1 = Math.hypot(r1.x - vertex.x, r1.y - vertex.y);
      const len2 = Math.hypot(r2.x - vertex.x, r2.y - vertex.y);
      const minRay = Math.min(len1, len2);
      const directed = measureDirectedAngle(vertex, r1, r2);
      if (minRay > 0 && directed > 0) {
        const wpp = tool.worldPerPixel();
        let radius = ANGLE_ARC_RADIUS_FRACTION * minRay;
        radius = Math.max(ANGLE_ARC_MIN_PX * wpp, Math.min(radius, ANGLE_ARC_MAX_PX * wpp));
        // Never let the arc overshoot the shorter ray.
        radius = Math.min(radius, minRay * 0.9);
        const a1 = Math.atan2(r1.y - vertex.y, r1.x - vertex.x);
        const segs = Math.max(2, Math.ceil((directed / (Math.PI * 2)) * ANGLE_ARC_SEGMENTS_PER_TURN));
        const arr = ensurePositionCapacity(arcLine.geometry, segs + 1);
        for (let i = 0; i <= segs; i++) {
          const ang = a1 + directed * (i / segs);
          arr[i * 3] = vertex.x + radius * Math.cos(ang) - offset.x;
          arr[i * 3 + 1] = vertex.y + radius * Math.sin(ang) - offset.y;
          arr[i * 3 + 2] = 0;
        }
        const attr = arcLine.geometry.getAttribute("position") as THREE.BufferAttribute;
        attr.needsUpdate = true;
        arcLine.geometry.setDrawRange(0, segs + 1);
        arcLine.geometry.computeBoundingSphere();
        arcLine.visible = true;
      } else {
        arcLine.visible = false;
      }
    } else {
      arcLine.visible = false;
    }

    // Vertex markers (committed only).
    if (committed.length >= 1) {
      const arr = ensurePositionCapacity(markerPoints.geometry, committed.length);
      for (let i = 0; i < committed.length; i++) {
        arr[i * 3] = committed[i].x - offset.x;
        arr[i * 3 + 1] = committed[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = markerPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      markerPoints.geometry.setDrawRange(0, committed.length);
      markerPoints.visible = true;
    } else {
      markerPoints.visible = false;
    }
  };

  const emitChange = (): void => {
    tool.getCallbacks().onChange?.(stateRef.current);
    refreshOverlay();
    tool.render();
    pushState(stateRef.current);
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = stateRef.current.points.length > 0 && !stateRef.current.closed;
    stateRef.current = emptyState();
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const closeAngle = (): void => {
    const pts = stateRef.current.points;
    if (pts.length < 3) return;
    stateRef.current = { points: pts, hoverWorld: null, closed: true };
    emitChange();
    const [v, p1, p2] = pts;
    const radians = measureDirectedAngle(v, p1, p2);
    const degrees = toDegrees(radians);
    tool.getCallbacks().onResult?.({
      vertex: { x: v.x, y: v.y, z: v.z ?? 0 },
      p1: { x: p1.x, y: p1.y, z: p1.z ?? 0 },
      p2: { x: p2.x, y: p2.y, z: p2.z ?? 0 },
      radians,
      degrees,
      reflex: degrees > 180,
      units,
    });
  };

  const addPoint = (world: MeasurePoint): void => {
    stateRef.current = {
      points: [...stateRef.current.points, world],
      hoverWorld: world,
      closed: false,
    };
    emitChange();
  };

  const popPoint = (): void => {
    if (stateRef.current.closed || stateRef.current.points.length === 0) return;
    const next = stateRef.current.points.slice(0, -1);
    stateRef.current = { points: next, hoverWorld: stateRef.current.hoverWorld, closed: false };
    emitChange();
  };

  tool.configure({
    overlayName: "dxf-angle-measurement-overlay",
    buildOverlay: (group, color) => {
      const c = new THREE.Color(color);
      lineMaterial = new THREE.LineBasicMaterial({
        color: c.clone(),
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95,
      });
      markerMaterial = new THREE.PointsMaterial({
        color: c.clone(),
        size: 8,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      });

      // Two ray segments share a single 3-vertex polyline [p1, vertex, p2].
      const rayGeom = new THREE.BufferGeometry();
      rayGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
      rayGeom.setDrawRange(0, 0);
      rayLine = new THREE.Line(rayGeom, lineMaterial);
      rayLine.visible = false;
      group.add(rayLine);

      const arcGeom = new THREE.BufferGeometry();
      arcGeom.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array((ANGLE_ARC_SEGMENTS_PER_TURN + 1) * 3), 3),
      );
      arcGeom.setDrawRange(0, 0);
      arcLine = new THREE.Line(arcGeom, lineMaterial);
      arcLine.visible = false;
      group.add(arcLine);

      const markerGeom = new THREE.BufferGeometry();
      markerGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
      markerGeom.setDrawRange(0, 0);
      markerPoints = new THREE.Points(markerGeom, markerMaterial);
      markerPoints.visible = false;
      group.add(markerPoints);
    },
    disposeOverlay: () => {
      rayLine?.geometry.dispose();
      arcLine?.geometry.dispose();
      markerPoints?.geometry.dispose();
      lineMaterial?.dispose();
      markerMaterial?.dispose();
      rayLine = null;
      arcLine = null;
      markerPoints = null;
      lineMaterial = null;
      markerMaterial = null;
    },
    applyColor: (color) => {
      const c = new THREE.Color(color);
      lineMaterial?.color.set(c);
      markerMaterial?.color.set(c);
    },
    onCommit: (raw, e) => {
      const world = tool.applySnap(raw, e.clientX, e.clientY);
      if (stateRef.current.closed) {
        // A completed angle is still visible — start fresh with this as the apex.
        stateRef.current = { points: [world], hoverWorld: world, closed: false };
        emitChange();
        return;
      }
      addPoint(world);
      // The third point completes the angle.
      if (stateRef.current.points.length >= 3) closeAngle();
    },
    onMove: (world) => {
      if (stateRef.current.closed) return;
      if (stateRef.current.points.length < 1) return;
      stateRef.current = { points: stateRef.current.points, hoverWorld: world, closed: false };
      emitChange();
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        if (stateRef.current.points.length > 0 || stateRef.current.closed) {
          e.preventDefault();
          e.stopPropagation();
        }
        resetState(true);
        return;
      }
      if (e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (!stateRef.current.closed && stateRef.current.points.length >= 1) {
          e.preventDefault();
          popPoint();
        }
      }
    },
    reset: resetState,
  });

  const setUnits = (next: AngleUnits): void => {
    units = next;
  };

  const clear = (): void => {
    stateRef.current = emptyState();
    emitChange();
  };

  return {
    attach: tool.attach,
    detach: tool.detach,
    setEnabled: tool.setEnabled,
    setUnits,
    setColor: tool.setColor,
    clear,
    dispose: tool.dispose,
  };
}

export interface UseAngleMeasurementResult {
  /** Reactive angle-measurement state (consumed by `useMeasureLabels`). */
  state: AngleMeasureState;
  attach: AngleMeasurementController["attach"];
  detach: AngleMeasurementController["detach"];
  setEnabled: AngleMeasurementController["setEnabled"];
  setUnits: AngleMeasurementController["setUnits"];
  setColor: AngleMeasurementController["setColor"];
  clear: AngleMeasurementController["clear"];
  dispose: AngleMeasurementController["dispose"];
}

/**
 * React hook for the 3-point angle-measurement tool. Returns a STABLE object
 * reference (see `useMeasurement` for why); `state` is a live property updated
 * by the controller, paired with a `forceRender`.
 */
export function useAngleMeasurement(): UseAngleMeasurementResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseAngleMeasurementResult | null>(null);
  if (ref.current === null) {
    const result = { state: emptyState() } as unknown as UseAngleMeasurementResult;
    const controller = createAngleMeasurementController((state) => {
      result.state = state;
      forceRender((v) => v + 1);
    });
    result.attach = controller.attach;
    result.detach = controller.detach;
    result.setEnabled = controller.setEnabled;
    result.setUnits = controller.setUnits;
    result.setColor = controller.setColor;
    result.clear = controller.clear;
    result.dispose = controller.dispose;
    ref.current = result;
  }
  return ref.current;
}

/**
 * Format an angle value (given in degrees) into a short string for the
 * requested unit mode. Pure / framework-agnostic.
 *
 * - `"deg"` → `"123.4°"` (one decimal)
 * - `"rad"` → `"2.150 rad"` (three decimals)
 * - `"dms"` → `"123°30'15\""` (degrees-minutes-seconds, zero-padded)
 */
export function formatAngleValue(degrees: number, units: AngleUnits): string {
  if (!Number.isFinite(degrees)) return "—";
  if (units === "rad") {
    const rad = (degrees * Math.PI) / 180;
    return `${rad.toFixed(3)} rad`;
  }
  if (units === "dms") {
    const sign = degrees < 0 ? "-" : "";
    const total = Math.abs(degrees);
    let d = Math.floor(total);
    let m = Math.floor((total - d) * 60);
    let s = Math.round(((total - d) * 60 - m) * 60);
    if (s === 60) {
      s = 0;
      m += 1;
    }
    if (m === 60) {
      m = 0;
      d += 1;
    }
    return `${sign}${d}°${m.toString().padStart(2, "0")}'${s.toString().padStart(2, "0")}"`;
  }
  return `${degrees.toFixed(1)}°`;
}
