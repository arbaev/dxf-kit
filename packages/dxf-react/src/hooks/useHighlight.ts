import { useRef } from "react";
import * as THREE from "three";
import {
  buildHighlightGeometry,
  type DxfEntity,
  type PickingEntry,
  type PickingIndex,
} from "dxf-render";

export interface HighlightController {
  init: (
    sceneRef: THREE.Scene,
    offset: { x: number; y: number; z: number },
    color: string,
  ) => void;
  installHighlightData: (entityIdx: Map<string, DxfEntity>, pickingIdx: PickingIndex) => void;
  removeHighlightData: () => void;
  setColor: (color: string) => void;
  highlight: (entries: PickingEntry[]) => void;
  clear: () => void;
  dispose: () => void;
}

/**
 * Highlight-overlay controller. Traces precise entity geometry (via
 * `buildHighlightGeometry`) with a bbox-edge fallback for
 * text/dimension/point/insert. Pure Three.js — no React state.
 */
function createHighlightController(): HighlightController {
  let scene: THREE.Scene | null = null;
  let originOffset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  let highlightGroup: THREE.Group | null = null;
  let lineMaterial: THREE.LineBasicMaterial | null = null;
  let entityIndex: Map<string, DxfEntity> | null = null;
  let pickingIndex: PickingIndex | null = null;

  const init = (
    sceneRef: THREE.Scene,
    offset: { x: number; y: number; z: number },
    color: string,
  ): void => {
    scene = sceneRef;
    originOffset = offset;
    if (!highlightGroup) {
      highlightGroup = new THREE.Group();
      highlightGroup.name = "dxf-highlight-group";
      highlightGroup.renderOrder = 999;
      scene.add(highlightGroup);
    }
    if (!lineMaterial) {
      lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95,
      });
    } else {
      lineMaterial.color.set(color);
    }
  };

  const installHighlightData = (
    entityIdx: Map<string, DxfEntity>,
    pickingIdx: PickingIndex,
  ): void => {
    entityIndex = entityIdx;
    pickingIndex = pickingIdx;
  };

  const removeHighlightData = (): void => {
    entityIndex = null;
    pickingIndex = null;
  };

  const setColor = (color: string): void => {
    lineMaterial?.color.set(color);
  };

  const highlight = (entries: PickingEntry[]): void => {
    if (!highlightGroup || !lineMaterial) return;
    clear();
    for (const entry of entries) {
      renderEntry(entry);
    }
  };

  const renderEntry = (entry: PickingEntry): void => {
    // INSERT aggregate → expand into child entries (children carry the
    // actual geometry, the aggregate is only a bbox cover).
    if (entry.type === "INSERT" && entry.childIds?.length && pickingIndex) {
      for (const childId of entry.childIds) {
        const child = pickingIndex.byId.get(childId);
        if (child) renderEntry(child);
      }
      return;
    }

    const entity = entityIndex?.get(entry.handle);
    if (!entity) {
      addBBoxEdges(entry.bbox);
      return;
    }

    const geom = buildHighlightGeometry(entity, entry.worldMatrix ?? null);
    if (geom.fallbackToBBox) {
      addBBoxEdges(entry.bbox);
      return;
    }
    for (const polyline of geom.polylines) {
      addPolyline(polyline);
    }
  };

  const addPolyline = (points: THREE.Vector3[]): void => {
    if (!highlightGroup || !lineMaterial || points.length < 2) return;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x - originOffset.x;
      positions[i * 3 + 1] = points[i].y - originOffset.y;
      positions[i * 3 + 2] = points[i].z - originOffset.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, lineMaterial);
    line.frustumCulled = false;
    line.userData.isHighlight = true;
    highlightGroup.add(line);
  };

  const addBBoxEdges = (bbox: THREE.Box3): void => {
    if (!highlightGroup || !lineMaterial) return;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    // Floor a degenerate box (POINT, flat 2D text) to a visible sliver.
    const sx = Math.max(size.x, 0.01);
    const sy = Math.max(size.y, 0.01);
    const sz = Math.max(size.z, 0.01);

    const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    const lines = new THREE.LineSegments(edges, lineMaterial);
    lines.position.set(
      center.x - originOffset.x,
      center.y - originOffset.y,
      center.z - originOffset.z,
    );
    lines.frustumCulled = false;
    lines.userData.isHighlight = true;
    highlightGroup.add(lines);
  };

  const clear = (): void => {
    if (!highlightGroup) return;
    for (const child of [...highlightGroup.children]) {
      if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
      highlightGroup.remove(child);
    }
  };

  const dispose = (): void => {
    clear();
    if (highlightGroup && scene) {
      scene.remove(highlightGroup);
    }
    highlightGroup = null;
    if (lineMaterial) {
      lineMaterial.dispose();
      lineMaterial = null;
    }
    scene = null;
    entityIndex = null;
    pickingIndex = null;
  };

  return {
    init,
    installHighlightData,
    removeHighlightData,
    setColor,
    highlight,
    clear,
    dispose,
  };
}

/** React hook over {@link createHighlightController}. Returns a stable controller. */
export function useHighlight(): HighlightController {
  const ref = useRef<HighlightController | null>(null);
  if (ref.current === null) {
    ref.current = createHighlightController();
  }
  return ref.current;
}
