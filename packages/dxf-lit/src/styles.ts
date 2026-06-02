import { css } from "lit";

/**
 * Encapsulated viewer styles (Shadow DOM). Ported from dxf-react's
 * `styles.css` + `DXFViewer.css`, with two scope rewrites for the shadow
 * boundary:
 *   - `:root { --dxfk-* }`  → `:host { --dxfk-* }` (defaults; consumer overrides
 *     of `--dxfk-*` from the light DOM pierce the boundary and win).
 *   - `.dxfk-viewer.dxfk-dark X` → `:host([dark-theme]) X` (the `dark-theme`
 *     attribute reflects the `darkTheme` property).
 * The `.dxfk-viewer` wrapper is dropped — its box styles live on `:host`.
 *
 * Sub-component styles (toolbar / layer-panel / properties-panel / ruler) are
 * appended in later stages.
 */
export const viewerStyles = css`
  :host {
    /* --- design tokens (consumer-overridable via --dxfk-* from outside) --- */
    --dxfk-primary-color: #1040b0;
    --dxfk-error-color: #f44336;
    --dxfk-bg-color: #fafafa;
    --dxfk-text-color: #212121;
    --dxfk-text-secondary: #757575;
    --dxfk-border-color: #e0e0e0;
    --dxfk-border-radius: 4px;
    --dxfk-spacing-xs: 4px;
    --dxfk-spacing-sm: 8px;
    --dxfk-spacing-md: 16px;
    --dxfk-spacing-lg: 24px;
    --dxfk-ruler-size: 24px;
    --dxfk-ruler-bg: #fafafa;
    --dxfk-ruler-text: #333;
    --dxfk-ruler-tick: #999;
    --dxfk-ruler-cursor: #1040b0;

    /* --- box (was .dxfk-viewer) --- */
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background-color: var(--dxfk-bg-color, #fafafa);
    border: 2px solid var(--dxfk-border-color, #e0e0e0);
    border-radius: var(--dxfk-border-radius, 4px);
    overflow: hidden;
    touch-action: none;
  }

  :host([hidden]) {
    display: none;
  }

  canvas {
    display: block;
  }

  /* Dedicated mount node for the Three.js canvas. The element owns this node
     but never its children, so the imperatively appended <canvas> is safe. */
  .dxfk-canvas-mount {
    position: absolute;
    inset: 0;
  }

  /* Overlay grid: 6-cell layout for positioning overlay elements */
  .dxfk-overlay-grid {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      "top-left     top-center     top-right"
      "bottom-left  bottom-center  bottom-right";
    padding: var(--dxfk-spacing-sm, 8px);
    gap: var(--dxfk-spacing-sm, 8px);
    pointer-events: none;
  }

  .dxfk-overlay-grid--with-rulers {
    padding-top: calc(var(--dxfk-ruler-size, 24px) + var(--dxfk-spacing-sm, 8px));
    padding-left: calc(var(--dxfk-ruler-size, 24px) + var(--dxfk-spacing-sm, 8px));
  }

  .dxfk-ruler-corner {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--dxfk-ruler-size, 24px);
    height: var(--dxfk-ruler-size, 24px);
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--dxfk-ruler-text, #333);
    background-color: var(--dxfk-ruler-bg, #fafafa);
    border-right: 1px solid var(--dxfk-ruler-tick, #999);
    border-bottom: 1px solid var(--dxfk-ruler-tick, #999);
    pointer-events: none;
    user-select: none;
  }

  :host([dark-theme]) .dxfk-ruler-corner {
    --dxfk-ruler-bg: #1f1f1f;
    --dxfk-ruler-text: #ddd;
    --dxfk-ruler-tick: #888;
  }

  .dxfk-overlay-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    min-height: 0;
  }

  .dxfk-overlay-cell--top-left { grid-area: top-left; align-items: flex-start; }
  .dxfk-overlay-cell--top-center { grid-area: top-center; align-items: center; }
  .dxfk-overlay-cell--top-right { grid-area: top-right; align-items: flex-end; }
  .dxfk-overlay-cell--bottom-left { grid-area: bottom-left; align-items: flex-start; justify-content: flex-end; }
  .dxfk-overlay-cell--bottom-center { grid-area: bottom-center; align-items: center; justify-content: flex-end; }
  .dxfk-overlay-cell--bottom-right { grid-area: bottom-right; align-items: flex-end; justify-content: flex-end; }

  .dxfk-file-name-overlay {
    padding: var(--dxfk-spacing-sm, 8px) var(--dxfk-spacing-md, 16px);
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--dxfk-border-color, #e0e0e0);
    border-radius: var(--dxfk-border-radius, 4px);
    font-size: 14px;
    color: var(--dxfk-text-color, #212121);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dxfk-coordinates-overlay {
    display: flex;
    flex-direction: column;
    padding: 4px var(--dxfk-spacing-sm, 8px);
    background-color: rgba(255, 255, 255, 0.95);
    color: var(--dxfk-text-color, #212121);
    border: 1px solid var(--dxfk-border-color, #e0e0e0);
    border-radius: var(--dxfk-border-radius, 4px);
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    white-space: nowrap;
  }

  .dxfk-coord-row {
    display: flex;
    gap: 2px;
  }

  .dxfk-coord-value--na {
    color: var(--dxfk-text-secondary, #757575);
    opacity: 0.65;
  }

  .dxfk-coord-label {
    width: 1.2em;
    text-align: right;
    flex-shrink: 0;
  }

  .dxfk-coord-value {
    width: 7em;
    text-align: right;
    flex-shrink: 0;
  }

  .dxfk-zoom-value {
    width: auto;
    color: var(--dxfk-text-secondary, #757575);
  }

  .dxfk-debug-overlay {
    display: flex;
    gap: var(--dxfk-spacing-sm, 8px);
    padding: 4px var(--dxfk-spacing-sm, 8px);
    background-color: rgba(0, 0, 0, 0.7);
    color: #ccc;
    border-radius: var(--dxfk-border-radius, 4px);
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  }

  .dxfk-message-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--dxfk-spacing-lg, 24px);
  }

  .dxfk-message-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--dxfk-spacing-md, 16px);
    text-align: center;
  }

  .dxfk-message-icon--error {
    color: var(--dxfk-error-color, #f44336);
  }

  .dxfk-message-icon--placeholder {
    color: var(--dxfk-border-color, #e0e0e0);
  }

  .dxfk-message-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--dxfk-text-color, #212121);
  }

  .dxfk-message-text {
    font-size: 1rem;
    color: var(--dxfk-text-secondary, #757575);
    max-width: 300px;
  }

  .dxfk-measure-label {
    position: absolute;
    z-index: 14;
    pointer-events: none;
    transform: translate(-50%, -150%);
    padding: 2px 8px;
    background-color: var(--dxfk-measure-color, #ff6b1a);
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    user-select: none;
  }

  .dxfk-measure-area-label {
    position: absolute;
    z-index: 14;
    pointer-events: none;
    transform: translate(-50%, -50%);
    padding: 3px 8px;
    background-color: var(--dxfk-measure-color, #ff6b1a);
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    white-space: nowrap;
    text-align: center;
    line-height: 1.35;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    user-select: none;
  }

  .dxfk-measure-area-row--secondary {
    opacity: 0.85;
    font-size: 11px;
  }

  .dxfk-measure-angle-label {
    position: absolute;
    z-index: 14;
    pointer-events: none;
    transform: translate(-50%, -50%);
    padding: 2px 8px;
    background-color: var(--dxfk-measure-color, #ff6b1a);
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    user-select: none;
  }

  .dxfk-selection-rect {
    position: absolute;
    pointer-events: none;
    z-index: 15;
    box-sizing: border-box;
  }

  .dxfk-selection-rect--window {
    background-color: var(--dxfk-selection-rect-bg-window, rgba(64, 128, 255, 0.12));
    border: 1px solid var(--dxfk-selection-rect-border-window, #4080ff);
  }

  .dxfk-selection-rect--crossing {
    background-color: var(--dxfk-selection-rect-bg-crossing, rgba(64, 192, 64, 0.12));
    border: 1px dashed var(--dxfk-selection-rect-border-crossing, #40c040);
  }

  :host([dark-theme]) .dxfk-selection-rect--window {
    --dxfk-selection-rect-bg-window: rgba(96, 156, 255, 0.18);
    --dxfk-selection-rect-border-window: #609cff;
  }

  :host([dark-theme]) .dxfk-selection-rect--crossing {
    --dxfk-selection-rect-bg-crossing: rgba(96, 220, 96, 0.18);
    --dxfk-selection-rect-border-crossing: #60dc60;
  }

  .dxfk-loading-overlay {
    z-index: 20;
    background-color: rgba(250, 250, 250, 0.85);
  }

  .dxfk-error-overlay {
    z-index: 20;
    background-color: rgba(250, 250, 250, 0.95);
  }

  .dxfk-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--dxfk-border-color, #e0e0e0);
    border-top-color: var(--dxfk-primary-color, #1040b0);
    border-radius: 50%;
    animation: dxfk-spin 0.8s linear infinite;
  }

  .dxfk-progress-container {
    width: 200px;
    height: 4px;
    background-color: var(--dxfk-border-color, #e0e0e0);
    border-radius: 2px;
    overflow: hidden;
  }

  .dxfk-progress-bar {
    height: 100%;
    background-color: var(--dxfk-primary-color, #1040b0);
    transition: width 0.1s ease-out;
  }

  .dxfk-progress-text {
    font-size: 0.85rem;
    color: var(--dxfk-text-secondary, #757575);
  }

  @keyframes dxfk-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .dxfk-drop-overlay {
    z-index: 30;
    background-color: rgba(250, 250, 250, 0.9);
    border: 3px dashed var(--dxfk-primary-color, #1040b0);
  }

  .dxfk-drop-overlay svg {
    color: var(--dxfk-primary-color, #1040b0);
  }

  /* --- Dark theme (was .dxfk-viewer.dxfk-dark …) --- */
  :host([dark-theme]) {
    background-color: #1a1a1a;
    border-color: #333;
  }

  :host([dark-theme]) .dxfk-loading-overlay {
    background-color: rgba(26, 26, 26, 0.85);
  }

  :host([dark-theme]) .dxfk-error-overlay {
    background-color: rgba(26, 26, 26, 0.95);
  }

  :host([dark-theme]) .dxfk-file-name-overlay {
    background-color: rgba(30, 30, 30, 0.95);
    border-color: #333;
    color: #e0e0e0;
  }

  :host([dark-theme]) .dxfk-coordinates-overlay {
    background-color: rgba(30, 30, 30, 0.95);
    border-color: #444;
    color: #e0e0e0;
  }

  :host([dark-theme]) .dxfk-message-text {
    color: #aaa;
  }

  :host([dark-theme]) .dxfk-progress-text {
    color: #aaa;
  }

  :host([dark-theme]) .dxfk-message-title {
    color: #e0e0e0;
  }

  :host([dark-theme]) .dxfk-spinner {
    border-color: #444;
    border-top-color: #6b8fd4;
  }

  :host([dark-theme]) .dxfk-progress-container {
    background-color: #444;
  }

  :host([dark-theme]) .dxfk-message-icon--placeholder {
    color: #555;
  }

  :host([dark-theme]) .dxfk-drop-overlay {
    background-color: rgba(26, 26, 26, 0.9);
    border-color: #6b8fd4;
  }

  :host([dark-theme]) .dxfk-drop-overlay svg {
    color: #6b8fd4;
  }

  @media (max-width: 768px) {
    .dxfk-file-name-overlay {
      padding: 6px var(--dxfk-spacing-sm, 8px);
      font-size: 12px;
    }

    .dxfk-message-title {
      font-size: 1.1rem;
    }

    .dxfk-message-text {
      font-size: 0.9rem;
    }
  }
`;
