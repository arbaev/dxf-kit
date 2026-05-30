import { shallowRef } from "vue";
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
  usePointerTool,
  ensurePositionCapacity,
  isTypingTarget,
} from "./usePointerTool";

/**
 * Result of a completed (3-point) angle measurement. Emitted via `onResult`
 * once the third click locks the second ray.
 */
export interface AngleMeasureResult {
  /** Apex of the angle (first click) in DXF world coordinates. */
  vertex: MeasurePoint;
  /** End of the first ray (second click). */
  p1: MeasurePoint;
  /** End of the second ray (third click). */
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
  /** Live cursor position in DXF world coords while drafting (null once closed). */
  hoverWorld: MeasurePoint | null;
  /** True once the third point is placed and a result emitted. */
  closed: boolean;
}

export interface AngleMeasureCallbacks {
  /** Fired when the third point is placed — the measurement is complete. */
  onResult?: (result: AngleMeasureResult) => void;
  /** Fired whenever the internal state changes (point added/removed, hover, reset). */
  onChange?: (state: AngleMeasureState) => void;
  /** Fired when Esc aborts an in-flight measurement OR `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
  /**
   * Optional geometry-snap resolver. Maps a raw world point + screen coords to
   * a possibly-snapped world point and drives the snap marker. Called on every
   * pointer move (so the marker tracks geometry) and on click.
   */
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

const emptyState = (): AngleMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
});

/**
 * 3-point angle-measurement tool (AutoCAD-style), built on the shared
 * {@link usePointerTool} pipeline.
 *
 * Flow (states keyed by committed-point count):
 *   - `empty` → click places the vertex (apex).
 *   - `one`   → a preview ray follows the cursor (the first ray).
 *   - `two`   → vertex + first ray locked; the second ray + arc + label follow
 *               the cursor. The directed CCW angle updates live, so moving the
 *               cursor past the first ray flips between `α` and `360° − α`.
 *   - `closed`→ the third click locks the second ray; rays + arc + label persist
 *               until the next click starts a fresh measurement.
 *
 * Esc aborts; Backspace removes the last placed point.
 *
 * Owns a Three.js overlay group with two ray segments (`THREE.Line` polyline
 * `[p1, vertex, p2]`), a directed-arc `THREE.Line`, and vertex `Points` markers.
 */
export function useAngleMeasurement() {
  const state = shallowRef<AngleMeasureState>(emptyState());
  const tool = usePointerTool<AngleMeasureCallbacks>();

  let units: AngleUnits = "deg";

  // Three.js overlay children (owned here; lifecycle driven by the base).
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let markerMaterial: THREE.PointsMaterial | null = null;
  let rayLine: THREE.Line | null = null;
  let arcLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;

  /**
   * Resolve the vertex and the two ray endpoints currently shown: committed
   * points, with the live cursor standing in for the not-yet-placed ray.
   */
  const displayRays = (): {
    vertex: MeasurePoint | null;
    r1: MeasurePoint | null;
    r2: MeasurePoint | null;
  } => {
    const s = state.value;
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
    const committed = state.value.points;
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
    tool.getCallbacks().onChange?.(state.value);
    refreshOverlay();
    tool.render();
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = state.value.points.length > 0 && !state.value.closed;
    state.value = emptyState();
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const closeAngle = (): void => {
    const pts = state.value.points;
    if (pts.length < 3) return;
    state.value = { points: pts, hoverWorld: null, closed: true };
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
    state.value = {
      points: [...state.value.points, world],
      hoverWorld: world,
      closed: false,
    };
    emitChange();
  };

  const popPoint = (): void => {
    if (state.value.closed || state.value.points.length === 0) return;
    const next = state.value.points.slice(0, -1);
    state.value = { points: next, hoverWorld: state.value.hoverWorld, closed: false };
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
      if (state.value.closed) {
        // A completed angle is still visible — start fresh with this as the apex.
        state.value = { points: [world], hoverWorld: world, closed: false };
        emitChange();
        return;
      }
      addPoint(world);
      // The third point completes the angle.
      if (state.value.points.length >= 3) closeAngle();
    },
    onMove: (world) => {
      if (state.value.closed) return;
      if (state.value.points.length < 1) return;
      state.value = { points: state.value.points, hoverWorld: world, closed: false };
      emitChange();
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        if (state.value.points.length > 0 || state.value.closed) {
          e.preventDefault();
          e.stopPropagation();
        }
        resetState(true);
        return;
      }
      if (e.key === "Backspace") {
        if (isTypingTarget(e.target)) return;
        if (!state.value.closed && state.value.points.length >= 1) {
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

  /** Manually clear any in-flight or completed measurement without firing `onCancel`. */
  const clear = (): void => {
    state.value = emptyState();
    emitChange();
  };

  return {
    state,
    isActive: tool.isActive,
    attach: tool.attach,
    detach: tool.detach,
    setEnabled: tool.setEnabled,
    setUnits,
    setColor: tool.setColor,
    clear,
    dispose: tool.dispose,
  };
}

/**
 * Format an angle value (given in degrees) into a short string for the
 * requested unit mode. Pure / framework-agnostic — exported for tests and
 * custom UI.
 *
 * - `"deg"` → `"123.4°"` (one decimal)
 * - `"rad"` → `"2.150 rad"` (three decimals)
 * - `"dms"` → `"123°30'15\""` (degrees-minutes-seconds, zero-padded)
 *
 * Returns an em-dash for non-finite input.
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
