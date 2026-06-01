/**
 * dxf-interaction — framework-agnostic interaction controllers for DXF viewers.
 *
 * Each module exports a plain `createX(...)` factory (no framework binding) plus
 * its pure helpers and types. Vue composables / React hooks bind these to their
 * own reactivity. The pure geometry math itself lives in `dxf-render`.
 */

// Shared pointer pipeline + projection/geometry helpers
export * from "./pointerTool";

// Measurement tools (distance / area / angle) + value formatters
export * from "./measurement";
export * from "./areaMeasurement";
export * from "./angleMeasurement";

// Geometry snapping
export * from "./snap";

// Window/crossing rectangle selection + pure rect helpers
export * from "./rectangleSelection";

// Picking (hover/click) and precise highlight overlay
export * from "./picking";
export * from "./highlight";

// Shared display-unit types
export * from "./types";
