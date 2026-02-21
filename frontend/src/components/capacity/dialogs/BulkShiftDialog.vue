<template>
  <Dialog
    v-model:visible="store.showBulkShiftModal.value"
    modal
    header="Update Shifts"
    :style="{ width: '700px', maxWidth: '95vw' }"
    @hide="store.closeBulkShiftModal()"
  >
    <div class="field-group">
      <label class="field-label">Date</label>
      <DatePicker
        v-model="bulkShiftDateObj"
        dateFormat="yy-mm-dd"
        showIcon
        fluid
        @date-select="onDateChange"
      />
    </div>
    <div v-if="store.bulkShiftMachines.value.length > 0" class="table-wrap">
      <table class="bulk-table">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Shift</th>
            <th class="text-right">Total Min</th>
            <th class="text-right">Allocated</th>
            <th>Type</th>
            <th class="text-right">Minutes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in store.bulkShiftMachines.value" :key="row.machine_id">
            <td>{{ row.machine_name }}</td>
            <td>{{ row.shift_name }}</td>
            <td class="text-right">{{ row.total_minutes }}</td>
            <td class="text-right">{{ row.allocated_minutes }}</td>
            <td>
              <Select
                v-model="store.bulkShiftMachines.value[idx].alteration_type"
                :options="typeOptions"
                optionLabel="label"
                optionValue="value"
                size="small"
                class="inline-select"
              />
            </td>
            <td>
              <InputNumber
                v-model="store.bulkShiftMachines.value[idx].update_minutes"
                :min="0"
                size="small"
                class="inline-input"
              />
            </td>
            <td>
              <Button
                icon="pi pi-times"
                size="small"
                severity="danger"
                text
                @click="store.bulkShiftMachines.value.splice(idx, 1)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="store.bulkShiftDate.value" class="empty-msg">
      No machines loaded for this date.
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeBulkShiftModal()" />
      <Button
        label="Apply"
        icon="pi pi-check"
        :loading="store.bulkShiftSaving.value"
        :disabled="!store.bulkShiftMachines.value.some(r => r.update_minutes > 0)"
        @click="store.applyBulkShiftUpdates()"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Dialog, Button, Select, InputNumber, DatePicker } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'

const store = useCapacityStore()
const typeOptions = [
  { label: 'Overtime', value: 'Add' },
  { label: 'Break', value: 'Reduce' },
]

const bulkShiftDateObj = ref(null)

watch(() => store.showBulkShiftModal.value, (visible) => {
  if (visible) bulkShiftDateObj.value = null
})

function onDateChange(val) {
  if (!val) return
  const d = val instanceof Date ? val : new Date(val)
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  store.bulkShiftDate.value = dateStr
  store.loadBulkShiftMachines(dateStr)
}
</script>

<style scoped>
.field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
.table-wrap { overflow-x: auto; max-height: 320px; overflow-y: auto; border: 1px solid var(--surface-border); border-radius: 6px; }
.bulk-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bulk-table th { background: var(--surface-section); font-weight: 600; padding: 6px 10px; text-align: left; position: sticky; top: 0; }
.bulk-table td { padding: 5px 8px; border-bottom: 1px solid var(--surface-border); vertical-align: middle; }
.bulk-table tbody tr:last-child td { border-bottom: none; }
.text-right { text-align: right; }
.inline-select { width: 110px; }
.inline-input { width: 80px; }
.empty-msg { font-size: 13px; color: var(--text-color-secondary); padding: 12px 0; }
</style>
