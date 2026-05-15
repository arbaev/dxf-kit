import * as THREE from "three";
import type { DxfEntity, DxfData } from "@/types/dxf";
import { isLeaderEntity, isMLeaderEntity } from "@/types/dxf";
import { resolveEntityColor, resolveMLeaderColor } from "@/utils/colorResolver";
import { ARROW_SIZE } from "@/constants";
import {
  type RenderContext,
  getLineMaterial,
  getMeshMaterial,
} from "../primitives";
import type { GeometryCollector } from "../mergeCollectors";
import { resolveEntityFont } from "../text/fontClassifier";
import { replaceSpecialChars } from "../text/mtextParser";
import { resolveDimVarsFromHeader } from "../dimensions";
import { classifyArrowBlock, createArrowhead, type ArrowKind } from "../arrowheads";
import {
  addTextToCollector,
  HAlign,
  VAlign,
} from "../text/vectorTextBuilder";

/**
 * Catmull-Rom spline interpolation through given points.
 * Returns a smooth polyline that passes through all input points.
 */
export const catmullRomSpline = (points: THREE.Vector3[], segmentsPerSpan = 12): THREE.Vector3[] => {
  if (points.length <= 2) return points;
  const result: THREE.Vector3[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let t = 0; t < segmentsPerSpan; t++) {
      const s = t / segmentsPerSpan;
      const s2 = s * s;
      const s3 = s2 * s;
      result.push(new THREE.Vector3(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * s + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * s2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * s3),
      ));
    }
  }
  result.push(points[n - 1]);
  return result;
};

/**
 * Cubic Bezier through two endpoints with the curve tangent to `endTangent`
 * at the END point (the dogleg landing). The arrow-side tangent is taken as
 * the chord direction so the curve only bends near the landing — this matches
 * the look AutoCAD draws for a spline MLEADER with a single line vertex
 * (vertex = arrow tip, lastLeaderPoint = landing, doglegVector = shelf direction).
 *
 * The end-tangent vector points OUTWARD from the curve (along the shelf away
 * from the leader); the control point is placed in the OPPOSITE direction so
 * the curve approaches the landing tangent to the shelf.
 */
const sampleBezierLeader = (
  arrowTip: THREE.Vector3,
  landing: THREE.Vector3,
  endTangent: THREE.Vector3,
  segments = 24,
): THREE.Vector3[] => {
  const dx = landing.x - arrowTip.x;
  const dy = landing.y - arrowTip.y;
  const dz = landing.z - arrowTip.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist === 0) return [arrowTip.clone(), landing.clone()];

  const handle = dist / 3;
  // Arrow-side: aim toward landing along the chord (no extra bend at the tip).
  const c1 = new THREE.Vector3(
    arrowTip.x + (dx / dist) * handle,
    arrowTip.y + (dy / dist) * handle,
    arrowTip.z + (dz / dist) * handle,
  );
  // Landing-side: tangent to the shelf — control point sits OPPOSITE
  // the dogleg direction so the curve flows into the shelf direction.
  const tLen = Math.hypot(endTangent.x, endTangent.y, endTangent.z) || 1;
  const c2 = new THREE.Vector3(
    landing.x - (endTangent.x / tLen) * handle,
    landing.y - (endTangent.y / tLen) * handle,
    landing.z - (endTangent.z / tLen) * handle,
  );

  const result: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const u2 = u * u, u3 = u2 * u, t2 = t * t, t3 = t2 * t;
    result.push(new THREE.Vector3(
      u3 * arrowTip.x + 3 * u2 * t * c1.x + 3 * u * t2 * c2.x + t3 * landing.x,
      u3 * arrowTip.y + 3 * u2 * t * c1.y + 3 * u * t2 * c2.y + t3 * landing.y,
      u3 * arrowTip.z + 3 * u2 * t * c1.z + 3 * u * t2 * c2.z + t3 * landing.z,
    ));
  }
  return result;
};

/**
 * Collect LEADER/MULTILEADER entity: lines and arrows decomposed into collector,
 * text rendered as vector glyphs directly into collector.
 */
export function collectLeaderEntity(
  entity: DxfEntity,
  _dxf: DxfData,
  colorCtx: RenderContext,
  collector: GeometryCollector,
  layer: string,
  worldMatrix?: THREE.Matrix4,
): void {
  const styleName = isLeaderEntity(entity) ? entity.styleName : undefined;
  const font = resolveEntityFont(styleName, colorCtx.styles, colorCtx.serifFont, colorCtx.font!);
  // entityColor drives leader lines and arrows. For MULTILEADER it gets
  // reassigned below to the resolved line color (entity override > style >
  // ByLayer); the text body uses a separate `textColor` resolved the same way
  // but with the TextColor override bit and MLEADERSTYLE TextColor.
  let entityColor = resolveEntityColor(entity, colorCtx.layers, colorCtx.blockColor);
  const matrix = worldMatrix ?? new THREE.Matrix4();
  const v = new THREE.Vector3();

  const addLeaderLineToCollector = (points: THREE.Vector3[]) => {
    for (let i = 0; i < points.length - 1; i++) {
      v.copy(points[i]).applyMatrix4(matrix);
      const x1 = v.x, y1 = v.y, z1 = v.z;
      v.copy(points[i + 1]).applyMatrix4(matrix);
      collector.addLineSegments(layer, entityColor, [x1, y1, z1, v.x, v.y, v.z]);
    }
  };

  /**
   * Build any standard AutoCAD arrowhead (closed-filled, dot, tick, box, ...)
   * and decompose it into the collector. `kind` defaults to closed-filled —
   * the AutoCAD default arrow used when DIMLDRBLK is unset.
   */
  const addArrowheadToCollector = (
    from: THREE.Vector3, to: THREE.Vector3, size: number, kind: ArrowKind = "closed-filled",
  ) => {
    const lineMat = getLineMaterial(entityColor, colorCtx.materials);
    const fillMat = getMeshMaterial(entityColor, colorCtx.materials);
    const heads = createArrowhead({ from, tip: to, size, kind, lineMaterial: lineMat, fillMaterial: fillMat });
    for (const head of heads) {
      const geo = (head as THREE.Mesh | THREE.Line | THREE.LineSegments).geometry as THREE.BufferGeometry;
      const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
      const count = posAttr.count;

      if (head instanceof THREE.LineSegments) {
        const verts: number[] = [];
        for (let i = 0; i < count; i++) {
          v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
          verts.push(v.x, v.y, v.z);
        }
        collector.addLineSegments(layer, entityColor, verts);
      } else if (head instanceof THREE.Line) {
        const verts: number[] = [];
        for (let i = 0; i < count - 1; i++) {
          v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
          const x1 = v.x, y1 = v.y, z1 = v.z;
          v.fromBufferAttribute(posAttr, i + 1).applyMatrix4(matrix);
          verts.push(x1, y1, z1, v.x, v.y, v.z);
        }
        collector.addLineSegments(layer, entityColor, verts);
      } else if (head instanceof THREE.Mesh) {
        const positions: number[] = [];
        for (let i = 0; i < count; i++) {
          v.fromBufferAttribute(posAttr, i).applyMatrix4(matrix);
          positions.push(v.x, v.y, v.z);
        }
        const index = geo.getIndex();
        const indices = index ? Array.from(index.array) : [];
        if (indices.length === 0) {
          for (let i = 0; i < count; i++) indices.push(i);
        }
        collector.addOverlayMesh(layer, entityColor, positions, indices);
      }
    }
  };

  // Resolve arrow block for LEADER: DIMSTYLE code 341 (DIMLDRBLK) -> block name
  const leaderStyleName = isLeaderEntity(entity) ? entity.styleName : undefined;
  const leaderDimStyle = leaderStyleName ? colorCtx.dimStyles?.[leaderStyleName] : undefined;
  const baseDv = colorCtx.dimVars ?? resolveDimVarsFromHeader(undefined);

  // Resolve leader arrow block name from DIMLDRBLK (code 341) only.
  // Do NOT fall back to DIMBLK (code 342) — that's for dimension arrowheads.
  // When DIMLDRBLK is unset, leaders use the default filled arrow.
  let leaderArrowBlockName: string | undefined;
  if (colorCtx.blockHandleToName) {
    const ldrHandle = leaderDimStyle?.dimldrblkHandle;
    if (ldrHandle) leaderArrowBlockName = colorCtx.blockHandleToName.get(ldrHandle);
  }

  // Render a block definition at a point with rotation (for custom arrow blocks)
  const addBlockArrowToCollector = (
    blockName: string, tip: THREE.Vector3, angle: number, scale: number,
  ) => {
    const block = _dxf.blocks?.[blockName];
    if (!block?.entities) return false;
    const blockMatrix = new THREE.Matrix4()
      .makeTranslation(tip.x, tip.y, tip.z)
      .multiply(new THREE.Matrix4().makeRotationZ(angle))
      .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
    if (worldMatrix) blockMatrix.premultiply(worldMatrix);
    for (const be of block.entities) {
      if (be.type === "LINE" && "vertices" in be) {
        const verts = be.vertices as { x: number; y: number; z?: number }[];
        if (verts.length >= 2) {
          v.set(verts[0].x, verts[0].y, verts[0].z || 0).applyMatrix4(blockMatrix);
          const x1 = v.x, y1 = v.y, z1 = v.z;
          v.set(verts[1].x, verts[1].y, verts[1].z || 0).applyMatrix4(blockMatrix);
          collector.addLineSegments(layer, entityColor, [x1, y1, z1, v.x, v.y, v.z]);
        }
      }
    }
    return true;
  };

  if (entity.type === "LEADER" && isLeaderEntity(entity) && entity.vertices.length >= 2) {
    const rawPoints = entity.vertices.map(
      (vt) => new THREE.Vector3(vt.x, vt.y, vt.z || 0),
    );
    // Spline path (code 72 = 1): interpolate as Catmull-Rom curve
    const points = entity.pathType === 1 ? catmullRomSpline(rawPoints) : rawPoints;
    addLeaderLineToCollector(points);

    // arrowHeadFlag: 0 = no arrow, 1 or undefined = with arrow (DXF default)
    if (entity.arrowHeadFlag !== 0 && rawPoints.length >= 2) {
      // Arrow size: entity XDATA DSTYLE override > DIMSTYLE > header default
      const arrowSize = entity.arrowSize || baseDv.arrowSize;
      // Arrow direction: use the spline point near arrowSize distance from tip
      // so the arrow base aligns with the curved leader line
      let baseIdx = 1;
      for (let i = 1; i < points.length; i++) {
        baseIdx = i;
        const d = (points[i].x - points[0].x) ** 2 + (points[i].y - points[0].y) ** 2;
        if (d >= arrowSize * arrowSize) break;
      }
      const angle = Math.atan2(points[0].y - points[baseIdx].y, points[0].x - points[baseIdx].x);
      // DIMLDRBLK resolution: try standard kinds first; non-standard names fall
      // back to rendering the user-defined block geometry; if that fails, use
      // the AutoCAD default (closed-filled). Leaders never inherit DIMBLK's
      // tick kind from baseDv — that's for dimension arrowheads only.
      const leaderArrowKind = classifyArrowBlock(leaderArrowBlockName);
      if (leaderArrowKind !== undefined) {
        addArrowheadToCollector(points[baseIdx], points[0], arrowSize, leaderArrowKind);
      } else if (leaderArrowBlockName) {
        const drawn = addBlockArrowToCollector(leaderArrowBlockName, points[0], angle, arrowSize);
        if (!drawn) addArrowheadToCollector(points[baseIdx], points[0], arrowSize);
      } else {
        addArrowheadToCollector(points[baseIdx], points[0], arrowSize);
      }
    }
  } else if ((entity.type === "MULTILEADER" || entity.type === "MLEADER") && isMLeaderEntity(entity) && entity.leaders.length > 0) {
    // Resolve MULTILEADER colors. AutoCAD precedence:
    //   1. Entity-level CmEntityColor when its PropertyOverrideFlag bit is set
    //   2. MLEADERSTYLE color (looked up by entity.styleHandle, code 340)
    //   3. ByLayer / ByBlock via resolveEntityColor
    // Bits in propertyOverrideFlag: bit 1 = LeaderLineColor, bit 15 = TextColor.
    const styleHandle = entity.styleHandle;
    const style = styleHandle && colorCtx.mLeaderStyles
      ? colorCtx.mLeaderStyles[styleHandle.toUpperCase()]
      : undefined;
    const overrideFlag = entity.propertyOverrideFlag ?? 0;
    const lineColor = resolveMLeaderColor(
      entity.leaderLineColorRaw,
      (overrideFlag & (1 << 1)) !== 0,
      style?.leaderLineColorRaw,
      entity,
      colorCtx.layers,
      colorCtx.blockColor,
    );
    const textColor = resolveMLeaderColor(
      entity.textColorRaw,
      (overrideFlag & (1 << 15)) !== 0,
      style?.textColorRaw,
      entity,
      colorCtx.layers,
      colorCtx.blockColor,
    );
    entityColor = lineColor;

    const arrowSize = entity.arrowSize || ARROW_SIZE;

    const isSpline = entity.leaderLineType === 2;
    for (const leader of entity.leaders) {
      for (const line of leader.lines) {
        // A LEADER_LINE can carry just the arrow tip (1 vertex) — the dogleg
        // landing then comes from the parent LEADER's lastLeaderPoint, giving
        // the second point needed to draw a segment.
        const rawPoints = line.vertices.map(
          (vt) => new THREE.Vector3(vt.x, vt.y, vt.z || 0),
        );
        if (leader.lastLeaderPoint) {
          rawPoints.push(new THREE.Vector3(
            leader.lastLeaderPoint.x,
            leader.lastLeaderPoint.y,
            leader.lastLeaderPoint.z || 0,
          ));
        }
        if (rawPoints.length < 2) continue;

        let points = rawPoints;
        if (isSpline) {
          if (rawPoints.length === 2 && leader.doglegVector) {
            // Single arrow-tip vertex + landing — bend toward the shelf.
            points = sampleBezierLeader(
              rawPoints[0],
              rawPoints[1],
              new THREE.Vector3(
                leader.doglegVector.x,
                leader.doglegVector.y,
                leader.doglegVector.z || 0,
              ),
            );
          } else if (rawPoints.length >= 3) {
            // Several vertices — interpolate them as a Catmull-Rom curve.
            points = catmullRomSpline(rawPoints);
          }
          // 2 points without a dogleg vector: fall through to a straight line.
        }

        addLeaderLineToCollector(points);

        if (entity.hasArrowHead !== false && points.length >= 2) {
          // Arrow direction follows the curve's tangent at the tip — for a
          // spline, points[1] is the next sampled point on the curve.
          // MULTILEADER arrowhead style is selected by the MLEADERSTYLE; we
          // currently always render closed-filled (the AutoCAD default).
          addArrowheadToCollector(points[1], points[0], arrowSize);
        }
      }
    }

    if (entity.text && entity.textPosition) {
      const textHeight = entity.textHeight || colorCtx.defaultTextHeight;
      const textContent = replaceSpecialChars(entity.text);
      if (textContent) {
        let posX = entity.textPosition.x;
        let posY = entity.textPosition.y;
        if (worldMatrix) {
          v.set(posX, posY, 0).applyMatrix4(worldMatrix);
          posX = v.x;
          posY = v.y;
        }
        addTextToCollector({
          collector, layer, color: textColor, font, text: textContent, height: textHeight,
          posX, posY, posZ: 0, hAlign: HAlign.LEFT, vAlign: VAlign.MIDDLE,
        });
      }
    }
  }
}
