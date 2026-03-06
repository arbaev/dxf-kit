import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IEntityBase } from "../parseHelpers";

export interface I3DSolidEntity extends IEntityBase {
  type: "3DSOLID";
}

export function parse3DSolid(scanner: DxfScanner, curr: IGroup): I3DSolidEntity {
  const entity = { type: curr.value } as I3DSolidEntity;
  curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    helpers.checkCommonEntityProperties(entity, curr, scanner);
    curr = scanner.next();
  }
  return entity;
}
