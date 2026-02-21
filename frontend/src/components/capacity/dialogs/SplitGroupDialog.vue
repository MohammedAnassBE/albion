<template>
  <Dialog
    v-model:visible="store.showSplitGroupModal.value"
    modal
    header="Split Group at Date"
    :style="{ width: '360px' }"
    @hide="store.closeSplitGroupModal()"
  >
    <template v-if="store.selectedGroup.value">
      <div class="info">
        <span class="info-label">Item: </span>
        <strong>{{ store.selectedGroup.value.item }}</strong>
        ({{ store.selectedGroup.value.allocs?.length }} days)
      </div>
      <div class="field-group">
        <label class="field-label">Split before date</label>
        <Select
          v-model="store.splitGroupDate.value"
          :options="splitOptions"
          optionLabel="label"
          optionValue="value"
          fluid
        />
      </div>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="store.closeSplitGroupModal()" />
      <Button label="Split" icon="pi pi-scissors" @click="store.confirmSplitGroup()" />
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Dialog, Button, Select } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'

const store = useCapacityStore()

const splitOptions = computed(() => {
  const group = store.selectedGroup.value
  if (!group?.allocs?.length) return []
  return group.allocs.slice(1).map(a => ({
    label: store.fmtDate(a.operation_date),
    value: a.operation_date
  }))
})
</script>

<style scoped>
.info { font-size: 13px; margin-bottom: 14px; }
.info-label { color: var(--text-color-secondary); }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
</style>
