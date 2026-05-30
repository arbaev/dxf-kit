import { ref, onMounted, onBeforeUnmount } from "vue";

/**
 * Fullscreen toggle for a container element. Owns the `fullscreenchange`
 * listener (added on mount, removed on unmount) so the reactive `isFullscreen`
 * flag stays in sync even when the user exits fullscreen via the Esc key or the
 * browser chrome.
 */
export function useFullscreen(getContainer: () => HTMLElement | null) {
  const isFullscreen = ref(false);

  const toggleFullscreen = async (): Promise<void> => {
    const container = getContainer();
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const onFullscreenChange = (): void => {
    isFullscreen.value = !!document.fullscreenElement;
  };

  onMounted(() => {
    document.addEventListener("fullscreenchange", onFullscreenChange);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
  });

  return { isFullscreen, toggleFullscreen };
}
