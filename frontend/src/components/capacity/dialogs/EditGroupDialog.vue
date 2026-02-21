<template>
  <Dialog
    v-model:visible="store.showEditGroupModal.value"
    modal
    header="Edit Group Quantity"
    :style="{ width: '360px' }"
    @hide="store.closeEditGroupModal()"
  >
    <template v-if="store.selectedGroup.value">
      <div class="info-grid">
        <span class="info-label">Item</span>
        <span class="info-val">{{ store.selectedGroup.value.item }}</span>
        <span class="info-label">Dates</span>
        <span class="info-val">{{ store.fmtDate(store.selectedGroup.value.start_date) }} to {{ store.fmtDate(store.selectedGroup.value.end_date) }}</span>
        <span class="info-label">Days</span>
        <span class="info-val">{{ store.selectedGroup.value.allocs?.length }}</span>
        <span class="info-label">Current Qty</span>
        <span class="info-val">{{ store.selectedGroup.value.total_quantity }}</span>
      </div>
      <div class="field-group">
        <label class="field-label">New Total Quantity</label>
        <InputNumber
          v-model="store.editGroupQuantity.value"
          :min="1"
          showButtons
          fluid
          autofocus
        />
      </div>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeEditGroupModal()" />
      <Button label="Update" icon="pi pi-check" @click="store.confirmEditGroup()" />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, InputNumber } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.info-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; font-size: 13px; margin-bottom: 16px; }
.info-label { color: var(--text-color-secondary); }
.info-val { color: var(--text-color); font-weight: 500; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
</style>
