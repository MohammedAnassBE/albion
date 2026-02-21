<template>
  <Dialog
    v-model:visible="store.showBackfillModal.value"
    modal
    header="Fill Gap After Deletion"
    :style="{ width: '620px', maxWidth: '95vw' }"
    :closable="false"
  >
    <template v-if="store.backfillModalData.value">
      <p class="explanation">
        <strong>{{ store.backfillModalData.value.affectedAllocations.length }}</strong> subsequent allocation(s) on
        <strong>{{ store.backfillModalData.value.machineId }}</strong> can be shifted backward to fill the gap.
      </p>
      <div class="table-wrap">
        <table class="shift-table">
          <thead>
            <tr>
              <th>Order</th><th>Item</th><th>Process</th><th>Qty</th><th>Current</th><th></th><th>New Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in store.backfillModalData.value.affectedAllocations" :key="i">
              <td>{{ entry.allocation.order }}</td>
              <td>{{ entry.allocation.item }}</td>
              <td>{{ entry.allocation.process }}</td>
              <td>{{ entry.allocation.quantity }}</td>
              <td>{{ store.fmtDate(entry.currentDate) }}</td>
              <td>←</td>
              <td>{{ store.fmtDate(entry.newDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template #footer>
      <Button label="Cancel Delete" severity="secondary" text @click="store.cancelDeleteGroup()" />
      <Button label="Just Delete" severity="secondary" outlined @click="store.declineBackfill()" />
      <Button label="Shift Backward" icon="pi pi-arrow-left" @click="store.confirmBackfill()" />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.explanation { font-size: 13px; margin-bottom: 14px; }
.table-wrap { overflow-x: auto; max-height: 280px; overflow-y: auto; border: 1px solid var(--surface-border); border-radius: 6px; }
.shift-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.shift-table th { background: var(--surface-section); font-weight: 600; padding: 6px 10px; text-align: left; position: sticky; top: 0; }
.shift-table td { padding: 5px 10px; border-bottom: 1px solid var(--surface-border); }
.shift-table tbody tr:last-child td { border-bottom: none; }
</style>
