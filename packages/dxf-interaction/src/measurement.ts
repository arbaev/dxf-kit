import * as THREE from "three";
import { measureDistance, type MeasurePoint } from "dxf-render";
import { createPointerTool, type PointerTool } from "./pointerTool";

/** Kind of measurement produced by this tool. */
export type MeasureKind = "distance";

/** Display units. Matches `RulerUnits` from dxf-react/types. */
export type MeasureUnits = "dxf-units" | "mm" | "inch";

/**
 * Result of a completed measurement. Emitted via `onResult` once the second
 * point is placed.
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
  /** Optional geometry-snap resolver (see dxf-react's `useSnap`). */
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

export interface MeasurementController {
  tool: PointerTool<MeasureCallbacks>;
  attach: PointerTool<MeasureCallbacks>["attach"];
  detach: () => void;
  setEnabled: (on: boolean) => void;
  setUnitsScale: (scale: number, label: MeasureUnits) => void;
  setColor: (color: string) => void;
  clear: () => void;
  dispose: () => void;
}

/**
 * Distance-measurement state machine on top of {@link createPointerTool}.
 * The `pushState` bridge mirrors the authoritative `stateRef` into React state
 * so the HTML label (projected by `useMeasureLabels`) re-renders.
 */
export function createMeasurementController(
  pushState: (state: MeasureState) => void,
): MeasurementController {
  const stateRef = { current: { points: [], hoverWorld: null } as MeasureState };
  const tool = createPointerTool<MeasureCallbacks>();

  let unitsScale = 1;
  let unitsLabel: MeasureUnits = "dxf-units";

  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let pointsMaterial: THREE.PointsMaterial | null = null;
  let segmentLine: THREE.Line | null = null;
  let markerPoints: THREE.Points | null = null;

  /** Update the overlay geometry to match `stateRef`. */
  const refreshOverlay = (): void => {
    tool.ensureOverlay();
    if (!segmentLine || !markerPoints) return;

    const offset = tool.getOffset();
    const pts = stateRef.current.points;
    const previewTo = pts.length === 1 ? stateRef.current.hoverWorld : null;

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
    tool.getCallbacks().onChange?.(stateRef.current);
    refreshOverlay();
    tool.render();
    pushState(stateRef.current);
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = stateRef.current.points.length > 0;
    stateRef.current = { points: [], hoverWorld: null };
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const addPoint = (world: MeasurePoint): void => {
    const pts = stateRef.current.points;
    if (pts.length === 0) {
      stateRef.current = { points: [world], hoverWorld: world };
      emitChange();
      return;
    }
    if (pts.length === 1) {
      const a = pts[0];
      const b = world;
      const valueRaw = measureDistance(a, b);
      // Settle the second point and keep it visible until a new measurement starts.
      stateRef.current = { points: [a, b], hoverWorld: null };
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
    stateRef.current = { points: [world], hoverWorld: world };
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
      // Only the "one placed point, awaiting the second" state needs a live preview.
      if (stateRef.current.points.length !== 1) return;
      stateRef.current = { points: stateRef.current.points, hoverWorld: world };
      emitChange();
    },
    onKeyDown: (e) => {
      if (e.key === "Escape") {
        if (stateRef.current.points.length > 0) {
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
    stateRef.current = { points: [], hoverWorld: null };
    emitChange();
  };

  return {
    tool,
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
 * Format a measurement value into a short, human-friendly string. Pure /
 * framework-agnostic — exported so tests and custom UI can reuse it.
 */
export function formatMeasureValue(value: number, units: MeasureUnits): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  if (units === "mm") return `${fixed} mm`;
  if (units === "inch") return `${fixed} in`;
  return fixed;
}
