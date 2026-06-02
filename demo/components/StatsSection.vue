<template>
  <section ref="root" class="stats-section">
    <h2>Basic features</h2>
    <div class="stats">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <span class="stat-value">{{ display[stat.label] }}</span>
        <span class="stat-label">{{ stat.label }}</span>
        <span class="stat-sub">{{ stat.sub }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";

interface Stat {
  value: number;
  label: string;
  sub: string;
}

const stats: Stat[] = [
  { value: 22, label: "entity types", sub: "LINE · ARC · SPLINE · HATCH · INSERT · MTEXT · REGION · …" },
  { value: 1299, label: "tests", sub: "100% green CI on every push" },
  { value: 29, label: "hatch patterns", sub: "ANSI31 · ANSI32 · ANSI33 · GRASS · NET · GOST · …" },
  { value: 7, label: "dimension types", sub: "linear · aligned · radial · diametric · angular · ordinate · 3-pt" },
  { value: 6, label: "AA modes", sub: "MSAA · SMAA · FXAA · TAA · SSAA · none" },
  { value: 0, label: "parser deps", sub: "zero runtime imports for parser-only entry" },
];

const display = reactive<Record<string, number>>(
  Object.fromEntries(stats.map((s) => [s.label, 0])),
);

const root = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
const animationsRunning = new Set<number>();

const reducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const animate = (): void => {
  if (reducedMotion()) {
    for (const s of stats) display[s.label] = s.value;
    return;
  }
  const duration = 800;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    // ease-out cubic
    const k = 1 - Math.pow(1 - t, 3);
    for (const s of stats) {
      display[s.label] = Math.round(s.value * k);
    }
    if (t < 1) {
      const handle = requestAnimationFrame(step);
      animationsRunning.add(handle);
    }
  };
  const handle = requestAnimationFrame(step);
  animationsRunning.add(handle);
};

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === "undefined") {
    animate();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animate();
          observer?.disconnect();
          break;
        }
      }
    },
    { threshold: 0.3 },
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  for (const h of animationsRunning) cancelAnimationFrame(h);
  animationsRunning.clear();
});
</script>

<style scoped>
.stats-section {
  max-width: var(--content-max-width);
  margin: calc(var(--spacing-lg) * 2) auto var(--spacing-lg);
  text-align: center;
}

.stats-section h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 var(--spacing-md);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border: none;
  border-left: 2px solid var(--primary-color);
  border-bottom: 2px solid var(--primary-color);
  border-radius: 0;
  background: transparent;
  text-align: left;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--primary-color);
  line-height: 1;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-color);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 600;
}

.stat-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }

  .stat {
    padding: 14px 12px;
  }

  .stat-value {
    font-size: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stat {
    transition: none;
  }
}
</style>
