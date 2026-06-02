<template>
  <div class="code-block">
    <span class="code-lang">{{ lang }}</span>
    <pre><code v-html="highlighted"></code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { highlight } from "../utils/highlight";

// Read-only code presentation shared by the framework landing pages and the
// "Works with your stack" tabs. Highlighting is done by a tiny, dependency-free
// tokenizer (utils/highlight.ts) — just enough colour to read, no library.
const props = defineProps<{ code: string; lang: string }>();

const highlighted = computed(() => highlight(props.code));
</script>

<style scoped>
.code-block {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--input-bg, #f7f7f8);
  overflow: hidden;
}

.code-lang {
  position: absolute;
  top: 8px;
  right: 12px;
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.code-block pre {
  margin: 0;
  padding: var(--spacing-md) var(--spacing-lg);
  overflow-x: auto;
}

.code-block code {
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-color);
  white-space: pre;
}

/* Token palette — light theme (GitHub-light inspired). */
.code-block :deep(.tok-cm) {
  color: #6e7781;
  font-style: italic;
}
.code-block :deep(.tok-st) {
  color: #0a3069;
}
.code-block :deep(.tok-kw) {
  color: #cf222e;
}
.code-block :deep(.tok-tg) {
  color: #116329;
}
.code-block :deep(.tok-pn) {
  color: #6e7781;
}
.code-block :deep(.tok-fn) {
  color: #8250df;
}
.code-block :deep(.tok-nm) {
  color: #0550ae;
}

/* Token palette — dark theme (GitHub-dark inspired). */
.dark .code-block :deep(.tok-cm) {
  color: #8b949e;
}
.dark .code-block :deep(.tok-st) {
  color: #a5d6ff;
}
.dark .code-block :deep(.tok-kw) {
  color: #ff7b72;
}
.dark .code-block :deep(.tok-tg) {
  color: #7ee787;
}
.dark .code-block :deep(.tok-pn) {
  color: #8b949e;
}
.dark .code-block :deep(.tok-fn) {
  color: #d2a8ff;
}
.dark .code-block :deep(.tok-nm) {
  color: #79c0ff;
}
</style>
