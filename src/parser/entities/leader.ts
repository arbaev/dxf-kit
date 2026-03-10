import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IPoint, IEntityBase } from "../parseHelpers";

export interface ILeaderEntity extends IEntityBase {
  type: "LEADER";
  vertices: IPoint[];
  styleName?: string;
  arrowHeadFlag?: number; // 71: 0 = no arrowhead, 1 = with arrowhead
  pathType?: number; // 72: 0 = straight line, 1 = spline
  numVertices?: number; // 76: number of vertices
  arrowSize?: number; // DIMASZ override from XDATA DSTYLE (code 41)
}

/** DIMVAR code for DIMASZ (arrow size) in XDATA DSTYLE pairs */
const DIMVAR_DIMASZ = 41;

export function parseLeader(scanner: DxfScanner, curr: IGroup): ILeaderEntity {
  const entity = { type: curr.value, vertices: [] as IPoint[] } as ILeaderEntity;
  curr = scanner.next();
  // XDATA DSTYLE parsing state: track "1001 ACAD" → "1000 DSTYLE" → "1002 {" block
  let inDStyle = false;
  let pendingDimVar: number | null = null;
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 3:
        entity.styleName = curr.value as string;
        break;
      case 10:
        entity.vertices.push(helpers.parsePoint(scanner));
        break;
      case 71:
        entity.arrowHeadFlag = curr.value as number;
        break;
      case 72:
        entity.pathType = curr.value as number;
        break;
      case 76:
        entity.numVertices = curr.value as number;
        break;
      case 100:
        break;
      // XDATA DSTYLE: extract DIMASZ override
      case 1000:
        inDStyle = curr.value === "DSTYLE";
        break;
      case 1002:
        if (curr.value === "}") { inDStyle = false; pendingDimVar = null; }
        break;
      case 1070:
        if (inDStyle) {
          if (pendingDimVar === null) {
            // First 1070 in pair: DIMVAR code
            pendingDimVar = curr.value as number;
          } else {
            // Second 1070: integer value for the pending DIMVAR
            if (pendingDimVar === DIMVAR_DIMASZ) entity.arrowSize = curr.value as number;
            pendingDimVar = null;
          }
        }
        break;
      case 1040:
        if (inDStyle && pendingDimVar !== null) {
          // Real value for the pending DIMVAR
          if (pendingDimVar === DIMVAR_DIMASZ) entity.arrowSize = curr.value as number;
          pendingDimVar = null;
        }
        break;
      case 1005:
        // Handle value for pending DIMVAR (e.g. block reference) -- skip
        if (inDStyle) pendingDimVar = null;
        break;
      default:
        helpers.checkCommonEntityProperties(entity, curr, scanner);
        break;
    }
    curr = scanner.next();
  }
  return entity;
}
