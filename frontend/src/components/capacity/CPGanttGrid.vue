<template>
  <div class="cp-gantt">
    <div class="calendar-wrapper" ref="wrapperRef" @scroll="store.onCalendarScroll()">
      <div
        class="gantt-grid"
        :class="{ 'gantt-zoom': store.isZoomedOut.value }"
        :style="store.ganttGridStyle.value"
        @dragover="store.onWrapperDragOver($event)"
      >
        <!-- Corner + date headers -->
        <div class="gantt-corner">Machine</div>
        <div
          v-for="(date, dIdx) in store.dateRange.value"
          :key="'hdr-' + date"
          class="date-header"
          :class="store.getDateHeaderClass(date)"
          :style="{ gridRow: 1, gridColumn: dIdx + 2 }"
          @click="!store.isZoomedOut.value && store.openActionChoice(date, null)"
        >
          <div class="date-cell-inner">
            <span class="date-label">
              {{ store.isZoomedOut.value ? store.formatDate(date) : store.formatDayName(date) + ', ' + store.formatDate(date) }}
            </span>
            <span v-if="!store.isZoomedOut.value" class="shift-info">
              {{ store.getShiftNamesForDate(date) }} · {{ store.getEffectiveMinutes(date) }}m
              <span
                v-if="store.getDayAlterationDelta(date)"
                class="day-alt-badge clickable"
                :class="store.getDayAlterationDelta(date).cls"
                @click.stop="store.openEditAlterationsModal(date, null)"
              >{{ store.getDayAlterationDelta(date).label }}</span>
            </span>
          </div>
        </div>

        <!-- Machine rows -->
        <template v-for="(machine, mIdx) in store.filteredMachines.value" :key="machine.machine_id">
          <!-- Machine label -->
          <div
            class="machine-cell"
            :class="{
              'machine-disabled': !store.isMachineCompatible(machine.machine_id),
              'machine-zoom': store.isZoomedOut.value
            }"
            :style="{ gridRow: mIdx + 2 }"
            :title="store.isZoomedOut.value ? `${machine.machine_id} — ${machine.machine_name} (${machine.machine_gg})` : ''"
          >
            <template v-if="store.isZoomedOut.value">
              <span class="machine-id-zoom">{{ machine.machine_id }}</span>
            </template>
            <template v-else>
              <div class="machine-info">
                <div class="machine-top">
                  <span class="machine-id">{{ machine.machine_id }}</span>
                  <span class="machine-gg-badge">{{ machine.machine_gg }}</span>
                </div>
                <span class="machine-name">{{ machine.machine_name }}</span>
              </div>
            </template>
          </div>

          <!-- Date cells -->
          <div
            v-for="(date, dIdx) in store.dateRange.value"
            :key="machine.machine_id + '-' + date"
            class="date-cell"
            :class="[store.getCellClass(date, machine.machine_id), { 'machine-disabled': !store.isMachineCompatible(machine.machine_id) }]"
            :style="{ gridRow: mIdx + 2, gridColumn: dIdx + 2 }"
            @dragover="!store.isZoomedOut.value && store.onCellDragOver($event, machine.machine_id)"
            @drop="!store.isZoomedOut.value && store.onDrop($event, machine.machine_id, date)"
            @click.self="!store.isZoomedOut.value && store.openActionChoice(date, machine.machine_id)"
          >
            <template v-if="!store.isZoomedOut.value">
              <span
                v-if="store.hasMachineSpecificShift(date, machine.machine_id)"
                class="machine-shift-badge clickable"
                @click.stop="store.openActionChoice(date, machine.machine_id)"
              >{{ store.getShiftNamesForDate(date, machine.machine_id) }}</span>
              <span
                v-if="store.getCellAlterationBadge(date, machine.machine_id)"
                class="alt-badge clickable"
                :class="store.getCellAlterationBadge(date, machine.machine_id).cls"
                @click.stop="store.openEditAlterationsModal(date, machine.machine_id)"
              >{{ store.getCellAlterationBadge(date, machine.machine_id).label }}</span>
              <div class="cell-top-row">
                <button
                  class="cell-add-btn"
                  @click.stop="store.openActionChoice(date, machine.machine_id)"
                  title="Update shift or time"
                >+</button>
              </div>
              <div
                v-if="store.getUsedMinutes(date, machine.machine_id) > 0"
                class="util-bar-wrap"
                :title="`${store.getUsedMinutes(date, machine.machine_id)}m / ${store.getEffectiveMinutes(date, machine.machine_id)}m`"
              >
                <div class="util-bar" :class="store.getCapacityBarClass(date, machine.machine_id)">
                  <div
                    class="util-fill"
                    :style="{ width: Math.min(store.getCapacityPercentage(date, machine.machine_id), 100) + '%' }"
                    :class="store.getCapacityBarClass(date, machine.machine_id)"
                  />
                  <span class="util-label">
                    {{ store.getUsedMinutes(date, machine.machine_id) }}m/{{ store.getEffectiveMinutes(date, machine.machine_id) }}m
                  </span>
                </div>
              </div>
            </template>
          </div>

          <!-- Bar overlay layer -->
          <div
            class="bar-layer"
            :class="{ 'machine-disabled': !store.isMachineCompatible(machine.machine_id) }"
            :style="{
              gridRow: mIdx + 2,
              gridColumn: `2 / ${store.dateRange.value.length + 2}`,
              minHeight: store.getBarLayerHeight(machine.machine_id) + 'px'
            }"
          >
            <div
              v-for="group in store.getGroupsForMachine(machine.machine_id)"
              :key="group.group_id"
              class="gantt-bar"
              :class="{
                'snap-in': store.isJustDropped(group),
                'bar-zoom': store.isZoomedOut.value,
                'bar-selected': store.selectedGroup.value && store.selectedGroup.value.group_id === group.group_id
              }"
              :style="store.getBarStyle(group)"
              :draggable="!store.isZoomedOut.value"
              @dragstart="!store.isZoomedOut.value && store.onGroupDragStart($event, group)"
              @dragend="!store.isZoomedOut.value && store.onDragEnd()"
              @dragover="!store.isZoomedOut.value && store.onCellDragOver($event, machine.machine_id)"
              @drop="!store.isZoomedOut.value && store.onBarDrop($event, machine.machine_id)"
              @contextmenu.prevent="!store.isZoomedOut.value && store.onBarContextMenu($event, group)"
              @click.stop="!store.isZoomedOut.value && store.selectGroup(group)"
              @mouseenter="store.showTooltip($event, group)"
              @mouseleave="store.hideTooltip()"
              @animationend="store.onSnapAnimationEnd(group)"
            >
              <template v-if="store.isZoomedOut.value">
                <div class="bar-zoom-row">
                  <span v-if="group.order" class="bar-tag">O: {{ group.order }}</span>
                  <span class="bar-name">{{ group.item }}</span>
                  <span class="bar-qty">{{ group.total_quantity }}</span>
                </div>
              </template>
              <template v-else>
                <div class="bar-top">
                  <span class="bar-name">{{ group.item }}</span>
                  <span class="bar-qty">{{ group.total_quantity }}</span>
                </div>
                <div class="bar-mid">
                  <span class="bar-process">{{ group.process }}</span>
                  <span class="bar-mins">{{ group.total_minutes }}m</span>
                </div>
                <div class="bar-bot">
                  <span v-if="group.order" class="bar-tag order-tag">O: {{ group.order }}</span>
                  <span v-if="group.colour" class="bar-tag colour-tag">C: {{ group.colour }}</span>
                  <span v-if="group.size" class="bar-tag size-tag">S: {{ group.size }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'

const store = useCapacityStore()
const wrapperRef = ref(null)

onMounted(() => {
  if (wrapperRef.value) {
    store.setCalendarWrapper(wrapperRef.value)
  }
})
onUnmounted(() => {
  store.setCalendarWrapper(null)
})
</script>

<style scoped>
.cp-gantt {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.calendar-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
}
.gantt-grid {
  display: grid;
  border-collapse: collapse;
  min-height: 100%;
}
.gantt-corner {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 30;
  background: var(--surface-card);
  border-right: 2px solid var(--surface-border);
  border-bottom: 2px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  grid-row: 1;
  grid-column: 1;
}
.date-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  border-bottom: 2px solid var(--surface-border);
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.15s;
  grid-row: 1;
  min-width: 0;
}
.date-header:hover {
  background: var(--surface-hover);
}
.date-header.today-date {
  background: #eff6ff;
  border-bottom: 2px solid var(--primary-color);
}
.date-header.past-date {
  background: var(--surface-ground);
}
.date-header.weekly-off {
  background: #fef9c3;
}
.date-cell-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.date-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
}
.shift-info {
  font-size: 10px;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.day-alt-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
}
.day-alt-badge.badge-add { background: #dcfce7; color: #16a34a; }
.day-alt-badge.badge-reduce { background: #fef2f2; color: #dc2626; }

.machine-cell {
  position: sticky;
  left: 0;
  z-index: 10;
  background: var(--surface-card);
  border-right: 2px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  padding: 8px 10px;
  display: flex;
  align-items: center;
}
.machine-cell.machine-disabled {
  opacity: 0.4;
}
.machine-info { display: flex; flex-direction: column; gap: 2px; }
.machine-top { display: flex; align-items: center; gap: 6px; }
.machine-id { font-weight: 700; font-size: 13px; color: var(--text-color); }
.machine-gg-badge {
  font-size: 10px;
  background: #ede9fe;
  color: #7c3aed;
  padding: 1px 5px;
  border-radius: 10px;
  font-weight: 600;
}
.machine-name { font-size: 11px; color: var(--text-color-secondary); }
.machine-id-zoom { font-weight: 700; font-size: 11px; color: var(--text-color); }

.date-cell {
  border-right: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  position: relative;
  min-height: 52px;
  transition: background 0.1s;
  overflow: visible;
}
.date-cell.machine-disabled {
  opacity: 0.4;
  pointer-events: none;
}
.date-cell.cell-available { background: var(--surface-ground); }
.date-cell.cell-allocated { background: #f0fdf4; }
.date-cell.cell-full { background: #dcfce7; }
.date-cell.cell-conflict { background: #fef2f2; }
.date-cell.cell-today { outline: 2px solid var(--primary-color); outline-offset: -2px; }
.date-cell.cell-past { opacity: 0.7; }
.date-cell.cell-altered-add { box-shadow: inset 0 -3px 0 #16a34a; }
.date-cell.cell-altered-reduce { box-shadow: inset 0 -3px 0 #dc2626; }
.date-cell:hover {
  background: var(--surface-hover);
}

.machine-shift-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 9px;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
}
.alt-badge {
  position: absolute;
  top: 2px;
  right: 20px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
}
.alt-badge.badge-add { background: #dcfce7; color: #16a34a; }
.alt-badge.badge-reduce { background: #fef2f2; color: #dc2626; }
.cell-top-row {
  position: absolute;
  top: 2px;
  right: 2px;
}
.cell-add-btn {
  background: none;
  border: 1px solid var(--surface-border);
  border-radius: 3px;
  width: 16px;
  height: 16px;
  font-size: 11px;
  cursor: pointer;
  line-height: 1;
  color: var(--text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.date-cell:hover .cell-add-btn { opacity: 1; }
.util-bar-wrap {
  position: absolute;
  bottom: 2px;
  left: 4px;
  right: 4px;
}
.util-bar {
  border-radius: 3px;
  height: 16px;
  background: var(--surface-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}
.util-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.util-bar.bar-ok      { background: #dcfce7; }
.util-bar.bar-warning { background: #fef9c3; }
.util-bar.bar-low     { background: #fee2e2; }
.util-fill.bar-ok      { background: #86efac; }
.util-fill.bar-warning { background: #fde68a; }
.util-fill.bar-low     { background: #fca5a5; }
.util-label {
  font-size: 9px;
  position: relative;
  z-index: 1;
  padding: 0 4px;
  color: var(--text-color);
  white-space: nowrap;
}

.bar-layer {
  position: relative;
  pointer-events: none;
  grid-column: 2 / -1;
  overflow: visible;
}
.bar-layer.machine-disabled { opacity: 0.3; }

.gantt-bar {
  position: absolute;
  border-radius: 4px;
  cursor: grab;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3px 6px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  transition: box-shadow 0.15s, opacity 0.15s;
}
.gantt-bar:hover {
  box-shadow: 0 3px 10px rgba(0,0,0,0.2);
  z-index: 10;
}
.gantt-bar.bar-selected {
  box-shadow: 0 0 0 2px var(--primary-color);
  z-index: 5;
}
.gantt-bar.snap-in {
  animation: snapIn 0.3s ease-out;
}
@keyframes snapIn {
  from { transform: scale(0.85); opacity: 0.5; }
  to { transform: scale(1); opacity: 1; }
}
.bar-top, .bar-mid, .bar-bot, .bar-zoom-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 0;
}
.bar-name {
  font-weight: 700;
  font-size: 11px;
  color: inherit;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-qty {
  font-weight: 700;
  font-size: 11px;
}
.bar-process {
  font-size: 10px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.bar-mins {
  font-size: 10px;
  opacity: 0.8;
}
.bar-tag {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 2px;
}
.bar-tag.order-tag  { background: #dbeafe; color: #1e40af; }
.bar-tag.colour-tag { background: #ffedd5; color: #c2410c; }
.bar-tag.size-tag   { background: #f4f4f5; color: #3f3f46; }
.date-cell.cell-offday { background: #fffbeb; }
.clickable { cursor: pointer; }
</style>
