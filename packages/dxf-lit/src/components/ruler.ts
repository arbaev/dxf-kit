import { LitElement, html, css, type PropertyValues } from "lit";
import { property, query } from "lit/decorators.js";
import type * as THREE from "three";
import { niceTickStep, formatTickLabel } from "../utils/niceTickStep";

interface ControlsLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

const TICK_MAJOR_PX = 10;
const TICK_MINOR_PX = 4;
const LABEL_OFFSET_PX = 2;
const TARGET_LABEL_SPACING_PX = 80;
const FONT = "10px system-ui, -apple-system, sans-serif";

/**
 * `<dxf-ruler>` — a horizontal or vertical ruler rendered to a DPI-aware 2D
 * canvas. Internal sub-component used by `<dxf-viewer>`; a 1:1 port of
 * dxf-react's `Ruler`. Redraws on a rAF tick whenever a draw-relevant property
 * changes or the orbit controls fire `change`.
 */
export class DxfRulerElement extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      z-index: 11;
      pointer-events: none;
      background-color: var(--dxfk-ruler-bg, #fafafa);
      overflow: hidden;
      display: block;
    }
    :host([orientation="horizontal"]) {
      top: 0;
      left: 0;
      right: 0;
      height: var(--dxfk-ruler-size, 24px);
    }
    :host([orientation="vertical"]) {
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--dxfk-ruler-size, 24px);
    }
    :host([dark-theme]) {
      --dxfk-ruler-bg: #1f1f1f;
      --dxfk-ruler-text: #ddd;
      --dxfk-ruler-tick: #888;
      --dxfk-ruler-cursor: #ffaa00;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: String, reflect: true }) orientation: "horizontal" | "vertical" = "horizontal";
  @property({ attribute: false }) camera: THREE.OrthographicCamera | null = null;
  @property({ attribute: false }) controls: ControlsLike | null = null;
  @property({ attribute: false }) originOffset: { x: number; y: number } = { x: 0, y: 0 };
  @property({ attribute: false }) cursorWorld: { x: number; y: number } = { x: 0, y: 0 };
  @property({ type: Boolean, attribute: "is-cursor-visible" }) isCursorVisible = false;
  @property({ type: Number, attribute: "units-scale" }) unitsScale = 1;
  @property({ type: Boolean, reflect: true, attribute: "dark-theme" }) darkTheme = false;

  @query("canvas") private _canvas!: HTMLCanvasElement;

  private _raf: number | null = null;
  private _ro: ResizeObserver | null = null;
  private _cssSize = { width: 0, height: 0 };
  private _attachedControls: ControlsLike | null = null;
  private readonly _controlsHandler = (): void => this._requestRedraw();

  override firstUpdated(): void {
    this._ro = new ResizeObserver(() => this._requestRedraw());
    this._ro.observe(this);
    this._requestRedraw();
  }

  override updated(changed: PropertyValues): void {
    if (changed.has("controls")) {
      if (this._attachedControls) {
        this._attachedControls.removeEventListener("change", this._controlsHandler);
      }
      this._attachedControls = this.controls;
      if (this._attachedControls) {
        this._attachedControls.addEventListener("change", this._controlsHandler);
      }
    }
    this._requestRedraw();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._ro?.disconnect();
    this._ro = null;
    if (this._attachedControls) {
      this._attachedControls.removeEventListener("change", this._controlsHandler);
      this._attachedControls = null;
    }
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  private _requestRedraw(): void {
    if (this._raf !== null) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._draw();
    });
  }

  private _readVar(name: string, fallback: string): string {
    const v = getComputedStyle(this).getPropertyValue(name).trim();
    return v || fallback;
  }

  private _syncCanvasSize(): void {
    const canvas = this._canvas;
    if (!canvas) return;
    const rect = this.getBoundingClientRect();
    this._cssSize.width = rect.width;
    this._cssSize.height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
  }

  private _draw(): void {
    const canvas = this._canvas;
    if (!canvas) return;
    this._syncCanvasSize();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { width: w, height: h } = this._cssSize;
    ctx.clearRect(0, 0, w, h);

    const bg = this._readVar("--dxfk-ruler-bg", this.darkTheme ? "#1f1f1f" : "#fafafa");
    const tickColor = this._readVar("--dxfk-ruler-tick", this.darkTheme ? "#888" : "#999");
    const textColor = this._readVar("--dxfk-ruler-text", this.darkTheme ? "#ddd" : "#333");
    const cursorColor = this._readVar("--dxfk-ruler-cursor", this.darkTheme ? "#ffaa00" : "#1040b0");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const isH = this.orientation === "horizontal";

    // Separator line on the inner edge (between ruler and canvas).
    ctx.strokeStyle = tickColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (isH) {
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
    } else {
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
    }
    ctx.stroke();

    const camera = this.camera;
    if (!camera || w <= 0 || h <= 0) return;

    const halfRange = isH
      ? (camera.right - camera.left) / 2 / camera.zoom
      : (camera.top - camera.bottom) / 2 / camera.zoom;
    const worldCenter = isH ? camera.position.x : camera.position.y;
    const worldOffset = isH ? this.originOffset.x : this.originOffset.y;

    const dxfMin = worldCenter - halfRange + worldOffset;
    const dxfMax = worldCenter + halfRange + worldOffset;
    const dxfRange = dxfMax - dxfMin;
    if (dxfRange === 0) return;

    const displayMin = dxfMin * this.unitsScale;
    const displayMax = dxfMax * this.unitsScale;
    const displayRange = displayMax - displayMin;
    const pixelsPerDisplay = (isH ? w : h) / displayRange;

    const step = niceTickStep(Math.abs(displayRange), isH ? w : h, TARGET_LABEL_SPACING_PX);
    const minorStep = step / 5;

    const rangeStart = Math.min(displayMin, displayMax);
    const rangeEnd = Math.max(displayMin, displayMax);
    const firstMajor = Math.ceil(rangeStart / step) * step;
    const firstMinor = Math.ceil(rangeStart / minorStep) * minorStep;

    ctx.font = FONT;
    ctx.textBaseline = isH ? "alphabetic" : "middle";
    ctx.textAlign = isH ? "center" : "left";
    ctx.fillStyle = textColor;
    ctx.strokeStyle = tickColor;

    const displayToPx = (display: number): number => {
      if (isH) return (display - displayMin) * pixelsPerDisplay;
      // Vertical: canvas y grows downward, DXF y grows upward.
      return h - (display - displayMin) * pixelsPerDisplay;
    };

    // Minor ticks (no labels).
    ctx.beginPath();
    for (let v = firstMinor; v <= rangeEnd + minorStep * 0.5; v += minorStep) {
      if (Math.abs(v / step - Math.round(v / step)) < 1e-6) continue; // skip major positions
      const px = displayToPx(v);
      if (isH) {
        ctx.moveTo(Math.round(px) + 0.5, h);
        ctx.lineTo(Math.round(px) + 0.5, h - TICK_MINOR_PX);
      } else {
        ctx.moveTo(w, Math.round(px) + 0.5);
        ctx.lineTo(w - TICK_MINOR_PX, Math.round(px) + 0.5);
      }
    }
    ctx.stroke();

    // Major ticks.
    ctx.beginPath();
    for (let v = firstMajor; v <= rangeEnd + step * 0.5; v += step) {
      const px = displayToPx(v);
      if (isH) {
        ctx.moveTo(Math.round(px) + 0.5, h);
        ctx.lineTo(Math.round(px) + 0.5, h - TICK_MAJOR_PX);
      } else {
        ctx.moveTo(w, Math.round(px) + 0.5);
        ctx.lineTo(w - TICK_MAJOR_PX, Math.round(px) + 0.5);
      }
    }
    ctx.stroke();

    // Labels (separate loop to avoid breaking the tick path).
    for (let v = firstMajor; v <= rangeEnd + step * 0.5; v += step) {
      const px = displayToPx(v);
      const label = formatTickLabel(v, step);
      if (!label) continue;
      if (isH) {
        ctx.fillText(label, Math.round(px), h - TICK_MAJOR_PX - LABEL_OFFSET_PX);
      } else {
        ctx.save();
        ctx.translate(w - TICK_MAJOR_PX - LABEL_OFFSET_PX, Math.round(px));
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }

    // Cursor marker.
    if (this.isCursorVisible) {
      const cursorDisplay = (isH ? this.cursorWorld.x : this.cursorWorld.y) * this.unitsScale;
      if (cursorDisplay >= rangeStart && cursorDisplay <= rangeEnd) {
        const px = displayToPx(cursorDisplay);
        ctx.strokeStyle = cursorColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (isH) {
          ctx.moveTo(Math.round(px) + 0.5, 0);
          ctx.lineTo(Math.round(px) + 0.5, h);
        } else {
          ctx.moveTo(0, Math.round(px) + 0.5);
          ctx.lineTo(w, Math.round(px) + 0.5);
        }
        ctx.stroke();
      }
    }
  }

  override render() {
    return html`<canvas></canvas>`;
  }
}
