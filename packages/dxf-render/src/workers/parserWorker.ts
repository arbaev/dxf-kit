/// <reference lib="webworker" />
import { parseDxf } from "@/parser";

self.onmessage = (event: MessageEvent<{ id: number; dxfText: string }>) => {
  const { id, dxfText } = event.data;
  try {
    const data = parseDxf(dxfText);
    self.postMessage({ id, success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parsing error";
    self.postMessage({ id, success: false, error: message });
  }
};
