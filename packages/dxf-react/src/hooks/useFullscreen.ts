import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fullscreen toggle for a container element. Owns the `fullscreenchange`
 * listener so `isFullscreen` stays in sync even when the user exits via Esc or
 * the browser chrome.
 */
export function useFullscreen(getContainer: () => HTMLElement | null) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const getContainerRef = useRef(getContainer);
  getContainerRef.current = getContainer;

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const container = getContainerRef.current();
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = (): void => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  return { isFullscreen, toggleFullscreen };
}
