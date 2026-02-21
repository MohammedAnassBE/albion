<template>
  <Dialog
    v-model:visible="store.showShiftModal.value"
    modal
    :header="store.shiftModalData.value?.type === 'move_group' ? 'Cascade Shift Groups' : 'Shift Allocations Forward'"
    :style="{ width: '680px', maxWidth: '95vw' }"
    @hide="store.closeShiftModal()"
  >
    <template v-if="store.shiftModalData.value">
      <div class="explanation">
        <template v-if="store.shiftModalData.value.type === 'move_group' && store.shiftModalData.value.affectedGroups">
          <p>Moving group to <strong>{{ store.shiftModalData.value.targetMachineId }}</strong> will cascade
            <strong>{{ store.shiftModalData.value.affectedGroups.length }}</strong> subsequent group(s) forward.</p>
        </template>
        <template v-else-if="store.shiftModalData.value.type === 'move_group'">
          <p>Moving group to <strong>{{ store.shiftModalData.value.targetMachineId }}</strong> conflicts with
            <strong>{{ store.shiftModalData.value.affectedAllocations.length }}</strong> existing allocation(s).</p>
          <p>These will be shifted forward to make room.</p>
        </template>
        <template v-else>
          <p>The new workload needs <strong>{{ store.shiftModalData.value.newWorkloadPlan?.length }}</strong> day(s) on
            <strong>{{ store.shiftModalData.value.pendingDropData?.machineId }}</strong>.</p>
          <p><strong>{{ store.shiftModalData.value.affectedAllocations.length }}</strong> existing allocation(s) will be shifted forward.</p>
        </template>
      </div>

      <!-- Group-level table -->
      <div v-if="store.shiftModalData.value.affectedGroups?.length > 0" class="table-wrap">
        <table class="shift-table">
          <thead>
            <tr>
              <th>Item</th><th>Order</th><th>Days</th><th>Current Range</th><th></th><th>New Range</th><th>Shift</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(grp, i) in store.shiftModalData.value.affectedGroups" :key="i">
              <td>{{ grp.item }}</td>
              <td>{{ grp.order }}</td>
              <td>{{ grp.dayCount }}</td>
              <td>{{ store.fmtDate(grp.oldStart) }} to {{ store.fmtDate(grp.oldEnd) }}</td>
              <td>→</td>
              <td>{{ grp.newStart && grp.newEnd ? `${store.fmtDate(grp.newStart)} to ${store.fmtDate(grp.newEnd)}` : 'Out of range' }}</td>
              <td>+{{ grp.pushDays }}d</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Allocation-level table -->
      <div v-else class="table-wrap">
        <table class="shift-table">
          <thead>
            <tr>
              <th>Order</th><th>Item</th><th>Process</th><th>Qty</th><th>Current</th><th></th><th>New Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in store.shiftModalData.value.affectedAllocations" :key="i">
              <td>{{ entry.allocation.order }}</td>
              <td>{{ entry.allocation.item }}</td>
              <td>{{ entry.allocation.process }}</td>
              <td>{{ entry.allocation.quantity }}</td>
              <td>{{ store.fmtDate(entry.currentDate) }}</td>
              <td>→</td>
              <td>{{ store.fmtDate(entry.newDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeShiftModal()" />
      <Button
        :label="store.shiftModalData.value?.type === 'move_group' ? 'Shift & Move' : 'Shift & Allocate'"
        icon="pi pi-check"
        @click="store.confirmShift()"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.explanation { margin-bottom: 14px; font-size: 13px; }
.explanation p { margin: 0 0 6px; }
.table-wrap { overflow-x: auto; max-height: 300px; overflow-y: auto; border: 1px solid var(--surface-border); border-radius: 6px; }
.shift-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.shift-table th { background: var(--surface-section); font-weight: 600; padding: 6px 10px; text-align: left; position: sticky; top: 0; }
.shift-table td { padding: 5px 10px; border-bottom: 1px solid var(--surface-border); }
.shift-table tbody tr:last-child td { border-bottom: none; }
</style>
