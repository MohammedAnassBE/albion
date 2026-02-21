<template>
  <Dialog
    v-model:visible="store.showShiftByDaysModal.value"
    modal
    header="Shift Group by Days"
    :style="{ width: '620px', maxWidth: '95vw' }"
    @hide="store.closeShiftByDaysModal()"
  >
    <template v-if="store.selectedGroup.value">
      <div class="group-info">
        <strong>{{ store.selectedGroup.value.item }}</strong>
        &mdash;
        {{ store.fmtDate(store.selectedGroup.value.start_date) }} to {{ store.fmtDate(store.selectedGroup.value.end_date) }}
        ({{ store.selectedGroup.value.allocs?.length }} days)
      </div>
      <div class="field-group">
        <label class="field-label">Days to shift</label>
        <InputNumber
          v-model="store.shiftByDaysCount.value"
          showButtons
          fluid
          @update:modelValue="store.computeShiftByDaysPreview()"
        />
        <small class="hint">Positive = forward · Negative = backward</small>
      </div>

      <template v-if="store.shiftByDaysCount.value !== 0 && store.shiftByDaysPreview.value">
        <div v-if="store.shiftByDaysPreview.value.error" class="error-msg">
          <i class="pi pi-exclamation-triangle" /> {{ store.shiftByDaysPreview.value.error }}
        </div>
        <template v-else>
          <div class="preview-summary">
            <p>Group moves from <strong>{{ store.fmtDate(store.selectedGroup.value.start_date) }}</strong>
               → <strong>{{ store.fmtDate(store.shiftByDaysPreview.value.newStart) }}</strong></p>
            <p v-if="store.shiftByDaysPreview.value.affectedGroups?.length > 0">
              <strong>{{ store.shiftByDaysPreview.value.affectedGroups.length }}</strong> subsequent group(s) will cascade forward.
            </p>
            <p v-else>No conflicts — group can shift directly.</p>
          </div>
          <div v-if="store.shiftByDaysPreview.value.affectedGroups?.length > 0" class="table-wrap">
            <table class="shift-table">
              <thead>
                <tr><th>Item</th><th>Order</th><th>Days</th><th>Current Range</th><th></th><th>New Range</th><th>Shift</th></tr>
              </thead>
              <tbody>
                <tr v-for="(grp, i) in store.shiftByDaysPreview.value.affectedGroups" :key="i">
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
        </template>
      </template>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeShiftByDaysModal()" />
      <Button
        v-if="store.shiftByDaysPreview.value && !store.shiftByDaysPreview.value.error"
        :label="store.shiftByDaysPreview.value?.affectedGroups?.length > 0 ? 'Shift & Move' : 'Shift Group'"
        icon="pi pi-check"
        :disabled="!!store.shiftByDaysPreview.value?.outOfBounds"
        @click="store.confirmShiftByDays()"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, InputNumber } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.group-info { font-size: 13px; margin-bottom: 14px; color: var(--text-color-secondary); }
.field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
.hint { font-size: 11px; color: var(--text-color-secondary); }
.error-msg { color: #dc2626; font-size: 13px; padding: 8px 12px; background: #fef2f2; border-radius: 6px; display: flex; align-items: center; gap: 6px; }
.preview-summary { font-size: 13px; margin-bottom: 12px; }
.preview-summary p { margin: 0 0 4px; }
.table-wrap { overflow-x: auto; max-height: 240px; overflow-y: auto; border: 1px solid var(--surface-border); border-radius: 6px; }
.shift-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.shift-table th { background: var(--surface-section); font-weight: 600; padding: 6px 10px; text-align: left; position: sticky; top: 0; }
.shift-table td { padding: 5px 10px; border-bottom: 1px solid var(--surface-border); }
</style>
