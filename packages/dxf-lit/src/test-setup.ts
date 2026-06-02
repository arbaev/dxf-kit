import { afterEach } from "vitest";

// jsdom lacks a few browser APIs the viewer touches. Stub the minimum so
// element smoke-tests can mount/unmount without throwing. (Actual WebGL
// rendering is never exercised in jsdom — `getContext("webgl")` returns null,
// so scene init bails into the "WebGL not supported" path.)
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

// Remove any elements mounted during a test.
afterEach(() => {
  document.body.innerHTML = "";
});
