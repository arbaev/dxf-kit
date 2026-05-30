import { shallowRef } from "vue";
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
  usePointerTool,
  ensurePositionCapacity,
  isTypingTarget,
} from "./usePointerTool";

/**
 * Result of a completed (closed) area measurement. Emitted via `onResult`
 * once the polygon is closed (double-click, click on the first vertex, or
 * Enter — all require at least 3 vertices).
 */
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
  /** Multiplier applied to the raw Shoelace area (square of the linear factor). */
  areaScale: number;
  /** Multiplier applied to the raw perimeter (linear factor). */
  perimeterScale: number;
  /** Area unit suffix, e.g. `"m²"` / `"mm²"` / `"in²"` / `"ft²"` / `""`. */
  areaLabel: string;
  /** Length unit suffix for the perimeter, e.g. `"m"` / `"mm"` / `"in"` / `"ft"` / `""`. */
  lengthLabel: string;
}

export interface AreaMeasureState {
  /** Committed polygon vertices in DXF world coords (no origin offset). */
  points: MeasurePoint[];
  /** Live cursor position in DXF world coords while drafting (null once closed). */
  hoverWorld: MeasurePoint | null;
  /** True once the polygon has been closed and a result emitted. */
  closed: boolean;
  /** True when the cursor is within snap radius of the first vertex (≥3 points, drafting). */
  originSnap: boolean;
}

export interface AreaMeasureCallbacks {
  /** Fired when the polygon is closed — the measurement is complete. */
  onResult?: (result: AreaMeasureResult) => void;
  /** Fired whenever the internal state changes (point added/removed, hover, reset). */
  onChange?: (state: AreaMeasureState) => void;
  /** Fired when Esc aborts an in-flight measurement OR `setEnabled(false)` aborts a draft. */
  onCancel?: () => void;
  /**
   * Optional geometry-snap resolver. Maps a raw world point + screen coords to
   * a possibly-snapped world point and drives the snap marker. Called on every
   * pointer move and on click. The close-to-first-vertex behavior takes
   * precedence over geometry snap on click.
   */
  snap?: (rawWorld: MeasurePoint, clientX: number, clientY: number) => MeasurePoint;
}

const emptyState = (): AreaMeasureState => ({
  points: [],
  hoverWorld: null,
  closed: false,
  originSnap: false,
});

/**
 * N-point polygon area-measurement tool (AutoCAD-style), built on the shared
 * {@link usePointerTool} pipeline.
 *
 * Flow (states keyed by committed-vertex count):
 *   - `empty`  → click adds the first vertex.
 *   - `one`    → a preview line follows the cursor.
 *   - `two`    → a preview triangle (2 committed + cursor); the perimeter is
 *                live but the area is held at `—` until a real polygon exists.
 *   - `three+` → the polygon grows; area + perimeter update live (Shoelace)
 *                including the cursor as the next candidate vertex.
 *   - `closed` → the polygon is finalized; outline + fill + label persist
 *                until the next click starts a fresh measurement.
 *
 * Closing (only at ≥3 vertices): double-click, a click on the first vertex
 * (snap-highlighted), or the Enter key. Esc aborts; Backspace removes the
 * last placed vertex.
 *
 * Owns a Three.js overlay group with a `LineLoop` outline, a translucent `Mesh`
 * fill, vertex `Points` markers, and a larger origin-snap marker.
 */
export function useAreaMeasurement() {
  const state = shallowRef<AreaMeasureState>(emptyState());
  const tool = usePointerTool<AreaMeasureCallbacks>();

  let scales: AreaUnitScales = { areaScale: 1, perimeterScale: 1, areaLabel: "", lengthLabel: "" };

  // Three.js overlay children (owned here; lifecycle driven by the base).
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

  /**
   * The polygon currently shown: committed vertices, plus the live cursor
   * point as a candidate next vertex while drafting.
   */
  const displayPolygon = (): MeasurePoint[] => {
    const s = state.value;
    if (s.closed) return s.points;
    return s.hoverWorld ? [...s.points, s.hoverWorld] : s.points;
  };

  const refreshOverlay = (): void => {
    tool.ensureOverlay();
    if (!outlineLoop || !fillMesh || !markerPoints || !originMarker) return;

    const offset = tool.getOffset();
    const committed = state.value.points;
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
    if (state.value.originSnap && committed.length >= 1) {
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
    tool.getCallbacks().onChange?.(state.value);
    refreshOverlay();
    tool.render();
  };

  const resetState = (notify: boolean): void => {
    const hadDraft = state.value.points.length > 0;
    state.value = emptyState();
    emitChange();
    if (notify && hadDraft) tool.getCallbacks().onCancel?.();
  };

  const closePolygon = (): void => {
    const pts = state.value.points;
    if (pts.length < 3) return;
    state.value = { points: pts, hoverWorld: null, closed: true, originSnap: false };
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
    if (state.value.closed) {
      // A completed polygon is still visible — start a fresh measurement.
      state.value = { points: [world], hoverWorld: world, closed: false, originSnap: false };
    } else {
      state.value = {
        points: [...state.value.points, world],
        hoverWorld: world,
        closed: false,
        originSnap: false,
      };
    }
    emitChange();
  };

  const popPoint = (): void => {
    if (state.value.closed || state.value.points.length === 0) return;
    const next = state.value.points.slice(0, -1);
    state.value = { points: next, hoverWorld: state.value.hoverWorld, closed: false, originSnap: false };
    emitChange();
  };

  const handleDblClick = (e: MouseEvent): void => {
    // The actual close is driven by the second pointerup (see onCommit);
    // here we only suppress the browser's text-selection default.
    if (tool.isActive.value) e.preventDefault();
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

      if (!state.value.closed) {
        // Double-click finishes the polygon (the 2nd tap is a near-duplicate,
        // not a new vertex). The first tap already committed its point.
        if (isSecondTap && state.value.points.length >= 3) {
          closePolygon();
          return;
        }
        // Clicking the first vertex (snap-highlighted) closes the loop.
        if (state.value.originSnap && state.value.points.length >= 3) {
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
      if (state.value.closed) return;
      const committed = state.value.points;
      if (committed.length < 1) return;

      // Detect proximity to the first vertex (≥3 committed → closable).
      let originSnap = false;
      if (committed.length >= 3) {
        const originScreen = tool.worldToScreen(committed[0]);
        if (originScreen) {
          originSnap =
            Math.hypot(e.clientX - originScreen.x, e.clientY - originScreen.y) <= ORIGIN_SNAP_RADIUS_PX;
        }
      }
      state.value = { points: committed, hoverWorld: world, closed: false, originSnap };
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
      if (e.key === "Enter") {
        if (isTypingTarget(e.target)) return;
        if (!state.value.closed && state.value.points.length >= 3) {
          e.preventDefault();
          closePolygon();
        }
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
    onAttach: (canvas) => {
      canvas.addEventListener("dblclick", handleDblClick, { capture: true });
    },
    onDetach: (canvas) => {
      canvas.removeEventListener("dblclick", handleDblClick, { capture: true } as EventListenerOptions);
    },
  });

  const setUnits = (next: AreaUnitScales): void => {
    scales = next;
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
 * Format an area or perimeter value into a short string with a unit suffix.
 *
 * Two decimals below 100, one decimal at/above 100 — the same trade-off the
 * ruler and distance labels use. `unit` is appended verbatim (`"m²"`, `"mm"`,
 * …); pass `""` for raw DXF units (no suffix). Pure / framework-agnostic.
 */
export function formatAreaValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fixed = abs >= 100 ? value.toFixed(1) : value.toFixed(2);
  return unit ? `${fixed} ${unit}` : fixed;
}
