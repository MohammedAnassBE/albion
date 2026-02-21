<template>
  <div class="capacity-page" @click="store.closeContextMenu()">
    <CPToolbar />
    <div v-if="store.validationErrors.value.length > 0" class="validation-alerts">
      <div v-for="(err, i) in store.validationErrors.value" :key="i" class="val-alert">
        <i class="pi pi-exclamation-triangle" /> {{ err }}
      </div>
    </div>
    <div class="cp-body">
      <CPWorkloadPanel v-show="!store.isZoomedOut.value" />
      <CPGanttGrid />
    </div>

    <!-- Dialogs -->
    <AllocateDialog />
    <ShiftConfirmDialog />
    <BackfillDialog />
    <EditGroupDialog />
    <SplitGroupDialog />
    <ShiftByDaysDialog />
    <ActionChoiceDialog />
    <ShiftUpdateDialog />
    <AlterationDialog />
    <EditAlterationsDialog />
    <BulkShiftDialog />

    <!-- Context Menu -->
    <CPContextMenu />

    <!-- Tooltip -->
    <CPTooltip />
  </div>
</template>

<script setup>
import { onMounted, provide } from 'vue'
import { createCapacityStore, CAPACITY_KEY } from '@/composables/useCapacityPlanning'
import CPToolbar from '@/components/capacity/CPToolbar.vue'
import CPWorkloadPanel from '@/components/capacity/CPWorkloadPanel.vue'
import CPGanttGrid from '@/components/capacity/CPGanttGrid.vue'
import CPContextMenu from '@/components/capacity/CPContextMenu.vue'
import CPTooltip from '@/components/capacity/CPTooltip.vue'
import AllocateDialog from '@/components/capacity/dialogs/AllocateDialog.vue'
import ShiftConfirmDialog from '@/components/capacity/dialogs/ShiftConfirmDialog.vue'
import BackfillDialog from '@/components/capacity/dialogs/BackfillDialog.vue'
import EditGroupDialog from '@/components/capacity/dialogs/EditGroupDialog.vue'
import SplitGroupDialog from '@/components/capacity/dialogs/SplitGroupDialog.vue'
import ShiftByDaysDialog from '@/components/capacity/dialogs/ShiftByDaysDialog.vue'
import ActionChoiceDialog from '@/components/capacity/dialogs/ActionChoiceDialog.vue'
import ShiftUpdateDialog from '@/components/capacity/dialogs/ShiftUpdateDialog.vue'
import AlterationDialog from '@/components/capacity/dialogs/AlterationDialog.vue'
import EditAlterationsDialog from '@/components/capacity/dialogs/EditAlterationsDialog.vue'
import BulkShiftDialog from '@/components/capacity/dialogs/BulkShiftDialog.vue'

const store = createCapacityStore()
provide(CAPACITY_KEY, store)

onMounted(async () => {
  await store.loadInitialData()
})
</script>

<style scoped>
.capacity-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--surface-ground);
}
.cp-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.validation-alerts {
  padding: 6px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.val-alert {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
