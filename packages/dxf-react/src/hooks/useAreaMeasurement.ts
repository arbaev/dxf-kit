import { useRef, useState } from "react";
import * as THREE from "three";
import {
  measureArea,
  measurePerimeter,
  polygonSelfIntersects,
  DOUBLE_CLICK_MS,
  DOUBLE_CLICK_DISTANCE_PX,
  ORIGIN_SNAP_RADIUS_PX,
  type MeasurePoint,
} from "dxf-render";
import {
  createPointerTool,
  ensurePositionCapacity,
  isTypingTarget,
  type PointerTool,
} from "./usePointerTool";

/** Result of a completed (closed) area measurement. */
export interface AreaMeasureResult {
  /** Closed polygon vertices in DXF world coordinates (first vertex not repeated). */
  points: MeasurePoint[];
  /** Raw polygon area in DXF world units² (Shoelace, absolute). */
  areaRaw: number;
  /** Area scaled to the displayed units (`areaRaw * areaScale`). */
  area: number;
  /** Raw closed perimeter in DXF world units. */
  perimeterRaw: number;
  /** Perimeter scaled to the displayed units (`perimeterRaw * perimeterScale`). */
  perimeter: number;
  /** Area unit suffix label that was active, e.g. `"m²"` / `"mm²"` / `""` (dxf-units). */
  areaUnits: string;
  /** Length unit suffix label for the perimeter, e.g. `"m"` / `"mm"` / `""`. */
  lengthUnits: string;
  /** True when the polygon boundary crosses itself (algebraic area still reported). */
  selfIntersecting: boolean;
}

/** Resolved unit scales + labels driving the displayed area / perimeter values. */
export interface AreaUnitScales {
  areaScale: number;
  perimeterScale: number;
  areaLabel: string;
  lengthLabel: string;
}

export interface AreaMeasureState {
  points: MeasurePoint[];
  hoverWorld: MeasurePoint | null;
  closed: boolean;
  originSnap: boolean;
}

export interface AreaMeasureCallbacks {
  onResult?: (result: AreaMeasureResult) => void;
  onChange?: (state: AreaMeasureState) => void;
  onCancel?: () => void;
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

const emptyState = (): AreaMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
  originSnap: false,
});

export interface AreaMeasurementController {
  attach: PointerTool<AreaMeasureCallbacks>["attach"];
  detach: () => void;
  setEnabled: (on: boolean) => void;
  setUnits: (next: AreaUnitScales) => void;
  setColor: (color: string) => void;
  clear: () => void;
  dispose: () => void;
}

/**
 * N-point polygon area-measurement state machine on top of
 * {@link createPointerTool}. The authoritative `stateRef` is mirrored to React
 * state via `pushState` for the HTML label.
 */
function createAreaMeasurementController(
  pushState: (state: AreaMeasureState) => void,
): AreaMeasurementController {
  const stateRef = { current: emptyState() };
  const tool = createPointerTool<AreaMeasureCallbacks>();

  let scales: AreaUnitScales = { areaScale: 1, perimeterScale: 1, areaLabel: "", lengthLabel: "" };

  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let fillMaterial: THREE.MeshBasicMaterial | null = null;
  let markerMaterial: THREE.PointsMaterial | null = null;
  let originMaterial: THREE.PointsMaterial | null = null;
  let outlineLoop: THREE.LineLoop | null = null;
  let fillMesh: THREE.Mesh | null = null;
  let markerPoints: THREE.Points | null = null;
  let originMarker: THREE.Points | null = null;

  // Double-click detection (the close gesture).
  let lastCommitTime = 0;
  let lastCommitX = 0;
  let lastCommitY = 0;

  const displayPolygon = (): MeasurePoint[] => {
    const s = stateRef.current;
    if (s.closed) return s.points;
    return s.hoverWorld ? [...s.points, s.hoverWorld] : s.points;
  };

  const refreshOverlay = (): void => {
    tool.ensureOverlay();
    if (!outlineLoop || !fillMesh || !markerPoints || !originMarker) return;

    const offset = tool.getOffset();
    const committed = stateRef.current.points;
    const display = displayPolygon();

    // Outline (LineLoop auto-closes last → first)
    if (display.length >= 2) {
      const arr = ensurePositionCapacity(outlineLoop.geometry, display.length);
      for (let i = 0; i < display.length; i++) {
        arr[i * 3] = display[i].x - offset.x;
        arr[i * 3 + 1] = display[i].y - offset.y;
        arr[i * 3 + 2] = 0;
      }
      const attr = outlineLoop.geometry.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      outlineLoop.geometry.setDrawRange(0, display.length);
      outlineLoop.geometry.computeBoundingSphere();
      outlineLoop.visible = true;
    } else {
      outlineLoop.visible = false;
    }

    // Fill — triangulate the display polygon (≥3 vertices)
    if (display.length >= 3) {
      const contour = display.map((p) => new THREE.Vector2(p.x - offset.x, p.y - offset.y));
      let faces: number[][] = [];
      try {
        faces = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch {
        faces = [];
      }
      if (faces.length > 0) {
        const positions = new Float32Array(contour.length * 3);
        for (let i = 0; i < contour.length; i++) {
          positions[i * 3] = contour[i].x;
          positions[i * 3 + 1] = contour[i].y;
          positions[i * 3 + 2] = 0;
        }
        const indices = new Uint16Array(faces.length * 3);
        for (let f = 0; f < faces.length; f++) {
          indices[f * 3] = faces[f][0];
          indices[f * 3 + 1] = faces[f][1];
          indices[f * 3 + 2] = faces[f][2];
        }
        fillMesh.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        fillMesh.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        fillMesh.geometry.computeBoundingSphere();
        fillMesh.visible = true;
      } else {
        fillMesh.visible = false;
      }
    } else {
      fillMesh.visible = false;
    }

    // Vertex markers (committed only)
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

    // Origin-snap cue — larger marker on the first vertex when snapping is active
    if (stateRef.current.originSnap && committed.length >= 1) {
      const arr = originMarker.geometry.getAttribute("position") as THREE.BufferAttribute;
      const oArr = arr.array as Float32Array;
      oArr[0] = committed[0].x - offset.x;
      oArr[1] = committed[0].y - offset.y;
      oArr[2] = 0;
      arr.needsUpdate = true;
      originMarker.geometry.setDrawRange(0, 1);
      originMarker.visible = true;
    } else {
      originMarker.visible = false;
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
    stateRef.current = emptyState();
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const closePolygon = (): void => {
    const pts = stateRef.current.points;
    if (pts.length < 3) return;
    stateRef.current = { points: pts, hoverWorld: null, closed: true, originSnap: false };
    emitChange();
    const areaRaw = measureArea(pts);
    const perimeterRaw = measurePerimeter(pts);
    tool.getCallbacks().onResult?.({
      points: pts.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
      areaRaw,
      area: areaRaw * scales.areaScale,
      perimeterRaw,
      perimeter: perimeterRaw * scales.perimeterScale,
      areaUnits: scales.areaLabel,
      lengthUnits: scales.lengthLabel,
      selfIntersecting: polygonSelfIntersects(pts),
    });
  };

  const addPoint = (world: MeasurePoint): void => {
    if (stateRef.current.closed) {
      // A completed polygon is still visible — start a fresh measurement.
      stateRef.current = { points: [world], hoverWorld: world, closed: false, originSnap: false };
    } else {
      stateRef.current = {
        points: [...stateRef.current.points, world],
        hoverWorld: world,
        closed: false,
        originSnap: false,
      };
    }
    emitChange();
  };

  const popPoint = (): void => {
    if (stateRef.current.closed || stateRef.current.points.length === 0) return;
    const next = stateRef.current.points.slice(0, -1);
    stateRef.current = {
      points: next,
      hoverWorld: stateRef.current.hoverWorld,
      closed: false,
      originSnap: false,
    };
    emitChange();
  };

  const handleDblClick = (e: MouseEvent): void => {
    // The actual close is driven by the second pointerup (see onCommit);
    // here we only suppress the browser's text-selection default.
    if (tool.isActive()) e.preventDefault();
  };

  tool.configure({
    overlayName: "dxf-area-measurement-overlay",
    buildOverlay: (group, color) => {
      const c = new THREE.Color(color);
      fillMaterial = new THREE.MeshBasicMaterial({
        color: c.clone(),
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
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
      originMaterial = new THREE.PointsMaterial({
        color: c.clone(),
        size: 16,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.6,
      });

      // Fill first so the translucent mesh sits under the outline / markers.
      fillMesh = new THREE.Mesh(new THREE.BufferGeometry(), fillMaterial);
      fillMesh.visible = false;
      group.add(fillMesh);

      const outlineGeom = new THREE.BufferGeometry();
      outlineGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      outlineGeom.setDrawRange(0, 0);
      outlineLoop = new THREE.LineLoop(outlineGeom, lineMaterial);
      outlineLoop.visible = false;
      group.add(outlineLoop);

      const markerGeom = new THREE.BufferGeometry();
      markerGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      markerGeom.setDrawRange(0, 0);
      markerPoints = new THREE.Points(markerGeom, markerMaterial);
      markerPoints.visible = false;
      group.add(markerPoints);

      const originGeom = new THREE.BufferGeometry();
      originGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
      originGeom.setDrawRange(0, 0);
      originMarker = new THREE.Points(originGeom, originMaterial);
      originMarker.visible = false;
      group.add(originMarker);
    },
    disposeOverlay: () => {
      outlineLoop?.geometry.dispose();
      fillMesh?.geometry.dispose();
      markerPoints?.geometry.dispose();
      originMarker?.geometry.dispose();
      lineMaterial?.dispose();
      fillMaterial?.dispose();
      markerMaterial?.dispose();
      originMaterial?.dispose();
      outlineLoop = null;
      fillMesh = null;
      markerPoints = null;
      originMarker = null;
      lineMaterial = null;
      fillMaterial = null;
      markerMaterial = null;
      originMaterial = null;
    },
    applyColor: (color) => {
      const c = new THREE.Color(color);
      lineMaterial?.color.set(c);
      fillMaterial?.color.set(c);
      markerMaterial?.color.set(c);
      originMaterial?.color.set(c);
    },
    onCommit: (raw, e) => {
      const now = performance.now();
      const isSecondTap =
        now - lastCommitTime < DOUBLE_CLICK_MS &&
        Math.hypot(e.clientX - lastCommitX, e.clientY - lastCommitY) < DOUBLE_CLICK_DISTANCE_PX;

      if (!stateRef.current.closed) {
        // Double-click finishes the polygon (the 2nd tap is a near-duplicate).
        if (isSecondTap && stateRef.current.points.length >= 3) {
          closePolygon();
          return;
        }
        // Clicking the first vertex (snap-highlighted) closes the loop.
        if (stateRef.current.originSnap && stateRef.current.points.length >= 3) {
          closePolygon();
          return;
        }
      }

      const world = tool.applySnap(raw, e.clientX, e.clientY);
      addPoint(world);
      lastCommitTime = now;
      lastCommitX = e.clientX;
      lastCommitY = e.clientY;
    },
    onMove: (world, e) => {
      if (stateRef.current.closed) return;
      const committed = stateRef.current.points;
      if (committed.length < 1) return;

      // Detect proximity to the first vertex (≥3 committed → closable).
      let originSnap = false;
      if (committed.length >= 3) {
        const originScreen = tool.worldToScreen(committed[0]);
        if (originScreen) {
          originSnap =
            Math.hypot(e.clientX - originScreen.x, e.clientY - originScreen.y) <=
            ORIGIN_SNAP_RADIUS_PX;
        }
      }
      stateRef.current = { points: committed, hoverWorld: world, closed: false, originSnap };
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
      if (e.key === "Enter") {
        if (isTypingTarget(e.target)) return;
        if (!stateRef.current.closed && stateRef.current.points.length >= 3) {
          e.preventDefault();
          closePolygon();
        }
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
    onAttach: (canvas) => {
      canvas.addEventListener("dblclick", handleDblClick, { capture: true });
    },
    onDetach: (canvas) => {
      canvas.removeEventListener("dblclick", handleDblClick, {
        capture: true,
      } as EventListenerOptions);
    },
  });

  const setUnits = (next: AreaUnitScales): void => {
    scales = next;
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

export interface UseAreaMeasurementResult {
  /** Reactive area-measurement state (consumed by `useMeasureLabels`). */
  state: AreaMeasureState;
  attach: AreaMeasurementController["attach"];
  detach: AreaMeasurementController["detach"];
  setEnabled: AreaMeasurementController["setEnabled"];
  setUnits: AreaMeasurementController["setUnits"];
  setColor: AreaMeasurementController["setColor"];
  clear: AreaMeasurementController["clear"];
  dispose: AreaMeasurementController["dispose"];
}

/**
 * React hook for the polygon area-measurement tool. Returns a STABLE object
 * reference (see `useMeasurement` for why); `state` is a live property updated
 * by the controller, paired with a `forceRender`.
 */
export function useAreaMeasurement(): UseAreaMeasurementResult {
  const [, forceRender] = useState(0);
  const ref = useRef<UseAreaMeasurementResult | null>(null);
  if (ref.current === null) {
    const result = { state: emptyState() } as unknown as UseAreaMeasurementResult;
    const controller = createAreaMeasurementController((state) => {
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
 * Format an area or perimeter value into a short string with a unit suffix.
 * Pure / framework-agnostic.
 */
export function formatAreaValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  return unit ? `${fixed} ${unit}` : fixed;
}
