import { ref } from "vue";

/**
 * Drag-and-drop file loading for the viewer, plus the buffer/blob entry points
 * that share its UTF-8 / UTF-16 BOM decoding. All loading funnels through the
 * host-supplied `loadText` so error handling and lifecycle stay in one place.
 */
export function useDragAndDrop(opts: {
  /** Whether dropping is currently permitted (the `allowDrop` prop). */
  allowDrop: () => boolean;
  /** Load DXF text into the viewer (the host's `loadDXFFromText`). */
  loadText: (text: string) => void | Promise<void>;
  /** Notify the host that a file was dropped (drives the `file-dropped` emit). */
  onFileDropped: (fileName: string) => void;
}) {
  const isDragOver = ref(false);
  let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  const handleDragOver = (e: DragEvent): void => {
    if (!opts.allowDrop()) return;
    if (dragLeaveTimer) {
      clearTimeout(dragLeaveTimer);
      dragLeaveTimer = null;
    }
    isDragOver.value = true;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (): void => {
    if (!opts.allowDrop()) return;
    // Debounce to avoid flicker when dragging over child elements
    dragLeaveTimer = setTimeout(() => {
      isDragOver.value = false;
    }, 50);
  };

  const handleDrop = async (e: DragEvent): Promise<void> => {
    if (!opts.allowDrop()) return;
    isDragOver.value = false;
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    opts.onFileDropped(file.name);
    const text = await file.text();
    opts.loadText(text);
  };

  const decodeBuffer = (buffer: ArrayBuffer): string => {
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
  };

  const loadDXFFromBuffer = async (buffer: ArrayBuffer): Promise<void> => {
    await opts.loadText(decodeBuffer(buffer));
  };

  const loadDXFFromBlob = async (blob: Blob): Promise<void> => {
    const buffer = await blob.arrayBuffer();
    await loadDXFFromBuffer(buffer);
  };

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
