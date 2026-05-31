import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMeasurement } from "../useMeasurement";
import { useAreaMeasurement } from "../useAreaMeasurement";
import { useAngleMeasurement } from "../useAngleMeasurement";
import { useRectangleSelection } from "../useRectangleSelection";

/**
 * Regression guard: these hooks must return a referentially-stable object
 * across re-renders. DXFViewer lists them in effect dependency arrays, so a
 * fresh object each render would re-run the mount effect (re-initialising
 * Three.js / WebGL) on every render — an infinite loop that hangs the browser.
 */
describe("measurement / selection hooks return stable references", () => {
  it("useMeasurement", () => {
    const { result, rerender } = renderHook(() => useMeasurement());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("useAreaMeasurement", () => {
    const { result, rerender } = renderHook(() => useAreaMeasurement());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("useAngleMeasurement", () => {
    const { result, rerender } = renderHook(() => useAngleMeasurement());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("useRectangleSelection", () => {
    const { result, rerender } = renderHook(() => useRectangleSelection());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });
});
