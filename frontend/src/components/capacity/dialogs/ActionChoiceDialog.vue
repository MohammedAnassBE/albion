<template>
  <Dialog
    v-model:visible="store.showActionChoice.value"
    modal
    header="What would you like to do?"
    :style="{ width: '340px' }"
    @hide="store.closeActionChoice()"
  >
    <div class="date-info">
      <i class="pi pi-calendar" />
      {{ store.fmtDate(store.actionChoiceContext.value.date) }}
      {{ store.actionChoiceContext.value.machine ? '(' + store.actionChoiceContext.value.machine + ')' : '(All Machines)' }}
    </div>
    <div class="choice-buttons">
      <button class="choice-btn" @click="store.chooseUpdateShift()">
        <i class="pi pi-clock choice-icon" />
        <div class="choice-label">Update Shift</div>
        <div class="choice-desc">Change the shift for this date</div>
      </button>
      <button class="choice-btn" @click="store.chooseUpdateTime()">
        <i class="pi pi-pencil choice-icon" />
        <div class="choice-label">Update Time</div>
        <div class="choice-desc">Add overtime or break</div>
      </button>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeActionChoice()" />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.date-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
}
.choice-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.choice-btn {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
.choice-btn:hover {
  background: var(--surface-hover);
  border-color: var(--primary-color);
}
.choice-icon {
  font-size: 20px;
  color: var(--primary-color);
  margin-top: 2px;
  flex-shrink: 0;
}
.choice-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-color);
}
.choice-desc {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}
</style>
