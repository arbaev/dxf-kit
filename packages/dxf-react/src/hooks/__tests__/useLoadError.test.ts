import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoadError } from "../useLoadError";

describe("setError", () => {
  it("extracts message from Error instance", () => {
    const { result } = renderHook(() => useLoadError());
    let msg = "";
    act(() => {
      msg = result.current.setError(new Error("parse failed"), "fallback");
    });
    expect(msg).toBe("parse failed");
    expect(result.current.errorMessage).toBe("parse failed");
  });

  it("uses fallback message for non-Error values", () => {
    const { result } = renderHook(() => useLoadError());
    let msg = "";
    act(() => {
      msg = result.current.setError("string error", "fallback message");
    });
    expect(msg).toBe("fallback message");
    expect(result.current.errorMessage).toBe("fallback message");
  });

  it("uses fallback message for null", () => {
    const { result } = renderHook(() => useLoadError());
    let msg = "";
    act(() => {
      msg = result.current.setError(null, "fallback");
    });
    expect(msg).toBe("fallback");
    expect(result.current.errorMessage).toBe("fallback");
  });
});

describe("clearError", () => {
  it("resets errorMessage to null", () => {
    const { result } = renderHook(() => useLoadError());
    act(() => {
      result.current.setError(new Error("fail"), "fallback");
    });
    expect(result.current.errorMessage).toBe("fail");
    act(() => {
      result.current.clearError();
    });
    expect(result.current.errorMessage).toBeNull();
  });
});
