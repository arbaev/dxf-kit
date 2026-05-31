<template>
  <section class="stack" id="stack" aria-labelledby="stack-heading">
    <h2 id="stack-heading">Works with your stack</h2>
    <p class="stack-subtitle">
      Same engine, your framework — pick one, only the integration code changes.
    </p>

    <div class="stack-tabs" role="tablist" aria-label="Framework wrappers">
      <button
        v-for="f in FRAMEWORKS"
        :key="f.id"
        type="button"
        role="tab"
        :class="['stack-tab', { 'stack-tab--active': f.id === activeId }]"
        :aria-selected="f.id === activeId"
        @click="activeId = f.id"
      >
        <span class="stack-tab-icon" v-html="f.icon" />
        {{ f.label }}
        <span v-if="f.status === 'coming-soon'" class="stack-tab-soon">soon</span>
      </button>
    </div>

    <div class="stack-panel" role="tabpanel">
      <div class="stack-install-wrapper">
        <code class="stack-install">{{ active.install }}</code>
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

      <CodeBlock :code="active.snippet" :lang="active.lang" />

      <div class="stack-actions">
        <a v-if="active.route" class="stack-action" :href="active.route">
          Open the {{ active.label }} page →
        </a>
        <a
          v-if="active.stackblitzUrl"
          class="stack-action stack-action--ghost"
          :href="active.stackblitzUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="trackEvent('stackblitz-open', { framework: stackblitzFramework })"
        >
          Open in StackBlitz ↗
        </a>
        <span v-if="active.status === 'coming-soon'" class="stack-note">
          {{ active.npmPackage }} is in the works — the live preview below already runs the engine.
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CodeBlock from "./CodeBlock.vue";
import { FRAMEWORKS } from "../frameworks";
import type { FrameworkId } from "../frameworks";
import { trackEvent } from "../analytics";

const activeId = ref<FrameworkId>("vue");
const active = computed(() => FRAMEWORKS.find((f) => f.id === activeId.value) ?? FRAMEWORKS[0]);

const stackblitzFramework = computed(
  () =>
    (active.value.id === "vanilla" ? "vanilla-ts" : active.value.id) as
      | "vanilla-ts"
      | "react"
      | "vue",
);

const copied = ref(false);
async function copyInstall() {
  const cmd = active.value.install;
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
</script>

<style scoped>
.stack {
  max-width: var(--content-max-width);
  margin: var(--spacing-xl) auto 0;
  text-align: center;
}

.stack h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: var(--spacing-sm);
}

.stack-subtitle {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-md);
}

.stack-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--border-radius);
  background: var(--accent-bg, #f0f4ff);
  margin-bottom: var(--spacing-md);
}

.stack-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.stack-tab:hover {
  color: var(--primary-color);
}

.stack-tab--active {
  background: var(--card-bg, #fff);
  color: var(--primary-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.stack-tab-icon {
  display: inline-flex;
}

.stack-tab-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

.stack-tab-soon {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 1px 6px;
}

.stack-panel {
  text-align: left;
}

.stack-install-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background-color: var(--input-bg, #f5f5f5);
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}

.stack-install {
  flex: 1;
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

.stack-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-md);
}

.stack-action {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--primary-color);
  text-decoration: none;
}

.stack-action:hover {
  text-decoration: underline;
}

.stack-action--ghost {
  color: var(--text-secondary);
}

.stack-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
