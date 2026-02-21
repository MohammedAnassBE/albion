<template>
  <Teleport to="body">
    <div
      v-if="store.tooltip.value.show"
      class="gantt-tooltip"
      :style="{ top: store.tooltip.value.y + 'px', left: store.tooltip.value.x + 'px' }"
    >
      <div class="tt-header">{{ store.tooltip.value.data.item }}</div>
      <div class="tt-grid">
        <span class="tt-label">Order</span><span class="tt-val">{{ store.tooltip.value.data.order }}</span>
        <span class="tt-label">Process</span><span class="tt-val">{{ store.tooltip.value.data.process }}</span>
        <span class="tt-label">Dates</span>
        <span class="tt-val">{{ store.fmtDate(store.tooltip.value.data.start_date) }} → {{ store.fmtDate(store.tooltip.value.data.end_date) }}</span>
        <span class="tt-label">Days</span><span class="tt-val">{{ store.tooltip.value.data.days }}</span>
        <span class="tt-label">Quantity</span><span class="tt-val tt-qty">{{ store.tooltip.value.data.total_quantity }}</span>
        <span class="tt-label">Minutes</span><span class="tt-val">{{ store.tooltip.value.data.total_minutes }}m</span>
        <template v-if="store.tooltip.value.data.colour">
          <span class="tt-label">Colour</span><span class="tt-val">{{ store.tooltip.value.data.colour }}</span>
        </template>
        <template v-if="store.tooltip.value.data.size">
          <span class="tt-label">Size</span><span class="tt-val">{{ store.tooltip.value.data.size }}</span>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.gantt-tooltip {
  position: fixed;
  background: var(--surface-overlay);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  padding: 10px 12px;
  z-index: 2000;
  pointer-events: none;
  transform: translateX(-50%) translateY(-100%) translateY(-10px);
  min-width: 180px;
}
.tt-header {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-color);
  margin-bottom: 8px;
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 4px;
}
.tt-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  font-size: 12px;
}
.tt-label {
  color: var(--text-color-secondary);
  white-space: nowrap;
}
.tt-val { color: var(--text-color); font-weight: 500; }
.tt-qty { font-weight: 700; color: var(--primary-color); }
</style>
