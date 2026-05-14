import { isRegionEntity } from "@/types/dxf";
import { resolveEntityColor } from "@/utils/colorResolver";
import { resolveEntityLinetype } from "@/utils/linetypeResolver";
import { buildOcsMatrix, transformOcsPoints } from "@/utils/ocsTransform";
import type { CollectEntityParams } from "../blockTemplateCache";
import { boundaryPathToLinePoints } from "../hatch";
import { addLineToCollector, applyWorld } from "./helpers";

/**
 * Collect a REGION entity into the GeometryCollector.
 * REGION holds ACIS modeler data we don't decode; instead we render the contour
 * "borrowed" from a HATCH that references this REGION as a boundary source
 * (linked at parse time, see linkRegionsToHatchBoundaries). Color, layer and
 * linetype come from the REGION itself — only the curve geometry is shared
 * with the HATCH.
 */
export function collectRegion(p: CollectEntityParams): boolean {
  const { entity, colorCtx, collector, layer, worldMatrix, overrideColor } = p;
  if (!isRegionEntity(entity)) return false;
  if (!entity.contourBoundary || entity.contourBoundary.length === 0) return false;

  const entityColor = overrideColor ?? resolveEntityColor(entity, colorCtx.layers, colorCtx.blockColor);
  const ltInfo = resolveEntityLinetype(
    entity, colorCtx.layers, colorCtx.lineTypes,
    colorCtx.globalLtScale, colorCtx.blockLineType, colorCtx.headerLtScale,
  );
  const pattern = ltInfo?.pattern;

  const ocsMatrix = buildOcsMatrix(entity.contourExtrusionDirection);

  for (const bp of entity.contourBoundary) {
    const pts = boundaryPathToLinePoints(bp);
    if (pts.length > 1) {
      addLineToCollector(
        collector,
        layer,
        entityColor,
        applyWorld(transformOcsPoints(pts, ocsMatrix), worldMatrix),
        pattern,
      );
    }
  }
  return true;
}
