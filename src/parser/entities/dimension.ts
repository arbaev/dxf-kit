import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IPoint, IEntityBase } from "../parseHelpers";

export interface IDimensionEntity extends IEntityBase {
  type: "DIMENSION";
  block?: string;
  styleName?: string;
  anchorPoint?: IPoint;
  middleOfText?: IPoint;
  insertionPoint?: IPoint;
  linearOrAngularPoint1?: IPoint;
  linearOrAngularPoint2?: IPoint;
  diameterOrRadiusPoint?: IPoint;
  arcPoint?: IPoint;
  dimensionType?: number;
  attachmentPoint?: number;
  actualMeasurement?: number;
  text?: string;
  textHeight?: number;
  angle?: number;
  /** DIMASZ — arrow size from XDATA DSTYLE override */
  arrowSize?: number;
  /** DIMSCALE — overall dimension scale from XDATA DSTYLE override */
  dimScale?: number;
}

/**
 * Parse DIMSTYLE overrides from XDATA (codes 1070/1040 pairs inside ACAD DSTYLE group).
 * Pattern: 1070→varCode, then 1070→intValue or 1040→realValue.
 * Key variables: 140=DIMTXT, 41=DIMASZ, 40=DIMSCALE.
 */
function applyDimStyleXData(entity: IDimensionEntity, scanner: DxfScanner): void {
  let curr = scanner.next();
  // Expect "1000 DSTYLE" after "1001 ACAD"
  if (curr.code !== 1000 || curr.value !== "DSTYLE") return;
  curr = scanner.next();
  // Expect "1002 {"
  if (curr.code !== 1002 || curr.value !== "{") return;

  // Parse variable pairs: 1070→varCode, then 1070→int or 1040→real
  curr = scanner.next();
  while (!scanner.isEOF() && !(curr.code === 1002 && curr.value === "}") && curr.code !== 0) {
    if (curr.code === 1070) {
      const varCode = curr.value as number;
      curr = scanner.next();
      if (curr.code === 0 || (curr.code === 1002 && curr.value === "}")) break;

      const varValue = curr.value as number;

      switch (varCode) {
        case 140: // DIMTXT — text height
          if (!entity.textHeight) entity.textHeight = varValue;
          break;
        case 41: // DIMASZ — arrow size
          entity.arrowSize = varValue;
          break;
        case 40: // DIMSCALE — overall scale
          entity.dimScale = varValue;
          break;
      }
    }
    curr = scanner.next();
  }
}

export function parseDimension(scanner: DxfScanner, curr: IGroup): IDimensionEntity {
  const entity = { type: curr.value } as IDimensionEntity;
  curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 2:
        entity.block = curr.value as string;
        break;
      case 3:
        entity.styleName = curr.value as string;
        break;
      case 10:
        entity.anchorPoint = helpers.parsePoint(scanner);
        break;
      case 11:
        entity.middleOfText = helpers.parsePoint(scanner);
        break;
      case 12:
        entity.insertionPoint = helpers.parsePoint(scanner);
        break;
      case 13:
        entity.linearOrAngularPoint1 = helpers.parsePoint(scanner);
        break;
      case 14:
        entity.linearOrAngularPoint2 = helpers.parsePoint(scanner);
        break;
      case 15:
        entity.diameterOrRadiusPoint = helpers.parsePoint(scanner);
        break;
      case 16:
        entity.arcPoint = helpers.parsePoint(scanner);
        break;
      case 70:
        entity.dimensionType = curr.value as number;
        break;
      case 71:
        entity.attachmentPoint = curr.value as number;
        break;
      case 42:
        entity.actualMeasurement = curr.value as number;
        break;
      case 1:
        entity.text = curr.value as string;
        break;
      case 140:
        entity.textHeight = curr.value as number;
        break;
      case 50:
        entity.angle = curr.value as number;
        break;
      case 1001:
        // Parse ACAD DIMSTYLE overrides from extended data
        if (curr.value === "ACAD") {
          applyDimStyleXData(entity, scanner);
          // applyDimStyleXData leaves scanner past the closing "}"
          curr = scanner.lastReadGroup;
          continue; // skip scanner.next() at bottom — already advanced
        }
        helpers.checkCommonEntityProperties(entity, curr, scanner);
        break;
      default:
        helpers.checkCommonEntityProperties(entity, curr, scanner);
        break;
    }
    curr = scanner.next();
  }
  return entity;
}
