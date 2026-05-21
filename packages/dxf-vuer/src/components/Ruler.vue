<template>
  <div
    ref="rootEl"
    class="dxfk-ruler"
    :class="[orientation === 'horizontal' ? 'dxfk-ruler-h' : 'dxfk-ruler-v', { 'dxfk-dark': darkTheme }]"
    aria-hidden="true"
  >
    <canvas ref="canvasEl" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, toRaw } from "vue";
import type * as THREE from "three";
import { niceTickStep, formatTickLabel } from "../utils/niceTickStep";

interface ControlsLike {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface Props {
  orientation: "horizontal" | "vertical";
  camera: THREE.OrthographicCamera | null;
  controls: ControlsLike | null;
  originOffset: { x: number; y: number };
  cursorWorld: { x: number; y: number };
  isCursorVisible: boolean;
  unitsScale: number;
  darkTheme: boolean;
}

const props = defineProps<Props>();

const rootEl = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

let resizeObserver: ResizeObserver | null = null;
let rafId: number | null = null;
let cssSize = { width: 0, height: 0 };

const TICK_MAJOR_PX = 10;
const TICK_MINOR_PX = 4;
const LABEL_OFFSET_PX = 2;
const TARGET_LABEL_SPACING_PX = 80;
const FONT = "10px system-ui, -apple-system, sans-serif";

const requestRedraw = () => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    draw();
  });
};

const syncCanvasSize = () => {
  const canvas = canvasEl.value;
  const root = rootEl.value;
  if (!canvas || !root) return;
  const rect = root.getBoundingClientRect();
  cssSize.width = rect.width;
  cssSize.height = rect.height;
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }
};

const draw = () => {
  const canvas = canvasEl.value;
  if (!canvas) return;
  syncCanvasSize();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { width: w, height: h } = cssSize;
  ctx.clearRect(0, 0, w, h);

  // Background.
  const bg = readVar("--dxfk-ruler-bg", props.darkTheme ? "#1f1f1f" : "#fafafa");
  const tickColor = readVar("--dxfk-ruler-tick", props.darkTheme ? "#888" : "#999");
  const textColor = readVar("--dxfk-ruler-text", props.darkTheme ? "#ddd" : "#333");
  const cursorColor = readVar("--dxfk-ruler-cursor", props.darkTheme ? "#ffaa00" : "#1040b0");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Separator line on the inner edge (between ruler and canvas).
  ctx.strokeStyle = tickColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (props.orientation === "horizontal") {
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
  } else {
    ctx.moveTo(w - 0.5, 0);
    ctx.lineTo(w - 0.5, h);
  }
  ctx.stroke();

  const camera = props.camera ? toRaw(props.camera) : null;
  if (!camera || w <= 0 || h <= 0) return;

  // Compute the world range visible across this ruler's main axis.
  const isH = props.orientation === "horizontal";
  const halfRange = isH
    ? (camera.right - camera.left) / 2 / camera.zoom
    : (camera.top - camera.bottom) / 2 / camera.zoom;
  const worldCenter = isH ? camera.position.x : camera.position.y;
  const worldOffset = isH ? props.originOffset.x : props.originOffset.y;

  // DXF/display coordinates spanning this ruler (already includes originOffset).
  const dxfMin = (worldCenter - halfRange) + worldOffset;
  const dxfMax = (worldCenter + halfRange) + worldOffset;
  const dxfRange = dxfMax - dxfMin;
  if (dxfRange === 0) return;

  const displayMin = dxfMin * props.unitsScale;
  const displayMax = dxfMax * props.unitsScale;
  const displayRange = displayMax - displayMin;
  const pixelsPerDisplay = (isH ? w : h) / displayRange;

  // Step is computed in *display* units.
  const step = niceTickStep(Math.abs(displayRange), isH ? w : h, TARGET_LABEL_SPACING_PX);
  // Sub-tick: 5 sub-divisions per major (rendered without labels).
  const minorStep = step / 5;

  // First visible major tick (rounded toward the lower bound).
  const rangeStart = Math.min(displayMin, displayMax);
  const rangeEnd = Math.max(displayMin, displayMax);
  const firstMajor = Math.ceil(rangeStart / step) * step;
  const firstMinor = Math.ceil(rangeStart / minorStep) * minorStep;

  ctx.font = FONT;
  ctx.textBaseline = isH ? "alphabetic" : "middle";
  ctx.textAlign = isH ? "center" : "left";
  ctx.fillStyle = textColor;
  ctx.strokeStyle = tickColor;

  // Display→pixel along the ruler axis. Account for direction (worldCenter scaled).
  const displayToPx = (display: number) => {
    if (isH) return (display - displayMin) * pixelsPerDisplay;
    // Vertical: canvas y grows downward, but DXF y grows upward. Higher dxf → smaller pixel y.
    return h - (display - displayMin) * pixelsPerDisplay;
  };

  // Minor ticks (no labels).
  ctx.beginPath();
  for (let v = firstMinor; v <= rangeEnd + minorStep * 0.5; v += minorStep) {
    if (Math.abs(((v / step) - Math.round(v / step))) < 1e-6) continue; // skip positions of major ticks
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

  // Major ticks + labels.
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
      // Rotate labels 90° so they read along the ruler axis.
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
  if (props.isCursorVisible) {
    const cursorDisplay = (isH ? props.cursorWorld.x : props.cursorWorld.y) * props.unitsScale;
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
};

const readVar = (name: string, fallback: string): string => {
  const root = rootEl.value;
  if (!root) return fallback;
  const v = getComputedStyle(root).getPropertyValue(name).trim();
  return v || fallback;
};

const onControlsChange = () => requestRedraw();

const attachControls = () => {
  if (props.controls) {
    props.controls.addEventListener("change", onControlsChange);
  }
};
const detachControls = (prev: ControlsLike | null) => {
  if (prev) prev.removeEventListener("change", onControlsChange);
};

onMounted(() => {
  if (rootEl.value) {
    resizeObserver = new ResizeObserver(() => requestRedraw());
    resizeObserver.observe(rootEl.value);
  }
  attachControls();
  requestRedraw();
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  detachControls(props.controls);
});

watch(
  () => props.controls,
  (next, prev) => {
    if (prev) detachControls(prev);
    if (next) next.addEventListener("change", onControlsChange);
    requestRedraw();
  },
);

watch(
  () => [
    props.cursorWorld.x,
    props.cursorWorld.y,
    props.isCursorVisible,
    props.unitsScale,
    props.darkTheme,
    props.originOffset.x,
    props.originOffset.y,
  ],
  () => requestRedraw(),
);
</script>

<style scoped>
.dxfk-ruler {
  position: absolute;
  z-index: 11;
  pointer-events: none;
  background-color: var(--dxfk-ruler-bg, #fafafa);
  overflow: hidden;
}

.dxfk-ruler-h {
  top: 0;
  left: 0;
  right: 0;
  height: var(--dxfk-ruler-size, 24px);
}

.dxfk-ruler-v {
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--dxfk-ruler-size, 24px);
}

.dxfk-ruler canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.dxfk-ruler.dxfk-dark {
  --dxfk-ruler-bg: #1f1f1f;
  --dxfk-ruler-text: #ddd;
  --dxfk-ruler-tick: #888;
  --dxfk-ruler-cursor: #ffaa00;
}
</style>
