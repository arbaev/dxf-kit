import { shallowRef } from "vue";
import * as THREE from "three";
import { measureDistance, type MeasurePoint } from "dxf-render";
import { usePointerTool } from "./usePointerTool";

/**
 * Kind of measurement currently supported. The state machine is designed so
 * that future `"area"` and `"angle"` can be added without breaking the API.
 */
export type MeasureKind = "distance";

/**
 * Result of a completed measurement. Emitted via `onResult` once enough
 * clicks have been collected (2 for distance, N+close for area, 3 for angle).
 */
export interface MeasureResult {
  kind: MeasureKind;
  p1: MeasurePoint;
  p2: MeasurePoint;
  /** Raw value in DXF world units (Euclidean distance). */
  valueRaw: number;
  /** Value scaled to the displayed units (`valueRaw * unitsScale`). */
  value: number;
  /** The units label that was active at the moment of measurement. */
  units: MeasureUnits;
}

/** Display units. Matches `RulerUnits` from `dxf-vuer/types`. */
export type MeasureUnits = "dxf-units" | "mm" | "inch";

export interface MeasureState {
  /** 0, 1, or 2 placed points. Stored in DXF world coordinates (no offset). */
  points: MeasurePoint[];
  /** Live cursor position in DXF world coords (set while a measurement is in-flight). */
  hoverWorld: MeasurePoint | null;
}

export interface MeasureCallbacks {
  /** Fired after the second click — the measurement is complete. */
  onResult?: (result: MeasureResult) => void;
  /** Fired whenever the internal state changes (point added, hover updated, reset). */
  onChange?: (state: MeasureState) => void;
  /** Fired when Esc is pressed mid-measurement OR when `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
  /**
   * Optional geometry-snap resolver. Maps a raw world point + screen coords to
   * a possibly-snapped world point and drives the snap marker. Called on every
   * pointer move (so the marker tracks geometry) and on click (so the placed
   * point snaps). When omitted, points land exactly under the cursor.
   */
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

/**
 * Drag-state machine for the AutoCAD-style linear measurement tool, built on
 * the shared {@link usePointerTool} pointer pipeline (which owns the
 * capture-phase listeners, click-vs-pan threshold, LEFT-button steal and the
 * overlay group). This composable supplies only the distance state machine and
 * its overlay geometry.
 *
 * Flow:
 *   1. `setEnabled(true)` flips the cursor to crosshair and starts intercepting
 *      clicks.
 *   2. First click adds point A; subsequent pointermoves update `hoverWorld` so
 *      the consumer can render a live preview line.
 *   3. Second click adds point B; `onResult` fires; the segment + label persist
 *      until the next click starts a fresh measurement.
 *   4. Esc cancels an in-flight measurement; `setEnabled(false)` also clears and
 *      fires `onCancel` if there was a draft.
 *
 * The overlay group (renderOrder=999, depthTest=false) holds one `THREE.Points`
 * for the placed markers and one `THREE.Line` for the live segment.
 */
export function useMeasurement() {
  const state = shallowRef<MeasureState>({ points: [], hoverWorld: null });
  const tool = usePointerTool<MeasureCallbacks>();

  let unitsScale = 1;
  let unitsLabel: MeasureUnits = "dxf-units";

  // Three.js overlay children (owned here; lifecycle driven by the base).
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let pointsMaterial: THREE.PointsMaterial | null = null;
  let segmentLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;

  /** Update the overlay geometry to match `state`. */
  const refreshOverlay = (): void => {
    tool.ensureOverlay();
    if (!segmentLine || !markerPoints) return;

    const offset = tool.getOffset();
    const pts = state.value.points;
    const previewTo = pts.length === 1 ? state.value.hoverWorld : null;

    // Markers — one per placed point (scene-space)
    const markerAttr = markerPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const markerArr = markerAttr.array as Float32Array;
    if (pts.length === 0) {
      markerPoints.visible = false;
      markerPoints.geometry.setDrawRange(0, 0);
    } else {
      for (let i = 0; i < pts.length; i++) {
        markerArr[i * 3 + 0] = pts[i].x - offset.x;
        markerArr[i * 3 + 1] = pts[i].y - offset.y;
        markerArr[i * 3 + 2] = 0;
      }
      markerAttr.needsUpdate = true;
      markerPoints.geometry.setDrawRange(0, pts.length);
      markerPoints.visible = true;
    }

    // Live segment
    const a = pts[0];
    const b = pts[1] ?? previewTo ?? null;
    if (a && b) {
      const segAttr = segmentLine.geometry.getAttribute("position") as THREE.BufferAttribute;
      const segArr = segAttr.array as Float32Array;
      segArr[0] = a.x - offset.x;
      segArr[1] = a.y - offset.y;
      segArr[2] = 0;
      segArr[3] = b.x - offset.x;
      segArr[4] = b.y - offset.y;
      segArr[5] = 0;
      segAttr.needsUpdate = true;
      segmentLine.geometry.computeBoundingSphere();
      segmentLine.visible = true;
    } else {
      segmentLine.visible = false;
    }
  };

  const emitChange = (): void => {
    tool.getCallbacks().onChange?.(state.value);
    refreshOverlay();
    tool.render();
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = state.value.points.length > 0;
    state.value = { points: [], hoverWorld: null };
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const addPoint = (world: MeasurePoint): void => {
    const pts = state.value.points;
    if (pts.length === 0) {
      state.value = { points: [world], hoverWorld: world };
      emitChange();
      return;
    }
    if (pts.length === 1) {
      const a = pts[0];
      const b = world;
      const valueRaw = measureDistance(a, b);
      // Settle the second point and keep it visible — the line + label stay on
      // canvas until the user starts a new measurement (next click) or clears.
      state.value = { points: [a, b], hoverWorld: null };
      emitChange();
      tool.getCallbacks().onResult?.({
        kind: "distance",
        p1: a,
        p2: b,
        valueRaw,
        value: valueRaw * unitsScale,
        units: unitsLabel,
      });
      return;
    }
    // pts.length === 2 — a completed measurement is still visible. The new
    // click starts a fresh one with the clicked location as the new A.
    state.value = { points: [world], hoverWorld: world };
    emitChange();
  };

  tool.configure({
    overlayName: "dxf-measurement-overlay",
    buildOverlay: (group, color) => {
      lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95,
      });
      pointsMaterial = new THREE.PointsMaterial({
        color: new THREE.Color(color),
        size: 8,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 1,
      });

      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      segmentLine = new THREE.Line(lineGeom, lineMaterial);
      segmentLine.visible = false;
      group.add(segmentLine);

      const pointsGeom = new THREE.BufferGeometry();
      pointsGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      pointsGeom.setDrawRange(0, 0);
      markerPoints = new THREE.Points(pointsGeom, pointsMaterial);
      markerPoints.visible = false;
      group.add(markerPoints);
    },
    disposeOverlay: () => {
      segmentLine?.geometry.dispose();
      markerPoints?.geometry.dispose();
      lineMaterial?.dispose();
      pointsMaterial?.dispose();
      segmentLine = null;
      markerPoints = null;
      lineMaterial = null;
      pointsMaterial = null;
    },
    applyColor: (color) => {
      lineMaterial?.color.set(color);
      pointsMaterial?.color.set(color);
    },
    onCommit: (raw, e) => {
      addPoint(tool.applySnap(raw, e.clientX, e.clientY));
    },
    onMove: (world) => {
      // Only the "one placed point, awaiting the second" state needs a live
      // preview. (The marker still tracked geometry via the base's snap.)
      if (state.value.points.length !== 1) return;
      state.value = { points: state.value.points, hoverWorld: world };
      emitChange();
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        if (state.value.points.length > 0) {
          e.preventDefault();
          e.stopPropagation();
        }
        resetState(true);
      }
    },
    reset: resetState,
  });

  const setUnitsScale = (scale: number, label: MeasureUnits): void => {
    unitsScale = scale;
    unitsLabel = label;
  };

  /** Manually clear any in-flight measurement without firing `onCancel`. */
  const clear = (): void => {
    state.value = { points: [], hoverWorld: null };
    emitChange();
  };

  return {
    state,
    isActive: tool.isActive,
    attach: tool.attach,
    detach: tool.detach,
    setEnabled: tool.setEnabled,
    setUnitsScale,
    setColor: tool.setColor,
    clear,
    dispose: tool.dispose,
  };
}

/**
 * Format a measurement value into a short, human-friendly string.
 *
 * Uses two decimal places for small values and one decimal for values
 * over 100 — same trade-off the ruler labels make. Pure / framework-
 * agnostic — exported so tests and custom UI can reuse it.
 */
export function formatMeasureValue(value: number, units: MeasureUnits): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  if (units === "mm") return `${fixed} mm`;
  if (units === "inch") return `${fixed} in`;
  return fixed;
}
