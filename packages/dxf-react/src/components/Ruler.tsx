import { useCallback, useEffect, useRef } from "react";
import type * as THREE from "three";
import { niceTickStep, formatTickLabel } from "../utils/niceTickStep";
import { cx } from "../utils/classNames";
import "./Ruler.css";

interface ControlsLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface RulerProps {
  orientation: "horizontal" | "vertical";
  camera: THREE.OrthographicCamera | null;
  controls: ControlsLike | null;
  originOffset: { x: number; y: number };
  cursorWorld: { x: number; y: number };
  isCursorVisible: boolean;
  unitsScale: number;
  darkTheme: boolean;
  /** Extra class merged onto the ruler root. */
  className?: string;
}

const TICK_MAJOR_PX = 10;
const TICK_MINOR_PX = 4;
const LABEL_OFFSET_PX = 2;
const TARGET_LABEL_SPACING_PX = 80;
const FONT = "10px system-ui, -apple-system, sans-serif";

/**
 * Horizontal or vertical ruler rendered to a DPI-aware 2D canvas. The draw
 * routine reads the latest props from a ref so the rAF-scheduled redraw stays a
 * stable callback.
 */
export function Ruler(props: RulerProps) {
  const { orientation, controls, darkTheme, className } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const cssSizeRef = useRef({ width: 0, height: 0 });

  // Latest draw-relevant props for the stable draw() routine.
  const propsRef = useRef(props);
  propsRef.current = props;

  const readVar = useCallback((name: string, fallback: string): string => {
    const root = rootRef.current;
    if (!root) return fallback;
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }, []);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const rect = root.getBoundingClientRect();
    cssSizeRef.current.width = rect.width;
    cssSizeRef.current.height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasSize();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const p = propsRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { width: w, height: h } = cssSizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const bg = readVar("--dxfk-ruler-bg", p.darkTheme ? "#1f1f1f" : "#fafafa");
    const tickColor = readVar("--dxfk-ruler-tick", p.darkTheme ? "#888" : "#999");
    const textColor = readVar("--dxfk-ruler-text", p.darkTheme ? "#ddd" : "#333");
    const cursorColor = readVar("--dxfk-ruler-cursor", p.darkTheme ? "#ffaa00" : "#1040b0");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Separator line on the inner edge (between ruler and canvas).
    ctx.strokeStyle = tickColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (p.orientation === "horizontal") {
      ctx.moveTo(0, h - 0.5);
      ctx.lineTo(w, h - 0.5);
    } else {
      ctx.moveTo(w - 0.5, 0);
      ctx.lineTo(w - 0.5, h);
    }
    ctx.stroke();

    const camera = p.camera;
    if (!camera || w <= 0 || h <= 0) return;

    const isH = p.orientation === "horizontal";
    const halfRange = isH
      ? (camera.right - camera.left) / 2 / camera.zoom
      : (camera.top - camera.bottom) / 2 / camera.zoom;
    const worldCenter = isH ? camera.position.x : camera.position.y;
    const worldOffset = isH ? p.originOffset.x : p.originOffset.y;

    const dxfMin = worldCenter - halfRange + worldOffset;
    const dxfMax = worldCenter + halfRange + worldOffset;
    const dxfRange = dxfMax - dxfMin;
    if (dxfRange === 0) return;

    const displayMin = dxfMin * p.unitsScale;
    const displayMax = dxfMax * p.unitsScale;
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

    const displayToPx = (display: number) => {
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
    if (p.isCursorVisible) {
      const cursorDisplay = (isH ? p.cursorWorld.x : p.cursorWorld.y) * p.unitsScale;
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
  }, [syncCanvasSize, readVar]);

  const requestRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // Mount: ResizeObserver + initial redraw.
  useEffect(() => {
    const root = rootRef.current;
    let ro: ResizeObserver | null = null;
    if (root) {
      ro = new ResizeObserver(() => requestRedraw());
      ro.observe(root);
    }
    requestRedraw();
    return () => {
      if (ro) ro.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [requestRedraw]);

  // Re-attach the controls "change" listener whenever the controls instance changes.
  useEffect(() => {
    if (!controls) return;
    const handler = () => requestRedraw();
    controls.addEventListener("change", handler);
    requestRedraw();
    return () => controls.removeEventListener("change", handler);
  }, [controls, requestRedraw]);

  // Redraw on any draw-relevant prop change.
  useEffect(() => {
    requestRedraw();
  }, [
    props.camera,
    props.originOffset.x,
    props.originOffset.y,
    props.cursorWorld.x,
    props.cursorWorld.y,
    props.isCursorVisible,
    props.unitsScale,
    props.darkTheme,
    requestRedraw,
  ]);

  return (
    <div
      ref={rootRef}
      className={cx(
        "dxfk-ruler",
        orientation === "horizontal" ? "dxfk-ruler-h" : "dxfk-ruler-v",
        darkTheme && "dxfk-dark",
        className,
      )}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
