import * as THREE from "three";
import type {
  DxfData,
  DxfEntity,
  DxfVertex,
  DxfBlock,
  DxfAttribEntity,
} from "@/types/dxf";
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isEllipseEntity,
  isPolylineEntity,
  isSplineEntity,
  isPointEntity,
  isSolidEntity,
  is3DFaceEntity,
  isHatchEntity,
  isMlineEntity,
  isXlineEntity,
  isRegionEntity,
  isTextEntity,
  isAttdefEntity,
  isAttribEntity,
  isDimensionEntity,
  isLeaderEntity,
  isMLeaderEntity,
  isInsertEntity,
} from "@/types/dxf";
import { buildOcsMatrix } from "@/utils/ocsTransform";
import { getInsUnitsScale } from "@/utils/insUnitsScale";
import { degreesToRadians } from "./primitives";

const MAX_RECURSION_DEPTH = 10;

export interface PickingEntry {
  /** Unique within the index — distinguishes multiple INSERT instances of the same block. */
  id: string;
  /** Original DXF handle (may be shared across instances of the same block). */
  handle: string;
  type: string;
  layer: string;
  /** Axis-aligned bounding box in world coordinates (after OCS + INSERT transforms) */
  bbox: THREE.Box3;
}

export interface PickingIndex {
  entries: PickingEntry[];
  /** O(1) DXF handle → all entries with that handle (multiple for blocks reused via INSERT). */
  byHandle: Map<string, PickingEntry[]>;
  /** O(1) unique pick-id → entry lookup. */
  byId: Map<string, PickingEntry>;
}

/**
 * Build a flat list of pickable entries with world-space bounding boxes.
 * Pure data — no Three.js objects. Used to construct an invisible picking
 * group that the raycaster intersects against.
 *
 * INSERTs are expanded recursively: each entity inside the block becomes
 * its own entry, transformed by the INSERT's world matrix. ATTRIB entities
 * attached to an INSERT are emitted as separate entries so they can be
 * highlighted independently.
 */
export function buildPickingIndex(dxf: DxfData): PickingIndex {
  const entries: PickingEntry[] = [];
  const ctx: BuildContext = { instancePath: "", instanceCounter: { n: 0 } };

  for (const entity of dxf.entities ?? []) {
    if (entity.inPaperSpace) continue;
    if (entity.visible === false) continue;
    collectEntry(entity, dxf, null, entity.layer || "0", entries, 0, ctx);
  }

  // Assign unique ids: prefer the DXF handle when it's globally unique (top-level
  // entities), otherwise suffix with the INSERT instance path so each instance of
  // a reused block gets its own id.
  const byHandle = new Map<string, PickingEntry[]>();
  const byId = new Map<string, PickingEntry>();
  for (const e of entries) {
    if (!byId.has(e.id)) byId.set(e.id, e);
    let list = byHandle.get(e.handle);
    if (!list) {
      list = [];
      byHandle.set(e.handle, list);
    }
    list.push(e);
  }

  return { entries, byHandle, byId };
}

interface BuildContext {
  /** Path of nested INSERT instance ids: "" for top level, "1F6" inside one INSERT, "1F6/1F8" nested. */
  instancePath: string;
  /** Monotonic counter to generate unique ids for entities without a handle. */
  instanceCounter: { n: number };
}

function collectEntry(
  entity: DxfEntity,
  dxf: DxfData,
  parentMatrix: THREE.Matrix4 | null,
  inheritedLayer: string,
  out: PickingEntry[],
  depth: number,
  ctx: BuildContext,
): void {
  // Resolve layer: "0" inside a block inherits from INSERT
  const layer = (!entity.layer || entity.layer === "0") ? inheritedLayer : entity.layer;

  if (entity.type === "INSERT" && isInsertEntity(entity)) {
    if (depth > MAX_RECURSION_DEPTH) return;
    expandInsert(entity, dxf, parentMatrix, layer, out, depth, ctx);
    return;
  }

  const handle = normalizeHandle(entity.handle);
  if (!handle) return;

  const localBox = computeLocalBBox(entity);
  if (!localBox || localBox.isEmpty()) return;

  // Apply OCS transform if present (entity → WCS)
  const ocs = "extrusionDirection" in entity
    ? buildOcsMatrix((entity as { extrusionDirection?: DxfVertex }).extrusionDirection)
    : null;

  // Compose: parentMatrix * ocs
  const worldMatrix = composeMatrices(parentMatrix, ocs);
  const worldBox = worldMatrix
    ? localBox.clone().applyMatrix4(worldMatrix)
    : localBox.clone();

  const id = ctx.instancePath ? `${handle}@${ctx.instancePath}` : handle;
  out.push({ id, handle, type: entity.type, layer, bbox: worldBox });
}

function expandInsert(
  insert: DxfEntity & { type: "INSERT" } & {
    name: string;
    position: DxfVertex;
    rotation?: number;
    xScale?: number;
    yScale?: number;
    zScale?: number;
    columnCount?: number;
    rowCount?: number;
    columnSpacing?: number;
    rowSpacing?: number;
    attribs?: DxfAttribEntity[];
    extrusionDirection?: DxfVertex;
  },
  dxf: DxfData,
  parentMatrix: THREE.Matrix4 | null,
  insertLayer: string,
  out: PickingEntry[],
  depth: number,
  ctx: BuildContext,
): void {
  if (!isInsertEntity(insert)) return;
  // Block geometry is optional — an INSERT may still expose ATTRIBs even if
  // the referenced block is empty or missing.
  const block: DxfBlock | undefined = dxf.blocks?.[insert.name];
  const blockEntities = block?.entities ?? [];

  const cols = insert.columnCount ?? 1;
  const rows = insert.rowCount ?? 1;
  const colSpacing = insert.columnSpacing ?? 0;
  const rowSpacing = insert.rowSpacing ?? 0;

  const drawingUnits = dxf.header?.$INSUNITS ?? 0;
  const blockRecord = dxf.tables?.blockRecord;
  const blockUnits = blockRecord?.blockRecords?.[insert.name]?.units ?? 0;
  const unitScale = getInsUnitsScale(drawingUnits, blockUnits);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pos = insert.position;
      const insertMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(
          pos.x + col * colSpacing,
          pos.y + row * rowSpacing,
          pos.z || 0,
        ),
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          insert.rotation ? degreesToRadians(insert.rotation) : 0,
        ),
        new THREE.Vector3(
          (insert.xScale ?? 1) * unitScale,
          (insert.yScale ?? 1) * unitScale,
          (insert.zScale ?? 1) * unitScale,
        ),
      );

      const ocsMatrix = buildOcsMatrix(insert.extrusionDirection);
      if (ocsMatrix) insertMatrix.premultiply(ocsMatrix);

      const worldMatrix = parentMatrix
        ? new THREE.Matrix4().multiplyMatrices(parentMatrix, insertMatrix)
        : insertMatrix;

      // The INSERT itself is also pickable as a whole — emit an entry covering all child bboxes
      const insertHandle = normalizeHandle(insert.handle);
      const insertStart = out.length;

      // Build a unique instance segment for nested entities. For array INSERTs each
      // (row, col) gets its own segment so entries inside don't collide.
      const arraySuffix = (rows > 1 || cols > 1) ? `:${row}:${col}` : "";
      const instanceSegment = (insertHandle ?? `i${++ctx.instanceCounter.n}`) + arraySuffix;
      const childCtx: BuildContext = {
        instancePath: ctx.instancePath
          ? `${ctx.instancePath}/${instanceSegment}`
          : instanceSegment,
        instanceCounter: ctx.instanceCounter,
      };

      for (const child of blockEntities) {
        if (child.visible === false) continue;
        collectEntry(child, dxf, worldMatrix, insertLayer, out, depth + 1, childCtx);
      }

      // ATTRIBs: attached to this INSERT instance, transformed by world matrix
      if (row === 0 && col === 0 && insert.attribs?.length) {
        for (const attrib of insert.attribs) {
          if (attrib.invisible) continue;
          collectEntry(attrib as unknown as DxfEntity, dxf, worldMatrix, insertLayer, out, depth + 1, childCtx);
        }
      }

      // Emit aggregate INSERT bbox covering all children for this instance
      if (insertHandle) {
        const childCount = out.length - insertStart;
        if (childCount > 0) {
          const aggregate = new THREE.Box3();
          for (let i = insertStart; i < out.length; i++) {
            aggregate.union(out[i].bbox);
          }
          if (!aggregate.isEmpty()) {
            const aggregateId = ctx.instancePath
              ? `${insertHandle}@${ctx.instancePath}${arraySuffix}`
              : insertHandle + arraySuffix;
            out.push({
              id: aggregateId,
              handle: insertHandle,
              type: "INSERT",
              layer: insertLayer,
              bbox: aggregate,
            });
          }
        }
      }
    }
  }
}

// ─── Local-space bbox per entity type ────────────────────────────────

function computeLocalBBox(entity: DxfEntity): THREE.Box3 | null {
  if (isLineEntity(entity)) {
    return boxFromVertices([entity.vertices[0], entity.vertices[1]]);
  }

  if (isCircleEntity(entity)) {
    const c = entity.center;
    const r = entity.radius;
    return new THREE.Box3(
      new THREE.Vector3(c.x - r, c.y - r, (c.z ?? 0) - r),
      new THREE.Vector3(c.x + r, c.y + r, (c.z ?? 0) + r),
    );
  }

  if (isArcEntity(entity)) {
    return arcBBox(entity.center, entity.radius, entity.startAngle, entity.endAngle);
  }

  if (isEllipseEntity(entity)) {
    return ellipseBBox(entity);
  }

  if (isPolylineEntity(entity)) {
    return boxFromVertices(entity.vertices);
  }

  if (isSplineEntity(entity)) {
    const pts = entity.fitPoints?.length ? entity.fitPoints : entity.controlPoints;
    return pts?.length ? boxFromVertices(pts) : null;
  }

  if (isPointEntity(entity)) {
    const p = entity.position;
    const z = p.z ?? 0;
    // Inflate slightly so picking doesn't require pixel-perfect aim
    return new THREE.Box3(
      new THREE.Vector3(p.x, p.y, z),
      new THREE.Vector3(p.x, p.y, z),
    );
  }

  if (isSolidEntity(entity)) {
    return boxFromVertices(entity.points);
  }

  if (is3DFaceEntity(entity)) {
    return boxFromVertices(entity.vertices);
  }

  if (isHatchEntity(entity)) {
    return hatchBBox(entity);
  }

  if (isRegionEntity(entity)) {
    if (!entity.contourBoundary?.length) return null;
    return hatchBBox({ boundaryPaths: entity.contourBoundary });
  }

  if (isMlineEntity(entity)) {
    return boxFromVertices(entity.vertices);
  }

  if (isXlineEntity(entity)) {
    // XLINE/RAY are infinite — picking by bbox doesn't make sense.
    // Skip them to avoid covering the entire scene with a pick target.
    return null;
  }

  if (isTextEntity(entity)) {
    return textBBox(entity, entity.type);
  }

  if (isAttdefEntity(entity) || isAttribEntity(entity)) {
    const start = entity.startPoint ?? entity.endPoint;
    if (!start) return null;
    const h = entity.textHeight ?? 1;
    const len = (entity.text ?? entity.tag ?? "").length * h * 0.6;
    return new THREE.Box3(
      new THREE.Vector3(start.x, start.y, 0),
      new THREE.Vector3(start.x + len, start.y + h, 0),
    );
  }

  if (isDimensionEntity(entity)) {
    return dimensionBBox(entity);
  }

  if (isLeaderEntity(entity)) {
    return boxFromVertices(entity.vertices);
  }

  if (isMLeaderEntity(entity)) {
    const verts: DxfVertex[] = [];
    for (const branch of entity.leaders ?? []) {
      for (const line of branch.lines ?? []) {
        verts.push(...line.vertices);
      }
      if (branch.lastLeaderPoint) verts.push(branch.lastLeaderPoint);
    }
    if (entity.textPosition) verts.push(entity.textPosition);
    return verts.length ? boxFromVertices(verts) : null;
  }

  return null;
}

function boxFromVertices(vertices: ReadonlyArray<DxfVertex>): THREE.Box3 | null {
  if (!vertices.length) return null;
  const box = new THREE.Box3();
  for (const v of vertices) {
    box.expandByPoint(new THREE.Vector3(v.x, v.y, v.z ?? 0));
  }
  return box;
}

/**
 * Build a tight bbox for an ARC. Angles are in RADIANS — the DXF parser
 * converts code 50/51 to radians when populating DxfArcEntity.
 */
function arcBBox(
  center: DxfVertex,
  radius: number,
  startRad: number,
  endRad: number,
): THREE.Box3 {
  const TWO_PI = Math.PI * 2;
  const z = center.z ?? 0;
  const cx = center.x;
  const cy = center.y;
  const start = normalizeRad(startRad);
  const end = normalizeRad(endRad);

  const box = new THREE.Box3();

  // Always include the two arc endpoints
  box.expandByPoint(angleToPoint(cx, cy, radius, start, z));
  box.expandByPoint(angleToPoint(cx, cy, radius, end, z));

  // Include each cardinal point (0, π/2, π, 3π/2) that the arc actually crosses
  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const cardinal of cardinals) {
    if (angleInArc(cardinal, start, end, TWO_PI)) {
      box.expandByPoint(angleToPoint(cx, cy, radius, cardinal, z));
    }
  }

  return box;
}

function normalizeRad(r: number): number {
  const TWO_PI = Math.PI * 2;
  let n = r % TWO_PI;
  if (n < 0) n += TWO_PI;
  return n;
}

function angleToPoint(
  cx: number,
  cy: number,
  r: number,
  rad: number,
  z: number,
): THREE.Vector3 {
  return new THREE.Vector3(cx + r * Math.cos(rad), cy + r * Math.sin(rad), z);
}

/**
 * Whether the cardinal angle lies strictly inside the CCW arc from start to end.
 * If start == end the arc is a full circle, so all cardinals qualify.
 */
function angleInArc(cardinal: number, start: number, end: number, twoPi: number): boolean {
  if (start === end) return true;
  const sweep = (end - start + twoPi) % twoPi;
  const offset = (cardinal - start + twoPi) % twoPi;
  return offset > 0 && offset < sweep;
}

function ellipseBBox(entity: {
  center: DxfVertex;
  majorAxisEndPoint: DxfVertex;
  axisRatio: number;
}): THREE.Box3 {
  const c = entity.center;
  const ma = entity.majorAxisEndPoint;
  const majorLen = Math.hypot(ma.x, ma.y);
  const minorLen = majorLen * (entity.axisRatio || 1);
  // Conservative: use max of major/minor as half-extent on both axes
  const r = Math.max(majorLen, minorLen);
  const z = c.z ?? 0;
  return new THREE.Box3(
    new THREE.Vector3(c.x - r, c.y - r, z),
    new THREE.Vector3(c.x + r, c.y + r, z),
  );
}

function hatchBBox(entity: {
  boundaryPaths: Array<{ polylineVertices?: DxfVertex[]; edges?: Array<unknown> }>;
}): THREE.Box3 | null {
  const verts: DxfVertex[] = [];
  for (const path of entity.boundaryPaths ?? []) {
    if (path.polylineVertices?.length) {
      verts.push(...path.polylineVertices);
    }
    for (const edge of path.edges ?? []) {
      const e = edge as { type: string; start?: DxfVertex; end?: DxfVertex; center?: DxfVertex; radius?: number };
      if (e.start) verts.push(e.start);
      if (e.end) verts.push(e.end);
      if (e.center && e.radius) {
        verts.push(
          { x: e.center.x - e.radius, y: e.center.y - e.radius, z: e.center.z ?? 0 },
          { x: e.center.x + e.radius, y: e.center.y + e.radius, z: e.center.z ?? 0 },
        );
      }
    }
  }
  return verts.length ? boxFromVertices(verts) : null;
}

function textBBox(
  entity: {
    text?: string;
    position?: DxfVertex;
    startPoint?: DxfVertex;
    endPoint?: DxfVertex;
    height?: number;
    textHeight?: number;
    width?: number;
    rotation?: number;
    halign?: number;
    valign?: number;
    xScale?: number;
    attachmentPoint?: number;
  },
  type: string,
): THREE.Box3 | null {
  // For TEXT: when halign or valign is set, the alignment point is endPoint (code 11)
  // not startPoint (code 10). MTEXT uses entity.position (code 10) directly.
  const usesAlignmentPoint = type === "TEXT"
    && ((entity.halign ?? 0) !== 0 || (entity.valign ?? 0) !== 0)
    && entity.endPoint != null;
  const anchor = usesAlignmentPoint
    ? entity.endPoint!
    : (entity.position ?? entity.startPoint ?? entity.endPoint);
  if (!anchor) return null;

  const h = entity.height ?? entity.textHeight ?? 1;
  const rawText = entity.text ?? "";

  // For MTEXT, split on \P (line break) BEFORE stripping formatting codes,
  // then drop inline format codes (\C1;, \H2.5x;, \fArial|i1|...;, \L, \O, …)
  // and grouping braces { }. Otherwise both line count and character count
  // get distorted by markup that isn't visible.
  const rawLines = type === "MTEXT" ? rawText.split(/\\P/) : [rawText];
  const visibleLines = rawLines.map(stripMTextFormatting);
  // TEXT may have a width factor (code 41 = xScale); MTEXT doesn't use this field
  const widthFactor = type === "TEXT" ? (entity.xScale ?? 1) : 1;
  const charWidth = h * 0.7 * widthFactor;
  const refWidth = type === "MTEXT" && entity.width && entity.width > 0 ? entity.width : Infinity;

  // Walk lines once: compute per-line effective width (chars × charWidth × \H multiplier)
  // AND per-line height (h × \H multiplier × line spacing). The widest single line
  // determines bbox width; the sum of line heights determines bbox height.
  let currentMul = 1;
  let totalH = 0;
  let widestLineW = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const segMul = applyHCodesToMultiplier(rawLines[i], currentMul, h);
    currentMul = segMul.endingMul;
    const effectiveCharWidth = charWidth * segMul.maxMul;
    const lineWidth = visibleLines[i].length * effectiveCharWidth;
    const lineHeight = h * segMul.maxMul * (5 / 3);

    // Wrap accounting:
    // - Lines that fit within refWidth stay on a single row.
    // - Long lines wrap at WORD boundaries (not characters), which tends to leave
    //   each row only ~70-80% full because the next word jumps to a new row when
    //   it doesn't fit. A 30% overhead factor keeps the bbox conservative enough
    //   to cover the visible row count for narrow columns of long prose.
    let wrapRows: number;
    if (refWidth === Infinity || lineWidth <= refWidth) {
      wrapRows = 1;
    } else {
      const WORD_WRAP_OVERHEAD = 1.3;
      wrapRows = Math.max(1, Math.ceil((lineWidth * WORD_WRAP_OVERHEAD) / refWidth));
    }
    totalH += lineHeight * wrapRows;

    // Visual width of THIS line (capped by wrap boundary)
    const visibleLineW = Math.min(lineWidth, refWidth === Infinity ? lineWidth : refWidth);
    if (visibleLineW > widestLineW) widestLineW = visibleLineW;
  }
  if (totalH <= 0) totalH = h * (5 / 3);
  const w = widestLineW > 0 ? widestLineW : charWidth;

  // Add 1 char-width of padding on each side to absorb font measurement drift.
  const padX = h * 0.7;

  // Compute (left, right, top, bottom) offsets relative to anchor based on
  // attachment point / horizontal+vertical alignment.
  let dxLeft = 0;        // anchor.x + dxLeft = bbox.min.x
  let dxRight = w;       // anchor.x + dxRight = bbox.max.x
  let dyBottom = -totalH; // anchor.y + dyBottom = bbox.min.y
  let dyTop = 0;         // anchor.y + dyTop = bbox.max.y

  if (type === "MTEXT") {
    // attachmentPoint: 1=TopLeft, 2=TopCenter, 3=TopRight,
    // 4=MiddleLeft, 5=MiddleCenter, 6=MiddleRight,
    // 7=BottomLeft, 8=BottomCenter, 9=BottomRight
    const ap = entity.attachmentPoint ?? 1;
    const col = (ap - 1) % 3; // 0=Left, 1=Center, 2=Right
    const row = Math.floor((ap - 1) / 3); // 0=Top, 1=Middle, 2=Bottom

    if (col === 0)      { dxLeft = 0;      dxRight = w; }
    else if (col === 1) { dxLeft = -w / 2; dxRight = w / 2; }
    else                { dxLeft = -w;     dxRight = 0; }

    if (row === 0)      { dyTop = 0;          dyBottom = -totalH; }    // Top
    else if (row === 1) { dyTop = totalH / 2; dyBottom = -totalH / 2; } // Middle
    else                { dyTop = totalH;     dyBottom = 0; }           // Bottom
  } else {
    // TEXT: halign 0=Left, 1=Center, 2=Right, 3=Aligned, 4=Middle, 5=Fit
    //       valign 0=Baseline, 1=Bottom, 2=Middle, 3=Top
    const ha = entity.halign ?? 0;
    const va = entity.valign ?? 0;

    if (ha === 1 || ha === 4) { dxLeft = -w / 2; dxRight = w / 2; }
    else if (ha === 2)        { dxLeft = -w;     dxRight = 0; }
    else                      { dxLeft = 0;      dxRight = w; }

    // For TEXT vertical alignment is around a single line of height h
    if (va === 0 || va === 1) { dyBottom = 0;      dyTop = h; }       // Baseline/Bottom: text goes up
    else if (va === 2)        { dyBottom = -h / 2; dyTop = h / 2; }   // Middle
    else                      { dyBottom = -h;     dyTop = 0; }       // Top: text goes down
  }

  return new THREE.Box3(
    new THREE.Vector3(anchor.x + dxLeft - padX, anchor.y + dyBottom, 0),
    new THREE.Vector3(anchor.x + dxRight + padX, anchor.y + dyTop, 0),
  );
}

/**
 * Scan a segment for inline \H height codes and return:
 * - endingMul: the multiplier active at the END of the segment (carries to next line)
 * - maxMul: the LARGEST multiplier seen during the segment (used to size THIS line)
 *
 * Supports `\H1.5x;` (relative — multiplies current) and `\H1.5;` (absolute —
 * `value / baseHeight`).
 */
function applyHCodesToMultiplier(
  segment: string,
  startingMul: number,
  baseHeight: number,
): { endingMul: number; maxMul: number } {
  let cur = startingMul;
  let max = startingMul;
  const re = /\\H([\d.]+)(x?);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(segment)) !== null) {
    const value = parseFloat(m[1]);
    if (!isFinite(value) || value <= 0) continue;
    cur = m[2] === "x" ? cur * value : value / baseHeight;
    if (cur > max) max = cur;
  }
  return { endingMul: cur, maxMul: max };
}

/**
 * Strip MTEXT inline format codes so the remaining string approximates what
 * the user actually sees. Handles backslash codes that take a parameter
 * (\C1;, \H2.5x;, \W0.8;, \Q15;, \fArial|b1|i1|c0|p34;, \pxqi;, \T1.2;) and
 * grouping braces { }. Backslash escapes for braces (\{ \}) are kept as is.
 */
function stripMTextFormatting(text: string): string {
  return text
    // \L \O \l \o (underline/overline toggles, no parameter)
    .replace(/\\[LOlo]/g, "")
    // backslash + letter + parameters until ; (codes with values)
    .replace(/\\[A-Za-z][^\\;]*;/g, "")
    // grouping braces
    .replace(/[{}]/g, "")
    // stray escape sequences
    .replace(/\\~/g, " ")
    .replace(/%%[a-zA-Z0-9]/g, "X");
}

function dimensionBBox(entity: {
  anchorPoint?: DxfVertex;
  middleOfText?: DxfVertex;
  insertionPoint?: DxfVertex;
  linearOrAngularPoint1?: DxfVertex;
  linearOrAngularPoint2?: DxfVertex;
  diameterOrRadiusPoint?: DxfVertex;
  arcPoint?: DxfVertex;
}): THREE.Box3 | null {
  const verts: DxfVertex[] = [];
  for (const key of [
    "anchorPoint", "middleOfText", "insertionPoint",
    "linearOrAngularPoint1", "linearOrAngularPoint2",
    "diameterOrRadiusPoint", "arcPoint",
  ] as const) {
    const v = entity[key];
    if (v) verts.push(v);
  }
  return verts.length ? boxFromVertices(verts) : null;
}

function composeMatrices(
  a: THREE.Matrix4 | null,
  b: THREE.Matrix4 | null,
): THREE.Matrix4 | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return new THREE.Matrix4().multiplyMatrices(a, b);
}

function normalizeHandle(handle: string | number | undefined): string | null {
  if (handle == null) return null;
  return typeof handle === "string" ? handle : handle.toString(16).toUpperCase();
}
