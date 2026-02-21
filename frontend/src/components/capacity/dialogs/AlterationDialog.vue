<template>
  <Dialog
    v-model:visible="store.showAlterationModal.value"
    modal
    header="Add Shift Alteration"
    :style="{ width: '400px' }"
    @hide="store.closeAlterationModal()"
  >
    <div class="info-grid">
      <span class="info-label">Date</span>
      <span class="info-val">{{ store.fmtDate(store.alterationForm.value.date) }}</span>
      <span class="info-label">Machine</span>
      <span class="info-val">{{ store.alterationForm.value.machine || 'All Machines' }}</span>
    </div>
    <div class="fields">
      <div class="field-group">
        <label class="field-label">Type</label>
        <Select
          v-model="store.alterationForm.value.alteration_type"
          :options="typeOptions"
          optionLabel="label"
          optionValue="value"
          fluid
        />
      </div>
      <div class="field-group">
        <label class="field-label">Minutes</label>
        <InputNumber
          v-model="store.alterationForm.value.minutes"
          :min="1"
          showButtons
          fluid
        />
      </div>
      <div class="field-group">
        <label class="field-label">Reason (optional)</label>
        <InputText
          v-model="store.alterationForm.value.reason"
          placeholder="e.g., Overtime, Emergency break"
          fluid
        />
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeAlterationModal()" />
      <Button
        label="Add Alteration"
        icon="pi pi-plus"
        :loading="store.alterationSaving.value"
        @click="store.confirmAlteration()"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, Select, InputNumber, InputText } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
const typeOptions = [
  { label: 'Add Overtime', value: 'Add' },
  { label: 'Add Break / Reduce', value: 'Reduce' },
]
</script>

<style scoped>
.info-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13px; margin-bottom: 16px; }
.info-label { color: var(--text-color-secondary); }
.info-val { font-weight: 500; }
.fields { display: flex; flex-direction: column; gap: 12px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
</style>
