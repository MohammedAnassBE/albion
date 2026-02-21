<template>
  <Dialog
    v-model:visible="store.showShiftUpdateModal.value"
    modal
    :header="`Update Shifts${store.shiftUpdateForm.value.machine ? ' — ' + store.shiftUpdateForm.value.machine : ''}`"
    :style="{ width: '420px' }"
    @hide="store.closeShiftUpdateModal()"
  >
    <div class="info-grid">
      <span class="info-label">Date</span>
      <span class="info-val">{{ store.fmtDate(store.shiftUpdateForm.value.date) }}</span>
      <template v-if="store.shiftUpdateForm.value.machine">
        <span class="info-label">Machine</span>
        <span class="info-val">{{ store.shiftUpdateForm.value.machine }}</span>
      </template>
    </div>
    <div class="field-group">
      <label class="field-label">Shifts</label>
      <div class="shift-list">
        <label
          v-for="s in store.allShifts.value"
          :key="s.name"
          class="shift-item"
        >
          <Checkbox
            :value="s.name"
            v-model="store.shiftUpdateForm.value.shifts"
            :binary="false"
          />
          <span class="shift-name">{{ s.shift_name }}</span>
          <span class="shift-mins">{{ s.duration_minutes }}m</span>
        </label>
      </div>
    </div>
    <div v-if="store.shiftUpdateForm.value.shifts.length > 0" class="total-row">
      Total: <strong>{{ store.selectedShiftsTotalMinutes.value }}m</strong>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeShiftUpdateModal()" />
      <Button
        label="Update"
        icon="pi pi-check"
        :loading="store.shiftUpdateSaving.value"
        :disabled="store.shiftUpdateForm.value.shifts.length === 0"
        @click="store.confirmShiftUpdate()"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, Checkbox } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.info-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13px; margin-bottom: 16px; }
.info-label { color: var(--text-color-secondary); }
.info-val { font-weight: 500; }
.field-group { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
.shift-list { display: flex; flex-direction: column; gap: 6px; }
.shift-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.shift-item:hover { background: var(--surface-hover); }
.shift-name { flex: 1; font-size: 13px; font-weight: 500; }
.shift-mins { font-size: 12px; color: var(--text-color-secondary); }
.total-row { font-size: 13px; color: var(--text-color-secondary); margin-top: 10px; }
</style>
