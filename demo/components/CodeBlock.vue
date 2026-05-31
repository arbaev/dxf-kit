<template>
  <div class="code-block">
    <span class="code-lang">{{ lang }}</span>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
// Read-only code presentation shared by the framework landing pages and the
// "Works with your stack" tabs. No syntax highlighting (dependency-free) — just
// a monospaced block with a language label.
defineProps<{ code: string; lang: string }>();
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
</style>
