import { describe, it, expect } from "vitest";
import { useLoadError } from "../useLoadError";

describe("setError", () => {
  it("extracts message from Error instance", () => {
    const { setError, errorMessage } = useLoadError();

    const msg = setError(new Error("parse failed"), "fallback");

    expect(msg).toBe("parse failed");
    expect(errorMessage.value).toBe("parse failed");
  });

  it("uses fallback message for non-Error values", () => {
    const { setError, errorMessage } = useLoadError();

    const msg = setError("string error", "fallback message");

    expect(msg).toBe("fallback message");
    expect(errorMessage.value).toBe("fallback message");
  });

  it("uses fallback message for null", () => {
    const { setError, errorMessage } = useLoadError();

    const msg = setError(null, "fallback");

    expect(msg).toBe("fallback");
    expect(errorMessage.value).toBe("fallback");
  });
});

describe("clearError", () => {
  it("resets errorMessage to null", () => {
    const { setError, clearError, errorMessage } = useLoadError();

    setError(new Error("fail"), "fallback");
    expect(errorMessage.value).toBe("fail");

    clearError();

    expect(errorMessage.value).toBeNull();
  });
});
