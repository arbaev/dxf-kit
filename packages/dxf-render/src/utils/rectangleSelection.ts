import type { PickingEntry, PickingIndex } from "@/render/pickingIndex";

/**
 * Axis-aligned rectangle in the same world coordinate space as
 * `PickingEntry.bbox` — i.e. DXF world coordinates BEFORE any
 * `originOffset` subtraction. Callers that already translated their
 * cursor coordinates back into DXF world (e.g. `cursorX + originOffset.x`)
 * can pass those values directly.
 *
 * `minX <= maxX` and `minY <= maxY` must hold; the caller is responsible
 * for normalising drag start/end into a proper rectangle.
 */
export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FindInRectOptions {
  /**
   * Selection semantics:
   * - `"window"` — entry's bbox must lie **fully inside** the rectangle.
   * - `"crossing"` — entry's bbox must **overlap** the rectangle (any
   *   intersection counts).
   *
   * Defaults to `"crossing"`, which matches the more permissive
   * AutoCAD right-to-left drag.
   */
  mode?: "window" | "crossing";

  /**
   * Granularity for INSERT instances:
   * - `"aggregate"` (default) — return the INSERT entry as a whole, skip
   *   its child entries. Mirrors AutoCAD's "an INSERT is one selectable
   *   block".
   * - `"leaf"` — return every child entity individually, skip the
   *   aggregate INSERT entry.
   */
  granularity?: "aggregate" | "leaf";
}

/**
 * Pure helper: list every picking entry whose world-space bbox satisfies
 * the rectangle test. Used to power rectangle (window/crossing)
 * selection in `dxf-vuer` (and future React/Lit wrappers) without
 * pulling in Three.js raycasting.
 *
 * Both `rect` and `entry.bbox` live in DXF world coordinates (the
 * raw values produced by `buildPickingIndex` — `originOffset` is NOT
 * applied to entries, only to the picking-group meshes added to the
 * scene). Consumers that compute the rectangle from canvas mouse
 * positions must therefore add `originOffset` back to their unprojected
 * world coordinates before calling.
 *
 * XLINE / RAY are intentionally absent from the picking index (they're
 * infinite) and so are silently ignored.
 */
export function findEntriesInRect(
  pickingIndex: PickingIndex,
  rect: WorldRect,
  options: FindInRectOptions = {},
): PickingEntry[] {
  const mode = options.mode ?? "crossing";
  const granularity = options.granularity ?? "aggregate";

  const out: PickingEntry[] = [];
  for (const entry of pickingIndex.entries) {
    if (granularity === "aggregate") {
      // Skip entries that live INSIDE an INSERT instance (their id has the
      // `@instancePath` suffix). The INSERT aggregate entry itself ALSO
      // carries that suffix, but it's distinguished by `childIds` — keep
      // those; drop everything else under an instance path.
      if (isInsertChild(entry)) continue;
    } else {
      // Leaf granularity: skip aggregate INSERT entries; keep their children.
      if (entry.childIds) continue;
    }

    const bb = entry.bbox;
    if (mode === "window") {
      if (
        bb.min.x >= rect.minX &&
        bb.max.x <= rect.maxX &&
        bb.min.y >= rect.minY &&
        bb.max.y <= rect.maxY
      ) {
        out.push(entry);
      }
    } else {
      // Crossing: AABB overlap test
      if (
        bb.max.x >= rect.minX &&
        bb.min.x <= rect.maxX &&
        bb.max.y >= rect.minY &&
        bb.min.y <= rect.maxY
      ) {
        out.push(entry);
      }
    }
  }
  return out;
}

/**
 * An entry belongs to an INSERT instance when its id was suffixed with
 * `@instancePath` AND it's not the aggregate cover (which carries
 * `childIds`). Top-level entries keep `id === handle` (no `@`).
 */
function isInsertChild(entry: PickingEntry): boolean {
  return entry.id.includes("@") && !entry.childIds;
}
