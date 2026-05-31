/**
 * Pure entity → property-section model for the PropertiesPanel UI component.
 *
 * Lives in dxf-react because it's a presentation concern (the same DxfEntity
 * shapes can be rendered very differently in a panel vs. a tooltip vs. an
 * export). Keeping it out of dxf-render avoids inflating the framework-agnostic
 * core with view-specific formatting logic.
 *
 * Read-only: this module does NOT mutate or extend the entity in any way.
 */

import type {
  DxfEntity,
  DxfVertex,
  DxfLineEntity,
  DxfCircleEntity,
  DxfArcEntity,
  DxfEllipseEntity,
  DxfPointEntity,
  DxfPolylineEntity,
  DxfSplineEntity,
  DxfTextEntity,
  DxfDimensionEntity,
  DxfInsertEntity,
  DxfSolidEntity,
  Dxf3DFaceEntity,
  DxfHatchEntity,
  DxfLeaderEntity,
  DxfMLeaderEntity,
  DxfMlineEntity,
  DxfXlineEntity,
  DxfAttribEntity,
  DxfAttdefEntity,
} from "dxf-render";
import { rgbNumberToHex, ACI_PALETTE } from "dxf-render";

/** ACI indices that map to theme-adaptive sentinels in the renderer. */
const THEME_ADAPTIVE_ACI = new Set([7, 250, 251, 255]);

export interface PropertyRow {
  label: string;
  value: string;
  /** Render value in a monospace font (handles, coords). */
  mono?: boolean;
  /** Optional color swatch (hex) shown left of the value. */
  swatch?: string;
}

export interface PropertySection {
  title: string;
  rows: PropertyRow[];
}

const NEUTRAL_SWATCH = "#888888";

const formatNumber = (n: number | undefined, digits = 2): string => {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100000 || (Math.abs(n) > 0 && Math.abs(n) < 0.001)) {
    return n.toExponential(2);
  }
  // Trim trailing zeros after the decimal point.
  const fixed = n.toFixed(digits);
  return fixed.replace(/\.?0+$/, "") || "0";
};

const formatPoint = (p: DxfVertex | undefined): string => {
  if (!p) return "—";
  const x = formatNumber(p.x);
  const y = formatNumber(p.y);
  const z = p.z;
  if (z === undefined || z === 0) return `(${x}, ${y})`;
  return `(${x}, ${y}, ${formatNumber(z)})`;
};

const formatAngleRadians = (rad: number | undefined): string => {
  if (rad === undefined || !Number.isFinite(rad)) return "—";
  const deg = (rad * 180) / Math.PI;
  return `${formatNumber(deg, 2)}°`;
};

const formatAngleDegrees = (deg: number | undefined): string => {
  if (deg === undefined || !Number.isFinite(deg)) return "—";
  return `${formatNumber(deg, 2)}°`;
};

const formatBool = (b: boolean | undefined): string => (b ? "Yes" : "No");

const lineweightLabel = (lw: number | undefined): string => {
  if (lw === undefined) return "ByLayer";
  if (lw === -3) return "Standard";
  if (lw === -2) return "ByLayer";
  if (lw === -1) return "ByBlock";
  // DXF lineweight is in hundredths of a millimeter (e.g. 25 → 0.25 mm).
  return `${(lw / 100).toFixed(2)} mm`;
};

/** Distance between two DXF vertices (3D when Z present on either). */
const distance = (a: DxfVertex, b: DxfVertex): number => {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

interface ColorDisplay {
  label: string;
  swatch?: string;
}

/**
 * Resolve the color row's label + swatch from the raw entity color fields.
 * Theme-adaptive ACI sentinels (7/255/250/251) collapse to a neutral grey
 * swatch — actual rendering colour depends on the live theme, which the
 * panel doesn't know about and isn't worth threading through.
 */
const resolveColorDisplay = (
  colorIndex: number | undefined,
  trueColor: number | undefined,
): ColorDisplay => {
  if (trueColor !== undefined && Number.isFinite(trueColor)) {
    const hex = rgbNumberToHex(trueColor);
    return { label: `True color ${hex.toUpperCase()}`, swatch: hex };
  }
  if (colorIndex === undefined || colorIndex === 256) {
    return { label: "ByLayer", swatch: NEUTRAL_SWATCH };
  }
  if (colorIndex === 0) {
    return { label: "ByBlock", swatch: NEUTRAL_SWATCH };
  }
  if (colorIndex < 1 || colorIndex > 255) {
    return { label: `ACI ${colorIndex}`, swatch: NEUTRAL_SWATCH };
  }
  if (THEME_ADAPTIVE_ACI.has(colorIndex)) {
    return { label: `ACI ${colorIndex}`, swatch: NEUTRAL_SWATCH };
  }
  return { label: `ACI ${colorIndex}`, swatch: rgbNumberToHex(ACI_PALETTE[colorIndex]) };
};

/** Build the "General" section common to every entity. */
const generalSection = (entity: DxfEntity): PropertySection => {
  const rows: PropertyRow[] = [];
  rows.push({ label: "Type", value: entity.type });
  if (entity.handle !== undefined) {
    rows.push({ label: "Handle", value: String(entity.handle), mono: true });
  }
  rows.push({ label: "Layer", value: entity.layer || "0" });

  const color = resolveColorDisplay(entity.colorIndex, entity.color);
  rows.push({ label: "Color", value: color.label, swatch: color.swatch });

  rows.push({ label: "Linetype", value: entity.lineType || "ByLayer" });
  rows.push({ label: "Lineweight", value: lineweightLabel(entity.lineweight) });

  if (entity.lineTypeScale !== undefined && entity.lineTypeScale !== 1) {
    rows.push({ label: "Linetype scale", value: formatNumber(entity.lineTypeScale, 3) });
  }
  if (entity.visible === false) {
    rows.push({ label: "Visible", value: "No" });
  }
  if (entity.inPaperSpace) {
    rows.push({ label: "Space", value: "Paper" });
  }
  return { title: "General", rows };
};

// --- Per-type geometry sections -------------------------------------------

const lineGeometry = (e: DxfLineEntity): PropertySection => {
  const [start, end] = e.vertices;
  return {
    title: "Geometry",
    rows: [
      { label: "Start", value: formatPoint(start), mono: true },
      { label: "End", value: formatPoint(end), mono: true },
      { label: "Length", value: formatNumber(distance(start, end), 3) },
    ],
  };
};

const circleGeometry = (e: DxfCircleEntity): PropertySection => ({
  title: "Geometry",
  rows: [
    { label: "Center", value: formatPoint(e.center), mono: true },
    { label: "Radius", value: formatNumber(e.radius, 3) },
    { label: "Diameter", value: formatNumber(e.radius * 2, 3) },
    { label: "Circumference", value: formatNumber(2 * Math.PI * e.radius, 3) },
  ],
});

const arcGeometry = (e: DxfArcEntity): PropertySection => {
  // ARC angles are stored in degrees in the DXF parser output.
  const sweepDeg = ((e.endAngle - e.startAngle) % 360 + 360) % 360;
  const length = (sweepDeg * Math.PI) / 180 * e.radius;
  return {
    title: "Geometry",
    rows: [
      { label: "Center", value: formatPoint(e.center), mono: true },
      { label: "Radius", value: formatNumber(e.radius, 3) },
      { label: "Start angle", value: formatAngleDegrees(e.startAngle) },
      { label: "End angle", value: formatAngleDegrees(e.endAngle) },
      { label: "Arc length", value: formatNumber(length, 3) },
    ],
  };
};

const ellipseGeometry = (e: DxfEllipseEntity): PropertySection => {
  const major = e.majorAxisEndPoint;
  const majorLen = Math.sqrt((major.x ?? 0) ** 2 + (major.y ?? 0) ** 2 + (major.z ?? 0) ** 2);
  return {
    title: "Geometry",
    rows: [
      { label: "Center", value: formatPoint(e.center), mono: true },
      { label: "Major axis end", value: formatPoint(major), mono: true },
      { label: "Major axis length", value: formatNumber(majorLen, 3) },
      { label: "Axis ratio", value: formatNumber(e.axisRatio, 3) },
      // ELLIPSE angles are in radians per DXF spec.
      { label: "Start angle", value: formatAngleRadians(e.startAngle) },
      { label: "End angle", value: formatAngleRadians(e.endAngle) },
    ],
  };
};

const pointGeometry = (e: DxfPointEntity): PropertySection => ({
  title: "Geometry",
  rows: [{ label: "Position", value: formatPoint(e.position), mono: true }],
});

const polylineGeometry = (e: DxfPolylineEntity): PropertySection => {
  const rows: PropertyRow[] = [
    { label: "Vertices", value: String(e.vertices.length) },
    { label: "Closed", value: formatBool(e.shape) },
  ];
  if (e.width !== undefined && e.width !== 0) {
    rows.push({ label: "Width", value: formatNumber(e.width, 3) });
  }
  if (e.isPolyfaceMesh) rows.push({ label: "Polyface mesh", value: "Yes" });
  if (e.is3dPolygonMesh) rows.push({ label: "3D polygon mesh", value: "Yes" });
  return { title: "Geometry", rows };
};

const splineGeometry = (e: DxfSplineEntity): PropertySection => {
  const cp = e.controlPoints?.length ?? e.numberOfControlPoints ?? 0;
  const fp = e.fitPoints?.length ?? 0;
  const rows: PropertyRow[] = [
    { label: "Degree", value: String(e.degree ?? e.degreeOfSplineCurve ?? "—") },
    { label: "Control points", value: String(cp) },
  ];
  if (fp > 0) rows.push({ label: "Fit points", value: String(fp) });
  if (e.closed) rows.push({ label: "Closed", value: "Yes" });
  if (e.periodic) rows.push({ label: "Periodic", value: "Yes" });
  return { title: "Geometry", rows };
};

const solidGeometry = (e: DxfSolidEntity | Dxf3DFaceEntity): PropertySection => {
  // SOLID stores its 4 vertices under `points`; 3DFACE uses `vertices`.
  const pts: DxfVertex[] = e.type === "SOLID" ? Array.from(e.points) : e.vertices;
  return {
    title: "Geometry",
    rows: [
      { label: "Vertices", value: String(pts.length) },
      ...pts.slice(0, 4).map<PropertyRow>((v, i) => ({
        label: `V${i + 1}`,
        value: formatPoint(v),
        mono: true,
      })),
    ],
  };
};

const hatchGeometry = (e: DxfHatchEntity): PropertySection => {
  const rows: PropertyRow[] = [
    { label: "Pattern", value: e.patternName || "—" },
    { label: "Solid fill", value: formatBool(e.solid) },
    { label: "Boundary paths", value: String(e.boundaryPaths.length) },
  ];
  if (!e.solid) {
    if (e.patternScale !== undefined) {
      rows.push({ label: "Pattern scale", value: formatNumber(e.patternScale, 3) });
    }
    if (e.patternAngle !== undefined) {
      rows.push({ label: "Pattern angle", value: formatAngleDegrees(e.patternAngle) });
    }
  }
  return { title: "Geometry", rows };
};

const insertGeometry = (e: DxfInsertEntity): PropertySection => {
  const rows: PropertyRow[] = [
    { label: "Block name", value: e.name },
    { label: "Position", value: formatPoint(e.position), mono: true },
  ];
  if (e.rotation !== undefined && e.rotation !== 0) {
    rows.push({ label: "Rotation", value: formatAngleDegrees(e.rotation) });
  }
  const xs = e.xScale ?? 1;
  const ys = e.yScale ?? 1;
  const zs = e.zScale ?? 1;
  if (xs !== 1 || ys !== 1 || zs !== 1) {
    rows.push({
      label: "Scale",
      value: `(${formatNumber(xs, 3)}, ${formatNumber(ys, 3)}, ${formatNumber(zs, 3)})`,
      mono: true,
    });
  }
  const cols = e.columnCount ?? 1;
  const rowsArr = e.rowCount ?? 1;
  if (cols > 1 || rowsArr > 1) {
    rows.push({ label: "Array", value: `${cols} × ${rowsArr}` });
  }
  if (e.attribs && e.attribs.length > 0) {
    rows.push({ label: "ATTRIBs", value: String(e.attribs.length) });
  }
  return { title: "Geometry", rows };
};

const DIMENSION_TYPE_LABELS: Record<number, string> = {
  0: "Linear",
  1: "Aligned",
  2: "Angular",
  3: "Diameter",
  4: "Radial",
  5: "Angular (3-point)",
  6: "Ordinate",
};

const dimensionGeometry = (e: DxfDimensionEntity): PropertySection => {
  const rows: PropertyRow[] = [];
  if (e.dimensionType !== undefined) {
    // Lower 4 bits hold the type code (upper bits are flags).
    const kind = e.dimensionType & 0x07;
    rows.push({
      label: "Dimension type",
      value: DIMENSION_TYPE_LABELS[kind] ?? `Type ${kind}`,
    });
  }
  if (e.styleName) rows.push({ label: "Style", value: e.styleName });
  if (e.actualMeasurement !== undefined) {
    rows.push({ label: "Measurement", value: formatNumber(e.actualMeasurement, 3) });
  }
  if (e.anchorPoint) {
    rows.push({ label: "Definition point", value: formatPoint(e.anchorPoint), mono: true });
  }
  if (e.middleOfText) {
    rows.push({ label: "Text mid", value: formatPoint(e.middleOfText), mono: true });
  }
  return { title: "Geometry", rows };
};

const leaderGeometry = (e: DxfLeaderEntity): PropertySection => {
  const rows: PropertyRow[] = [
    { label: "Vertices", value: String(e.vertices.length) },
  ];
  if (e.styleName) rows.push({ label: "Style", value: e.styleName });
  if (e.arrowHeadFlag === 0) rows.push({ label: "Arrowhead", value: "Off" });
  if (e.pathType === 1) rows.push({ label: "Path type", value: "Spline" });
  return { title: "Geometry", rows };
};

const mleaderGeometry = (e: DxfMLeaderEntity): PropertySection => {
  const totalVertices = e.leaders.reduce(
    (sum, b) => sum + b.lines.reduce((s, l) => s + l.vertices.length, 0),
    0,
  );
  const rows: PropertyRow[] = [
    { label: "Branches", value: String(e.leaders.length) },
    { label: "Vertices total", value: String(totalVertices) },
  ];
  if (e.textPosition) {
    rows.push({ label: "Text position", value: formatPoint(e.textPosition), mono: true });
  }
  return { title: "Geometry", rows };
};

const mlineGeometry = (e: DxfMlineEntity): PropertySection => {
  const rows: PropertyRow[] = [
    { label: "Vertices", value: String(e.numVertices) },
    { label: "Elements", value: String(e.numElements) },
    { label: "Scale", value: formatNumber(e.scale, 3) },
    { label: "Justification", value: String(e.justification) },
  ];
  if (e.styleName) rows.push({ label: "Style", value: e.styleName });
  return { title: "Geometry", rows };
};

const xlineGeometry = (e: DxfXlineEntity): PropertySection => ({
  title: "Geometry",
  rows: [
    { label: "Base point", value: formatPoint(e.basePoint), mono: true },
    { label: "Direction", value: formatPoint(e.direction), mono: true },
  ],
});

const attribGeometry = (e: DxfAttribEntity | DxfAttdefEntity): PropertySection => {
  const rows: PropertyRow[] = [];
  if (e.tag) rows.push({ label: "Tag", value: e.tag });
  if (e.startPoint) {
    rows.push({ label: "Position", value: formatPoint(e.startPoint), mono: true });
  }
  if (e.textHeight !== undefined) {
    rows.push({ label: "Height", value: formatNumber(e.textHeight, 3) });
  }
  if (e.rotation !== undefined && e.rotation !== 0) {
    rows.push({ label: "Rotation", value: formatAngleDegrees(e.rotation) });
  }
  return { title: "Geometry", rows };
};

const textGeometry = (e: DxfTextEntity): PropertySection => {
  const rows: PropertyRow[] = [];
  const pos = e.position ?? e.startPoint;
  if (pos) rows.push({ label: "Position", value: formatPoint(pos), mono: true });
  const h = e.height ?? e.textHeight;
  if (h !== undefined) rows.push({ label: "Height", value: formatNumber(h, 3) });
  if (e.rotation !== undefined && e.rotation !== 0) {
    rows.push({ label: "Rotation", value: formatAngleDegrees(e.rotation) });
  }
  if (e.width !== undefined) {
    rows.push({ label: "Reference width", value: formatNumber(e.width, 3) });
  }
  return { title: "Geometry", rows };
};

// --- Text section ---------------------------------------------------------

interface TextLike {
  text?: string;
  textStyle?: string;
  styleName?: string;
}

const buildTextSection = (entity: DxfEntity): PropertySection | null => {
  const t = entity as TextLike;
  if (!t.text || typeof t.text !== "string") return null;
  const rows: PropertyRow[] = [{ label: "Text", value: t.text }];
  const style = t.textStyle ?? t.styleName;
  if (style) rows.push({ label: "Style", value: style });
  return { title: "Text", rows };
};

// --- Public entry point ---------------------------------------------------

/**
 * Build the structured property listing for a DXF entity. Returns the
 * "General" section plus a type-specific "Geometry" section and, when the
 * entity carries text content, a "Text" section.
 *
 * Always returns at least the General section. Unknown entity types fall
 * back to General only.
 */
export function getEntityProperties(entity: DxfEntity): PropertySection[] {
  const sections: PropertySection[] = [generalSection(entity)];

  const geom = buildGeometrySection(entity);
  if (geom && geom.rows.length > 0) sections.push(geom);

  const text = buildTextSection(entity);
  if (text) sections.push(text);

  return sections;
}

function buildGeometrySection(entity: DxfEntity): PropertySection | null {
  switch (entity.type) {
    case "LINE": return lineGeometry(entity as DxfLineEntity);
    case "CIRCLE": return circleGeometry(entity as DxfCircleEntity);
    case "ARC": return arcGeometry(entity as DxfArcEntity);
    case "ELLIPSE": return ellipseGeometry(entity as DxfEllipseEntity);
    case "POINT": return pointGeometry(entity as DxfPointEntity);
    case "POLYLINE":
    case "LWPOLYLINE": return polylineGeometry(entity as DxfPolylineEntity);
    case "SPLINE": return splineGeometry(entity as DxfSplineEntity);
    case "SOLID":
    case "3DFACE": return solidGeometry(entity as DxfSolidEntity | Dxf3DFaceEntity);
    case "HATCH": return hatchGeometry(entity as DxfHatchEntity);
    case "INSERT": return insertGeometry(entity as DxfInsertEntity);
    case "DIMENSION": return dimensionGeometry(entity as DxfDimensionEntity);
    case "LEADER": return leaderGeometry(entity as DxfLeaderEntity);
    case "MULTILEADER": return mleaderGeometry(entity as DxfMLeaderEntity);
    case "MLINE": return mlineGeometry(entity as DxfMlineEntity);
    case "XLINE":
    case "RAY": return xlineGeometry(entity as DxfXlineEntity);
    case "ATTRIB":
    case "ATTDEF": return attribGeometry(entity as DxfAttribEntity | DxfAttdefEntity);
    case "TEXT":
    case "MTEXT": return textGeometry(entity as DxfTextEntity);
    default: return null;
  }
}
