import type { DxfEntity, DxfHatchEntity, DxfRegionEntity } from "@/types/dxf";
import { isHatchEntity, isRegionEntity } from "@/types/dxf";

/**
 * Post-parse step: connect every REGION to the boundary edges of the HATCH(es)
 * that list it as a source object. The HATCH stores the actual curve geometry
 * (codes 92/93/72/…); the REGION stores only ACIS modeler data which we don't
 * decode. By "borrowing" the HATCH boundary we get a visible/pickable contour
 * for the REGION without parsing ACIS.
 *
 * Mutates the entities in place. Idempotent: re-running just rewrites
 * contourBoundary with the same paths.
 */
export function linkRegionsToHatchBoundaries(entities: DxfEntity[]): void {
  if (!entities || entities.length === 0) return;

  // Build handle -> hatch map (handles normalized to uppercase to match
  // how parseBoundarySourceObjects stores them).
  const handleToHatch = new Map<string, DxfHatchEntity>();
  for (const e of entities) {
    if (!isHatchEntity(e)) continue;
    for (const path of e.boundaryPaths) {
      for (const h of path.sourceObjectHandles ?? []) {
        handleToHatch.set(h, e);
      }
    }
  }
  if (handleToHatch.size === 0) return;

  for (const e of entities) {
    if (!isRegionEntity(e) || e.handle == null) continue;
    const handle = String(e.handle).toUpperCase();
    const hatch = handleToHatch.get(handle);
    if (!hatch) continue;
    const pathsForRegion = hatch.boundaryPaths.filter(
      (p) => p.sourceObjectHandles?.includes(handle),
    );
    if (pathsForRegion.length === 0) continue;
    (e as DxfRegionEntity).contourBoundary = pathsForRegion;
    if (hatch.extrusionDirection) {
      (e as DxfRegionEntity).contourExtrusionDirection = hatch.extrusionDirection;
    }
  }
}
