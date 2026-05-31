import type { ReactNode } from "react";
import { cx } from "../utils/classNames";
import "./ViewerToolbar.css";

export interface ViewerToolbarProps {
  showExportButton?: boolean;
  showResetButton?: boolean;
  showFullscreenButton?: boolean;
  showMeasureButton?: boolean;
  measureActive?: boolean;
  showMeasureAreaButton?: boolean;
  measureAreaActive?: boolean;
  showMeasureAngleButton?: boolean;
  measureAngleActive?: boolean;
  isFullscreen?: boolean;
  darkTheme?: boolean;
  /** Extra class merged onto the `.dxfk-toolbar` root. */
  className?: string;
  /** Extra buttons appended after the built-in ones (the `#extra` slot). */
  extra?: ReactNode;
  onExport?: () => void;
  onResetView?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMeasure?: () => void;
  onToggleMeasureArea?: () => void;
  onToggleMeasureAngle?: () => void;
}

export function ViewerToolbar({
  showExportButton = false,
  showResetButton = false,
  showFullscreenButton = true,
  showMeasureButton = false,
  measureActive = false,
  showMeasureAreaButton = false,
  measureAreaActive = false,
  showMeasureAngleButton = false,
  measureAngleActive = false,
  isFullscreen = false,
  darkTheme = false,
  className,
  extra,
  onExport,
  onResetView,
  onToggleFullscreen,
  onToggleMeasure,
  onToggleMeasureArea,
  onToggleMeasureAngle,
}: ViewerToolbarProps) {
  return (
    <div
      className={cx("dxfk-toolbar", darkTheme && "dxfk-dark", className)}
      role="toolbar"
      aria-label="DXF viewer toolbar"
    >
      {showExportButton && (
        <button
          className="dxfk-toolbar-button"
          onClick={onExport}
          title="Export PNG"
          aria-label="Export current view as PNG"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      )}
      {showMeasureButton && (
        <button
          className={cx("dxfk-toolbar-button", measureActive && "dxfk-toolbar-button--active")}
          onClick={onToggleMeasure}
          title={measureActive ? "Disable measure tool" : "Measure distance"}
          aria-label={measureActive ? "Disable measure tool" : "Enable measure-distance tool"}
          aria-pressed={measureActive}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17 17 3l4 4L7 21z" />
            <path d="M14 6l2 2" />
            <path d="M11 9l2 2" />
            <path d="M8 12l2 2" />
            <path d="M5 15l2 2" />
          </svg>
        </button>
      )}
      {showMeasureAreaButton && (
        <button
          className={cx("dxfk-toolbar-button", measureAreaActive && "dxfk-toolbar-button--active")}
          onClick={onToggleMeasureArea}
          title={measureAreaActive ? "Disable area tool" : "Measure area"}
          aria-label={measureAreaActive ? "Disable area-measurement tool" : "Enable area-measurement tool"}
          aria-pressed={measureAreaActive}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 3 21 9.5 17.5 20.5 6.5 20.5 3 9.5" />
            <circle cx="12" cy="3" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="21" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="17.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="6.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
            <circle cx="3" cy="9.5" r="1.4" fill="currentColor" stroke="none" />
          </svg>
        </button>
      )}
      {showMeasureAngleButton && (
        <button
          className={cx("dxfk-toolbar-button", measureAngleActive && "dxfk-toolbar-button--active")}
          onClick={onToggleMeasureAngle}
          title={measureAngleActive ? "Disable angle tool" : "Measure angle"}
          aria-label={measureAngleActive ? "Disable angle-measurement tool" : "Enable angle-measurement tool"}
          aria-pressed={measureAngleActive}
        >
          <svg width="20" height="20" viewBox="0 0 122.88 103.56" fill="currentColor" aria-hidden="true">
            <path d="M59.49,1.72c1.03-1.69,3.24-2.23,4.94-1.2c1.69,1.03,2.23,3.24,1.2,4.94L34.75,55.92c6.65,4.72,12.18,10.9,16.11,18.07 c3.69,6.72,5.99,14.31,6.51,22.37h61.91c1.99,0,3.6,1.61,3.6,3.6c0,1.99-1.61,3.6-3.6,3.6H3.59v-0.01c-0.64,0-1.29-0.17-1.87-0.53 c-1.69-1.03-2.23-3.24-1.2-4.94L59.49,1.72L59.49,1.72z M31,62.05L10.01,96.36h40.14c-0.51-6.82-2.47-13.23-5.59-18.91 C41.22,71.36,36.57,66.1,31,62.05L31,62.05z" />
          </svg>
        </button>
      )}
      {showResetButton && (
        <button
          className="dxfk-toolbar-button"
          onClick={onResetView}
          title="Fit to View"
          aria-label="Reset camera and fit drawing to view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}
      {showFullscreenButton && (
        <button
          className="dxfk-toolbar-button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={isFullscreen}
        >
          {!isFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V4h4" />
              <path d="M16 4h4v4" />
              <path d="M20 16v4h-4" />
              <path d="M4 16v4h4" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4v4H4" />
              <path d="M16 4v4h4" />
              <path d="M4 16h4v4" />
              <path d="M20 16h-4v4" />
            </svg>
          )}
        </button>
      )}
      {extra}
    </div>
  );
}
