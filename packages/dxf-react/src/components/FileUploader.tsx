import type { ChangeEvent } from "react";

export interface FileUploaderProps {
  /** Fired with the selected `.dxf` File. */
  onFileSelected?: (file: File) => void;
}

import "./FileUploader.css";

/**
 * A simple `.dxf` file picker button. Resets its value after each selection so
 * re-selecting the same file fires `onFileSelected` again.
 */
export function FileUploader({ onFileSelected }: FileUploaderProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const file = target.files?.[0];
    if (file) onFileSelected?.(file);
    // Reset value so re-selecting the same file triggers a change event.
    target.value = "";
  };

  return (
    <div className="dxfk-file-uploader">
      <label htmlFor="dxf-file-input" className="dxfk-file-input-label">
        <input
          id="dxf-file-input"
          type="file"
          accept=".dxf"
          className="dxfk-file-input"
          aria-label="Select a DXF file to load"
          onChange={handleFileChange}
        />
        <div className="dxfk-file-uploader-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Load DXF File</span>
        </div>
      </label>
    </div>
  );
}
