<template>
  <section class="stats-section">
    <h2>Basic features</h2>
    <div class="stats">
      <div class="stat">
        <span class="stat-value">21</span>
        <span class="stat-label">entity types</span>
      </div>
      <div class="stat-divider" />
      <div class="stat">
        <span class="stat-value">0</span>
        <span class="stat-label">parser deps</span>
      </div>
      <div class="stat-divider" />
      <div class="stat">
        <span class="stat-value">878</span>
        <span class="stat-label">tests</span>
      </div>
      <div class="stat-divider" />
      <div class="stat">
        <span class="stat-value">Web Worker</span>
        <span class="stat-label">parsing</span>
      </div>
    </div>
  </section>
</template>

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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
  line-height: 1;
  white-space: nowrap;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
}

@media (max-width: 768px) {
  .stats {
    gap: var(--spacing-sm);
  }

  .stat-value {
    font-size: 1.25rem;
  }
}
</style>
