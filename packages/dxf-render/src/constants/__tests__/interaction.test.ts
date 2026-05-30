import { describe, it, expect } from "vitest";
import * as interaction from "../interaction";
import * as constants from "../index";

describe("interaction constants", () => {
  it("exposes the documented pixel / timing budgets", () => {
    expect(interaction.CLICK_DISTANCE_THRESHOLD_PX).toBe(4);
    expect(interaction.DOUBLE_CLICK_MS).toBe(350);
    expect(interaction.DOUBLE_CLICK_DISTANCE_PX).toBe(6);
    expect(interaction.ORIGIN_SNAP_RADIUS_PX).toBe(12);
    expect(interaction.SNAP_TOLERANCE_PX).toBe(12);
    expect(interaction.SNAP_MARKER_PX).toBe(11);
    expect(interaction.ANGLE_ARC_RADIUS_FRACTION).toBeCloseTo(0.4);
    expect(interaction.ANGLE_ARC_MIN_PX).toBe(24);
    expect(interaction.ANGLE_ARC_MAX_PX).toBe(80);
    expect(interaction.ANGLE_ARC_SEGMENTS_PER_TURN).toBe(64);
    expect(interaction.MEASUREMENT_OVERLAY_RENDER_ORDER).toBe(999);
    expect(interaction.SNAP_OVERLAY_RENDER_ORDER).toBe(1000);
  });

  it("keeps the snap marker rendering above measurement overlays", () => {
    // Cross-overlay invariant: the snap glyph must sit on top of the
    // distance / area / angle overlays it is drawn over.
    expect(interaction.SNAP_OVERLAY_RENDER_ORDER).toBeGreaterThan(
      interaction.MEASUREMENT_OVERLAY_RENDER_ORDER,
    );
  });

  it("re-exports through the constants barrel (public API surface)", () => {
    expect(constants.CLICK_DISTANCE_THRESHOLD_PX).toBe(
      interaction.CLICK_DISTANCE_THRESHOLD_PX,
    );
    expect(constants.SNAP_OVERLAY_RENDER_ORDER).toBe(
      interaction.SNAP_OVERLAY_RENDER_ORDER,
    );
  });
});
