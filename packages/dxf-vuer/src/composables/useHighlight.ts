import * as THREE from "three";
import type { PickingEntry } from "dxf-render";

/**
 * Manage a highlight overlay group: draw thin wireframe boxes over the
 * entities being hovered/clicked. Boxes mirror the picking bboxes; if a
 * tighter visualisation is needed, swap the bbox edges for the entity's
 * actual geometry in a follow-up.
 */
export function useHighlight() {
  let scene: THREE.Scene | null = null;
  let originOffset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  let highlightGroup: THREE.Group | null = null;
  let lineMaterial: THREE.LineBasicMaterial | null = null;

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

  const setColor = (color: string): void => {
    lineMaterial?.color.set(color);
  };

  const highlight = (entries: PickingEntry[]): void => {
    if (!highlightGroup || !lineMaterial) return;
    clear();
    for (const entry of entries) {
      const size = new THREE.Vector3();
      entry.bbox.getSize(size);
      const center = new THREE.Vector3();
      entry.bbox.getCenter(center);

      // Use min size 0 — we don't need to inflate for highlight visibility,
      // a degenerate flat box is still rendered as edges
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
    }
  };

  const clear = (): void => {
    if (!highlightGroup) return;
    for (const child of [...highlightGroup.children]) {
      if (child instanceof THREE.LineSegments) {
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
  };

  return { init, setColor, highlight, clear, dispose };
}
