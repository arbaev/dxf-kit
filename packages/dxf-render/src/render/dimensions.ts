import * as THREE from "three";
import type { Font } from "opentype.js";
import type { DxfVertex, DxfDimensionEntity, DxfDimStyle } from "@/types/dxf";
import type { DxfHeader } from "@/types/header";
import {
  DIM_TEXT_HEIGHT,
  DIM_TEXT_GAP,
  DIM_TEXT_GAP_MULTIPLIER,
  DIM_TEXT_DECIMAL_PLACES,
  ARROW_SIZE,
  EXTENSION_LINE_DASH_SIZE,
  EXTENSION_LINE_GAP_SIZE,
  EXTENSION_LINE_EXTENSION,
  OUTSIDE_ARROW_THRESHOLD_RATIO,
  OUTSIDE_ARROW_TAIL_RATIO,
  DEGREES_TO_RADIANS_DIVISOR,
  EPSILON,
  CIRCLE_SEGMENTS,
  MIN_ARC_SEGMENTS,
} from "@/constants";
import { createArrow, createTick } from "./primitives";
import { replaceSpecialChars } from "./text/mtextParser";
import type { GeometryCollector } from "./mergeCollectors";
import { addDimensionTextToCollector, measureDimensionTextWidth } from "./text/vectorTextBuilder";

/**
 * Check if a DIMBLK block name represents a tick mark (oblique stroke).
 * Common tick block names: _ArchTick, ArchTick, _OBLIQUE, Oblique, _Tick.
 */
export const isTickBlock = (name: string): boolean => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes("tick") || n.includes("oblique");
};

/**
 * Resolved dimension variable set. Values are final (already scaled by DIMSCALE).
 * Priority: entity XDATA override > header $DIM* × $DIMSCALE > hardcoded defaults.
 */
export interface DimVars {
  arrowSize: number;
  textHeight: number;
  textGap: number;
  extLineDash: number;
  extLineGap: number;
  extLineExtension: number; // DIMEXE: extension line overshoot past dimension line
  useTicks: boolean;
  tickSize: number;
}

/** Default DimVars using hardcoded constants (backward compatibility) */
export const DEFAULT_DIM_VARS: DimVars = {
  arrowSize: ARROW_SIZE,
  textHeight: DIM_TEXT_HEIGHT,
  textGap: DIM_TEXT_GAP,
  extLineDash: EXTENSION_LINE_DASH_SIZE,
  extLineGap: EXTENSION_LINE_GAP_SIZE,
  extLineExtension: EXTENSION_LINE_EXTENSION,
  useTicks: false,
  tickSize: 0,
};

/**
 * Resolve dimension variables from DXF header.
 * $DIMSCALE multiplies all other $DIM* values.
 */
export function resolveDimVarsFromHeader(
  header: DxfHeader | undefined,
): DimVars {
  if (!header) return { ...DEFAULT_DIM_VARS };

  const dimScale = header.$DIMSCALE ?? 1;
  const scale = dimScale > 0 ? dimScale : 1;

  const arrowSize = (header.$DIMASZ ?? ARROW_SIZE) * scale;
  const textHeight = (header.$DIMTXT ?? DIM_TEXT_HEIGHT) * scale;
  const dimGap = header.$DIMGAP;
  const textGap = dimGap !== undefined
    ? dimGap * scale * DIM_TEXT_GAP_MULTIPLIER * 2
    : textHeight * DIM_TEXT_GAP_MULTIPLIER;
  const extLineDash = EXTENSION_LINE_DASH_SIZE * scale;
  const extLineGap = EXTENSION_LINE_GAP_SIZE * scale;
  const extLineExtension = (header.$DIMEXE ?? EXTENSION_LINE_EXTENSION) * scale;

  const dimtsz = header.$DIMTSZ ?? 0;
  const dimblk = header.$DIMBLK ?? "";
  const useTicks = dimtsz > 0 || isTickBlock(dimblk);
  // When using ticks: DIMTSZ provides explicit size, otherwise fall back to arrowSize
  const tickSize = !useTicks ? 0 : dimtsz > 0 ? dimtsz * scale : arrowSize;

  return { arrowSize, textHeight, textGap, extLineDash, extLineGap, extLineExtension, useTicks, tickSize };
}

/**
 * Merge per-entity XDATA overrides into resolved DimVars.
 * Entity textHeight (code 140) is treated as the final value.
 * Entity arrowSize from XDATA is scaled by entity dimScale.
 */
export function mergeEntityDimVars(
  base: DimVars,
  entity: DxfDimensionEntity,
): DimVars {
  const result = { ...base };

  if (entity.textHeight !== undefined) {
    result.textHeight = entity.textHeight;
    result.textGap = entity.textHeight * DIM_TEXT_GAP_MULTIPLIER;
  }

  if (entity.arrowSize !== undefined) {
    const scale = entity.dimScale ?? 1;
    result.arrowSize = entity.arrowSize * scale;
  }

  return result;
}

/**
 * Apply DIMSTYLE-level overrides to resolved DimVars.
 * Sits between header defaults and entity XDATA in priority chain:
 *   header → DIMSTYLE → entity XDATA
 *
 * DIMSCALE from DIMSTYLE multiplies DIMTXT/DIMASZ.
 * If DIMSTYLE has its own DIMTXT/DIMASZ, those override header values.
 */
export function applyDimStyleVars(
  base: DimVars,
  dimStyle: DxfDimStyle,
  header?: DxfHeader,
): DimVars {
  const result = { ...base };

  // DIMSCALE: DIMSTYLE overrides header $DIMSCALE
  const headerDimScale = header?.$DIMSCALE ?? 1;
  const styleDimScale = dimStyle.dimscale;
  const scale = (styleDimScale ?? headerDimScale) || 1;

  if (dimStyle.dimtxt !== undefined) {
    // DIMSTYLE provides its own text height — use it × scale
    result.textHeight = dimStyle.dimtxt * scale;
    result.textGap = result.textHeight * DIM_TEXT_GAP_MULTIPLIER;
  } else if (styleDimScale !== undefined && styleDimScale !== headerDimScale) {
    // DIMSTYLE only overrides DIMSCALE — re-scale header DIMTXT with new scale
    const headerDimTxt = header?.$DIMTXT ?? DIM_TEXT_HEIGHT;
    result.textHeight = headerDimTxt * scale;
    result.textGap = result.textHeight * DIM_TEXT_GAP_MULTIPLIER;
  }

  if (dimStyle.dimasz !== undefined) {
    // DIMSTYLE provides its own arrow size — use it × scale
    result.arrowSize = dimStyle.dimasz * scale;
  } else if (styleDimScale !== undefined && styleDimScale !== headerDimScale) {
    // DIMSTYLE only overrides DIMSCALE — re-scale header DIMASZ with new scale
    const headerDimAsz = header?.$DIMASZ ?? ARROW_SIZE;
    result.arrowSize = headerDimAsz * scale;
  }

  // When ticks are derived from arrowSize (DIMTSZ=0 + tick block), keep them in sync
  if (result.useTicks && result.tickSize > 0 && dimStyle.dimtsz === undefined) {
    result.tickSize = result.arrowSize;
  }

  // Re-scale extension line geometry
  if (styleDimScale !== undefined && styleDimScale !== headerDimScale) {
    result.extLineDash = EXTENSION_LINE_DASH_SIZE * scale;
    result.extLineGap = EXTENSION_LINE_GAP_SIZE * scale;
  }

  if (dimStyle.dimexe !== undefined) {
    result.extLineExtension = dimStyle.dimexe * scale;
  } else if (styleDimScale !== undefined && styleDimScale !== headerDimScale) {
    const headerDimExe = header?.$DIMEXE ?? EXTENSION_LINE_EXTENSION;
    result.extLineExtension = headerDimExe * scale;
  }

  return result;
}

// ── Parameter interfaces ──────────────────────────────────────────────

/** Shared params for dimension type functions (ordinate, radial, diametric, angular) */
export interface DimensionTypeParams {
  entity: DxfDimensionEntity;
  /** Color for dimension geometry (lines/arrows). Resolved from DIMCLRD or entity color. */
  color: string;
  /** Color for dimension text. Resolved from DIMCLRT or entity color. Defaults to `color`. */
  textColor?: string;
  font?: Font;
  collector?: GeometryCollector;
  layer?: string;
  transform?: readonly number[];
  dv?: DimVars;
  /** Dimension formatting options (DIMDEC, DIMZIN, DIMADEC, DIMLUNIT). */
  fmt?: DimFormatOptions;
  /** DIMTOH (DIMSTYLE code 73): text outside arc/dim — 0=aligned, 1=horizontal. Undefined treated as 0. */
  dimtoh?: number;
  /** DIMTIH (DIMSTYLE code 74): text inside arc/dim — 0=aligned, 1=horizontal. Undefined treated as 0. */
  dimtih?: number;
  /** DIMTAD (DIMSTYLE code 77): text vertical position (0=centered, 1=above, 2=outside, 3=JIS, 4=below).
   *  When undefined the ISO default (1, above line) is assumed. */
  dimtad?: number;
  /** DIMGAP (DIMSTYLE code 147): gap from the dim line to the text bounding box,
   *  and the radius used to break the dim line around centered text. Already scaled by DIMSCALE. */
  dimgap?: number;
  /** DIMTMOVE (DIMSTYLE code 279): how to draw text the user repositioned —
   *  0=move dim line, 1=add leader, 2=move text only. Default 0. */
  dimtmove?: number;
}

/** Params for createLinearDimensionLines */
export interface LinearDimensionLinesParams {
  point1: DxfVertex;
  point2: DxfVertex;
  anchorPoint: DxfVertex;
  textPos?: DxfVertex;
  dimLineMaterial: THREE.LineBasicMaterial;
  extensionLineMaterial: THREE.LineDashedMaterial;
  arrowMaterial: THREE.MeshBasicMaterial;
  isHorizontal: boolean;
  dv?: DimVars;
}

/** Params for createRotatedDimensionLines */
export interface RotatedDimensionLinesParams {
  point1: DxfVertex;
  point2: DxfVertex;
  anchorPoint: DxfVertex;
  textPos?: DxfVertex;
  dimLineMaterial: THREE.LineBasicMaterial;
  extensionLineMaterial: THREE.LineDashedMaterial;
  arrowMaterial: THREE.MeshBasicMaterial;
  angleRad: number;
  dv?: DimVars;
}

/** Params for createDimensionGroup */
export interface DimensionGroupParams {
  point1: DxfVertex;
  point2: DxfVertex;
  anchorPoint: DxfVertex;
  textPos?: DxfVertex;
  textHeight: number;
  isRadial: boolean;
  color: string;
  angle?: number;
  /** Type-0 (rotated) dimension: always use rotated path, even for angle=0 (horizontal) */
  forceRotated?: boolean;
  dv?: DimVars;
}

/** Params for emitStackedText (vectorTextBuilder.ts) */

/**
 * Tag userData.dimPart on dimension geometry so the collector can resolve
 * separate colors for dimension line + arrows ("dim") vs extension lines ("ext").
 * Walks the provided objects (and their descendants). Any object whose material
 * matches `extMaterial` is tagged "ext"; everything else is tagged "dim".
 */
export const tagDimParts = (
  objects: THREE.Object3D[],
  extMaterial?: THREE.Material,
): void => {
  for (const obj of objects) {
    obj.traverse((child) => {
      const mat = (child as THREE.Mesh).material as THREE.Material | undefined;
      if (!mat) return;
      child.userData.dimPart = (extMaterial && mat === extMaterial) ? "ext" : "dim";
    });
  }
};

/** Line defined by two points for intersectLines2D */
export interface Line2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const createExtensionLine = (
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.LineBasicMaterial | THREE.LineDashedMaterial,
  overshoot?: number,
): THREE.Line => {
  // Extension lines extend beyond the dimension line per AutoCAD convention (DIMEXE)
  let endPoint = to;
  if (overshoot && overshoot > 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > EPSILON) {
      endPoint = new THREE.Vector3(
        to.x + (dx / len) * overshoot,
        to.y + (dy / len) * overshoot,
        to.z,
      );
    }
  }

  const geometry = new THREE.BufferGeometry().setFromPoints([from, endPoint]);
  const line = new THREE.Line(geometry, material);

  // computeLineDistances required for LineDashedMaterial to render dashes
  if (material instanceof THREE.LineDashedMaterial) {
    line.computeLineDistances();
  }

  return line;
};

export const createLinearDimensionLines = (p: LinearDimensionLinesParams): THREE.Object3D[] => {
  const {
    point1, point2, anchorPoint, textPos,
    dimLineMaterial, extensionLineMaterial, arrowMaterial,
    isHorizontal, dv = DEFAULT_DIM_VARS,
  } = p;
  const objects: THREE.Object3D[] = [];

  const getMainCoord = (p: DxfVertex) => (isHorizontal ? p.x : p.y);
  const getFixedCoord = (p: DxfVertex) => (isHorizontal ? p.y : p.x);
  const createVec3 = (main: number, fixed: number, z: number) =>
    isHorizontal ? new THREE.Vector3(main, fixed, z) : new THREE.Vector3(fixed, main, z);

  const min = Math.min(getMainCoord(point1), getMainCoord(point2));
  const max = Math.max(getMainCoord(point1), getMainCoord(point2));
  const anchorFixed = getFixedCoord(anchorPoint);

  // When the dim line is too short to fit two inward-pointing arrows, flip them
  // to point inward from outside. Arrow bases sit at min - arrowSize / max + arrowSize;
  // the dim line extends one extra `tail` past each base so the arrows read as
  // arrows (shaft + head) rather than two opposing triangles.
  const useOutsideArrows = !dv.useTicks && (max - min) < OUTSIDE_ARROW_THRESHOLD_RATIO * dv.arrowSize;
  const outsideOffset = dv.arrowSize * (1 + OUTSIDE_ARROW_TAIL_RATIO);
  const dimMin = useOutsideArrows ? min - outsideOffset : min;
  const dimMax = useOutsideArrows ? max + outsideOffset : max;

  // Split dimension line around text only when arrows fit inside —
  // outside-arrow mode keeps a continuous extended line; the text usually sits
  // off the line (per file) and the gap would land outside the measurement.
  if (textPos && !useOutsideArrows && Math.abs(getFixedCoord(textPos) - anchorFixed) < 1) {
    const gapStart = getMainCoord(textPos) - dv.textGap / 2;
    const gapEnd = getMainCoord(textPos) + dv.textGap / 2;

    if (dimMin < gapStart) {
      objects.push(
        createExtensionLine(
          createVec3(dimMin, anchorFixed, 0),
          createVec3(gapStart, anchorFixed, 0),
          dimLineMaterial,
        ),
      );
    }

    if (dimMax > gapEnd) {
      objects.push(
        createExtensionLine(
          createVec3(gapEnd, anchorFixed, 0),
          createVec3(dimMax, anchorFixed, 0),
          dimLineMaterial,
        ),
      );
    }
  } else {
    objects.push(
      createExtensionLine(
        createVec3(dimMin, anchorFixed, 0),
        createVec3(dimMax, anchorFixed, 0),
        dimLineMaterial,
      ),
    );
  }

  if (Math.abs(getFixedCoord(point1) - anchorFixed) > 0.1) {
    objects.push(
      createExtensionLine(
        createVec3(getMainCoord(point1), getFixedCoord(point1), 0),
        createVec3(getMainCoord(point1), anchorFixed, 0),
        extensionLineMaterial,
        dv.extLineExtension,
      ),
    );
  }
  if (Math.abs(getFixedCoord(point2) - anchorFixed) > 0.1) {
    objects.push(
      createExtensionLine(
        createVec3(getMainCoord(point2), getFixedCoord(point2), 0),
        createVec3(getMainCoord(point2), anchorFixed, 0),
        extensionLineMaterial,
        dv.extLineExtension,
      ),
    );
  }

  if (dv.useTicks) {
    const dimAngle = isHorizontal ? 0 : Math.PI / 2;
    objects.push(createTick(createVec3(min, anchorFixed, 0.1), dv.tickSize, dimAngle, dimLineMaterial));
    objects.push(createTick(createVec3(max, anchorFixed, 0.1), dv.tickSize, dimAngle, dimLineMaterial));
  } else if (useOutsideArrows) {
    // Flipped: tips at min/max pointing inward, bases at dimMin/dimMax (outside)
    objects.push(createArrow(createVec3(dimMin, anchorFixed, 0.1), createVec3(min, anchorFixed, 0.1), dv.arrowSize, arrowMaterial));
    objects.push(createArrow(createVec3(dimMax, anchorFixed, 0.1), createVec3(max, anchorFixed, 0.1), dv.arrowSize, arrowMaterial));
  } else {
    objects.push(createArrow(createVec3(max, anchorFixed, 0.1), createVec3(min, anchorFixed, 0.1), dv.arrowSize, arrowMaterial));
    objects.push(createArrow(createVec3(min, anchorFixed, 0.1), createVec3(max, anchorFixed, 0.1), dv.arrowSize, arrowMaterial));
  }

  return objects;
};

/**
 * Create lines and arrows for a rotated dimension (arbitrary angle).
 * Projects measurement points onto the dimension line via dot product.
 */
export const createRotatedDimensionLines = (p: RotatedDimensionLinesParams): THREE.Object3D[] => {
  const {
    point1, point2, anchorPoint, textPos,
    dimLineMaterial, extensionLineMaterial, arrowMaterial,
    angleRad, dv = DEFAULT_DIM_VARS,
  } = p;
  const objects: THREE.Object3D[] = [];

  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);

  // Project points onto dimension line direction (anchorPoint lies on it)
  const t1 = (point1.x - anchorPoint.x) * dirX + (point1.y - anchorPoint.y) * dirY;
  const t2 = (point2.x - anchorPoint.x) * dirX + (point2.y - anchorPoint.y) * dirY;

  // Foot points: perpendicular intersections of measurement points with dimension line
  const foot1 = new THREE.Vector3(
    anchorPoint.x + t1 * dirX,
    anchorPoint.y + t1 * dirY,
    0,
  );
  const foot2 = new THREE.Vector3(
    anchorPoint.x + t2 * dirX,
    anchorPoint.y + t2 * dirY,
    0,
  );

  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const minPt = new THREE.Vector3(
    anchorPoint.x + tMin * dirX,
    anchorPoint.y + tMin * dirY,
    0,
  );
  const maxPt = new THREE.Vector3(
    anchorPoint.x + tMax * dirX,
    anchorPoint.y + tMax * dirY,
    0,
  );

  // When the dim line is too short to fit two inward-pointing arrows, flip them
  // to point inward from outside. Arrow bases sit at tMin - arrowSize / tMax + arrowSize;
  // the dim line extends one extra `tail` past each base so the arrows read as
  // arrows (shaft + head) rather than two opposing triangles.
  const useOutsideArrows = !dv.useTicks && (tMax - tMin) < OUTSIDE_ARROW_THRESHOLD_RATIO * dv.arrowSize;
  const outsideOffset = dv.arrowSize * (1 + OUTSIDE_ARROW_TAIL_RATIO);
  const tDimMin = useOutsideArrows ? tMin - outsideOffset : tMin;
  const tDimMax = useOutsideArrows ? tMax + outsideOffset : tMax;
  const dimMinPt = new THREE.Vector3(
    anchorPoint.x + tDimMin * dirX,
    anchorPoint.y + tDimMin * dirY,
    0,
  );
  const dimMaxPt = new THREE.Vector3(
    anchorPoint.x + tDimMax * dirX,
    anchorPoint.y + tDimMax * dirY,
    0,
  );

  // Split dimension line around text only when arrows fit inside —
  // in outside-arrow mode the dim line stays continuous along the extended range.
  if (textPos && !useOutsideArrows) {
    const tText = (textPos.x - anchorPoint.x) * dirX + (textPos.y - anchorPoint.y) * dirY;
    const perpDist = Math.abs(
      -(textPos.x - anchorPoint.x) * dirY + (textPos.y - anchorPoint.y) * dirX,
    );

    if (perpDist < 1) {
      const gapStart = tText - dv.textGap / 2;
      const gapEnd = tText + dv.textGap / 2;

      if (tDimMin < gapStart) {
        objects.push(
          createExtensionLine(
            dimMinPt,
            new THREE.Vector3(
              anchorPoint.x + gapStart * dirX,
              anchorPoint.y + gapStart * dirY,
              0,
            ),
            dimLineMaterial,
          ),
        );
      }
      if (tDimMax > gapEnd) {
        objects.push(
          createExtensionLine(
            new THREE.Vector3(
              anchorPoint.x + gapEnd * dirX,
              anchorPoint.y + gapEnd * dirY,
              0,
            ),
            dimMaxPt,
            dimLineMaterial,
          ),
        );
      }
    } else {
      objects.push(createExtensionLine(dimMinPt, dimMaxPt, dimLineMaterial));
    }
  } else {
    objects.push(createExtensionLine(dimMinPt, dimMaxPt, dimLineMaterial));
  }

  const p1 = new THREE.Vector3(point1.x, point1.y, 0);
  const p2 = new THREE.Vector3(point2.x, point2.y, 0);

  if (p1.distanceTo(foot1) > 0.1) {
    objects.push(createExtensionLine(p1, foot1, extensionLineMaterial, dv.extLineExtension));
  }
  if (p2.distanceTo(foot2) > 0.1) {
    objects.push(createExtensionLine(p2, foot2, extensionLineMaterial, dv.extLineExtension));
  }

  if (dv.useTicks) {
    objects.push(createTick(new THREE.Vector3(minPt.x, minPt.y, 0.1), dv.tickSize, angleRad, dimLineMaterial));
    objects.push(createTick(new THREE.Vector3(maxPt.x, maxPt.y, 0.1), dv.tickSize, angleRad, dimLineMaterial));
  } else if (useOutsideArrows) {
    // Flipped: tips at minPt/maxPt pointing inward, bases at dimMinPt/dimMaxPt (outside)
    objects.push(createArrow(new THREE.Vector3(dimMinPt.x, dimMinPt.y, 0.1), new THREE.Vector3(minPt.x, minPt.y, 0.1), dv.arrowSize, arrowMaterial));
    objects.push(createArrow(new THREE.Vector3(dimMaxPt.x, dimMaxPt.y, 0.1), new THREE.Vector3(maxPt.x, maxPt.y, 0.1), dv.arrowSize, arrowMaterial));
  } else {
    objects.push(createArrow(new THREE.Vector3(maxPt.x, maxPt.y, 0.1), new THREE.Vector3(minPt.x, minPt.y, 0.1), dv.arrowSize, arrowMaterial));
    objects.push(createArrow(new THREE.Vector3(minPt.x, minPt.y, 0.1), new THREE.Vector3(maxPt.x, maxPt.y, 0.1), dv.arrowSize, arrowMaterial));
  }

  return objects;
};

export interface DimFormatOptions {
  dimlunit?: number; // 2=Decimal, 4=Architectural
  dimzin?: number;   // Zero suppression flags
  dimdec?: number;   // Decimal places for primary units (arch: 2^dimdec = fraction denominator)
  dimadec?: number;  // Decimal places for angular dimensions
}

export const extractDimensionData = (entity: DxfDimensionEntity, dv: DimVars = DEFAULT_DIM_VARS, fmt?: DimFormatOptions) => {
  let point1 = entity.linearOrAngularPoint1;
  let point2 = entity.linearOrAngularPoint2;
  const anchorPoint = entity.anchorPoint;
  const diameterOrRadiusPoint = entity.diameterOrRadiusPoint;
  const textPos = entity.middleOfText;
  const angle = entity.angle || 0;
  let dimensionText = entity.text;
  let isRadial = false;

  const formatMeasurement = (value: number): string =>
    fmt?.dimlunit === 4
      ? formatArchitectural(value, fmt.dimzin, fmt.dimdec)
      : formatDimNumber(value, fmt?.dimdec, fmt?.dimzin);

  // Detect radial dimension BEFORE generating text to add "R" prefix
  if (!point1 && !point2 && diameterOrRadiusPoint && anchorPoint) {
    point1 = diameterOrRadiusPoint;
    point2 = anchorPoint;
    isRadial = true;
  }

  // Replace <> placeholder with actual measurement (AutoCAD convention)
  if (dimensionText && typeof entity.actualMeasurement === "number") {
    const measStr =
      (isRadial ? "R" : "") + formatMeasurement(entity.actualMeasurement);
    dimensionText = dimensionText.replace(/<>/g, measStr);
  }

  if (!dimensionText && typeof entity.actualMeasurement === "number") {
    dimensionText =
      (isRadial ? "R" : "") + formatMeasurement(entity.actualMeasurement);
  }

  // Fallback: compute measurement from point coordinates
  if (!dimensionText && point1 && point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = (point2.z || 0) - (point1.z || 0);
    const measurement = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dimensionText = (isRadial ? "R" : "") + formatMeasurement(measurement);
  }

  if (!isRadial && dimensionText && !isNaN(parseFloat(dimensionText)) && fmt?.dimlunit !== 4) {
    dimensionText = formatDimNumber(parseFloat(dimensionText), fmt?.dimdec, fmt?.dimzin);
  }

  if (!point1 || !point2 || !anchorPoint || !dimensionText) {
    return null;
  }
  const textHeight = entity.textHeight || dv.textHeight;

  return {
    point1,
    point2,
    anchorPoint,
    dimensionText,
    textPos,
    textHeight,
    angle,
    isRadial,
  };
};

export const createDimensionGroup = (p: DimensionGroupParams): THREE.Group => {
  const {
    point1, point2, anchorPoint, textPos,
    textHeight: _textHeight, isRadial, color,
    angle = 0, dv = DEFAULT_DIM_VARS,
  } = p;
  const dimGroup = new THREE.Group();

  const dimLineMaterial = new THREE.LineBasicMaterial({ color });
  const extensionLineMaterial = new THREE.LineDashedMaterial({
    color,
    dashSize: dv.extLineDash,
    gapSize: dv.extLineGap,
  });
  const arrowMaterial = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
  });

  if (isRadial) {
    const centerX = point2.x;
    const centerY = point2.y;
    const edgeX = point1.x;
    const edgeY = point1.y;

    dimGroup.add(
      createExtensionLine(
        new THREE.Vector3(centerX, centerY, 0),
        new THREE.Vector3(edgeX, edgeY, 0),
        dimLineMaterial,
      ),
    );

    const arrow = createArrow(
      new THREE.Vector3(centerX, centerY, 0.1),
      new THREE.Vector3(edgeX, edgeY, 0.1),
      dv.arrowSize,
      arrowMaterial,
    );
    dimGroup.add(arrow);

    // No extension lines in this radial branch — everything is "dim".
    tagDimParts([dimGroup]);
    return dimGroup;
  }

  let dimensionObjects: THREE.Object3D[];

  if (angle !== 0 || p.forceRotated) {
    const angleRad = (angle * Math.PI) / DEGREES_TO_RADIANS_DIVISOR;
    dimensionObjects = createRotatedDimensionLines({
      point1, point2, anchorPoint, textPos,
      dimLineMaterial, extensionLineMaterial, arrowMaterial,
      angleRad, dv,
    });
  } else {
    // Determine orientation by comparing point spread in X vs Y
    const spreadX = Math.abs(point2.x - point1.x);
    const spreadY = Math.abs(point2.y - point1.y);
    const isHorizontal = spreadX >= spreadY;

    dimensionObjects = createLinearDimensionLines({
      point1, point2, anchorPoint, textPos,
      dimLineMaterial, extensionLineMaterial, arrowMaterial,
      isHorizontal, dv,
    });
  }

  dimensionObjects.forEach((obj) => dimGroup.add(obj));

  // Tag children so the collector can split into dim/ext colors per DIMCLRD/DIMCLRE.
  tagDimParts([dimGroup], extensionLineMaterial);

  return dimGroup;
};

/**
 * Format a dimension number with optional `decimals` (DIMDEC for linear,
 * DIMADEC for angular) and `dimzin` zero-suppression flags. In decimal mode
 * DIMZIN uses bit 2 (4) for leading zeros and bit 3 (8) for trailing zeros.
 *
 * When `dimzin` is undefined trailing zeros are stripped — preserves the
 * pre-DIMDEC default (caller passes the raw value).
 */
export const formatDimNumber = (value: number, decimals?: number, dimzin?: number): string => {
  const places = decimals ?? DIM_TEXT_DECIMAL_PLACES;
  let s = value.toFixed(places);
  const stripTrailing = dimzin === undefined || (dimzin & 8) !== 0;
  const stripLeading = dimzin !== undefined && (dimzin & 4) !== 0;
  if (stripTrailing) s = parseFloat(s).toString();
  if (stripLeading) s = s.replace(/^(-?)0\./, "$1.");
  return s;
};

/**
 * Default DIMDEC for architectural fractions when not specified by DIMSTYLE/header.
 * 2^4 = 16 → 1/16" precision.
 */
const DEFAULT_ARCH_DIMDEC = 4;

/**
 * Upper bound on DIMDEC for architectural fractions. 2^8 = 1/256" is more than enough;
 * higher values would produce nonsensical denominators and risk Math.round overflow.
 */
const MAX_ARCH_DIMDEC = 8;

/**
 * Format a measurement in inches as architectural: feet'-inches".
 * Fractional inches are displayed using \S stacked notation (e.g. 6\S1/2;").
 * dimzin controls zero suppression (DXF code 78):
 *   bit 0 (1): suppress leading zeros in decimals (not relevant here)
 *   bit 1 (2): suppress trailing zeros in decimals (not relevant here)
 *   bit 2 (4): suppress 0 feet → "4\"" instead of "0'-4\""
 *   bit 3 (8): suppress 0 inches → "7'" instead of "7'-0\""
 * Default (dimzin=0): suppress both zero feet and zero inches.
 *
 * dimdec sets the fraction denominator as 2^dimdec (DXF code 271 / $DIMDEC):
 *   0 → whole inches only; 1 → 1/2; 2 → 1/4; 3 → 1/8; 4 → 1/16 (default); 5 → 1/32; ...
 */
export const formatArchitectural = (
  totalInches: number,
  dimzin?: number,
  dimdec?: number,
): string => {
  const sign = totalInches < 0 ? "-" : "";
  const abs = Math.abs(totalInches);
  let feet = Math.floor(abs / 12);
  const remInches = abs - feet * 12;
  let wholeInches = Math.floor(remInches);
  const fracPart = remInches - wholeInches;

  const dec = Math.min(Math.max(dimdec ?? DEFAULT_ARCH_DIMDEC, 0), MAX_ARCH_DIMDEC);
  const denom = 1 << dec; // 2^dec; dec=0 → 1 (no fraction, round to whole inch)

  // Convert fractional part to nearest fraction with power-of-2 denominator
  let fracNum = 0;
  let fracDen = 1;
  if (denom === 1) {
    // DIMDEC=0: round fractional part to nearest whole inch
    if (fracPart >= 0.5) {
      wholeInches++;
      if (wholeInches >= 12) { feet++; wholeInches -= 12; }
    }
  } else if (fracPart > 1 / (denom * 2)) {
    fracNum = Math.round(fracPart * denom);
    fracDen = denom;
    if (fracNum >= fracDen) {
      // Fraction rounds up to next whole inch
      fracNum = 0;
      wholeInches++;
      if (wholeInches >= 12) { feet++; wholeInches -= 12; }
    } else {
      // Reduce fraction by GCD
      let a = fracNum, b = fracDen;
      while (b) { const t = b; b = a % t; a = t; }
      fracNum /= a;
      fracDen /= a;
    }
  }

  const hasFrac = fracNum > 0;
  const zin = dimzin ?? 0;

  // Build the inches part: whole inches + optional stacked fraction + quote
  let inchPart = "";
  if (wholeInches > 0 && hasFrac) {
    inchPart = wholeInches + "\\S" + fracNum + "/" + fracDen + ";\"";
  } else if (hasFrac) {
    inchPart = "\\S" + fracNum + "/" + fracDen + ";\"";
  } else if (wholeInches > 0) {
    inchPart = wholeInches + "\"";
  }

  // Combine feet and inches with zero suppression
  if (zin === 0) {
    if (feet === 0 && !inchPart) return sign + "0\"";
    if (feet === 0) return sign + inchPart;
    if (!inchPart) return sign + feet + "'";
    return sign + feet + "'-" + inchPart;
  }

  if (feet === 0 && (zin & 4) !== 0) {
    return sign + (inchPart || "0\"");
  }
  if (!inchPart && (zin & 8) !== 0) {
    return sign + feet + "'";
  }
  return sign + feet + "'-" + (inchPart || "0\"");
};

/**
 * Clean MTEXT formatting codes from dimension text (except \S for stacked fractions).
 * Removes \A, \f, \c, \H, \P, {}, and processes Unicode escapes and special characters.
 */
export const cleanDimensionMText = (rawText: string): string => {
  // Protect escaped backslashes and braces with placeholders before stripping formatting
  let text = rawText.replace(/\\\\/g, "\x01").replace(/\\\{/g, "\x02").replace(/\\\}/g, "\x03");

  text = text.replace(/\\[Aa]\d+;/g, "");
  text = text.replace(/\\[fF][^;]*;/g, "");
  text = text.replace(/\\[cC]\d+;/g, "");
  text = text.replace(/\\[Hh][\d.]+;/g, "");
  text = text.replace(/\\[WTQA][\d.+-]+;/gi, "");
  text = text.replace(/\\[LOKlok]/g, "");
  text = text.replace(/\\P/g, " ");
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
  text = replaceSpecialChars(text);
  text = text.replace(/\x01/g, "\\").replace(/\x02/g, "{").replace(/\x03/g, "}");

  return text;
};

/**
 * Create an ordinate dimension (type 6/7).
 * Displays the X or Y coordinate of a point with a dog-leg leader.
 * No arrows or dashed lines -- solid lines only (per AutoCAD convention).
 */
export const createOrdinateDimension = (p: DimensionTypeParams): THREE.Object3D[] | null => {
  const { entity, color, font, collector, layer, transform, dv = DEFAULT_DIM_VARS, fmt } = p;
  const textColor = p.textColor ?? color;
  const feature = entity.linearOrAngularPoint1; // Code 13 -- point on object
  const leader = entity.linearOrAngularPoint2; // Code 14 -- end of diagonal
  const textPos = entity.middleOfText; // Code 11

  if (!feature || !leader) return null;

  let dimensionText = entity.text;
  const measurement = entity.actualMeasurement;

  if (dimensionText && typeof measurement === "number") {
    dimensionText = dimensionText.replace(/<>/g, formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin));
  }

  if (!dimensionText && typeof measurement === "number") {
    dimensionText = formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin);
  }

  if (!dimensionText) return null;

  const textHeight = entity.textHeight || dv.textHeight;
  const objects: THREE.Object3D[] = [];
  const material = new THREE.LineBasicMaterial({ color });

  // Create text mesh first to determine actual width for leader endpoint
  let actualTextWidth = 0;
  if (textPos) {
    actualTextWidth = measureDimensionTextWidth(font!, dimensionText, textHeight);
    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: textPos.x, posY: textPos.y, posZ: 0.2, transform,
    });
  }

  // X-ordinate (bit 0 set in dimensionType) or Y-ordinate (bit 0 clear)
  const isXOrdinate = ((entity.dimensionType ?? 0) & 1) !== 0;

  const featureVec = new THREE.Vector3(feature.x, feature.y, 0);
  const leaderVec = new THREE.Vector3(leader.x, leader.y, 0);

  if (!isXOrdinate) {
    // Y-ordinate: horizontal leader (measures Y coordinate)
    const dy = leader.y - feature.y;

    if (Math.abs(dy) < EPSILON) {
      const endX = textPos ? textPos.x + actualTextWidth / 2 : leader.x;
      const points = [featureVec, new THREE.Vector3(Math.max(leader.x, endX), leader.y, 0)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      objects.push(new THREE.Line(geometry, material));
    } else {
      // Dog-leg: diagonal offset = abs(dy)/2 (~63 degree angle)
      const diagDx = Math.abs(dy) / 2;
      const dirX = leader.x - feature.x !== 0 ? Math.sign(leader.x - feature.x) : 1;
      let kneeX = leader.x - dirX * diagDx;

      // Clamp knee so it doesn't extend beyond feature point
      if (dirX > 0) {
        kneeX = Math.max(kneeX, feature.x);
      } else {
        kneeX = Math.min(kneeX, feature.x);
      }

      const kneeVec = new THREE.Vector3(kneeX, feature.y, 0);

      if (Math.abs(kneeX - feature.x) > EPSILON) {
        const geom1 = new THREE.BufferGeometry().setFromPoints([featureVec, kneeVec]);
        objects.push(new THREE.Line(geom1, material));
      }

      const geom2 = new THREE.BufferGeometry().setFromPoints([kneeVec, leaderVec]);
      objects.push(new THREE.Line(geom2, material));

      const textEndX = textPos ? textPos.x + actualTextWidth / 2 : leader.x;
      if (Math.abs(textEndX - leader.x) > EPSILON && dirX * (textEndX - leader.x) > 0) {
        const geom3 = new THREE.BufferGeometry().setFromPoints([
          leaderVec,
          new THREE.Vector3(textEndX, leader.y, 0),
        ]);
        objects.push(new THREE.Line(geom3, material));
      }
    }
  } else {
    // X-ordinate: vertical leader (measures X coordinate)
    const dx = leader.x - feature.x;

    if (Math.abs(dx) < EPSILON) {
      const endY = textPos ? textPos.y + actualTextWidth / 2 : leader.y;
      const points = [featureVec, new THREE.Vector3(leader.x, Math.max(leader.y, endY), 0)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      objects.push(new THREE.Line(geometry, material));
    } else {
      const diagDy = Math.abs(dx) / 2;
      const dirY = leader.y - feature.y !== 0 ? Math.sign(leader.y - feature.y) : 1;
      let kneeY = leader.y - dirY * diagDy;

      if (dirY > 0) {
        kneeY = Math.max(kneeY, feature.y);
      } else {
        kneeY = Math.min(kneeY, feature.y);
      }

      const kneeVec = new THREE.Vector3(feature.x, kneeY, 0);

      if (Math.abs(kneeY - feature.y) > EPSILON) {
        const geom1 = new THREE.BufferGeometry().setFromPoints([featureVec, kneeVec]);
        objects.push(new THREE.Line(geom1, material));
      }

      const geom2 = new THREE.BufferGeometry().setFromPoints([kneeVec, leaderVec]);
      objects.push(new THREE.Line(geom2, material));

      const textEndY = textPos ? textPos.y + actualTextWidth / 2 : leader.y;
      if (Math.abs(textEndY - leader.y) > EPSILON && dirY * (textEndY - leader.y) > 0) {
        const geom3 = new THREE.BufferGeometry().setFromPoints([
          leaderVec,
          new THREE.Vector3(leader.x, textEndY, 0),
        ]);
        objects.push(new THREE.Line(geom3, material));
      }
    }
  }

  if (objects.length === 0) return null;
  tagDimParts(objects);
  return objects;
};

/**
 * Create a radial dimension (type 4).
 *
 * Layout state-machine driven by DIMSTYLE variables:
 *   DIMTIH/DIMTOH (codes 74/73): aligned vs horizontal text
 *   DIMTAD        (code 77):     vertical position of text relative to dim line
 *   DIMGAP        (code 147):    gap between dim line and text (and break-radius
 *                                around centered text)
 *   DIMTMOVE      (code 279):    behaviour when user repositions the text
 *
 * Entity-level signals:
 *   bit 5 of dimensionType (=32): default text position (auto-placed by CAD)
 *
 * Geometry:
 *   1. Project textPos onto the radius direction → (along, perp) coords.
 *   2. textInside  = (along ≤ radius)
 *      aligned    = textInside ? DIMTIH≠1 : DIMTOH≠1
 *      breakLine  = aligned ∧ DIMTAD=0           (text crosses the dim line)
 *      perpOffset = |perp|                       (how far text sits off the line)
 *   3. Pick aligned text rotation (radius angle, flipped to [-π/2, π/2]).
 *   4. Build dim line(s):
 *      • aligned, !breakLine
 *          – text outside arc:  no line from centre; short leader from arrow base
 *            outward to (near-arc edge of text along radius), only when room
 *          – text inside arc:   single line from centre to (radius − arrowSize),
 *            i.e. up to the arrow base on the centre side
 *      • aligned, breakLine
 *          two segments around the text projection on the radius line
 *          (gap = halfTextWidth + DIMGAP each side)
 *      • !aligned (horizontal text)
 *          existing leader + horizontal-text + underline path
 *   5. Arrow at arcPt:
 *      • text outside / aligned:  body OUTSIDE arc, tip points inward
 *      • text inside / aligned:   body INSIDE arc, tip points outward
 *      • horizontal:              body follows the leader (from tailEndPoint)
 *   6. Place text at textPos with the chosen rotation.
 *   7. If the user moved the text (defaultPosition bit clear) AND DIMTMOVE=1,
 *      add an extra leader from the projection of textPos on the radius line
 *      down to textPos itself — the "moved with leader" style.
 *
 * Caveats / not yet implemented:
 *   • Text positions OFF the radius line are handled (we honour textPos as-is)
 *     but only DIMTMOVE=1 adds a connector — DIMTMOVE=2 ("move text only")
 *     still draws the radius without a connector, which differs from AutoCAD.
 *   • DIMUPT, DIMATFIT — parsed but not used here yet.
 *   • ACAD_DSTYLE_DIMRADIAL_EXTENSION XDATA on the entity is ignored.
 */
export const createRadialDimension = (p: DimensionTypeParams): THREE.Object3D[] | null => {
  const { entity, color, font, collector, layer, transform, dv = DEFAULT_DIM_VARS, fmt } = p;
  const textColor = p.textColor ?? color;
  const center = entity.anchorPoint; // code 10
  const arcPt = entity.diameterOrRadiusPoint; // code 15
  const textPos = entity.middleOfText; // code 11

  if (!center || !arcPt) return null;

  let dimensionText = entity.text;
  const measurement = entity.actualMeasurement ??
    Math.sqrt((center.x - arcPt.x) ** 2 + (center.y - arcPt.y) ** 2);

  if (dimensionText) {
    const measStr = "R" + formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin);
    dimensionText = dimensionText.replace(/<>/g, measStr);
  }
  if (!dimensionText) {
    dimensionText = "R" + formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin);
  }

  const textHeight = entity.textHeight || dv.textHeight;
  const objects: THREE.Object3D[] = [];
  const lineMat = new THREE.LineBasicMaterial({ color });
  const arrowMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

  // Radius direction (centre → arcPt) and its perpendicular (CCW 90°).
  const radius = measurement;
  const rdx = arcPt.x - center.x;
  const rdy = arcPt.y - center.y;
  const rlen = Math.sqrt(rdx * rdx + rdy * rdy);
  if (rlen < EPSILON) return null;
  const outDirX = rdx / rlen;
  const outDirY = rdy / rlen;
  const perpDirX = -outDirY;
  const perpDirY = outDirX;

  // Resolved DIMSTYLE variables with ISO defaults.
  const dimtih = p.dimtih ?? 0;
  const dimtoh = p.dimtoh ?? 0;
  const dimtad = p.dimtad ?? 1; // 1 = text above line (ISO default)
  // Default DIMGAP follows the historical 0.4 × textHeight that the previous
  // implementation used; replaced when DIMSTYLE actually sets it.
  const dimgap = p.dimgap ?? textHeight * 0.4;
  const dimtmove = p.dimtmove ?? 0;
  // Bit 5 (=32) of code 70 = "default position", per DXF spec.
  const defaultPosition = ((entity.dimensionType ?? 0) & 32) !== 0;

  if (!textPos) {
    // No text: full radius line + outward-pointing arrow. Acts as a sane fallback.
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(center.x, center.y, 0),
      new THREE.Vector3(arcPt.x, arcPt.y, 0),
    ]);
    objects.push(new THREE.Line(lineGeom, lineMat));
    objects.push(createArrow(
      new THREE.Vector3(center.x, center.y, 0.1),
      new THREE.Vector3(arcPt.x, arcPt.y, 0.1),
      dv.arrowSize, arrowMat,
    ));
    tagDimParts(objects);
    return objects;
  }

  // Decompose textPos relative to centre into (along radius, perpendicular).
  const trx = textPos.x - center.x;
  const tryy = textPos.y - center.y;
  const textAlong = trx * outDirX + tryy * outDirY;
  const textPerp = trx * perpDirX + tryy * perpDirY;
  const textInside = textAlong <= radius;
  const aligned = textInside ? dimtih !== 1 : dimtoh !== 1;

  if (!aligned) {
    // ── Horizontal mode (DIMTIH=1 or DIMTOH=1, ANSI-style) ─────────────────
    // Leader + horizontal text + underline (existing behaviour preserved).
    const arcVec = new THREE.Vector3(arcPt.x, arcPt.y, 0);
    const underlineY = textPos.y - textHeight / 2;
    const leaderDx = center.x - arcPt.x;
    const leaderDy = center.y - arcPt.y;
    const leaderLen = Math.sqrt(leaderDx * leaderDx + leaderDy * leaderDy);
    const leaderDirX = leaderLen > EPSILON ? leaderDx / leaderLen : 1;
    const leaderDirY = leaderLen > EPSILON ? leaderDy / leaderLen : 0;
    let intersectX = textPos.x;
    if (Math.abs(leaderDirY) > EPSILON) {
      const t = (underlineY - arcPt.y) / leaderDirY;
      intersectX = arcPt.x + t * leaderDirX;
    }
    const textWidth = measureDimensionTextWidth(font!, dimensionText, textHeight);
    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: textPos.x, posY: textPos.y, posZ: 0.2, transform,
    });
    const tailEndPoint = new THREE.Vector3(intersectX, underlineY, 0);
    objects.push(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([arcVec, tailEndPoint]),
      lineMat,
    ));
    const textLeft = textPos.x - textWidth / 2;
    const textRight = textPos.x + textWidth / 2;
    const underlineLeft = intersectX <= textPos.x ? intersectX : textLeft;
    const underlineRight = intersectX <= textPos.x ? textRight : intersectX;
    objects.push(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(underlineLeft, underlineY, 0),
        new THREE.Vector3(underlineRight, underlineY, 0),
      ]),
      lineMat,
    ));
    objects.push(createArrow(
      new THREE.Vector3(tailEndPoint.x, tailEndPoint.y, 0.1),
      new THREE.Vector3(arcPt.x, arcPt.y, 0.1),
      dv.arrowSize, arrowMat,
    ));
    tagDimParts(objects);
    return objects;
  }

  // ── Aligned mode ───────────────────────────────────────────────────────
  // Use the "readable" radius angle in [-π/2, π/2]. With that rotation the text
  // ascender direction lands on the perpendicular side opposite to the readable
  // flip (CCW 90° from the readable baseline).
  let textAngle = Math.atan2(outDirY, outDirX);
  if (textAngle > Math.PI / 2) textAngle -= Math.PI;
  if (textAngle < -Math.PI / 2) textAngle += Math.PI;
  const aboveDirX = -Math.sin(textAngle);
  const aboveDirY = Math.cos(textAngle);
  // Project "above" onto our perpDir to know which perp side is "above" for the
  // readable rotation.
  const abovePerpSign = aboveDirX * perpDirX + aboveDirY * perpDirY; // +1 or -1

  // For default-position dims (CAD chose textPos automatically), if textPos sits
  // on the opposite perp side from "above" of the readable rotation we mirror
  // its perpendicular offset so the glyphs end up on the correct side. This
  // matches how AutoCAD would auto-lay-out the same dim and avoids upside-down
  // text. User-positioned dims (defaultPosition bit clear) are respected as-is.
  let renderTextX = textPos.x;
  let renderTextY = textPos.y;
  const onLine = Math.abs(textPerp) < textHeight * 0.1;
  if (defaultPosition && !onLine) {
    // Desired perp side = sign(abovePerpSign). Current textPos.perp side = sign(textPerp).
    const currentSign = textPerp >= 0 ? 1 : -1;
    if (currentSign * abovePerpSign < 0) {
      // Reflect textPos perpendicularly through the radius axis so it lands on
      // the "above" side of the readable rotation.
      const newPerp = -textPerp;
      const footX = center.x + outDirX * textAlong;
      const footY = center.y + outDirY * textAlong;
      renderTextX = footX + perpDirX * newPerp;
      renderTextY = footY + perpDirY * newPerp;
    }
  }

  const textWidth = measureDimensionTextWidth(font!, dimensionText, textHeight);
  const halfWidth = textWidth / 2;
  // The line breaks around the text only when DIMTAD=0 (text centred on line)
  // — DIMTAD≥1 keeps the line continuous because the text is offset
  // perpendicular by `dimgap + textHeight/2`.
  const breakLine = dimtad === 0;

  if (textInside) {
    // Text projects inside the arc. The dim line runs from centre up to the
    // arrow base; the arrow sits at arcPt pointing OUTWARD (body inside arc).
    const arrowBaseDist = Math.max(0, radius - dv.arrowSize);
    if (breakLine && textAlong > EPSILON) {
      const nearDist = Math.max(0, textAlong - halfWidth - dimgap);
      const farDist = textAlong + halfWidth + dimgap;
      if (nearDist > EPSILON) {
        objects.push(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(center.x, center.y, 0),
            new THREE.Vector3(center.x + outDirX * nearDist, center.y + outDirY * nearDist, 0),
          ]),
          lineMat,
        ));
      }
      if (farDist < arrowBaseDist) {
        objects.push(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(center.x + outDirX * farDist, center.y + outDirY * farDist, 0),
            new THREE.Vector3(center.x + outDirX * arrowBaseDist, center.y + outDirY * arrowBaseDist, 0),
          ]),
          lineMat,
        ));
      }
    } else if (arrowBaseDist > EPSILON) {
      objects.push(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(center.x, center.y, 0),
          new THREE.Vector3(center.x + outDirX * arrowBaseDist, center.y + outDirY * arrowBaseDist, 0),
        ]),
        lineMat,
      ));
    }
    objects.push(createArrow(
      new THREE.Vector3(center.x, center.y, 0.1),
      new THREE.Vector3(arcPt.x, arcPt.y, 0.1),
      dv.arrowSize, arrowMat,
    ));
  } else {
    // Text outside the arc. ISO convention: NO line from the centre — just
    // an arrow at arcPt pointing inward (body outside the arc on the text side)
    // and a leader extending OUTWARD along the radius:
    //   – DIMTAD=0: leader stops at the near-arc edge of the text (text breaks line)
    //   – DIMTAD≥1: leader runs UNDER the text up to its far (outer) edge
    const arrowSizeLen = dv.arrowSize;
    const arrowBaseAlong = radius + arrowSizeLen;
    const leaderEndAlong = breakLine
      ? textAlong - halfWidth - dimgap
      : textAlong + halfWidth;
    if (leaderEndAlong > arrowBaseAlong) {
      objects.push(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(center.x + outDirX * arrowBaseAlong, center.y + outDirY * arrowBaseAlong, 0),
          new THREE.Vector3(center.x + outDirX * leaderEndAlong, center.y + outDirY * leaderEndAlong, 0),
        ]),
        lineMat,
      ));
    }
    // Arrow `from` lies further out so createArrow places the tip-side base
    // OUTSIDE the arc — arrow points inward toward the arc.
    objects.push(createArrow(
      new THREE.Vector3(center.x + outDirX * arrowBaseAlong, center.y + outDirY * arrowBaseAlong, 0.1),
      new THREE.Vector3(arcPt.x, arcPt.y, 0.1),
      dv.arrowSize, arrowMat,
    ));
  }

  // DIMTMOVE=1 (user moved text + leader): drop a connector from the projected
  // foot of textPos on the radius line down to textPos itself. defaultPosition
  // means CAD placed the text, so this connector is skipped in that case.
  // The threshold is generous — we only draw if perpendicular offset is well
  // beyond the natural DIMTAD vertical gap.
  if (!defaultPosition && dimtmove === 1) {
    const naturalPerp = dimtad >= 1 ? dimgap + textHeight / 2 : 0;
    if (Math.abs(textPerp) > naturalPerp + textHeight) {
      const footX = center.x + outDirX * textAlong;
      const footY = center.y + outDirY * textAlong;
      objects.push(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(footX, footY, 0),
          new THREE.Vector3(renderTextX, renderTextY, 0),
        ]),
        lineMat,
      ));
    }
  }

  addDimensionTextToCollector({
    collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
    posX: renderTextX, posY: renderTextY, posZ: 0.2, rotation: textAngle, hAlign: "center", transform,
  });

  tagDimParts(objects);
  return objects;
};

/**
 * Create a diametric dimension (type 3).
 * Diameter line between two points on the circle with arrows on both ends.
 * Text can be along the line or offset with a leader.
 */
export const createDiametricDimension = (p: DimensionTypeParams): THREE.Object3D[] | null => {
  const { entity, color, font, collector, layer, transform, dv = DEFAULT_DIM_VARS, fmt } = p;
  const textColor = p.textColor ?? color;
  const p10 = entity.anchorPoint; // code 10 -- first point on circle
  const p15 = entity.diameterOrRadiusPoint; // code 15 -- opposite point
  const textPos = entity.middleOfText; // code 11

  if (!p10 || !p15) return null;

  let dimensionText = entity.text;
  const measurement = entity.actualMeasurement ??
    Math.sqrt((p10.x - p15.x) ** 2 + (p10.y - p15.y) ** 2);

  if (dimensionText) {
    dimensionText = dimensionText.replace(/<>/g, formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin));
  }

  if (!dimensionText) {
    dimensionText = formatDimNumber(measurement, fmt?.dimdec, fmt?.dimzin);
  }

  const textHeight = entity.textHeight || dv.textHeight;
  const objects: THREE.Object3D[] = [];
  const lineMat = new THREE.LineBasicMaterial({ color });
  const arrowMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

  const cx = (p10.x + p15.x) / 2;
  const cy = (p10.y + p15.y) / 2;

  const dx10 = cx - p10.x;
  const dy10 = cy - p10.y;
  const len10 = Math.sqrt(dx10 * dx10 + dy10 * dy10);
  const dir10x = len10 > EPSILON ? dx10 / len10 : 1;
  const dir10y = len10 > EPSILON ? dy10 / len10 : 0;

  // Determine if text projects onto the diameter segment (t ∈ [0,1]). When it
  // does we render aligned text along the diameter — the previous perpendicular
  // distance constraint (perpDist < textHeight) used to also require text to sit
  // right on the line, but that excluded perfectly normal cases where the source
  // CAD placed the text slightly offset perpendicular (DIMTAD=1 + DIMGAP). On-segment
  // text deserves the aligned treatment regardless of perpendicular offset; only
  // text whose projection falls OUTSIDE the segment is treated as "leader + shelf".
  let textOnLine = false;
  let textT = 0;
  let textPerpDiam = 0;
  let fullDiamLen = 0;
  if (textPos) {
    fullDiamLen = len10 * 2;
    if (fullDiamLen > EPSILON) {
      // Unit vector p15 → p10 (so t=0 at p15 and t=1 at p10).
      const ux = (p10.x - p15.x) / fullDiamLen;
      const uy = (p10.y - p15.y) / fullDiamLen;
      textT = ((textPos.x - p15.x) * ux + (textPos.y - p15.y) * uy) / fullDiamLen;
      // Signed perpendicular (CCW 90° from baseline). Used for DIMTAD mirroring.
      textPerpDiam = -(textPos.x - p15.x) * uy + (textPos.y - p15.y) * ux;
      textOnLine = textT >= 0 && textT <= 1;
    }
  }

  // Arrow direction: outward (from center) when text inside, inward when text offset
  const arrowSign = textOnLine ? 1 : -1;
  const arrow10From = new THREE.Vector3(
    p10.x + arrowSign * dir10x * dv.arrowSize,
    p10.y + arrowSign * dir10y * dv.arrowSize,
    0.1,
  );
  objects.push(
    createArrow(arrow10From, new THREE.Vector3(p10.x, p10.y, 0.1), dv.arrowSize, arrowMat),
  );
  const arrow15From = new THREE.Vector3(
    p15.x - arrowSign * dir10x * dv.arrowSize,
    p15.y - arrowSign * dir10y * dv.arrowSize,
    0.1,
  );
  objects.push(
    createArrow(arrow15From, new THREE.Vector3(p15.x, p15.y, 0.1), dv.arrowSize, arrowMat),
  );

  const diamLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p15.x, p15.y, 0),
    new THREE.Vector3(p10.x, p10.y, 0),
  ]);
  objects.push(new THREE.Line(diamLineGeom, lineMat));

  if (textPos && textOnLine) {
    // Text projects onto the diameter segment. DIMTIH=1 (horizontal) overrides
    // the aligned default — ANSI-style sheets use that. Otherwise we render
    // aligned text along the diameter direction with a readability flip.
    const aligned = p.dimtih !== 1;
    let angle = 0;
    let renderX = textPos.x;
    let renderY = textPos.y;
    if (aligned) {
      angle = Math.atan2(p10.y - p15.y, p10.x - p15.x);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;

      // Mirror textPos across the diameter axis for default-position dims when
      // the source CAD placed it on the perp side opposite to the readable
      // rotation's "above" — same trick as radial. Without this the readable
      // flip can put glyph ascenders pointing at the diameter line.
      const defaultPosition = ((entity.dimensionType ?? 0) & 32) !== 0;
      const onLineExact = Math.abs(textPerpDiam) < textHeight * 0.1;
      if (defaultPosition && !onLineExact && fullDiamLen > EPSILON) {
        const ux = (p10.x - p15.x) / fullDiamLen;
        const uy = (p10.y - p15.y) / fullDiamLen;
        // perpDir = CCW 90° from u (which is the readable "above" of `angle`
        // before the flip — after flipping into the readable half-turn, the
        // sign relationship still holds: text's "above" lies on the +perpDiam
        // side after any single flip).
        const perpDirX = -uy;
        const perpDirY = ux;
        const aboveDirX = -Math.sin(angle);
        const aboveDirY = Math.cos(angle);
        const abovePerpSign = aboveDirX * perpDirX + aboveDirY * perpDirY;
        const currentSign = textPerpDiam >= 0 ? 1 : -1;
        if (currentSign * abovePerpSign < 0) {
          // Reflect textPos perpendicularly across the diameter axis.
          const footT = textT;
          const footX = p15.x + ux * (footT * fullDiamLen);
          const footY = p15.y + uy * (footT * fullDiamLen);
          renderX = footX - perpDirX * textPerpDiam;
          renderY = footY - perpDirY * textPerpDiam;
        }
      }
    }
    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: renderX, posY: renderY, posZ: 0.2, rotation: angle, transform,
    });
  } else if (textPos) {
    // Text offset outside -- leader from nearest line end toward text
    const dist10 = (textPos.x - p10.x) ** 2 + (textPos.y - p10.y) ** 2;
    const dist15 = (textPos.x - p15.x) ** 2 + (textPos.y - p15.y) ** 2;
    const nearPt = dist10 <= dist15 ? p10 : p15;
    const dxN = cx - nearPt.x;
    const dyN = cy - nearPt.y;
    const lenN = Math.sqrt(dxN * dxN + dyN * dyN);
    const dirNx = lenN > EPSILON ? dxN / lenN : 1;
    const dirNy = lenN > EPSILON ? dyN / lenN : 0;

    // Underline Y for leader geometry: bottom of text area
    const underlineY = textPos.y - textHeight / 2;

    let intersectX = textPos.x;
    if (Math.abs(dirNy) > EPSILON) {
      const t = (underlineY - nearPt.y) / dirNy;
      intersectX = nearPt.x + t * dirNx;
    }

    const textWidth = measureDimensionTextWidth(font!, dimensionText, textHeight);
    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: textPos.x, posY: textPos.y, posZ: 0.2, transform,
    });

    const textLeft = textPos.x - textWidth / 2;
    const textRight = textPos.x + textWidth / 2;

    const nearVec = new THREE.Vector3(nearPt.x, nearPt.y, 0);
    const tailEnd = new THREE.Vector3(intersectX, underlineY, 0);
    const tailGeom = new THREE.BufferGeometry().setFromPoints([nearVec, tailEnd]);
    objects.push(new THREE.Line(tailGeom, lineMat));

    const underlineLeft = intersectX <= textPos.x ? intersectX : textLeft;
    const underlineRight = intersectX <= textPos.x ? textRight : intersectX;
    const underlineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(underlineLeft, underlineY, 0),
      new THREE.Vector3(underlineRight, underlineY, 0),
    ]);
    objects.push(new THREE.Line(underlineGeom, lineMat));
  } else {
    const diamLineGeom2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p15.x, p15.y, 0),
      new THREE.Vector3(p10.x, p10.y, 0),
    ]);
    objects.push(new THREE.Line(diamLineGeom2, lineMat));
    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: cx, posY: cy, posZ: 0.2, transform,
    });
  }

  if (objects.length === 0) return null;
  tagDimParts(objects);
  return objects;
};

/**
 * Compute intersection of two infinite lines (2D).
 * Returns null if lines are parallel.
 */
export const intersectLines2D = (a: Line2D, b: Line2D): { x: number; y: number } | null => {
  const d1x = a.x2 - a.x1;
  const d1y = a.y2 - a.y1;
  const d2x = b.x2 - b.x1;
  const d2y = b.y2 - b.y1;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < EPSILON) return null;
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / denom;
  return { x: a.x1 + t * d1x, y: a.y1 + t * d1y };
};

/** Normalize angle to [0, 2pi) */
export const normalizeAngle = (a: number): number => {
  const TWO_PI = Math.PI * 2;
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
};

/** Check whether testAngle lies within the CCW arc from startAngle to endAngle. */
export const isAngleInSweep = (startAngle: number, endAngle: number, testAngle: number): boolean => {
  const s = normalizeAngle(startAngle);
  const e = normalizeAngle(endAngle);
  const t = normalizeAngle(testAngle);
  if (s < e) {
    return t >= s && t <= e;
  }
  // Arc crosses 0
  return t >= s || t <= e;
};

/**
 * Create an angular dimension (type 2).
 * Arc between two rays with extension lines, arrows, and angle text in degrees.
 */
export const createAngularDimension = (p: DimensionTypeParams): THREE.Object3D[] | null => {
  const { entity, color, font, collector, layer, transform, dv = DEFAULT_DIM_VARS, fmt } = p;
  const textColor = p.textColor ?? color;
  const p13 = entity.linearOrAngularPoint1; // code 13 -- end 1 of first line
  const p14 = entity.linearOrAngularPoint2; // code 14 -- end 2 of first line
  const p15 = entity.diameterOrRadiusPoint; // code 15 -- end 1 of second line
  const p10 = entity.anchorPoint; // code 10 -- end 2 of second line
  const p16 = entity.arcPoint; // code 16 -- point on arc (defines radius)
  const textPos = entity.middleOfText; // code 11

  if (!p13 || !p14 || !p15 || !p10) return null;

  // Find the angle vertex (intersection of the two lines)
  let vertex: { x: number; y: number };
  const dist14_15 = Math.sqrt((p14.x - p15.x) ** 2 + (p14.y - p15.y) ** 2);
  if (dist14_15 < EPSILON) {
    // Lines converge at the same point
    vertex = { x: p14.x, y: p14.y };
  } else {
    const v = intersectLines2D(
      { x1: p13.x, y1: p13.y, x2: p14.x, y2: p14.y },
      { x1: p15.x, y1: p15.y, x2: p10.x, y2: p10.y },
    );
    if (!v) return null; // Parallel lines
    vertex = v;
  }

  // Compute angles and distances from vertex to all 4 endpoints
  const rays = [
    { angle: Math.atan2(p13.y - vertex.y, p13.x - vertex.x), pt: p13, line: 1 as const,
      dist: Math.sqrt((p13.x - vertex.x) ** 2 + (p13.y - vertex.y) ** 2) },
    { angle: Math.atan2(p14.y - vertex.y, p14.x - vertex.x), pt: p14, line: 1 as const,
      dist: Math.sqrt((p14.x - vertex.x) ** 2 + (p14.y - vertex.y) ** 2) },
    { angle: Math.atan2(p15.y - vertex.y, p15.x - vertex.x), pt: p15, line: 2 as const,
      dist: Math.sqrt((p15.x - vertex.x) ** 2 + (p15.y - vertex.y) ** 2) },
    { angle: Math.atan2(p10.y - vertex.y, p10.x - vertex.x), pt: p10, line: 2 as const,
      dist: Math.sqrt((p10.x - vertex.x) ** 2 + (p10.y - vertex.y) ** 2) },
  ];

  const radius = p16
    ? Math.sqrt((p16.x - vertex.x) ** 2 + (p16.y - vertex.y) ** 2)
    : Math.max(...rays.map(r => r.dist)) * 0.8;

  if (radius < EPSILON) return null;

  // Determine start/end angles and extension line endpoints.
  // Two lines through the vertex create 4 sectors; arcPoint (p16) selects the correct one.
  let startAngle = 0;
  let endAngle = 0;
  let extPtStart: DxfVertex = p13;
  let extPtEnd: DxfVertex = p10;

  if (p16) {
    const arcAngle = Math.atan2(p16.y - vertex.y, p16.x - vertex.x);

    // Filter out degenerate rays (endpoint coincides with vertex)
    const validRays = rays.filter(r => r.dist > EPSILON);

    // Sort rays by normalized angle to identify sectors
    const sorted = validRays
      .map(r => ({ ...r, normAngle: normalizeAngle(r.angle) }))
      .sort((a, b) => a.normAngle - b.normAngle);

    // Find the sector between rays from different lines that contains arcAngle
    const n = sorted.length;
    let found = false;
    for (let i = 0; i < n; i++) {
      const r1 = sorted[i];
      const r2 = sorted[(i + 1) % n];
      if (r1.line === r2.line) continue;

      if (isAngleInSweep(r1.angle, r2.angle, arcAngle)) {
        startAngle = r1.angle;
        endAngle = r2.angle;
        extPtStart = r1.pt;
        extPtEnd = r2.pt;
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: use farthest endpoints with original sweep direction logic
      const farA = rays[0].dist >= rays[1].dist ? rays[0] : rays[1];
      const farB = rays[2].dist >= rays[3].dist ? rays[2] : rays[3];
      if (isAngleInSweep(farA.angle, farB.angle, arcAngle)) {
        startAngle = farA.angle;
        endAngle = farB.angle;
        extPtStart = farA.pt;
        extPtEnd = farB.pt;
      } else {
        startAngle = farB.angle;
        endAngle = farA.angle;
        extPtStart = farB.pt;
        extPtEnd = farA.pt;
      }
    }
  } else {
    // No arcPoint: use farthest endpoints
    const farA = rays[0].dist >= rays[1].dist ? rays[0] : rays[1];
    const farB = rays[2].dist >= rays[3].dist ? rays[2] : rays[3];
    startAngle = farA.angle;
    endAngle = farB.angle;
    extPtStart = farA.pt;
    extPtEnd = farB.pt;
  }

  // Always CCW sweep
  let sweep = normalizeAngle(endAngle - startAngle);
  if (sweep < EPSILON) sweep = Math.PI * 2;

  const objects: THREE.Object3D[] = [];
  const lineMat = new THREE.LineBasicMaterial({ color });
  const dashedMat = new THREE.LineDashedMaterial({
    color,
    dashSize: dv.extLineDash,
    gapSize: dv.extLineGap,
  });
  const arrowMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

  // --- Compute dimension text before drawing arc (needed for text gap) ---
  let dimensionText = entity.text;
  const measurement = entity.actualMeasurement;

  // Angular measurement is stored in radians; convert to degrees for display.
  // Use DIMADEC for decimal places (defaults to 0 in AutoCAD if not specified).
  if (typeof measurement === "number") {
    const degrees = (measurement * DEGREES_TO_RADIANS_DIVISOR) / Math.PI;
    const measStr = formatDimNumber(degrees, fmt?.dimadec, fmt?.dimzin) + "\u00B0";
    if (dimensionText) {
      dimensionText = dimensionText.replace(/<>/g, measStr);
    } else {
      dimensionText = measStr;
    }
  }

  const textHeight = entity.textHeight || dv.textHeight;

  // Compute text position and angle
  let textAngle: number;
  let textX: number;
  let textY: number;
  let textOnArc = false;

  if (dimensionText && textPos) {
    textX = textPos.x;
    textY = textPos.y;
    textAngle = Math.atan2(textPos.y - vertex.y, textPos.x - vertex.x);
    const textDist = Math.sqrt((textPos.x - vertex.x) ** 2 + (textPos.y - vertex.y) ** 2);
    textOnArc = Math.abs(textDist - radius) < textHeight
      && isAngleInSweep(startAngle, endAngle, textAngle);
  } else {
    // Default: place text at arc midpoint, offset outward (not on arc)
    const midAngle = startAngle + sweep / 2;
    const textRadius = radius + textHeight * 0.8;
    textX = vertex.x + textRadius * Math.cos(midAngle);
    textY = vertex.y + textRadius * Math.sin(midAngle);
    textAngle = midAngle;
  }

  // --- Draw arc, splitting around text if text lies on it ---
  const addArcSegment = (fromAngle: number, toAngle: number) => {
    const arcSweep = normalizeAngle(toAngle - fromAngle);
    if (arcSweep < EPSILON) return;
    const segs = Math.max(MIN_ARC_SEGMENTS, Math.floor((arcSweep * CIRCLE_SEGMENTS) / (Math.PI * 2)));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = fromAngle + (i / segs) * arcSweep;
      pts.push(new THREE.Vector3(vertex.x + radius * Math.cos(a), vertex.y + radius * Math.sin(a), 0));
    }
    objects.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  };

  if (textOnArc && dimensionText && font) {
    const textWidth = measureDimensionTextWidth(font, dimensionText, textHeight);
    const halfGapAngle = (textWidth / 2 + dv.textGap / 4) / radius;
    addArcSegment(startAngle, textAngle - halfGapAngle);
    addArcSegment(textAngle + halfGapAngle, endAngle);
  } else {
    addArcSegment(startAngle, endAngle);
  }

  // Extension lines from ray endpoints to points on the arc
  const arcStartPt = new THREE.Vector3(
    vertex.x + radius * Math.cos(startAngle),
    vertex.y + radius * Math.sin(startAngle),
    0,
  );
  const arcEndPt = new THREE.Vector3(
    vertex.x + radius * Math.cos(endAngle),
    vertex.y + radius * Math.sin(endAngle),
    0,
  );

  const extLineA = createExtensionLine(
    new THREE.Vector3(extPtStart.x, extPtStart.y, 0),
    arcStartPt,
    dashedMat,
    dv.extLineExtension,
  );
  objects.push(extLineA);

  const extLineB = createExtensionLine(
    new THREE.Vector3(extPtEnd.x, extPtEnd.y, 0),
    arcEndPt,
    dashedMat,
    dv.extLineExtension,
  );
  objects.push(extLineB);

  // Arrowheads or tick marks at arc endpoints
  if (dv.useTicks) {
    // Tick marks: oriented along arc tangent at each endpoint
    objects.push(createTick(new THREE.Vector3(arcStartPt.x, arcStartPt.y, 0.1), dv.tickSize, startAngle + Math.PI / 2, lineMat));
    objects.push(createTick(new THREE.Vector3(arcEndPt.x, arcEndPt.y, 0.1), dv.tickSize, endAngle + Math.PI / 2, lineMat));
  } else {
    // Arrows follow arc curvature (chord direction, not pure tangent)
    const arrowArcAngle = dv.arrowSize / radius;

    const innerStartA = startAngle + arrowArcAngle;
    const arrowStartFrom = new THREE.Vector3(
      vertex.x + radius * Math.cos(innerStartA),
      vertex.y + radius * Math.sin(innerStartA),
      0.1,
    );
    objects.push(createArrow(arrowStartFrom, new THREE.Vector3(arcStartPt.x, arcStartPt.y, 0.1), dv.arrowSize, arrowMat));

    const innerEndA = endAngle - arrowArcAngle;
    const arrowEndFrom = new THREE.Vector3(
      vertex.x + radius * Math.cos(innerEndA),
      vertex.y + radius * Math.sin(innerEndA),
      0.1,
    );
    objects.push(createArrow(arrowEndFrom, new THREE.Vector3(arcEndPt.x, arcEndPt.y, 0.1), dv.arrowSize, arrowMat));
  }

  // --- Render text ---
  if (dimensionText) {
    // Rotate text along arc tangent (perpendicular to radius), keep it readable
    let textRotation = textAngle + Math.PI / 2;
    const norm = normalizeAngle(textRotation);
    if (norm > Math.PI / 2 && norm < Math.PI * 1.5) {
      textRotation += Math.PI;
    }

    addDimensionTextToCollector({
      collector: collector!, layer: layer!, color: textColor, font: font!, rawText: dimensionText, height: textHeight,
      posX: textX, posY: textY, posZ: 0.2, rotation: textRotation, transform,
    });
  }

  if (objects.length === 0) return null;
  tagDimParts(objects, dashedMat);
  return objects;
};
