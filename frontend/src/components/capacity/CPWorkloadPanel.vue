<template>
  <div
    class="cp-workload"
    :class="{ 'panel-collapsed': store.workloadCollapsed.value }"
    @dragover="store.onWorkloadDragOver($event)"
    @drop="store.onWorkloadDrop($event)"
  >
    <div class="panel-header" @click="store.workloadCollapsed.value = !store.workloadCollapsed.value">
      <div class="panel-header-row">
        <span class="panel-title">Workload</span>
        <button class="panel-toggle">
          <i :class="store.workloadCollapsed.value ? 'pi pi-chevron-right' : 'pi pi-chevron-left'" />
        </button>
      </div>
      <span v-if="!store.workloadCollapsed.value" class="panel-subtitle">Drag items to calendar</span>
    </div>

    <div v-show="!store.workloadCollapsed.value" class="workload-list">
      <div v-if="store.workloadItems.value.length === 0" class="empty-workload">
        <i class="pi pi-list" />
        <p>Select order and process to view workload</p>
      </div>

      <div
        v-for="item in store.workloadItems.value"
        :key="item.key"
        class="workload-item"
        :class="{
          'status-full': store.getAllocationStatus(item) === 'full',
          'status-partial': store.getAllocationStatus(item) === 'partial',
          'status-pending': store.getAllocationStatus(item) === 'pending',
          'invalid-item': !store.isValidForProcess(item)
        }"
        :draggable="store.isValidForProcess(item) && store.getAllocationStatus(item) !== 'full'"
        @dragstart="store.onDragStart($event, item)"
        @dragend="store.onDragEnd()"
      >
        <div class="item-row">
          <span v-if="store.isValidForProcess(item) && store.getAllocationStatus(item) !== 'full'" class="drag-handle">⋮⋮</span>
          <span class="item-name">{{ item.item }}</span>
          <span class="item-qty">{{ item.quantity }}</span>
        </div>
        <div v-if="item.machine_gg" class="item-gg">{{ item.machine_gg }}</div>
        <div v-if="item.colour" class="item-detail">Colour: {{ item.colour }}</div>
        <div v-if="item.size" class="item-detail">Size: {{ item.size }}</div>
        <div class="item-mins">{{ item.minutes }}m/unit</div>
        <div v-if="!store.isValidForProcess(item)" class="invalid-msg">No process time defined</div>
        <div v-else-if="store.getAllocatedQuantity(item) > 0" class="alloc-status" :class="store.getAllocationStatus(item)">
          Allocated: {{ store.getAllocatedQuantity(item) }} / {{ item.quantity }}
        </div>
        <div v-if="store.getAllocatedQuantity(item) > 0" class="progress-bar">
          <div
            class="progress-fill"
            :class="store.getAllocationStatus(item)"
            :style="{ width: Math.min(100, (store.getAllocatedQuantity(item) / item.quantity) * 100) + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- Deleted blocks -->
    <div v-show="!store.workloadCollapsed.value && store.deletedBlocks.value.length > 0" class="deleted-section">
      <div class="deleted-header">
        <span class="deleted-title">Recently Deleted</span>
        <button class="clear-btn" @click="store.clearDeletedBlocks()" title="Clear all">✕</button>
      </div>
      <div class="deleted-list">
        <div
          v-for="block in store.deletedBlocks.value"
          :key="block.id"
          class="deleted-item"
          draggable="true"
          @dragstart="store.onDeletedBlockDragStart($event, block)"
          @dragend="store.onDragEnd()"
        >
          <div class="item-row">
            <span class="drag-handle">⋮⋮</span>
            <span class="item-name">{{ block.item }}</span>
            <span class="item-qty">{{ block.total_quantity }}</span>
          </div>
          <div v-if="block.colour" class="item-detail">Colour: {{ block.colour }}</div>
          <div v-if="block.size" class="item-detail">Size: {{ block.size }}</div>
          <div class="item-mins">{{ block.days }}d · {{ block.minutes_per_unit }}m/unit</div>
          <button class="dismiss-btn" @click="store.removeDeletedBlock(block.id)">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useCapacityStore } from '@/composables/useCapacityPlanning'
const store = useCapacityStore()
</script>

<style scoped>
.cp-workload {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  overflow: hidden;
  transition: width 0.2s ease;
}
.cp-workload.panel-collapsed {
  width: 36px;
}
.panel-header {
  padding: 10px 12px 6px;
  cursor: pointer;
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.panel-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-color);
}
.panel-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  padding: 2px;
}
.panel-subtitle {
  font-size: 11px;
  color: var(--text-color-secondary);
  display: block;
  margin-top: 2px;
}
.workload-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.empty-workload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 8px;
  color: var(--text-color-secondary);
  text-align: center;
  font-size: 12px;
}
.empty-workload i {
  font-size: 24px;
  opacity: 0.4;
}
.workload-item {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  position: relative;
  cursor: grab;
  transition: box-shadow 0.15s;
}
.workload-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.workload-item.status-full {
  opacity: 0.5;
  cursor: default;
  border-color: #86efac;
  background: #f0fdf4;
}
.workload-item.status-partial {
  border-color: #fbbf24;
}
.workload-item.invalid-item {
  opacity: 0.6;
  cursor: not-allowed;
  background: #fff7ed;
  border-color: #fdba74;
}
.item-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.drag-handle {
  color: var(--text-color-secondary);
  letter-spacing: -2px;
  font-size: 14px;
}
.item-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-color);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-qty {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary-color);
}
.item-gg {
  font-size: 10px;
  color: #7c3aed;
  font-weight: 600;
  margin-top: 2px;
}
.item-detail {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}
.item-mins {
  font-size: 10px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}
.invalid-msg {
  font-size: 10px;
  color: #ef4444;
  margin-top: 3px;
  font-style: italic;
}
.alloc-status {
  font-size: 10px;
  margin-top: 3px;
  font-weight: 600;
}
.alloc-status.full { color: #16a34a; }
.alloc-status.partial { color: #d97706; }
.alloc-status.pending { color: var(--text-color-secondary); }
.progress-bar {
  height: 3px;
  background: var(--surface-border);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}
.progress-fill.full { background: #16a34a; }
.progress-fill.partial { background: #d97706; }
.progress-fill.pending { background: var(--primary-color); }

.deleted-section {
  border-top: 1px solid var(--surface-border);
  background: #fef9f0;
  flex-shrink: 0;
  max-height: 200px;
  overflow-y: auto;
}
.deleted-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #fed7aa;
}
.deleted-title {
  font-size: 11px;
  font-weight: 700;
  color: #92400e;
}
.clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #92400e;
  font-size: 12px;
  padding: 0 2px;
}
.deleted-list {
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.deleted-item {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 5px;
  padding: 6px 8px;
  font-size: 12px;
  position: relative;
  cursor: grab;
}
.dismiss-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: #92400e;
  font-size: 10px;
  padding: 0;
  opacity: 0.6;
}
.dismiss-btn:hover { opacity: 1; }
</style>
