import { parseDxf } from "./parser";
import type { DxfData } from "./types/dxf";
import ParserWorker from "./workers/parserWorker?worker&inline";

let worker: Worker | null = null;
let workerFailed = false;
let messageId = 0;

function getOrCreateWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  try {
    worker = new ParserWorker();
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

/**
 * Parse DXF text asynchronously using a Web Worker.
 * Falls back to synchronous parsing if Workers are unavailable.
 */
export function parseDxfAsync(dxfText: string): Promise<DxfData> {
  const w = getOrCreateWorker();
  if (!w) {
    try {
      return Promise.resolve(parseDxf(dxfText));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parsing error";
      return Promise.reject(new Error(`DXF file parsing error: ${message}`));
    }
  }
  const id = ++messageId;
  return new Promise<DxfData>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      if (event.data.success) {
        resolve(event.data.data);
      } else {
        reject(new Error(`DXF file parsing error: ${event.data.error}`));
      }
    };
    const onError = (event: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(new Error(`Worker error: ${event.message}`));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, dxfText });
  });
}

/** Terminate the parser worker to free resources. */
export function terminateParserWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
