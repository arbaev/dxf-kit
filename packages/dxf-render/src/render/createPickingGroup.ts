import * as THREE from "three";
import type { PickingIndex } from "./pickingIndex";

const MIN_PICK_SIZE = 0.5;

/**
 * Build an invisible THREE.Group of per-entity bounding-box meshes for raycasting.
 * Each mesh carries `userData.handle`, `userData.dxfType`, `userData.layerName`
 * so a raycast intersection resolves directly to the entity's handle.
 *
 * The group is set `visible = false` — Three.js raycasting still works on
 * invisible objects when intersectObjects is called with recursive=true,
 * so we toggle the group's `visible` only at render-time. Better: use a
 * separate raycast call against this group only.
 *
 * Coordinates are stored relative to `originOffset` (matching the main scene).
 */
export function createPickingGroup(
  index: PickingIndex,
  originOffset?: { x: number; y: number; z: number },
): THREE.Group {
  const group = new THREE.Group();
  group.name = "dxf-picking-group";
  group.visible = false;
  // Raycaster ignores invisible objects unless we explicitly target them
  group.userData.isPickingGroup = true;

  const ox = originOffset?.x ?? 0;
  const oy = originOffset?.y ?? 0;
  const oz = originOffset?.z ?? 0;

  // Shared invisible material — never rendered, only used for intersect tests
  const material = new THREE.MeshBasicMaterial({
    visible: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  for (const entry of index.entries) {
    const size = new THREE.Vector3();
    entry.bbox.getSize(size);
    const center = new THREE.Vector3();
    entry.bbox.getCenter(center);

    // Inflate degenerate dimensions (lines, points, flat shapes) so the
    // bbox actually has volume to intersect.
    const sx = Math.max(size.x, MIN_PICK_SIZE);
    const sy = Math.max(size.y, MIN_PICK_SIZE);
    const sz = Math.max(size.z, MIN_PICK_SIZE);

    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(center.x - ox, center.y - oy, center.z - oz);
    mesh.frustumCulled = false;
    mesh.userData.pickId = entry.id;
    mesh.userData.handle = entry.handle;
    mesh.userData.dxfType = entry.type;
    mesh.userData.layerName = entry.layer;
    group.add(mesh);
  }

  return group;
}

/**
 * Dispose all geometries in the picking group. Material is shared and
 * disposed separately at scene teardown.
 */
export function disposePickingGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      // Dispose any debug material we may have attached
      const debugMat = obj.userData.debugMaterial as THREE.Material | undefined;
      if (debugMat) debugMat.dispose();
    }
  });
  group.clear();
}

/**
 * Toggle visualisation of all picking bboxes — useful for diagnosing why a
 * specific entity isn't pickable. When enabled, every bbox is drawn as a
 * translucent magenta wireframe; when disabled, the picking group reverts
 * to its normal invisible state.
 */
export function setPickingGroupDebug(group: THREE.Group, on: boolean): void {
  group.visible = on;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (on) {
      let mat = obj.userData.debugMaterial as THREE.Material | undefined;
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          wireframe: true,
          transparent: true,
          opacity: 0.4,
          depthTest: false,
          depthWrite: false,
        });
        obj.userData.debugMaterial = mat;
        obj.userData.realMaterial = obj.material;
      }
      obj.material = mat;
    } else {
      const real = obj.userData.realMaterial as THREE.Material | undefined;
      if (real) obj.material = real;
    }
  });
}
