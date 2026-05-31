import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom lacks a few browser APIs the viewer touches. Stub the minimum so
// component smoke-tests can mount/unmount without throwing. (Actual WebGL
// rendering is never exercised in jsdom — `getContext("webgl")` returns null,
// so the scene init bails into the "WebGL not supported" path.)
// jsdom logs a noisy "Not implemented: getContext" for every canvas probe.
// Return null directly: the viewer treats a null context as "WebGL unsupported"
// and the ruler guards against a null 2d context, so this is the correct stub.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as HTMLCanvasElement["getContext"];
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof globalThis.matchMedia === "undefined") {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

// React Testing Library does not auto-clean up without test globals; do it here.
afterEach(() => {
  cleanup();
});
