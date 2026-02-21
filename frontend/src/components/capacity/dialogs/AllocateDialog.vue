<template>
  <Dialog
    v-model:visible="store.showDropModal.value"
    modal
    header="Allocate Quantity"
    :style="{ width: '400px' }"
    @hide="store.closeDropModal()"
  >
    <template v-if="store.pendingDrop.value">
      <div class="info-grid">
        <span class="info-label">Item</span>
        <span class="info-val">{{ store.pendingDrop.value.item }}</span>
        <span class="info-label">Target</span>
        <span class="info-val">{{ store.pendingDrop.value.machineId }} · {{ store.fmtDate(store.pendingDrop.value.dateStr) }}</span>
        <span class="info-label">Day capacity</span>
        <span class="info-val">{{ store.pendingDrop.value.availableCapacityQty }} units available</span>
        <span class="info-label">Remaining</span>
        <span class="info-val">{{ store.pendingDrop.value.maxQty }} units (max)</span>
      </div>
      <div v-if="store.dropQuantity.value > store.pendingDrop.value.availableCapacityQty" class="split-notice">
        <i class="pi pi-info-circle" /> Excess units will be split across subsequent days
      </div>
      <div class="field-group">
        <label class="field-label">Quantity</label>
        <InputNumber
          v-model="store.dropQuantity.value"
          :min="1"
          :max="store.pendingDrop.value.maxQty"
          showButtons
          fluid
          autofocus
          @keyup.enter="store.confirmDrop()"
        />
      </div>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeDropModal()" />
      <Button label="Allocate" icon="pi pi-check" @click="store.confirmDrop()" />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, InputNumber } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 12px;
  font-size: 13px;
  margin-bottom: 16px;
}
.info-label { color: var(--text-color-secondary); white-space: nowrap; }
.info-val { color: var(--text-color); font-weight: 500; }
.split-notice {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #1d4ed8;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
</style>
