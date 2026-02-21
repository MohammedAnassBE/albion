<template>
  <Dialog
    v-model:visible="store.showEditAlterationsModal.value"
    modal
    :header="`Manage Alterations — ${store.formatDate(store.editAlterationsContext.value.date)}${store.editAlterationsContext.value.machine_id ? ' — ' + store.editAlterationsContext.value.machine_id : ''}`"
    :style="{ width: '560px', maxWidth: '95vw' }"
    @hide="store.closeEditAlterationsModal()"
  >
    <div v-if="store.editAlterationsList.value.length === 0" class="empty-msg">
      No alterations for this {{ store.editAlterationsContext.value.machine_id ? 'cell' : 'date' }}.
    </div>
    <div v-else class="table-wrap">
      <table class="alt-table">
        <thead>
          <tr>
            <th v-if="!store.editAlterationsContext.value.machine_id">Machine</th>
            <th>Type</th>
            <th class="text-right">Minutes</th>
            <th>Reason</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in store.editAlterationsList.value" :key="row.name">
            <td v-if="!store.editAlterationsContext.value.machine_id">{{ row.machine || 'All' }}</td>
            <td>
              <Select
                v-model="store.editAlterationsList.value[idx].alteration_type"
                :options="typeOptions"
                optionLabel="label"
                optionValue="value"
                size="small"
                class="inline-select"
              />
            </td>
            <td>
              <InputNumber
                v-model="store.editAlterationsList.value[idx].minutes"
                :min="1"
                size="small"
                class="inline-input"
              />
            </td>
            <td>
              <InputText
                v-model="store.editAlterationsList.value[idx].reason"
                size="small"
                placeholder="Reason"
                class="inline-input"
              />
            </td>
            <td class="actions-cell">
              <Button
                icon="pi pi-check"
                size="small"
                severity="success"
                text
                title="Save"
                :loading="store.editAlterationsSaving.value"
                @click="store.saveAlteration(idx)"
              />
              <Button
                icon="pi pi-trash"
                size="small"
                severity="danger"
                text
                title="Delete"
                :loading="store.editAlterationsSaving.value"
                @click="store.deleteAlteration(idx)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template #footer>
      <Button label="+ Add New" icon="pi pi-plus" severity="secondary" outlined size="small" @click="store.addNewFromEditModal()" />
      <Button label="Close" severity="secondary" text @click="store.closeEditAlterationsModal()" />
    </template>
  </Dialog>
</template>

<script setup>
import { Dialog, Button, Select, InputNumber, InputText } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
const typeOptions = [
  { label: 'Overtime', value: 'Add' },
  { label: 'Break', value: 'Reduce' },
]
</script>

<style scoped>
.empty-msg { font-size: 13px; color: var(--text-color-secondary); padding: 12px 0; }
.table-wrap { overflow-x: auto; max-height: 320px; overflow-y: auto; border: 1px solid var(--surface-border); border-radius: 6px; }
.alt-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.alt-table th { background: var(--surface-section); font-weight: 600; padding: 6px 10px; text-align: left; position: sticky; top: 0; }
.alt-table td { padding: 5px 8px; border-bottom: 1px solid var(--surface-border); vertical-align: middle; }
.alt-table tbody tr:last-child td { border-bottom: none; }
.actions-cell { white-space: nowrap; }
.inline-select { width: 110px; }
.inline-input { width: 80px; }
.text-right { text-align: right; }
</style>
