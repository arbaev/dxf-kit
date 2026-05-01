declare global {
  interface Window {
    umami?: {
      track: (
        nameOrPayload:
          | string
          | { name: string; tag?: string; data?: Record<string, unknown> },
        data?: Record<string, unknown>,
      ) => void;
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
    const tag = props ? pickTag(props) : undefined;
    if (tag !== undefined) {
      window.umami?.track({ name, tag, data: props });
    } else {
      window.umami?.track(name, props);
    }
  } catch {
    // Analytics failures must never break the app (adblock, sandbox, etc.)
  }
}

// Umami's Breakdown view supports the special `tag` dimension but not arbitrary event data,
// so we promote the single defining prop of each event to a tag for slicing.
function pickTag(props: Record<string, unknown>): string | undefined {
  const value = props.framework ?? props.target ?? props.source ?? props.name;
  return typeof value === "string" ? value : undefined;
}
