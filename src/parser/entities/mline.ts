import type DxfScanner from "../scanner";
import type { IGroup } from "../scanner";
import * as helpers from "../parseHelpers";
import type { IPoint, IEntityBase } from "../parseHelpers";

interface IMlineElementParams {
  params: number[];
}

interface IMlineVertex {
  x: number;
  y: number;
  z: number;
  direction: IPoint;
  miter: IPoint;
  elementParams: IMlineElementParams[];
}

export interface IMlineEntity extends IEntityBase {
  type: "MLINE";
  styleName?: string;
  scale: number;
  justification: number;
  flags: number;
  numVertices: number;
  numElements: number;
  vertices: IMlineVertex[];
  extrusionDirection?: IPoint;
}

export function parseMline(scanner: DxfScanner, curr: IGroup): IMlineEntity {
  const entity = {
    type: curr.value,
    scale: 1,
    justification: 0,
    flags: 0,
    numVertices: 0,
    numElements: 0,
    vertices: [],
  } as IMlineEntity;

  let currentVertex: IMlineVertex | null = null;
  let currentElement: IMlineElementParams | null = null;

  curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0) break;
    switch (curr.code) {
      case 2:
        entity.styleName = curr.value as string;
        break;
      case 40:
        entity.scale = curr.value as number;
        break;
      case 70:
        entity.justification = curr.value as number;
        break;
      case 71:
        entity.flags = curr.value as number;
        break;
      case 72:
        entity.numVertices = curr.value as number;
        break;
      case 73:
        entity.numElements = curr.value as number;
        break;
      case 10:
        // Start point — skip (vertex positions in code 11 are authoritative)
        break;
      case 20:
      case 30:
        break;
      case 11:
        // New vertex
        currentVertex = {
          x: 0, y: 0, z: 0,
          direction: { x: 0, y: 0, z: 0 },
          miter: { x: 0, y: 0, z: 0 },
          elementParams: [],
        };
        entity.vertices.push(currentVertex);
        currentVertex.x = curr.value as number;
        break;
      case 21:
        if (currentVertex) currentVertex.y = curr.value as number;
        break;
      case 31:
        if (currentVertex) currentVertex.z = curr.value as number;
        break;
      case 12:
        if (currentVertex) currentVertex.direction = helpers.parsePoint(scanner);
        break;
      case 13:
        if (currentVertex) currentVertex.miter = helpers.parsePoint(scanner);
        break;
      case 74:
        // New element params block
        currentElement = { params: [] };
        if (currentVertex) currentVertex.elementParams.push(currentElement);
        break;
      case 41:
        if (currentElement) currentElement.params.push(curr.value as number);
        break;
      case 75:
      case 42:
        // Fill params — skip
        break;
      case 210:
        entity.extrusionDirection = helpers.parsePoint(scanner);
        break;
      case 100:
      case 340:
        break;
      default:
        helpers.checkCommonEntityProperties(entity, curr, scanner);
        break;
    }
    curr = scanner.next();
  }

  return entity;
}
