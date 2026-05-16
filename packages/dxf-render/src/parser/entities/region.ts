import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IEntityBase } from "../parseHelpers";

export interface IRegionEntity extends IEntityBase {
  type: "REGION";
}

// REGION holds ACIS modeler geometry that we don't parse; we still capture
// handle/layer/color so it becomes a first-class entity and can be linked to
// a HATCH that references it as a boundary source (see linkRegionsToHatchBoundaries).
export function parseRegion(scanner: DxfScanner, curr: IGroup): IRegionEntity {
  const entity = { type: "REGION" } as IRegionEntity;
  curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    helpers.checkCommonEntityProperties(entity, curr, scanner);
    curr = scanner.next();
  }
  return entity;
}
