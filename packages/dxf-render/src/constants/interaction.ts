/**
 * Framework-agnostic interaction tuning constants — screen-space pixel and
 * timing budgets shared by every wrapper's pointer tools (picking, rectangle
 * selection, geometry snap, and the distance / area / angle measurement state
 * machines).
 *
 * They live in `dxf-render` (not in a single wrapper) so that `dxf-vuer`,
 * `dxf-react` and `dxf-lit` all import the *same literal source* — a tweak
 * here changes every wrapper's feel in lockstep instead of drifting per port.
 * Co-located with the engine because the engine already owns the math these
 * thresholds feed (`findSnapPoint`, `findEntriesInRect`, `measureDirectedAngle`).
 */

/**
 * Pixel distance above which a mousedown→mouseup is treated as a pan (drag)
 * rather than a click. Used by every pointer tool to tell clicks from pans so
 * two tools never both act on the same gesture.
 */
export const CLICK_DISTANCE_THRESHOLD_PX = 4;

/** Max gap (ms) between two clicks to count as a double-click (e.g. closes an area polygon). */
export const DOUBLE_CLICK_MS = 350;
/** Max screen-pixel gap between two clicks to still count as a double-click. */
export const DOUBLE_CLICK_DISTANCE_PX = 6;

/**
 * Screen-pixel radius around the first polygon vertex within which a click
 * closes the area polygon (origin snap). Semantically distinct from
 * {@link SNAP_TOLERANCE_PX} even though both currently equal 12 — do not merge.
 */
export const ORIGIN_SNAP_RADIUS_PX = 12;

/** Geometry-snap aperture: how close (screen px) the cursor must be to snap. */
export const SNAP_TOLERANCE_PX = 12;
/** On-screen snap marker glyph size, in pixels. */
export const SNAP_MARKER_PX = 11;

/** Angle-tool arc radius as a fraction of the shorter ray length. */
export const ANGLE_ARC_RADIUS_FRACTION = 0.4;
/** Lower / upper clamp for the angle arc radius, in screen pixels. */
export const ANGLE_ARC_MIN_PX = 24;
export const ANGLE_ARC_MAX_PX = 80;
/** Segments used to approximate a full turn of the angle arc polyline. */
export const ANGLE_ARC_SEGMENTS_PER_TURN = 64;

/**
 * Three.js `renderOrder` for measurement overlay groups (distance / area /
 * angle). Paired with {@link SNAP_OVERLAY_RENDER_ORDER}: the snap marker must
 * render above measurement overlays — that ordering is a cross-overlay
 * invariant, named once here so it can't drift.
 */
export const MEASUREMENT_OVERLAY_RENDER_ORDER = 999;
/** Three.js `renderOrder` for the snap marker overlay — above measurement overlays. */
export const SNAP_OVERLAY_RENDER_ORDER = 1000;
