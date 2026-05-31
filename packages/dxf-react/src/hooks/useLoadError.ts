import { useCallback, useState } from "react";

/**
 * Tracks a user-facing load/render error message. `setError` extracts a message
 * from an Error (or falls back), stores it, and returns it for the caller to
 * forward.
 */
export function useLoadError() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setError = useCallback((error: unknown, fallbackMsg: string): string => {
    const msg = error instanceof Error ? error.message : fallbackMsg;
    setErrorMessage(msg);
    return msg;
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return { errorMessage, setError, clearError };
}
