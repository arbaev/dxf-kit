import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from "react";

export interface UseDragAndDropOptions {
  /** Whether dropping is currently permitted (the `allowDrop` prop). */
  allowDrop: boolean;
  /** Load DXF text into the viewer (the host's `loadDXFFromText`). */
  loadText: (text: string) => void | Promise<void>;
  /** Notify the host that a file was dropped (drives the `onFileDropped` callback). */
  onFileDropped: (fileName: string) => void;
}

/**
 * Drag-and-drop file loading plus the buffer/blob entry points that share its
 * UTF-8 / UTF-16 BOM decoding. The handlers call `preventDefault` directly to
 * keep the browser from opening the dropped file.
 */
export function useDragAndDrop(opts: UseDragAndDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const handleDragOver = useCallback((e: ReactDragEvent): void => {
    if (!optsRef.current.allowDrop) return;
    e.preventDefault();
    if (dragLeaveTimer.current) {
      clearTimeout(dragLeaveTimer.current);
      dragLeaveTimer.current = null;
    }
    setIsDragOver(true);
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((): void => {
    if (!optsRef.current.allowDrop) return;
    // Debounce to avoid flicker when dragging over child elements.
    dragLeaveTimer.current = setTimeout(() => {
      setIsDragOver(false);
    }, 50);
  }, []);

  const handleDrop = useCallback(async (e: ReactDragEvent): Promise<void> => {
    if (!optsRef.current.allowDrop) return;
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    optsRef.current.onFileDropped(file.name);
    const text = await file.text();
    optsRef.current.loadText(text);
  }, []);

  const decodeBuffer = useCallback((buffer: ArrayBuffer): string => {
    const view = new Uint8Array(buffer);
    // UTF-16 LE BOM (DXF files saved by AutoCAD with non-ASCII content)
    if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
      return new TextDecoder("utf-16le").decode(buffer);
    }
    // UTF-16 BE BOM
    if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) {
      return new TextDecoder("utf-16be").decode(buffer);
    }
    // UTF-8 (with or without BOM — TextDecoder strips it automatically)
    return new TextDecoder("utf-8").decode(buffer);
  }, []);

  const loadDXFFromBuffer = useCallback(
    async (buffer: ArrayBuffer): Promise<void> => {
      await optsRef.current.loadText(decodeBuffer(buffer));
    },
    [decodeBuffer],
  );

  const loadDXFFromBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      const buffer = await blob.arrayBuffer();
      await loadDXFFromBuffer(buffer);
    },
    [loadDXFFromBuffer],
  );

  return {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    decodeBuffer,
    loadDXFFromBuffer,
    loadDXFFromBlob,
  };
}
