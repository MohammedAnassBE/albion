<template>
  <Teleport to="body">
    <div
      v-if="store.contextMenu.value.show"
      class="context-menu"
      :style="{ top: store.contextMenu.value.y + 'px', left: store.contextMenu.value.x + 'px' }"
    >
      <template v-if="store.selectedGroup.value">
        <div class="menu-item" @click="openShiftByDays">Shift Group by Days</div>
        <div class="menu-item" @click="openEditGroup">Edit Quantity</div>
        <div class="menu-item" @click="openSplit" v-if="store.selectedGroup.value?.allocs?.length > 1">Split Group</div>
        <div class="menu-divider" />
        <div class="menu-item danger" @click="deleteGroup">Delete Group</div>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { useCapacityStore } from '@/composables/useCapacityPlanning'

const store = useCapacityStore()

function openShiftByDays() {
  store.openShiftGroupByDaysModal()
  store.closeContextMenu()
}

function openEditGroup() {
  store.editGroupQuantity.value = store.selectedGroup.value?.total_quantity || 0
  store.showEditGroupModal.value = true
  store.closeContextMenu()
}

function openSplit() {
  const group = store.selectedGroup.value
  if (group?.allocs?.length > 1) {
    store.splitGroupDate.value = group.allocs[1].operation_date
  }
  store.showSplitGroupModal.value = true
  store.closeContextMenu()
}

function deleteGroup() {
  store.deleteGroup()
  store.closeContextMenu()
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--surface-overlay);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 1000;
  min-width: 160px;
  padding: 4px 0;
  overflow: hidden;
}
.menu-item {
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-color);
  transition: background 0.1s;
}
.menu-item:hover {
  background: var(--surface-hover);
}
.menu-item.danger {
  color: #dc2626;
}
.menu-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 4px 0;
}
</style>
