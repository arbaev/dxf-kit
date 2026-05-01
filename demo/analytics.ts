declare global {
  interface Window {
    umami?: {
      track: (event: string, props?: Record<string, unknown>) => void;
    };
  }
}

export function trackEvent(name: "copy-install"): void;
export function trackEvent(name: "file-upload", props: { source: "button" | "drag-drop" }): void;
export function trackEvent(name: "sample-load", props: { name: string }): void;
export function trackEvent(
  name: "stackblitz-open",
  props: { framework: "vanilla-ts" | "react" | "vue" | "leaflet-dxf" | "dxf-to-pdf" },
): void;
export function trackEvent(
  name: "external-link",
  props: { target: "github" | "npm-render" | "npm-vuer" },
): void;
export function trackEvent(
  name: "dxf-error",
  props: { source: "sample-fetch" | "file-read" | "viewer" },
): void;
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  try {
    window.umami?.track(name, props);
  } catch {
    // Analytics failures must never break the app (adblock, sandbox, etc.)
  }
}
