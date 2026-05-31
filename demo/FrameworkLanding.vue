<template>
  <div class="fw-page app" :class="{ dark: isDark }">
    <TopActions v-model:dark="isDark" />

    <main class="fw-main">
      <!-- Cross-framework navigation -->
      <nav class="fw-nav" aria-label="Framework wrappers">
        <a class="fw-nav-home" href="/">← dxf-kit</a>
        <span class="fw-nav-sep">/</span>
        <template v-for="f in FRAMEWORKS" :key="f.id">
          <a
            v-if="f.route && f.id !== fw.id"
            class="fw-nav-item"
            :href="f.route"
            @click="trackEvent('framework-demo', { framework: f.id })"
            >{{ f.label }}</a
          >
          <span v-else-if="f.id === fw.id" class="fw-nav-item fw-nav-item--active">{{
            f.label
          }}</span>
        </template>
      </nav>

      <!-- Hero -->
      <header class="fw-hero">
        <span class="fw-icon" v-html="fw.icon" />
        <h1>
          {{ headline }}
          <span v-if="fw.status === 'coming-soon'" class="fw-badge">coming soon</span>
        </h1>
        <p class="fw-blurb">{{ fw.blurb }}</p>
      </header>

      <!-- Install -->
      <div class="fw-install-wrapper">
        <code class="fw-install">{{ fw.install }}</code>
        <button class="copy-btn" aria-label="Copy install command" @click="copyInstall">
          <svg
            v-if="!copied"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      <!-- Integration snippet -->
      <CodeBlock :code="fw.snippet" :lang="fw.lang" class="fw-code" />

      <!-- Live viewer (same engine across all wrappers) -->
      <p class="fw-live-label">
        <template v-if="fw.status === 'coming-soon'"
          >Live preview of the dxf-render engine the Web Component will wrap —</template
        >
        <template v-else>Live — same dxf-render engine —</template>
        drag to pan, scroll to zoom.
      </p>
      <MiniViewer :url="DEMO_SAMPLE_URL" :dark="isDark" />

      <!-- Links -->
      <div class="fw-links">
        <a
          v-if="fw.npmUrl"
          class="fw-link"
          :href="fw.npmUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: npmTarget })"
          >{{ fw.npmPackage }} on npm</a
        >
        <a
          v-if="fw.stackblitzUrl"
          class="fw-link"
          :href="fw.stackblitzUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('stackblitz-open', { framework: stackblitzFramework })"
          >Open in StackBlitz</a
        >
        <a
          class="fw-link"
          :href="GITHUB_URL"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('external-link', { target: 'github' })"
          >{{ fw.status === "coming-soon" ? "Watch the repo" : "GitHub" }}</a
        >
      </div>

      <footer class="fw-footer">
        MIT License ·
        <a href="/">dxf-kit home</a>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import TopActions from "./components/TopActions.vue";
import MiniViewer from "./components/MiniViewer.vue";
import CodeBlock from "./components/CodeBlock.vue";
import { FRAMEWORKS, getFramework, DEMO_SAMPLE_URL, GITHUB_URL } from "./frameworks";
import type { FrameworkId } from "./frameworks";
import { useDarkTheme } from "./composables/useDarkTheme";
import { trackEvent } from "./analytics";

const props = defineProps<{ framework: FrameworkId }>();

const { isDark } = useDarkTheme();

// Fall back to vanilla if an unknown id is somehow passed via the mount attribute.
const fw = computed(() => getFramework(props.framework) ?? FRAMEWORKS[0]);

// First segment of the SEO title reads naturally as the page headline.
const headline = computed(() => fw.value.meta.title.split("—")[0].trim());

// Narrow union types expected by the analytics overloads.
const NPM_TARGET: Record<FrameworkId, "npm-render" | "npm-vuer" | "npm-react" | null> = {
  vanilla: "npm-render",
  vue: "npm-vuer",
  react: "npm-react",
  lit: null,
};
const npmTarget = computed(() => NPM_TARGET[fw.value.id] ?? "npm-render");
const stackblitzFramework = computed(
  () => (fw.value.id === "vanilla" ? "vanilla-ts" : fw.value.id) as "vanilla-ts" | "react" | "vue",
);

const copied = ref(false);
async function copyInstall() {
  const cmd = fw.value.install;
  try {
    await navigator.clipboard.writeText(cmd);
  } catch {
    const el = document.createElement("textarea");
    el.value = cmd;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
  trackEvent("copy-install");
}

onMounted(() => {
  trackEvent("framework-demo", { framework: fw.value.id });
});
</script>

<style scoped>
.fw-page {
  min-height: 100vh;
  background: var(--bg-color);
  color: var(--text-color);
}

.fw-main {
  max-width: 760px;
  margin: 0 auto;
  padding: 3rem var(--spacing-lg) 4rem;
}

/* Nav */
.fw-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.875rem;
  margin-bottom: var(--spacing-lg);
}

.fw-nav-home {
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 600;
}

.fw-nav-home:hover {
  color: var(--primary-color);
}

.fw-nav-sep {
  color: var(--border-color);
}

.fw-nav-item {
  padding: 3px 12px;
  border-radius: 999px;
  color: var(--primary-color);
  text-decoration: none;
  transition: background-color 0.15s;
}

a.fw-nav-item:hover {
  background: rgba(74, 144, 217, 0.12);
}

.fw-nav-item--active {
  background: var(--primary-color);
  color: #fff;
  font-weight: 600;
}

/* Hero */
.fw-hero {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.fw-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--accent-bg, #f0f4ff);
  color: var(--primary-color);
  margin-bottom: var(--spacing-md);
}

.fw-hero h1 {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  line-height: 1.15;
  margin-bottom: var(--spacing-sm);
}

.fw-badge {
  display: inline-block;
  vertical-align: middle;
  margin-left: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-bg, #f0f4ff);
  color: var(--primary-color);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.fw-blurb {
  font-size: 1.0625rem;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 560px;
  margin: 0 auto;
}

/* Install */
.fw-install-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--spacing-lg);
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--input-bg, #f5f5f5);
  overflow: hidden;
}

.fw-install {
  padding: var(--spacing-sm) var(--spacing-md);
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.9rem;
  color: var(--text-color);
  user-select: all;
  white-space: nowrap;
  overflow-x: auto;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) 10px;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.copy-btn:hover {
  color: var(--primary-color);
  background-color: rgba(74, 144, 217, 0.08);
}

/* Code snippet — presentation lives in CodeBlock.vue; this only adds spacing. */
.fw-code {
  margin-bottom: var(--spacing-lg);
}

/* Live viewer */
.fw-live-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--spacing-sm);
}

/* Links */
.fw-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-sm) var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.fw-link {
  padding: 8px 18px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--text-color);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.fw-link:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.fw-footer {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-top: var(--spacing-xl);
}

.fw-footer a {
  color: var(--primary-color);
  text-decoration: none;
}

@media (max-width: 768px) {
  .fw-main {
    padding: 2rem var(--spacing-md) 3rem;
  }

  .fw-hero h1 {
    font-size: 1.5rem;
  }
}
</style>
