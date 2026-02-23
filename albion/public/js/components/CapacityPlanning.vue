<template>
    <div class="capacity-planning">
        <div class="cp-header">
            <div class="cp-filters">
                <div class="filter-rows">
                    <div class="filter-row" v-show="!isZoomedOut">
                        <div class="filter-field">
                            <label class="filter-label">Customer</label>
                            <div class="frappe-field" ref="customerFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">Order</label>
                            <div class="frappe-field" ref="orderFieldRef"></div>
                        </div>
                        <div class="filter-field" style="display:none">
                            <label class="filter-label">Start Date</label>
                            <div class="frappe-field" ref="startDateFieldRef"></div>
                        </div>
                        <div class="filter-field" style="display:none">
                            <label class="filter-label">End Date</label>
                            <div class="frappe-field" ref="endDateFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">Process</label>
                            <div class="frappe-field" ref="processFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">View Type</label>
                            <div class="frappe-field" ref="viewTypeFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">Machine GG</label>
                            <div class="frappe-field" ref="machineGGFieldRef"></div>
                        </div>
                    </div>
                    <div class="filter-row">
                        <div class="action-group">
                            <label v-if="applyZoom" class="compact-toggle-wrap">
                                <span class="compact-label">Compact View</span>
                                <div class="toggle-switch" :class="{ 'toggle-on': isZoomedOut }" @click="isZoomedOut = !isZoomedOut">
                                    <div class="toggle-knob"></div>
                                </div>
                            </label>
                            <button class="btn btn-default" @click="undoLastAction" :disabled="actionHistory.length === 0" v-show="!isZoomedOut">Undo</button>
                            <button class="btn btn-default" @click="redoLastAction" :disabled="redoHistory.length === 0" v-show="!isZoomedOut">Redo</button>
                            <button class="btn btn-default" @click="refreshCalendar">Refresh</button>
                            <button class="btn btn-default" @click="openBulkShiftModal" v-show="!isZoomedOut">Update Shifts</button>
                            <button class="btn btn-primary" @click="saveAllocations" v-show="!isZoomedOut">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="validation-alerts" v-if="validationErrors.length > 0">
            <div v-for="(error, idx) in validationErrors" :key="idx" class="alert alert-danger">
                {{ error }}
            </div>
        </div>

        <div class="cp-body">
            <!-- Left Panel - Workload List -->
            <div class="cp-left-panel" :class="{ 'panel-collapsed': workloadCollapsed }" v-show="!isZoomedOut"
                 @dragover="onWorkloadDragOver"
                 @drop="onWorkloadDrop">
                <div class="panel-header" @click="workloadCollapsed = !workloadCollapsed">
                    <div class="panel-header-row">
                        <h4>Workload</h4>
                        <button class="panel-toggle-btn" :title="workloadCollapsed ? 'Expand' : 'Collapse'">
                            {{ workloadCollapsed ? '&#9654;' : '&#9664;' }}
                        </button>
                    </div>
                    <span v-if="!workloadCollapsed" class="panel-subtitle">Drag items to calendar</span>
                </div>
                <div v-show="!workloadCollapsed" class="workload-list">
                    <div v-if="workloadItems.length === 0" class="empty-state">
                        <div class="empty-icon">&#9776;</div>
                        <div class="empty-text">Select order and process to view workload</div>
                    </div>
                    <div
                        v-for="item in workloadItems"
                        :key="item.key"
                        class="workload-item"
                        :class="{
                            'fully-allocated': getAllocationStatus(item) === 'full',
                            'partial-allocated': getAllocationStatus(item) === 'partial',
                            'pending': getAllocationStatus(item) === 'pending',
                            'invalid': !isValidForProcess(item)
                        }"
                        :draggable="isValidForProcess(item) && getAllocationStatus(item) !== 'full'"
                        @dragstart="onDragStart($event, item)"
                        @dragend="onDragEnd"
                    >
                        <div class="item-header">
                            <span class="drag-handle" v-if="isValidForProcess(item) && getAllocationStatus(item) !== 'full'">&#8942;&#8942;</span>
                            <span class="item-name">{{ item.item }}</span>
                            <span class="item-qty">{{ item.quantity }}</span>
                        </div>
                        <div v-if="item.machine_gg" class="item-gg">{{ item.machine_gg }}</div>
                        <div v-if="item.colour" class="item-detail">
                            Colour: {{ item.colour }}
                        </div>
                        <div v-if="item.size" class="item-detail">
                            Size: {{ item.size }}
                        </div>
                        <div class="item-minutes">
                            {{ item.minutes }} mins/unit
                        </div>
                        <div v-if="!isValidForProcess(item)" class="invalid-reason">
                            Process not defined for this item
                        </div>
                        <div v-else-if="getAllocatedQuantity(item) > 0" class="allocation-status" :class="getAllocationStatus(item)">
                            Allocated: {{ getAllocatedQuantity(item) }} / {{ item.quantity }}
                        </div>
                        <div v-if="getAllocatedQuantity(item) > 0" class="item-progress">
                            <div class="item-progress-fill" :style="{ width: Math.min(100, (getAllocatedQuantity(item) / item.quantity) * 100) + '%' }" :class="getAllocationStatus(item)"></div>
                        </div>
                    </div>
                </div>
                <!-- Recently Deleted Blocks -->
                <div v-show="!workloadCollapsed && deletedBlocks.length > 0" class="deleted-blocks-section">
                    <div class="deleted-header">
                        <span class="deleted-title">Recently Deleted</span>
                        <button class="deleted-clear-btn" @click="clearDeletedBlocks" title="Clear all">&#10005;</button>
                    </div>
                    <div class="deleted-list">
                        <div
                            v-for="block in deletedBlocks"
                            :key="block.id"
                            class="deleted-item"
                            draggable="true"
                            @dragstart="onDeletedBlockDragStart($event, block)"
                            @dragend="onDragEnd"
                        >
                            <div class="deleted-item-header">
                                <span class="drag-handle">&#8942;&#8942;</span>
                                <span class="deleted-item-name">{{ block.item }}</span>
                                <span class="deleted-item-qty">{{ block.total_quantity }}</span>
                            </div>
                            <div v-if="block.colour" class="item-detail">Colour: {{ block.colour }}</div>
                            <div v-if="block.size" class="item-detail">Size: {{ block.size }}</div>
                            <div class="deleted-item-meta">
                                {{ block.days }} day(s) &middot; {{ block.minutes_per_unit }} mins/unit
                            </div>
                            <button class="deleted-dismiss-btn" @click="removeDeletedBlock(block.id)" title="Dismiss">&#10005;</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel - Gantt Calendar -->
            <div class="cp-right-panel">
                <div class="calendar-header" v-show="!isZoomedOut">
                    <h4>Capacity Calendar</h4>
                </div>
                <div class="calendar-wrapper" @dragover="onWrapperDragOver">
                    <div class="gantt-grid" :class="{ 'gantt-grid-zoom': isZoomedOut }" :style="ganttGridStyle">
                        <!-- Header row -->
                        <div class="gantt-corner-cell">Machine</div>
                        <div v-for="(date, dIdx) in dateRange" :key="'hdr-'+date"
                             class="gantt-date-header" :class="getDateHeaderClass(date)"
                             :style="{ gridRow: 1, gridColumn: dIdx + 2 }"
                             @click="!isZoomedOut && openActionChoice(date)">
                            <div class="date-cell">
                                <span class="day-date">{{ isZoomedOut ? formatDate(date) : formatDayName(date) + ', ' + formatDate(date) }}</span>
                                <span v-if="!isZoomedOut" class="shift-info">
                                    {{ getShiftNamesForDate(date) }} &middot; {{ getEffectiveMinutes(date) }}m
                                    <span v-if="getDayAlterationDelta(date)" class="day-alteration-badge clickable" :class="getDayAlterationDelta(date).cls"
                                          @click.stop="openEditAlterationsModal(date, null)">
                                        {{ getDayAlterationDelta(date).label }}
                                    </span>
                                </span>
                            </div>
                        </div>

                        <!-- Machine rows -->
                        <template v-for="(machine, mIdx) in filteredMachines" :key="machine.machine_id">
                            <!-- Machine label cell -->
                            <div class="gantt-machine-cell" :class="{ 'machine-disabled': !isMachineCompatible(machine.machine_id), 'machine-cell-zoom': isZoomedOut }" :style="{ gridRow: mIdx + 2 }"
                                 :title="isZoomedOut ? `${machine.machine_id} — ${machine.machine_name} (${machine.machine_gg})` : ''">
                                <template v-if="isZoomedOut">
                                    <span class="machine-id-zoom">{{ machine.machine_id }}</span>
                                </template>
                                <template v-else>
                                    <div class="machine-info">
                                        <div class="machine-title">
                                            <span class="machine-id">{{ machine.machine_id }}</span>
                                            <span class="machine-gg-badge">{{ machine.machine_gg }}</span>
                                        </div>
                                        <span class="machine-name">{{ machine.machine_name }}</span>
                                    </div>
                                </template>
                            </div>

                            <!-- Date cells (drop targets) -->
                            <div v-for="(date, dIdx) in dateRange"
                                 :key="machine.machine_id+'-'+date"
                                 class="gantt-date-cell"
                                 :class="[getCellClass(machine.machine_id, date), { 'machine-disabled': !isMachineCompatible(machine.machine_id) }]"
                                 :style="{ gridRow: mIdx + 2, gridColumn: dIdx + 2 }"
                                 @dragover="!isZoomedOut && onCellDragOver($event, machine.machine_id)"
                                 @drop="!isZoomedOut && onDrop($event, machine.machine_id, date)"
                                 @click.self="!isZoomedOut && openActionChoice(date, machine.machine_id)">
                                <template v-if="!isZoomedOut">
                                    <span v-if="hasMachineSpecificShift(date, machine.machine_id)"
                                          class="machine-shift-badge clickable"
                                          @click.stop="openActionChoice(date, machine.machine_id)">
                                        {{ getShiftNamesForDate(date, machine.machine_id) }}
                                    </span>
                                    <span v-if="getCellAlterationBadge(date, machine.machine_id)"
                                          class="alteration-badge clickable"
                                          :class="getCellAlterationBadge(date, machine.machine_id).cls"
                                          @click.stop="openEditAlterationsModal(date, machine.machine_id)">
                                        {{ getCellAlterationBadge(date, machine.machine_id).label }}
                                    </span>
                                    <div class="cell-top-row">
                                        <button class="cell-add-btn" @click.stop="openActionChoice(date, machine.machine_id)" title="Update shift or time">+</button>
                                    </div>
                                    <div class="cell-utilization" v-if="getUsedMinutes(machine.machine_id, date) > 0"
                                         :title="`${getUsedMinutes(machine.machine_id, date)}m / ${getEffectiveMinutes(date, machine.machine_id)}m`">
                                        <div class="util-bar" :class="getCapacityBarClass(machine.machine_id, date)">
                                            <div class="util-fill"
                                                 :style="{ width: Math.min(getCapacityPercentage(machine.machine_id, date), 100) + '%' }"
                                                 :class="getCapacityBarClass(machine.machine_id, date)"></div>
                                            <span class="util-label">{{ getUsedMinutes(machine.machine_id, date) }}m/{{ getEffectiveMinutes(date, machine.machine_id) }}m</span>
                                        </div>
                                    </div>
                                </template>
                            </div>

                            <!-- Gantt bar layer (overlays date cells in same row) -->
                            <div class="gantt-bar-layer"
                                 :class="{ 'machine-disabled': !isMachineCompatible(machine.machine_id) }"
                                 :style="{ gridRow: mIdx + 2, gridColumn: `2 / ${dateRange.length + 2}`, minHeight: getBarLayerHeight(machine.machine_id) + 'px' }">
                                <div v-for="group in getGroupsForMachine(machine.machine_id)"
                                     :key="group.group_id"
                                     :class="['gantt-bar', { 'snap-in': isJustDropped(group), 'zoomed-out-bar': isZoomedOut }]"
                                     :style="getBarStyle(group)"
                                     :draggable="!isZoomedOut"
                                     @dragstart="!isZoomedOut && onGroupDragStart($event, group)"
                                     @dragend="!isZoomedOut && onDragEnd()"
                                     @dragover="!isZoomedOut && onCellDragOver($event, machine.machine_id)"
                                     @drop="!isZoomedOut && onBarDrop($event, machine.machine_id)"
                                     @contextmenu.prevent="!isZoomedOut && onBarContextMenu($event, group)"
                                     @click.stop="!isZoomedOut && selectGroup(group)"
                                     @mouseenter="showTooltip($event, group)"
                                     @mouseleave="hideTooltip"
                                     @animationend="onSnapAnimationEnd(group)">
                                    <template v-if="isZoomedOut">
                                        <div class="bar-row-zoom">
                                            <span v-if="group.order" class="bar-tag order-tag"><b>O:</b> {{ group.order }}</span>
                                            <span class="bar-item">{{ group.item }}</span>
                                            <span class="bar-qty">{{ group.total_quantity }}</span>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="bar-row-top">
                                            <span class="bar-item">{{ group.item }}</span>
                                            <span class="bar-qty">{{ group.total_quantity }}</span>
                                        </div>
                                        <div class="bar-row-mid">
                                            <span class="bar-process">{{ group.process }}</span>
                                            <span class="bar-minutes">{{ group.total_minutes }}m</span>
                                        </div>
                                        <div class="bar-row-bot">
                                            <span v-if="group.order" class="bar-tag order-tag"><b>O:</b> {{ group.order }}</span>
                                            <span v-if="group.colour" class="bar-tag colour-tag"><b>C:</b> {{ group.colour }}</span>
                                            <span v-if="group.size" class="bar-tag size-tag"><b>S:</b> {{ group.size }}</span>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <!-- Allocate Quantity Modal -->
        <div v-if="showDropModal && pendingDrop" class="modal-overlay" @click="closeDropModal">
            <div class="modal-content" @click.stop>
                <h4>Allocate Quantity</h4>
                <div class="form-group">
                    <label>Item: {{ pendingDrop.item }}</label>
                </div>
                <div class="form-group">
                    <label>Target: {{ pendingDrop.machineId }} &middot; {{ fmtDate(pendingDrop.dateStr) }}</label>
                </div>
                <div class="form-group">
                    <label>Available on this day: {{ pendingDrop.availableCapacityQty }} units</label>
                </div>
                <div class="form-group">
                    <label>Remaining (max): {{ pendingDrop.maxQty }} units</label>
                </div>
                <div class="form-group" v-if="dropQuantity > pendingDrop.availableCapacityQty">
                    <label class="text-info">Excess will be split across subsequent days</label>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" v-model.number="dropQuantity" class="form-control" min="1" :max="pendingDrop.maxQty" />
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmDrop">Allocate</button>
                    <button class="btn btn-secondary" @click="closeDropModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Shift Confirmation Modal -->
        <div v-if="showShiftModal && shiftModalData" class="modal-overlay" @click="closeShiftModal">
            <div class="shift-modal" @click.stop>
                <h4>{{ shiftModalData.type === 'move_group' ? 'Cascade Shift Groups' : 'Shift Allocations Forward' }}</h4>
                <div class="shift-explanation">
                    <template v-if="shiftModalData.type === 'move_group' && shiftModalData.affectedGroups">
                        <p>Moving group to <strong>{{ shiftModalData.targetMachineId }}</strong> will cascade <strong>{{ shiftModalData.affectedGroups.length }}</strong> subsequent group(s) forward.</p>
                    </template>
                    <template v-else-if="shiftModalData.type === 'move_group'">
                        <p>Moving group to <strong>{{ shiftModalData.targetMachineId }}</strong> conflicts with <strong>{{ shiftModalData.affectedAllocations.length }}</strong> existing allocation(s).</p>
                        <p>These allocations will be shifted forward to make room.</p>
                    </template>
                    <template v-else>
                        <p>The new workload needs <strong>{{ shiftModalData.newWorkloadPlan.length }}</strong> day(s) on <strong>{{ shiftModalData.pendingDropData.machineId }}</strong>.</p>
                        <p><strong>{{ shiftModalData.affectedAllocations.length }}</strong> existing allocation(s) will be shifted forward to make room.</p>
                    </template>
                </div>
                <div class="shift-table-wrapper">
                    <table v-if="shiftModalData.affectedGroups && shiftModalData.affectedGroups.length > 0" class="shift-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Order</th>
                                <th>Days</th>
                                <th>Current Range</th>
                                <th></th>
                                <th>New Range</th>
                                <th>Shift</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(grp, idx) in shiftModalData.affectedGroups" :key="idx">
                                <td>{{ grp.item }}</td>
                                <td>{{ grp.order }}</td>
                                <td>{{ grp.dayCount }}</td>
                                <td>{{ fmtDate(grp.oldStart) }} to {{ fmtDate(grp.oldEnd) }}</td>
                                <td>&rarr;</td>
                                <td>{{ grp.newStart && grp.newEnd ? `${fmtDate(grp.newStart)} to ${fmtDate(grp.newEnd)}` : 'Out of range' }}</td>
                                <td>+{{ grp.pushDays }}d</td>
                            </tr>
                        </tbody>
                    </table>
                    <table v-else class="shift-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Item</th>
                                <th>Process</th>
                                <th>Qty</th>
                                <th>Current Date</th>
                                <th></th>
                                <th>New Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(entry, idx) in shiftModalData.affectedAllocations" :key="idx">
                                <td>{{ entry.allocation.order }}</td>
                                <td>{{ entry.allocation.item }}</td>
                                <td>{{ entry.allocation.process }}</td>
                                <td>{{ entry.allocation.quantity }}</td>
                                <td>{{ fmtDate(entry.currentDate) }}</td>
                                <td>&rarr;</td>
                                <td>{{ fmtDate(entry.newDate) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmShift">
                        {{ shiftModalData.type === 'move_group' ? 'Shift & Move' : 'Shift & Allocate' }}
                    </button>
                    <button class="btn btn-secondary" @click="closeShiftModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Backfill Confirmation Modal -->
        <div v-if="showBackfillModal && backfillModalData" class="modal-overlay">
            <div class="shift-modal" @click.stop>
                <h4>Fill Gap After Deletion</h4>
                <div class="backfill-explanation">
                    <p><strong>{{ backfillModalData.affectedAllocations.length }}</strong> subsequent allocation(s) on <strong>{{ backfillModalData.machineId }}</strong> can be shifted backward to fill the gap.</p>
                </div>
                <div class="shift-table-wrapper">
                    <table class="shift-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Item</th>
                                <th>Process</th>
                                <th>Qty</th>
                                <th>Current Date</th>
                                <th></th>
                                <th>New Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(entry, idx) in backfillModalData.affectedAllocations" :key="idx">
                                <td>{{ entry.allocation.order }}</td>
                                <td>{{ entry.allocation.item }}</td>
                                <td>{{ entry.allocation.process }}</td>
                                <td>{{ entry.allocation.quantity }}</td>
                                <td>{{ fmtDate(entry.currentDate) }}</td>
                                <td>&larr;</td>
                                <td>{{ fmtDate(entry.newDate) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmBackfill">Shift Backward</button>
                    <button class="btn btn-default" @click="declineBackfill">Just Delete</button>
                    <button class="btn btn-secondary" @click="cancelDeleteGroup">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Edit Group Quantity Modal -->
        <div v-if="showEditGroupModal && selectedGroup" class="modal-overlay" @click="closeEditGroupModal">
            <div class="modal-content" @click.stop>
                <h4>Edit Group Quantity</h4>
                <div class="form-group">
                    <label>Item: {{ selectedGroup.item }}</label>
                </div>
                <div class="form-group">
                    <label>Dates: {{ fmtDate(selectedGroup.start_date) }} to {{ fmtDate(selectedGroup.end_date) }} ({{ selectedGroup.allocs.length }} days)</label>
                </div>
                <div class="form-group">
                    <label>Current Total: {{ selectedGroup.total_quantity }}</label>
                </div>
                <div class="form-group">
                    <label>New Total Quantity</label>
                    <input type="number" v-model.number="editGroupQuantity" class="form-control" min="1" />
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmEditGroup">Update</button>
                    <button class="btn btn-secondary" @click="closeEditGroupModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Split Group at Date Modal -->
        <div v-if="showSplitGroupModal && selectedGroup" class="modal-overlay" @click="closeSplitGroupModal">
            <div class="modal-content" @click.stop>
                <h4>Split Group at Date</h4>
                <div class="form-group">
                    <label>Item: {{ selectedGroup.item }} ({{ selectedGroup.allocs.length }} days)</label>
                </div>
                <div class="form-group">
                    <label>Split before date</label>
                    <select v-model="splitGroupDate" class="form-control">
                        <option v-for="alloc in selectedGroup.allocs.slice(1)" :key="alloc.operation_date" :value="alloc.operation_date">
                            {{ fmtDate(alloc.operation_date) }}
                        </option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmSplitGroup">Split</button>
                    <button class="btn btn-secondary" @click="closeSplitGroupModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Shift Group by Days Modal -->
        <div v-if="showShiftByDaysModal && selectedGroup" class="modal-overlay" @click="closeShiftByDaysModal">
            <div class="shift-modal" @click.stop>
                <h4>Shift Group by Days</h4>
                <div class="form-group">
                    <label>{{ selectedGroup.item }} &mdash; {{ fmtDate(selectedGroup.start_date) }} to {{ fmtDate(selectedGroup.end_date) }} ({{ selectedGroup.allocs.length }} days)</label>
                </div>
                <div class="form-group">
                    <label>Number of days to shift</label>
                    <input type="number" v-model.number="shiftByDaysCount" class="form-control" @input="computeShiftByDaysPreview" />
                    <small class="text-muted">Positive = forward, Negative = backward</small>
                </div>
                <template v-if="shiftByDaysCount !== 0 && shiftByDaysPreview">
                    <div v-if="shiftByDaysPreview.error" class="shift-explanation">
                        <p class="text-danger"><strong>{{ shiftByDaysPreview.error }}</strong></p>
                    </div>
                    <template v-else>
                        <div class="shift-explanation">
                            <p>Group moves from <strong>{{ fmtDate(selectedGroup.start_date) }}</strong> &rarr; <strong>{{ fmtDate(shiftByDaysPreview.newStart) }}</strong></p>
                            <p v-if="shiftByDaysPreview.affectedGroups && shiftByDaysPreview.affectedGroups.length > 0">
                                <strong>{{ shiftByDaysPreview.affectedGroups.length }}</strong> subsequent group(s) will cascade forward.
                            </p>
                            <p v-else>No conflicts — group can shift directly.</p>
                        </div>
                        <div v-if="shiftByDaysPreview.affectedGroups && shiftByDaysPreview.affectedGroups.length > 0" class="shift-table-wrapper">
                            <table class="shift-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Order</th>
                                        <th>Days</th>
                                        <th>Current Range</th>
                                        <th></th>
                                        <th>New Range</th>
                                        <th>Shift</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(grp, idx) in shiftByDaysPreview.affectedGroups" :key="idx">
                                        <td>{{ grp.item }}</td>
                                        <td>{{ grp.order }}</td>
                                        <td>{{ grp.dayCount }}</td>
                                        <td>{{ fmtDate(grp.oldStart) }} to {{ fmtDate(grp.oldEnd) }}</td>
                                        <td>&rarr;</td>
                                        <td>{{ grp.newStart && grp.newEnd ? `${fmtDate(grp.newStart)} to ${fmtDate(grp.newEnd)}` : 'Out of range' }}</td>
                                        <td>+{{ grp.pushDays }}d</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="modal-actions">
                            <button class="btn btn-primary" @click="confirmShiftByDays" :disabled="shiftByDaysPreview.outOfBounds">
                                {{ shiftByDaysPreview.affected.length > 0 ? 'Shift & Move' : 'Shift Group' }}
                            </button>
                            <button class="btn btn-secondary" @click="closeShiftByDaysModal">Cancel</button>
                        </div>
                    </template>
                </template>
                <div v-else class="modal-actions">
                    <button class="btn btn-secondary" @click="closeShiftByDaysModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Right-click Context Menu -->
        <div v-if="contextMenu.show" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
            <template v-if="selectedGroup">
                <div class="menu-item" @click="openShiftGroupByDaysModal">Shift Group by Days</div>
                <div class="menu-item text-danger" @click="deleteGroup">Delete Group</div>
            </template>
        </div>

        <!-- Action Choice Dialog -->
        <div v-if="showActionChoice" class="modal-overlay" @click="closeActionChoice">
            <div class="modal-content action-choice-modal" @click.stop>
                <h4>What would you like to do?</h4>
                <p class="action-choice-date">{{ fmtDate(actionChoiceContext.date) }} {{ actionChoiceContext.machine ? '(' + actionChoiceContext.machine + ')' : '(All Machines)' }}</p>
                <div class="action-choice-buttons">
                    <button class="btn btn-primary action-choice-btn" @click="chooseUpdateShift">
                        <span class="action-icon">&#9200;</span>
                        Update Shift
                    </button>
                    <button class="btn btn-default action-choice-btn" @click="chooseUpdateTime">
                        <span class="action-icon">&#9998;</span>
                        Update Time
                    </button>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" @click="closeActionChoice">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Shift Update Modal -->
        <div v-if="showShiftUpdateModal" class="modal-overlay" @click="closeShiftUpdateModal">
            <div class="modal-content" @click.stop>
                <h4>Update Shifts{{ shiftUpdateForm.machine ? ' — ' + shiftUpdateForm.machine : '' }}</h4>
                <div class="form-group">
                    <label>Date</label>
                    <input type="text" class="form-control" :value="shiftUpdateForm.date" disabled />
                </div>
                <div class="form-group" v-if="shiftUpdateForm.machine">
                    <label>Machine</label>
                    <input type="text" class="form-control" :value="shiftUpdateForm.machine" disabled />
                </div>
                <div class="form-group">
                    <label>Shifts</label>
                    <div class="shift-checkbox-list">
                        <label v-for="s in allShifts" :key="s.name" class="shift-checkbox-item">
                            <input type="checkbox" :value="s.name" v-model="shiftUpdateForm.shifts" />
                            <span class="shift-checkbox-label">{{ s.shift_name }}</span>
                            <span class="shift-checkbox-mins">{{ s.duration_minutes }}m</span>
                        </label>
                    </div>
                </div>
                <div class="form-group" v-if="shiftUpdateForm.shifts.length > 0">
                    <label class="text-muted">Total: {{ selectedShiftsTotalMinutes }}m</label>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmShiftUpdate" :disabled="shiftUpdateSaving || shiftUpdateForm.shifts.length === 0">
                        {{ shiftUpdateSaving ? 'Saving...' : 'Update' }}
                    </button>
                    <button class="btn btn-secondary" @click="closeShiftUpdateModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Shift Alteration Modal -->
        <div v-if="showAlterationModal" class="modal-overlay" @click="closeAlterationModal">
            <div class="modal-content" @click.stop>
                <h4>Add Shift Alteration</h4>
                <div class="form-group">
                    <label>Date</label>
                    <input type="text" class="form-control" :value="alterationForm.date" disabled />
                </div>
                <div class="form-group">
                    <label>Machine</label>
                    <input type="text" class="form-control" :value="alterationForm.machine || 'All Machines'" disabled />
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select v-model="alterationForm.alteration_type" class="form-control">
                        <option value="Add">Add Overtime</option>
                        <option value="Reduce">Add Break / Reduce</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Minutes</label>
                    <input type="number" v-model.number="alterationForm.minutes" class="form-control" min="1" />
                </div>
                <div class="form-group">
                    <label>Reason (optional)</label>
                    <input type="text" v-model="alterationForm.reason" class="form-control" placeholder="e.g., Overtime, Break" />
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmAlteration" :disabled="alterationSaving">
                        {{ alterationSaving ? 'Saving...' : 'Add Alteration' }}
                    </button>
                    <button class="btn btn-secondary" @click="closeAlterationModal">Cancel</button>
                </div>
            </div>
        </div>
        <!-- Edit Alterations Modal -->
        <div v-if="showEditAlterationsModal" class="modal-overlay" @click="closeEditAlterationsModal">
            <div class="modal-content bulk-shift-modal" @click.stop>
                <h4>Manage Alterations — {{ formatDate(editAlterationsContext.date) }}{{ editAlterationsContext.machine_id ? ' — ' + editAlterationsContext.machine_id : '' }}</h4>
                <div v-if="editAlterationsList.length === 0" class="text-muted" style="padding: 12px 0;">
                    No alterations for this {{ editAlterationsContext.machine_id ? 'cell' : 'date' }}.
                </div>
                <table v-else class="bulk-shift-table">
                    <thead>
                        <tr>
                            <th v-if="!editAlterationsContext.machine_id">Machine</th>
                            <th>Type</th>
                            <th class="text-right">Minutes</th>
                            <th>Reason</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, idx) in editAlterationsList" :key="row.name">
                            <td v-if="!editAlterationsContext.machine_id">{{ row.machine || 'All' }}</td>
                            <td>
                                <select v-model="editAlterationsList[idx].alteration_type" class="form-control bulk-shift-select">
                                    <option value="Add">Overtime</option>
                                    <option value="Reduce">Break</option>
                                </select>
                            </td>
                            <td class="text-right">
                                <input type="number" v-model.number="editAlterationsList[idx].minutes" class="form-control bulk-shift-input" min="1" />
                            </td>
                            <td>
                                <input type="text" v-model="editAlterationsList[idx].reason" class="form-control" placeholder="Reason" style="min-width: 120px;" />
                            </td>
                            <td class="text-center" style="white-space: nowrap;">
                                <button class="btn btn-xs btn-primary" @click="saveAlteration(idx)" :disabled="editAlterationsSaving" title="Save">Save</button>
                                <button class="btn btn-xs btn-danger" @click="deleteAlteration(idx)" :disabled="editAlterationsSaving" title="Delete" style="margin-left: 4px;">&#10005;</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <div class="modal-actions">
                    <button class="btn btn-primary btn-sm" @click="addNewFromEditModal">+ Add New</button>
                    <button class="btn btn-secondary btn-sm" @click="closeEditAlterationsModal">Close</button>
                </div>
            </div>
        </div>

        <!-- Bulk Shift Update Modal -->
        <div v-if="showBulkShiftModal" class="modal-overlay" @click="closeBulkShiftModal">
            <div class="modal-content bulk-shift-modal" @click.stop>
                <h4>Update Shifts</h4>
                <div class="form-group">
                    <label>Date</label>
                    <div ref="bulkShiftDateFieldRef"></div>
                </div>
                <div v-if="bulkShiftMachines.length > 0" class="bulk-shift-table-wrap">
                    <table class="bulk-shift-table">
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
                            <tr v-for="(row, idx) in bulkShiftMachines" :key="row.machine_id">
                                <td>{{ row.machine_name }}</td>
                                <td>{{ row.shift_name }}</td>
                                <td class="text-right">{{ row.total_minutes }}</td>
                                <td class="text-right">{{ row.allocated_minutes }}</td>
                                <td>
                                    <select v-model="bulkShiftMachines[idx].alteration_type" class="form-control bulk-shift-select">
                                        <option value="Add">Overtime</option>
                                        <option value="Reduce">Break</option>
                                    </select>
                                </td>
                                <td class="text-right">
                                    <input type="number" v-model.number="bulkShiftMachines[idx].update_minutes" class="form-control bulk-shift-input" min="0" />
                                </td>
                                <td class="text-center">
                                    <button class="btn btn-xs btn-danger bulk-shift-delete" @click="bulkShiftMachines.splice(idx, 1)" title="Remove machine">&#10005;</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-else-if="bulkShiftDate" class="text-muted" style="padding: 12px 0;">No machines loaded for this date.</div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="applyBulkShiftUpdates"
                        :disabled="bulkShiftSaving || !bulkShiftMachines.some(r => r.update_minutes > 0)">
                        {{ bulkShiftSaving ? 'Applying...' : 'Apply' }}
                    </button>
                    <button class="btn btn-secondary" @click="closeBulkShiftModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Custom Tooltip -->
        <div v-if="tooltip.show" class="gantt-tooltip" :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
            <div class="tooltip-header">{{ tooltip.data.item }}</div>
            <div class="tooltip-grid">
                <span class="tooltip-label">Order</span>
                <span class="tooltip-value">{{ tooltip.data.order }}</span>
                <span class="tooltip-label">Process</span>
                <span class="tooltip-value">{{ tooltip.data.process }}</span>
                <span class="tooltip-label">Dates</span>
                <span class="tooltip-value">{{ fmtDate(tooltip.data.start_date) }} &rarr; {{ fmtDate(tooltip.data.end_date) }}</span>
                <span class="tooltip-label">Days</span>
                <span class="tooltip-value">{{ tooltip.data.days }}</span>
                <span class="tooltip-label">Quantity</span>
                <span class="tooltip-value tooltip-qty">{{ tooltip.data.total_quantity }}</span>
                <span class="tooltip-label">Minutes</span>
                <span class="tooltip-value">{{ tooltip.data.total_minutes }}m</span>
                <template v-if="tooltip.data.colour">
                    <span class="tooltip-label">Colour</span>
                    <span class="tooltip-value">{{ tooltip.data.colour }}</span>
                </template>
                <template v-if="tooltip.data.size">
                    <span class="tooltip-label">Size</span>
                    <span class="tooltip-value">{{ tooltip.data.size }}</span>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

const emit = defineEmits(['saveAllocations']);

// State - internal refs that can be updated via load_data
const processes = ref([]);
const machines = ref([]);

const selectedCustomer = ref('');
const selectedMachineGG = ref('');
const selectedOrder = ref('');
const selectedProcess = ref('');
const viewType = ref('item_wise');
const startDate = ref('');
const endDate = ref('');
const suppressDateWatch = ref(false);
const orderData = ref(null);

// Infinite scroll
const isExtending = ref(false);
let scrollDebounceTimer = null;
const EXTEND_THRESHOLD = 300;
const EXTEND_DAYS = 30;

// Workload panel collapse
const workloadCollapsed = ref(false);
const isZoomedOut = ref(false);
const applyZoom = ref(false);

// Template refs for Frappe fields
const customerFieldRef = ref(null);
const machineGGFieldRef = ref(null);
const orderFieldRef = ref(null);
const processFieldRef = ref(null);
const viewTypeFieldRef = ref(null);
const startDateFieldRef = ref(null);
const endDateFieldRef = ref(null);
const bulkShiftDateFieldRef = ref(null);

// Frappe control instances
let customerControl = null;
let machineGGControl = null;
let orderControl = null;
let processControl = null;
let viewTypeControl = null;
let startDateControl = null;
let endDateControl = null;
let bulkShiftDateControl = null;
const shiftAllocations = ref([]);
const defaultAllocation = ref(null);
const allocations = ref([]);
const actionHistory = ref([]);
const redoHistory = ref([]);
const validationErrors = ref([]);

// Drop quantity modal state
const showDropModal = ref(false);
const dropQuantity = ref(0);
const pendingDrop = ref(null);

// Shift modal state
const showShiftModal = ref(false);
const shiftModalData = ref(null);

// Backfill modal state
const showBackfillModal = ref(false);
const backfillModalData = ref(null);

// Context menu
const contextMenu = ref({ show: false, x: 0, y: 0 });

// Tooltip
const tooltip = ref({ show: false, x: 0, y: 0, data: {} });

// Group state
const selectedGroup = ref(null);
const splitMarkers = ref(new Set());
const showEditGroupModal = ref(false);
const editGroupQuantity = ref(0);
const showSplitGroupModal = ref(false);
const splitGroupDate = ref('');

// Drag tracking for machine_gg filtering
const draggingItem = ref(null);

// Snap animation tracking for just-dropped groups
const droppedAllocKeys = ref(new Set());

// Recently deleted blocks for drag-to-reallocate
const deletedBlocks = ref([]);

// Shift group by days modal state
const showShiftByDaysModal = ref(false);
const shiftByDaysCount = ref(0);
const shiftByDaysPreview = ref(null);

// Alteration modal state
const showAlterationModal = ref(false);
const alterationSaving = ref(false);
const alterationForm = ref({
    date: '',
    machine: null,
    alteration_type: 'Add',
    minutes: 60,
    reason: ''
});

// Edit alterations modal state
const showEditAlterationsModal = ref(false);
const editAlterationsContext = ref({ date: '', machine_id: null });
const editAlterationsList = ref([]);
const editAlterationsSaving = ref(false);

// Action choice dialog state
const showActionChoice = ref(false);
const actionChoiceContext = ref({ date: '', machine: null });

// Shift update modal state
const showShiftUpdateModal = ref(false);
const shiftUpdateSaving = ref(false);
const shiftUpdateForm = ref({ date: '', shifts: [], machine: null });
const allShifts = ref([]);

// Bulk shift update modal state
const showBulkShiftModal = ref(false);
const bulkShiftSaving = ref(false);
const bulkShiftDate = ref('');
const bulkShiftMachines = ref([]);

// Initialize dates
const today = new Date();
startDate.value = today.toISOString().split('T')[0];
const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
endDate.value = nextMonth.toISOString().split('T')[0];

// Constants
const MIN_BATCH_SIZE = 1;
const COL_WIDTH = 120;
const COL_WIDTH_ZOOM = 48;
const MACHINE_COL_WIDTH = 180;
const MACHINE_COL_WIDTH_ZOOM = 120;
const BAR_HEIGHT = 68;
const BAR_HEIGHT_ZOOM = 22;
const BAR_GAP = 4;
const BAR_TOP_OFFSET = 22;
const SCROLL_EDGE_ZONE = 60;   // px from edge to trigger scroll
const SCROLL_SPEED = 12;       // px per animation frame
let autoScrollRAF = null;
let autoScrollDX = 0;
let autoScrollDY = 0;

// Machine GG lookup: Map<itemCode, machineGG>
const itemMachineGG = computed(() => {
    const map = new Map();
    if (orderData.value && orderData.value.items) {
        orderData.value.items.forEach(item => {
            if (item.item_doc && item.item_doc.machine_gg) {
                map.set(item.item, item.item_doc.machine_gg);
            }
        });
    }
    return map;
});

function isMachineCompatible(machineId) {
    if (!draggingItem.value) return true;
    let itemGG = itemMachineGG.value.get(draggingItem.value.item);
    // Fallback: infer GG from the source machine when dragging existing groups
    if (!itemGG && draggingItem.value.sourceMachineId) {
        const srcMachine = machines.value.find(m => m.machine_id === draggingItem.value.sourceMachineId);
        if (srcMachine && srcMachine.machine_gg) itemGG = srcMachine.machine_gg;
    }
    if (!itemGG && draggingItem.value.machine_gg) {
        itemGG = draggingItem.value.machine_gg;
    }
    if (!itemGG) return true; // no machine_gg info → all machines allowed
    const machine = machines.value.find(m => m.machine_id === machineId);
    if (!machine || !machine.machine_gg) return true; // no machine_gg on machine → allowed
    return machine.machine_gg === itemGG;
}

function checkMachineGGCompat(itemCode, sourceMachineId, targetMachineId) {
    if (sourceMachineId === targetMachineId) return true;
    // First try the orderData lookup
    let itemGG = itemMachineGG.value.get(itemCode);
    // Fallback: infer GG from the source machine (it was compatible when originally placed)
    if (!itemGG) {
        const srcMachine = machines.value.find(m => m.machine_id === sourceMachineId);
        if (srcMachine && srcMachine.machine_gg) itemGG = srcMachine.machine_gg;
    }
    if (!itemGG) return true; // no GG info available → allow
    const targetMachine = machines.value.find(m => m.machine_id === targetMachineId);
    if (!targetMachine || !targetMachine.machine_gg) return true;
    if (targetMachine.machine_gg !== itemGG) {
        frappe.show_alert({ message: __(`Cannot move: item requires Machine GG "${itemGG}" but target has "${targetMachine.machine_gg}"`), indicator: 'red' });
        return false;
    }
    return true;
}

// Computed
const dateRange = computed(() => {
    const dates = [];
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
});

const colWidth = computed(() => isZoomedOut.value ? COL_WIDTH_ZOOM : COL_WIDTH);

const ganttGridStyle = computed(() => ({
    gridTemplateColumns: `${isZoomedOut.value ? MACHINE_COL_WIDTH_ZOOM : MACHINE_COL_WIDTH}px repeat(${dateRange.value.length}, ${colWidth.value}px)`,
}));

watch(isZoomedOut, async () => {
    await nextTick();
    const wrapper = document.querySelector('.calendar-wrapper');
    if (!wrapper) return;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayIdx = dateRange.value.indexOf(todayStr);
    if (todayIdx >= 0) {
        wrapper.scrollLeft = Math.max(0, todayIdx * colWidth.value - colWidth.value * 2);
    }
});

const selectedShiftsTotalMinutes = computed(() => {
    return shiftUpdateForm.value.shifts.reduce((sum, name) => {
        const s = allShifts.value.find(x => x.name === name);
        return sum + (s ? s.duration_minutes : 0);
    }, 0);
});

const filteredMachines = computed(() => {
    if (!selectedMachineGG.value) return machines.value;
    return machines.value.filter(m => m.machine_gg === selectedMachineGG.value);
});

const availableProcesses = computed(() => {
    if (!orderData.value || !processes.value) return [];
    const processSet = new Set();
    orderData.value.items?.forEach(item => {
        item.item_doc?.processes?.forEach(p => processSet.add(p.process_name));
    });
    return processes.value.filter(p => processSet.has(p.name));
});

const workloadItems = computed(() => {
    if (!orderData.value || !selectedProcess.value) return [];

    const items = [];
    const processMinutes = getProcessMinutes();

    if (viewType.value === 'item_wise') {
        const itemTotals = {};
        orderData.value.order_details?.forEach(detail => {
            if (!itemTotals[detail.item]) {
                itemTotals[detail.item] = 0;
            }
            itemTotals[detail.item] += detail.quantity;
        });
        Object.entries(itemTotals).forEach(([item, qty]) => {
            items.push({
                key: `${item}`,
                item,
                quantity: qty,
                minutes: processMinutes[item] || 0,
                colour: null,
                size: null,
                machine_gg: itemMachineGG.value.get(item) || null
            });
        });
    } else if (viewType.value === 'colour_wise') {
        const colourTotals = {};
        orderData.value.order_details?.forEach(detail => {
            const key = `${detail.item}-${detail.colour}`;
            if (!colourTotals[key]) {
                colourTotals[key] = { item: detail.item, colour: detail.colour, quantity: 0 };
            }
            colourTotals[key].quantity += detail.quantity;
        });
        Object.entries(colourTotals).forEach(([key, data]) => {
            items.push({
                key,
                item: data.item,
                quantity: data.quantity,
                minutes: processMinutes[data.item] || 0,
                colour: data.colour,
                size: null,
                machine_gg: itemMachineGG.value.get(data.item) || null
            });
        });
    } else if (viewType.value === 'size_wise') {
        const sizeTotals = {};
        orderData.value.order_details?.forEach(detail => {
            const key = `${detail.item}-${detail.size}`;
            if (!sizeTotals[key]) {
                sizeTotals[key] = { item: detail.item, size: detail.size, quantity: 0 };
            }
            sizeTotals[key].quantity += detail.quantity;
        });
        Object.entries(sizeTotals).forEach(([key, data]) => {
            items.push({
                key,
                item: data.item,
                quantity: data.quantity,
                minutes: processMinutes[data.item] || 0,
                colour: null,
                size: data.size,
                machine_gg: itemMachineGG.value.get(data.item) || null
            });
        });
    }
    return items;
});

// Grouping computed - merges consecutive-day allocations into Gantt groups
const groupedAllocations = computed(() => {
    const groups = [];
    const groupMap = {};

    allocations.value.forEach(alloc => {
        const key = `${alloc.machine_id}|${alloc.order}|${alloc.item}|${alloc.process}|${alloc.colour || ''}|${alloc.size || ''}`;
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(alloc);
    });

    Object.entries(groupMap).forEach(([, allocs]) => {
        allocs.sort((a, b) => a.operation_date.localeCompare(b.operation_date));

        let currentGroup = null;

        allocs.forEach(alloc => {
            const shouldBreak = currentGroup && (
                !isNextDay(currentGroup.end_date, alloc.operation_date) ||
                isGroupSplit(alloc.machine_id, currentGroup.end_date, alloc.operation_date)
            );

            if (!currentGroup || shouldBreak) {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = {
                    group_id: `grp-${alloc.key}`,
                    machine_id: alloc.machine_id,
                    start_date: alloc.operation_date,
                    end_date: alloc.operation_date,
                    allocs: [alloc],
                    alloc_keys: [alloc.key],
                    item: alloc.item,
                    process: alloc.process,
                    order: alloc.order,
                    colour: alloc.colour,
                    size: alloc.size,
                    total_quantity: alloc.quantity,
                    total_minutes: alloc.allocated_minutes,
                };
            } else {
                currentGroup.end_date = alloc.operation_date;
                currentGroup.allocs.push(alloc);
                currentGroup.alloc_keys.push(alloc.key);
                currentGroup.total_quantity += alloc.quantity;
                currentGroup.total_minutes += alloc.allocated_minutes;
            }
        });

        if (currentGroup) groups.push(currentGroup);
    });

    return groups;
});

// Assign lane indices per machine for stacking non-overlapping groups
const groupedAllocationsWithLanes = computed(() => {
    const byMachine = {};
    groupedAllocations.value.forEach(g => {
        if (!byMachine[g.machine_id]) byMachine[g.machine_id] = [];
        byMachine[g.machine_id].push({ ...g });
    });

    const result = [];
    Object.entries(byMachine).forEach(([, groups]) => {
        groups.sort((a, b) => a.start_date.localeCompare(b.start_date));
        const lanes = [];

        groups.forEach(g => {
            let assigned = false;
            for (let i = 0; i < lanes.length; i++) {
                if (lanes[i] < g.start_date) {
                    g.lane = i;
                    lanes[i] = g.end_date;
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                g.lane = lanes.length;
                lanes.push(g.end_date);
            }
            result.push(g);
        });
    });

    return result;
});

// Methods
function loadData(data) {
    if (data.processes) processes.value = data.processes;
    if (data.machines) machines.value = data.machines;
}

function getProcessMinutes() {
    const minutes = {};
    if (orderData.value && orderData.value.items) {
        orderData.value.items.forEach(item => {
            const itemDoc = item.item_doc;
            if (itemDoc && itemDoc.processes) {
                const proc = itemDoc.processes.find(p => p.process_name === selectedProcess.value);
                if (proc) {
                    minutes[item.item] = proc.minutes;
                }
            }
        });
    }
    return minutes;
}

function isValidForProcess(item) {
    return item.minutes > 0;
}

function formatDayName(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function getCalendarForDate(dateStr, machineId = null) {
    // Priority: machine-single(1) > general-single(2) > machine-range(3) > general-range(4) > default(5)
    let machineRange = null, generalSingleDay = null, generalRange = null;
    for (const cal of shiftAllocations.value) {
        if (dateStr < cal.start_date || dateStr > cal.end_date) continue;
        const isSingleDay = cal.start_date === dateStr && cal.end_date === dateStr;

        if (machineId && cal.machine === machineId) {
            if (isSingleDay) return cal;  // Priority 1: machine single-day
            if (!machineRange) machineRange = cal;
        } else if (!cal.machine) {
            if (isSingleDay) { generalSingleDay = cal; }  // Priority 2
            else if (!generalRange) { generalRange = cal; }
        }
    }
    return generalSingleDay || machineRange || generalRange || defaultAllocation.value;
}

function getShiftForDate(dateStr, machineId = null) {
    const cal = getCalendarForDate(dateStr, machineId);
    if (cal && cal.shifts && cal.shifts.length > 0) {
        return cal.shifts[0];
    }
    return null;
}

function getShiftNamesForDate(dateStr, machineId = null) {
    const cal = getCalendarForDate(dateStr, machineId);
    if (!cal || !cal.shifts || cal.shifts.length === 0) return 'No Shift';
    return cal.shifts.map(s => s.shift_name).join(', ');
}

function getShiftMinutes(dateStr, machineId = null) {
    if (machineId) {
        // Check for a machine-specific calendar (overrides off-day)
        const machineCal = _findMachineCalendar(dateStr, machineId);
        if (machineCal) return machineCal.total_duration_minutes || 0;
    }
    if (isOffDay(dateStr)) return 0;
    const cal = getCalendarForDate(dateStr, null); // General only
    return cal ? (cal.total_duration_minutes || 480) : 480;
}

function _findMachineCalendar(dateStr, machineId) {
    // Returns a machine-specific calendar for this date+machine, or null
    let machineRange = null;
    for (const cal of shiftAllocations.value) {
        if (dateStr < cal.start_date || dateStr > cal.end_date) continue;
        if (cal.machine !== machineId) continue;
        if (cal.start_date === dateStr && cal.end_date === dateStr) return cal;
        if (!machineRange) machineRange = cal;
    }
    return machineRange;
}

function hasMachineSpecificShift(dateStr, machineId) {
    return !!_findMachineCalendar(dateStr, machineId);
}

function getEffectiveMinutes(dateStr, machineId = null) {
    let base = getShiftMinutes(dateStr, machineId); // Machine-aware base
    // Alterations are always on the general calendar
    const generalCal = getCalendarForDate(dateStr, null);
    if (!generalCal || !generalCal.alterations) return Math.max(0, base);

    for (const alt of generalCal.alterations) {
        if (alt.date !== dateStr) continue;
        // Day-level alterations (no machine)
        if (!alt.machine) {
            base += alt.alteration_type === 'Add' ? alt.minutes : -alt.minutes;
        }
    }

    if (machineId) {
        for (const alt of generalCal.alterations) {
            if (alt.date !== dateStr) continue;
            if (alt.machine === machineId) {
                base += alt.alteration_type === 'Add' ? alt.minutes : -alt.minutes;
            }
        }
    }

    return Math.max(0, base);
}

function getCellAlterationBadge(dateStr, machineId) {
    const base = getShiftMinutes(dateStr, machineId);
    const effective = getEffectiveMinutes(dateStr, machineId);
    const delta = effective - base;
    if (delta === 0) return null;
    return {
        label: delta > 0 ? `+${delta}m` : `${delta}m`,
        cls: delta > 0 ? 'badge-add' : 'badge-reduce'
    };
}

function getDayAlterationDelta(dateStr) {
    const base = getShiftMinutes(dateStr, null);
    const effective = getEffectiveMinutes(dateStr, null);
    const delta = effective - base;
    if (delta === 0) return null;
    return {
        label: delta > 0 ? `+${delta}m` : `${delta}m`,
        cls: delta > 0 ? 'badge-add' : 'badge-reduce'
    };
}

function isOffDay(dateStr) {
    const cal = defaultAllocation.value;
    if (!cal) return false;
    const dayIndex = new Date(dateStr).getDay(); // 0=Sun..6=Sat
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (!cal[dayFields[dayIndex]]) {
        // Check if a single-day general calendar was explicitly created for this date
        const hasExplicitCal = shiftAllocations.value.some(
            sa => sa.start_date === dateStr && sa.end_date === dateStr && !sa.machine
        );
        if (hasExplicitCal) return false;
        return true;
    }
    return false;
}

function isDefaultWeekdayOff(dateStr) {
    const cal = defaultAllocation.value;
    if (!cal) return false;
    const dayIndex = new Date(dateStr).getDay();
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return !cal[dayFields[dayIndex]];
}

function isPastDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function isToday(dateStr) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return dateStr === `${y}-${m}-${d}`;
}

function getDateHeaderClass(dateStr) {
    const classes = [];
    if (isToday(dateStr)) classes.push('today-date');
    else if (isPastDate(dateStr)) classes.push('past-date');
    if (isOffDay(dateStr)) classes.push('weekly-off');
    return classes.join(' ');
}

function getAllocations(machineId, dateStr) {
    return allocations.value.filter(a => a.machine_id === machineId && a.operation_date === dateStr);
}

function getUsedMinutes(machineId, dateStr) {
    return getAllocations(machineId, dateStr).reduce((sum, a) => sum + a.allocated_minutes, 0);
}

function getCapacityPercentage(machineId, dateStr) {
    const used = getUsedMinutes(machineId, dateStr);
    const total = getEffectiveMinutes(dateStr, machineId);
    return total > 0 ? (used / total) * 100 : 0;
}

function getCapacityBarClass(machineId, dateStr) {
    const pct = getCapacityPercentage(machineId, dateStr);
    if (pct >= 95) return 'bar-ok';
    if (pct >= 40) return 'bar-warning';
    return 'bar-low';
}

function getCellClass(machineId, dateStr) {
    const used = getUsedMinutes(machineId, dateStr);
    const total = getEffectiveMinutes(dateStr, machineId);
    const hasConflicts = getAllocations(machineId, dateStr).some(a => hasConflict(a));

    const classes = [];
    if (hasConflicts) classes.push('cell-conflict');
    else if (used >= total) classes.push('cell-full');
    else if (used > 0) classes.push('cell-allocated');
    else classes.push('cell-available');

    if (isToday(dateStr)) classes.push('cell-today');
    else if (isPastDate(dateStr)) classes.push('cell-past');

    const badge = getCellAlterationBadge(dateStr, machineId);
    if (badge) {
        classes.push(badge.cls === 'badge-add' ? 'cell-altered-add' : 'cell-altered-reduce');
    }

    return classes.join(' ');
}


function hasConflict(alloc) {
    const item = workloadItems.value.find(i =>
        i.item === alloc.item &&
        i.colour === alloc.colour &&
        i.size === alloc.size
    );

    if (item) {
        const totalAllocated = getAllocatedQuantity(item);
        if (totalAllocated > item.quantity) {
            return true;
        }
    }

    return false;
}

const _colorPairs = [
    { border: '#2563eb', bg: '#bfdbfe' },
    { border: '#dc2626', bg: '#fecaca' },
    { border: '#059669', bg: '#a7f3d0' },
    { border: '#d97706', bg: '#fde68a' },
    { border: '#7c3aed', bg: '#ddd6fe' },
    { border: '#0891b2', bg: '#a5f3fc' },
    { border: '#db2777', bg: '#fbcfe8' },
    { border: '#4f46e5', bg: '#c7d2fe' },
    { border: '#ca8a04', bg: '#fef08a' },
    { border: '#0d9488', bg: '#99f6e4' },
];
const _colorMap = new Map();

function getAllocationColor(alloc) {
    const key = `${alloc.order || ''}-${alloc.item || ''}-${alloc.process || ''}`;
    if (!_colorMap.has(key)) {
        _colorMap.set(key, _colorMap.size % _colorPairs.length);
    }
    return _colorPairs[_colorMap.get(key)];
}

function getAllocatedQuantity(item) {
    const itemAllocs = allocations.value.filter(a =>
        a.order === selectedOrder.value &&
        a.item === item.item &&
        a.process === selectedProcess.value
    );
    if (itemAllocs.length === 0) return 0;

    // Detect this workload item's granularity
    const isItemWise = !item.colour && !item.size;
    const isColourWise = !!item.colour && !item.size;
    const isSizeWise = !item.colour && !!item.size;

    // Check if any allocations exist at a different granularity
    const hasDifferentGranularity = itemAllocs.some(a => {
        const allocIsItemWise = !a.colour && !a.size;
        const allocIsColourWise = !!a.colour && !a.size;
        const allocIsSizeWise = !a.colour && !!a.size;

        if (isItemWise) return !allocIsItemWise;
        if (isColourWise) return !allocIsColourWise;
        if (isSizeWise) return !allocIsSizeWise;
        return false;
    });

    if (hasDifferentGranularity) {
        // Different granularity exists — block this item by returning its full quantity
        return item.quantity;
    }

    // Same granularity — use exact match
    return itemAllocs
        .filter(a => a.colour === item.colour && a.size === item.size)
        .reduce((sum, a) => sum + a.quantity, 0);
}

function getAllocationStatus(item) {
    const allocated = getAllocatedQuantity(item);
    if (allocated >= item.quantity) return 'full';
    if (allocated > 0) return 'partial';
    return 'pending';
}

// === Gantt Grouping Helpers ===

function isNextDay(dateA, dateB) {
    const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const [y, m, d] = dateA.split('-').map(Number);
    let cursor = fmt(new Date(y, m - 1, d + 1));
    // Skip over off days between dateA and dateB
    while (cursor < dateB) {
        if (!isOffDay(cursor) && !isDefaultWeekdayOff(cursor)) return false;
        const [cy, cm, cd] = cursor.split('-').map(Number);
        cursor = fmt(new Date(cy, cm - 1, cd + 1));
    }
    return cursor === dateB;
}

function isGroupSplit(machineId, date1, date2) {
    return splitMarkers.value.has(`${machineId}|${date1}|${date2}`);
}

function addDaysToDate(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addWorkingDays(dateStr, count, machineId) {
    const dates = dateRange.value;
    const startIdx = dates.indexOf(dateStr);
    if (startIdx < 0) return null;

    const direction = count > 0 ? 1 : -1;
    let remaining = Math.abs(count);
    let idx = startIdx;

    while (remaining > 0) {
        idx += direction;
        if (idx < 0 || idx >= dates.length) return null;
        if (getEffectiveMinutes(dates[idx], machineId) > 0) {
            remaining--;
        }
    }
    return dates[idx];
}

function getNextWorkingDay(dateStr, machineId) {
    const dates = dateRange.value;
    let idx = dates.indexOf(dateStr);
    if (idx < 0) return null;
    while (++idx < dates.length) {
        if (getEffectiveMinutes(dates[idx], machineId) > 0) return dates[idx];
    }
    return null;
}

async function extendEndDate(newEndDate) {
    const oldEnd = endDate.value;
    suppressDateWatch.value = true;
    const fetchStart = addDaysToDate(oldEnd, 1);
    await Promise.all([
        loadShiftAllocationsForRange(fetchStart, newEndDate),
        loadAllocationsForRange(fetchStart, newEndDate)
    ]);
    endDate.value = newEndDate;
    if (endDateControl) endDateControl.set_value(newEndDate);
    await nextTick();
    await nextTick();
    suppressDateWatch.value = false;
}

function ensureWorkingDaysAvailable(fromDate, neededCount, machineId) {
    let available = 0;
    let scanDate = fromDate;
    while (scanDate) {
        if (getEffectiveMinutes(scanDate, machineId) > 0) available++;
        if (available >= neededCount) return;
        scanDate = getNextDate(scanDate);
    }
    // Not enough working days — extend endDate
    const shortfall = neededCount - available;
    extendEndDate(addDaysToDate(endDate.value, shortfall * 3));
}

function simulateGroupEnd(totalQty, minutesPerUnit, startDate, machineId) {
    if (totalQty <= 0 || minutesPerUnit <= 0) return startDate;
    const dates = dateRange.value;
    let remaining = totalQty;
    let lastActiveDate = startDate;
    let workDate = startDate;
    if (getEffectiveMinutes(workDate, machineId) <= 0) {
        workDate = getNextWorkingDay(addDaysToDate(workDate, -1), machineId);
    }
    if (!workDate) return startDate;
    while (remaining > 0 && workDate && dates.includes(workDate)) {
        const cap = getEffectiveMinutes(workDate, machineId);
        const maxQty = Math.floor(cap / minutesPerUnit);
        const allocQty = Math.min(remaining, Math.max(maxQty, 0));
        if (allocQty > 0) { lastActiveDate = workDate; remaining -= allocQty; }
        if (remaining <= 0) break;
        workDate = getNextWorkingDay(workDate, machineId);
    }
    return lastActiveDate;
}

function getGroupsForMachine(machineId) {
    return groupedAllocationsWithLanes.value.filter(g => g.machine_id === machineId);
}

function getLaneCount(machineId) {
    const groups = groupedAllocationsWithLanes.value.filter(g => g.machine_id === machineId);
    if (groups.length === 0) return 0;
    return Math.max(...groups.map(g => g.lane)) + 1;
}

function getBarLayerHeight(machineId) {
    const lanes = getLaneCount(machineId);
    if (lanes === 0) return 0;
    const h = isZoomedOut.value ? BAR_HEIGHT_ZOOM : BAR_HEIGHT;
    const offset = isZoomedOut.value ? 4 : BAR_TOP_OFFSET;
    return lanes * (h + BAR_GAP) + offset * 2;
}

function getBarStyle(group) {
    const dates = dateRange.value;
    const startIdx = dates.indexOf(group.start_date);
    const endIdx = dates.indexOf(group.end_date);

    if (startIdx < 0 || endIdx < 0) return { display: 'none' };

    const h = isZoomedOut.value ? BAR_HEIGHT_ZOOM : BAR_HEIGHT;
    const offset = isZoomedOut.value ? 4 : BAR_TOP_OFFSET;
    const cw = colWidth.value;
    const left = startIdx * cw + BAR_GAP;
    const width = (endIdx - startIdx + 1) * cw - BAR_GAP * 2;
    const top = (group.lane || 0) * (h + BAR_GAP) + offset;

    const colors = getAllocationColor(group);

    return {
        position: 'absolute',
        left: left + 'px',
        top: top + 'px',
        width: width + 'px',
        height: h + 'px',
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '4px',
        pointerEvents: 'auto',
    };
}

let tooltipTimer = null;
function showTooltip(event, group) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
        const rect = event.target.closest('.gantt-bar').getBoundingClientRect();
        tooltip.value = {
            show: true,
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            data: {
                item: group.item,
                process: group.process,
                order: group.order,
                start_date: group.start_date,
                end_date: group.end_date,
                days: group.allocs.length,
                total_quantity: group.total_quantity,
                total_minutes: group.total_minutes,
                colour: group.colour,
                size: group.size
            }
        };
    }, 350);
}

function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltip.value.show = false;
}

function isJustDropped(group) {
    return group.alloc_keys.some(k => droppedAllocKeys.value.has(k));
}

function onSnapAnimationEnd(group) {
    group.alloc_keys.forEach(k => droppedAllocKeys.value.delete(k));
}

function triggerSnapAnimation(allocKeys) {
    droppedAllocKeys.value = new Set(allocKeys);
}

// === Recently Deleted Blocks ===

function addDeletedBlock(group, allocSnapshots) {
    const firstAlloc = allocSnapshots[0];
    const totalQty = allocSnapshots.reduce((sum, a) => sum + a.quantity, 0);
    const minutesPerUnit = firstAlloc.quantity > 0
        ? firstAlloc.allocated_minutes / firstAlloc.quantity
        : 0;

    const blockId = `del-${Date.now()}`;
    deletedBlocks.value.unshift({
        id: blockId,
        item: firstAlloc.item,
        order: firstAlloc.order,
        process: firstAlloc.process,
        colour: firstAlloc.colour || null,
        size: firstAlloc.size || null,
        total_quantity: totalQty,
        minutes_per_unit: minutesPerUnit,
        machine_id: firstAlloc.machine_id,
        machine_gg: itemMachineGG.value.get(firstAlloc.item)
            || machines.value.find(m => m.machine_id === firstAlloc.machine_id)?.machine_gg
            || null,
        days: allocSnapshots.length,
        timestamp: Date.now()
    });
    return blockId;
}

function removeDeletedBlock(blockId) {
    const idx = deletedBlocks.value.findIndex(b => b.id === blockId);
    if (idx > -1) deletedBlocks.value.splice(idx, 1);
}

function removeMatchingDeletedBlocks(item, colour, size, order, process) {
    deletedBlocks.value = deletedBlocks.value.filter(b =>
        !(b.item === item && (b.colour || null) === (colour || null) && (b.size || null) === (size || null) && (b.order || null) === (order || null) && (b.process || null) === (process || null))
    );
}

function clearDeletedBlocks() {
    deletedBlocks.value = [];
}

function onDeletedBlockDragStart(event, block) {
    const dragData = {
        key: block.id,
        item: block.item,
        quantity: block.total_quantity,
        minutes: block.minutes_per_unit,
        colour: block.colour,
        size: block.size,
        machine_gg: block.machine_gg,
        order: block.order,
        process: block.process,
        isDeletedBlock: true,
        deletedBlockId: block.id
    };
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.setData('application/deleted-block', block.id);
    draggingItem.value = dragData;
}

// === One-Item-Per-Machine-Day Validation ===

function validateMachineDaySlot(machineId, date, excludeKeys = []) {
    return !allocations.value.some(a =>
        a.machine_id === machineId &&
        a.operation_date === date &&
        !excludeKeys.includes(a.key)
    );
}

// === Group Operations ===

function selectGroup(group) {
    selectedGroup.value = group;
}

function onGroupDragStart(event, group) {
    // Calculate grab offset: how many columns from bar start the cursor is
    const bar = event.target.closest('.gantt-bar');
    const grabOffsetDays = bar
        ? Math.floor((event.clientX - bar.getBoundingClientRect().left) / colWidth.value)
        : 0;

    event.dataTransfer.setData('application/gantt-group', JSON.stringify({
        group_id: group.group_id,
        machine_id: group.machine_id,
        start_date: group.start_date,
        end_date: group.end_date,
        alloc_keys: group.alloc_keys,
        item: group.item,
        process: group.process,
        order: group.order,
        colour: group.colour,
        size: group.size,
        total_quantity: group.total_quantity,
        total_minutes: group.total_minutes,
        grab_offset: grabOffsetDays,
    }));
    event.dataTransfer.effectAllowed = 'move';
    draggingItem.value = { item: group.item, sourceMachineId: group.machine_id };
    hideTooltip();
}

function onWorkloadDragOver(event) {
    // Only accept gantt-group drags (not workload items or deleted blocks)
    if (event.dataTransfer.types.includes('application/gantt-group')) {
        event.preventDefault();
    }
}

function onWorkloadDrop(event) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/gantt-group');
    if (!raw) return;

    const groupData = JSON.parse(raw);
    draggingItem.value = null;

    // Find the actual allocations by key
    const allocs = groupData.alloc_keys
        .map(key => allocations.value.find(a => a.key === key))
        .filter(Boolean);
    if (allocs.length === 0) return;

    const undoData = allocs.map(a => ({ ...a }));
    const machineId = groupData.machine_id;
    const gapStartDate = groupData.start_date;
    const deletedKeys = groupData.alloc_keys;

    // Remove from local state (needed for backfill gap computation)
    allocs.forEach(alloc => {
        const idx = allocations.value.findIndex(a => a.key === alloc.key);
        if (idx > -1) allocations.value.splice(idx, 1);
    });

    // Check for backfill candidates
    const { affected } = computeBackfillPlan(machineId, gapStartDate, deletedKeys);

    if (affected.length > 0) {
        backfillModalData.value = {
            machineId,
            deletedAllocations: undoData,
            deletedKeys,
            affectedAllocations: affected
        };
        showBackfillModal.value = true;
    } else {
        saveAction('delete_group', { allocations: undoData });
        const blockId = addDeletedBlock(null, undoData);
        actionHistory.value[actionHistory.value.length - 1].data.deletedBlockId = blockId;
        frappe.show_alert({ message: __(`Moved to recently deleted`), indicator: 'green' });
    }
}

function onBarContextMenu(event, group) {
    selectedGroup.value = group;
    contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY
    };
}

function executeMoveGroup(groupData, targetDays, newMachineId) {
    // Compute minutesPerUnit and total quantity from group totals
    const totalQty = targetDays.reduce((s, { alloc }) => s + alloc.quantity, 0);
    const totalMin = targetDays.reduce((s, { alloc }) => s + alloc.allocated_minutes, 0);
    const minutesPerUnit = totalQty > 0 ? totalMin / totalQty : 0;

    // Save undo data including old quantity/minutes (full snapshot for removed allocs)
    const undoData = targetDays.map(({ alloc }) => ({
        key: alloc.key,
        oldMachineId: alloc.machine_id,
        oldDate: alloc.operation_date,
        oldShift: alloc.shift,
        oldQuantity: alloc.quantity,
        oldAllocatedMinutes: alloc.allocated_minutes
    }));

    // Move all allocations to new positions first
    targetDays.forEach(({ alloc, newDate }) => {
        alloc.machine_id = newMachineId;
        alloc.operation_date = newDate;
        alloc.shift = getShiftForDate(newDate, newMachineId)?.name || '';
    });

    // Redistribute total quantity across target days based on each day's capacity
    let remaining = totalQty;
    const removedSnapshots = [];
    let lastPlacedDate = targetDays[0].newDate;

    for (const { alloc, newDate } of targetDays) {
        if (remaining <= 0 || minutesPerUnit <= 0) {
            // Save full snapshot before removing (for undo)
            const ud = undoData.find(u => u.key === alloc.key);
            removedSnapshots.push({
                key: alloc.key,
                machine_id: ud.oldMachineId,
                operation_date: ud.oldDate,
                shift: ud.oldShift,
                order: alloc.order,
                item: alloc.item,
                process: alloc.process,
                colour: alloc.colour,
                size: alloc.size,
                quantity: ud.oldQuantity,
                allocated_minutes: ud.oldAllocatedMinutes
            });
            const idx = allocations.value.findIndex(a => a.key === alloc.key);
            if (idx > -1) allocations.value.splice(idx, 1);
            continue;
        }

        const effectiveCap = getEffectiveMinutes(newDate, newMachineId);
        const maxQty = Math.floor(effectiveCap / minutesPerUnit);
        const allocQty = Math.min(remaining, maxQty);

        if (allocQty <= 0) {
            // No usable capacity on this day — remove the zombie allocation
            const ud = undoData.find(u => u.key === alloc.key);
            if (ud) {
                removedSnapshots.push({
                    key: alloc.key,
                    machine_id: ud.oldMachineId,
                    operation_date: ud.oldDate,
                    shift: ud.oldShift,
                    order: alloc.order, item: alloc.item, process: alloc.process,
                    colour: alloc.colour, size: alloc.size,
                    quantity: ud.oldQuantity,
                    allocated_minutes: ud.oldAllocatedMinutes
                });
            }
            const idx = allocations.value.findIndex(a => a.key === alloc.key);
            if (idx > -1) allocations.value.splice(idx, 1);
            continue;
        }

        alloc.quantity = allocQty;
        alloc.allocated_minutes = allocQty * minutesPerUnit;
        remaining -= allocQty;
        lastPlacedDate = newDate;
    }

    // Place overflow on subsequent available days if quantity remains
    const overflowKeys = [];
    if (remaining > 0 && minutesPerUnit > 0) {
        const lastTargetDate = lastPlacedDate;
        const allMovedKeys = targetDays.map(({ alloc }) => alloc.key);
        let currentDate = getNextDate(lastTargetDate);
        if (!currentDate && remaining > 0) {
            extendEndDate(addDaysToDate(endDate.value, Math.ceil(remaining * minutesPerUnit / 480) * 3));
            currentDate = getNextDate(lastTargetDate);
        }
        const refAlloc = targetDays[0].alloc;

        while (remaining > 0 && currentDate) {
            if (!isPastDate(currentDate) && validateMachineDaySlot(newMachineId, currentDate, allMovedKeys)) {
                const effectiveCap = getEffectiveMinutes(currentDate, newMachineId);
                const maxQty = Math.floor(effectiveCap / minutesPerUnit);
                const allocQty = Math.min(remaining, maxQty);

                if (allocQty > 0) {
                    const key = `${newMachineId}-${currentDate}-gmove-${Date.now()}-${overflowKeys.length}`;
                    const shift = getShiftForDate(currentDate, newMachineId);
                    allocations.value.push({
                        key,
                        machine_id: newMachineId,
                        operation_date: currentDate,
                        shift: shift?.name || '',
                        order: refAlloc.order,
                        item: refAlloc.item,
                        process: refAlloc.process,
                        colour: refAlloc.colour,
                        size: refAlloc.size,
                        quantity: allocQty,
                        allocated_minutes: allocQty * minutesPerUnit
                    });
                    overflowKeys.push(key);
                    remaining -= allocQty;
                }
            }
            currentDate = getNextDate(currentDate);
        }

        if (remaining > 0) {
            frappe.show_alert({
                message: __(`${remaining} units could not be placed (no available days)`),
                indicator: 'orange'
            });
        }
    }

    return { allocations: undoData, overflowKeys, removedSnapshots };
}

function moveGroup(groupData, newMachineId, newStartDate) {
    // Adjust drop date by grab offset so the block keeps its position relative to cursor
    const grabOffset = groupData.grab_offset || 0;
    if (grabOffset > 0) {
        const dates = dateRange.value;
        const dropIdx = dates.indexOf(newStartDate);
        const adjustedIdx = dropIdx - grabOffset;
        if (adjustedIdx >= 0) {
            newStartDate = dates[adjustedIdx];
        } else {
            newStartDate = dates[0]; // clamp to calendar start
        }
    }

    const oldStart = new Date(groupData.start_date);
    const newStart = new Date(newStartDate);
    const dayOffset = Math.round((newStart - oldStart) / (1000 * 60 * 60 * 24));

    if (dayOffset === 0 && groupData.machine_id === newMachineId) return;

    // Machine GG compatibility check
    if (!checkMachineGGCompat(groupData.item, groupData.machine_id, newMachineId)) return;

    const groupAllocs = groupData.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);

    if (groupAllocs.length === 0) {
        frappe.show_alert({ message: __('Group allocations not found'), indicator: 'red' });
        return;
    }

    // Sort allocs by date to ensure chronological assignment
    groupAllocs.sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    // Pack into consecutive working days from drop date (skip holidays)
    // Prevents mid-week gaps when original group spans weekends
    // Auto-extend calendar if not enough working days for the group
    ensureWorkingDaysAvailable(newStartDate, groupAllocs.length, newMachineId);

    const targetDays = [];
    let _nextDate = newStartDate;
    for (const alloc of groupAllocs) {
        while (_nextDate && getEffectiveMinutes(_nextDate, newMachineId) <= 0) {
            _nextDate = getNextDate(_nextDate);
        }
        if (!_nextDate) break;
        targetDays.push({ alloc, newDate: _nextDate });
        _nextDate = getNextDate(_nextDate);
    }

    const dates = dateRange.value;
    const newEndDate = targetDays[targetDays.length - 1].newDate;

    // Validate date range and past dates
    for (const { newDate } of targetDays) {
        if (!dates.includes(newDate)) {
            frappe.show_alert({ message: __('Move would place days outside calendar range'), indicator: 'red' });
            return;
        }
        if (isPastDate(newDate)) {
            frappe.show_alert({ message: __('Cannot move to past date'), indicator: 'red' });
            return;
        }
    }

    // Collect conflicting allocations on target machine
    const targetDateSet = new Set(targetDays.map(t => t.newDate));
    const conflicting = allocations.value.filter(a =>
        a.machine_id === newMachineId &&
        targetDateSet.has(a.operation_date) &&
        !groupData.alloc_keys.includes(a.key)
    );

    if (conflicting.length === 0) {
        // No conflicts - move directly
        const result = executeMoveGroup(groupData, targetDays, newMachineId);
        saveAction('move_group', { allocations: result.allocations, overflowKeys: result.overflowKeys, removedSnapshots: result.removedSnapshots });
        triggerSnapAnimation(groupData.alloc_keys);
        frappe.show_alert({ message: __('Group moved successfully'), indicator: 'green' });
        return;
    }

    // Check if the drop lands in the middle of a conflicting group (same machine only)
    // If moving to a different machine, intermediate-date check doesn't apply
    if (newMachineId === groupData.machine_id) {
        const machineGroups = groupedAllocations.value.filter(g =>
            g.machine_id === newMachineId && g.group_id !== groupData.group_id
        );
        for (const otherGroup of machineGroups) {
            // Check if the dragged group's new start is strictly inside another group
            if (newStartDate > otherGroup.start_date && newStartDate <= otherGroup.end_date) {
                frappe.show_alert({
                    message: __('Cannot drop in the middle of an existing group. Drop at the start of the group to cascade shift.'),
                    indicator: 'orange'
                });
                return;
            }
        }
    }

    // Cascading group push: shift entire conflicting groups forward
    const machineGroups = groupedAllocations.value
        .filter(g => g.machine_id === newMachineId && g.group_id !== groupData.group_id)
        .map(g => ({
            ...g,
            allocObjs: g.alloc_keys.map(k => allocations.value.find(a => a.key === k)).filter(Boolean)
        }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    const affected = [];
    let outOfBounds = false;
    const forwardPushGroups = [];

    // Always cascade forward — push conflicting groups toward the future
    // Uses consecutive working-day mapping to avoid splits from non-working day gaps
    {
        const primaryTotalQty = groupAllocs.reduce((s, a) => s + a.quantity, 0);
        const primaryTotalMin = groupAllocs.reduce((s, a) => s + a.allocated_minutes, 0);
        const primaryMPU = primaryTotalQty > 0 ? primaryTotalMin / primaryTotalQty : 0;
        const simulatedPrimaryEnd = simulateGroupEnd(primaryTotalQty, primaryMPU, targetDays[0].newDate, newMachineId);
        let currentEnd = simulatedPrimaryEnd;
        for (const otherGroup of machineGroups) {
            if (otherGroup.end_date < newStartDate) continue;
            if (otherGroup.start_date > currentEnd) break;

            const targetStart = addDaysToDate(currentEnd, 1);
            let workDate = targetStart;
            // Find first working day at or after targetStart
            if (!dates.includes(workDate) || getEffectiveMinutes(workDate, newMachineId) <= 0) {
                workDate = getNextWorkingDay(addDaysToDate(targetStart, -1), newMachineId);
            }
            if (!workDate) {
                outOfBounds = true;
                for (const alloc of otherGroup.allocObjs) {
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                }
                forwardPushGroups.push({
                    alloc_keys: otherGroup.alloc_keys.slice(),
                    targetStartDate: targetStart
                });
                continue;
            }

            let lastWorkDate = null;
            for (const alloc of otherGroup.allocObjs) {
                if (!workDate || !dates.includes(workDate)) {
                    outOfBounds = true;
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                } else if (isPastDate(workDate)) {
                    outOfBounds = true;
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                } else {
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: workDate });
                    lastWorkDate = workDate;
                    workDate = getNextWorkingDay(workDate, newMachineId);
                }
            }

            if (lastWorkDate && !outOfBounds) {
                const cgTotalQty = otherGroup.allocObjs.reduce((s, a) => s + a.quantity, 0);
                const cgTotalMin = otherGroup.allocObjs.reduce((s, a) => s + a.allocated_minutes, 0);
                const cgMPU = cgTotalQty > 0 ? cgTotalMin / cgTotalQty : 0;
                const cgEntries = affected.filter(e => otherGroup.alloc_keys.includes(e.allocation.key) && e.newDate);
                const cgStart = cgEntries.length > 0 ? cgEntries[0].newDate : null;
                if (cgStart && cgMPU > 0) {
                    currentEnd = simulateGroupEnd(cgTotalQty, cgMPU, cgStart, newMachineId);
                } else {
                    currentEnd = lastWorkDate;
                }
            }

            forwardPushGroups.push({
                alloc_keys: otherGroup.alloc_keys.slice(),
                targetStartDate: targetStart
            });
        }
    }

    if (outOfBounds) {
        frappe.show_alert({
            message: __('Cannot move: some groups would be pushed beyond the calendar date range. Extend end date first.'),
            indicator: 'red'
        });
        return;
    }

    // Build group-level summary for the modal
    const affectedGroups = [];
    const seenGroups = new Set();
    for (const entry of affected) {
        const grp = machineGroups.find(g => g.alloc_keys.includes(entry.allocation.key));
        if (grp && !seenGroups.has(grp.group_id)) {
            seenGroups.add(grp.group_id);
            const grpEntries = affected.filter(e => grp.alloc_keys.includes(e.allocation.key));
            const newDates = grpEntries.map(e => e.newDate).filter(Boolean).sort();
            const pushDays = newDates.length > 0
                ? Math.round((new Date(newDates[0]) - new Date(grp.start_date)) / (1000 * 60 * 60 * 24))
                : 0;
            affectedGroups.push({
                item: grp.item,
                order: grp.order,
                dayCount: grp.allocs.length,
                oldStart: grp.start_date,
                oldEnd: grp.end_date,
                newStart: newDates[0] || null,
                newEnd: newDates[newDates.length - 1] || null,
                pushDays: Math.abs(pushDays)
            });
        }
    }

    // Show shift modal for confirmation
    shiftModalData.value = {
        type: 'move_group',
        affectedAllocations: affected,
        affectedGroups,
        groupData,
        targetDays,
        targetMachineId: newMachineId,
        forwardPushGroups
    };
    showShiftModal.value = true;
}

function closeEditGroupModal() {
    showEditGroupModal.value = false;
}

function confirmEditGroup() {
    if (!selectedGroup.value) return;

    const newTotal = editGroupQuantity.value;
    const group = selectedGroup.value;
    const oldTotal = group.total_quantity;

    if (newTotal < 1) {
        frappe.show_alert({ message: __('Quantity must be at least 1'), indicator: 'red' });
        return;
    }

    const item = workloadItems.value.find(i =>
        i.item === group.item &&
        i.colour === group.colour &&
        i.size === group.size
    );
    if (item) {
        const currentAllocated = getAllocatedQuantity(item);
        const adjustment = newTotal - oldTotal;
        if (currentAllocated + adjustment > item.quantity) {
            frappe.show_alert({ message: __('Cannot exceed order quantity'), indicator: 'red' });
            return;
        }
    }

    const allocs = group.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);
    const ratio = newTotal / oldTotal;

    const undoData = allocs.map(a => ({ key: a.key, oldQty: a.quantity, oldMinutes: a.allocated_minutes }));

    let distributed = 0;
    allocs.forEach((alloc, idx) => {
        const minutesPerUnit = alloc.allocated_minutes / alloc.quantity;
        if (idx === allocs.length - 1) {
            alloc.quantity = newTotal - distributed;
        } else {
            alloc.quantity = Math.max(1, Math.round(alloc.quantity * ratio));
            distributed += alloc.quantity;
        }
        alloc.allocated_minutes = alloc.quantity * minutesPerUnit;
    });

    saveAction('edit_group', { allocations: undoData });
    frappe.show_alert({ message: __('Group quantity updated'), indicator: 'green' });
    closeEditGroupModal();
}

function closeSplitGroupModal() {
    showSplitGroupModal.value = false;
}

function confirmSplitGroup() {
    if (!selectedGroup.value || !splitGroupDate.value) return;

    const group = selectedGroup.value;
    const splitDate = splitGroupDate.value;

    const splitIdx = group.allocs.findIndex(a => a.operation_date === splitDate);
    if (splitIdx <= 0) {
        frappe.show_alert({ message: __('Invalid split date'), indicator: 'red' });
        return;
    }

    const prevDate = group.allocs[splitIdx - 1].operation_date;
    const markerKey = `${group.machine_id}|${prevDate}|${splitDate}`;

    splitMarkers.value.add(markerKey);

    saveAction('split_group', { markerKey });
    frappe.show_alert({ message: __('Group split successfully'), indicator: 'green' });
    closeSplitGroupModal();
}

function openShiftGroupByDaysModal() {
    if (!selectedGroup.value) return;
    shiftByDaysCount.value = 0;
    shiftByDaysPreview.value = null;
    showShiftByDaysModal.value = true;
    closeContextMenu();
}

function closeShiftByDaysModal() {
    showShiftByDaysModal.value = false;
    shiftByDaysPreview.value = null;
    shiftByDaysCount.value = 0;
}

function computeShiftByDaysPreview() {
    const dayOffset = shiftByDaysCount.value;
    if (!dayOffset || !selectedGroup.value) {
        shiftByDaysPreview.value = null;
        return;
    }

    const group = selectedGroup.value;
    const machineId = group.machine_id;
    const dates = dateRange.value;

    // Compute the primary group's new target dates using working days
    const groupAllocs = group.alloc_keys
        .map(key => allocations.value.find(a => a.key === key))
        .filter(Boolean);

    if (groupAllocs.length === 0) {
        shiftByDaysPreview.value = { error: 'Group allocations not found' };
        return;
    }

    // Sort group allocs by date
    const sortedAllocs = [...groupAllocs].sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    // Compute first alloc's new date using working days
    let firstNewDate = addWorkingDays(sortedAllocs[0].operation_date, dayOffset, machineId);
    if (!firstNewDate && dayOffset > 0) {
        extendEndDate(addDaysToDate(endDate.value, Math.abs(dayOffset) * 3));
        firstNewDate = addWorkingDays(sortedAllocs[0].operation_date, dayOffset, machineId);
    }
    if (!firstNewDate) {
        shiftByDaysPreview.value = { error: 'Shift would place days outside calendar range.' };
        return;
    }

    // Auto-extend calendar if not enough working days for the group
    ensureWorkingDaysAvailable(firstNewDate, sortedAllocs.length, machineId);

    // Lay out allocs on consecutive working days from firstNewDate
    const targetDays = [];
    let currentWorkDate = firstNewDate;
    for (const alloc of sortedAllocs) {
        if (!currentWorkDate || !dateRange.value.includes(currentWorkDate)) {
            ensureWorkingDaysAvailable(firstNewDate, sortedAllocs.length, machineId);
            currentWorkDate = getNextWorkingDay(targetDays[targetDays.length - 1].newDate, machineId);
            if (!currentWorkDate) {
                shiftByDaysPreview.value = { error: 'Not enough working days in calendar range.' };
                return;
            }
        }
        if (isPastDate(currentWorkDate)) {
            shiftByDaysPreview.value = { error: 'Cannot shift to past dates' };
            return;
        }
        targetDays.push({ alloc, newDate: currentWorkDate });
        if (alloc !== sortedAllocs[sortedAllocs.length - 1]) {
            currentWorkDate = getNextWorkingDay(currentWorkDate, machineId);
        }
    }

    const newStart = targetDays[0].newDate;

    // Simulate executeMoveGroup's capacity redistribution to find actual newEnd
    const totalQty = sortedAllocs.reduce((s, a) => s + a.quantity, 0);
    const totalMin = sortedAllocs.reduce((s, a) => s + a.allocated_minutes, 0);
    const minutesPerUnit = totalQty > 0 ? totalMin / totalQty : 0;

    let simRemaining = totalQty;
    let newEnd = newStart;

    // Phase 1: fill targetDays (mirrors executeMoveGroup main loop)
    for (const { newDate } of targetDays) {
        if (simRemaining <= 0) break;
        const cap = getEffectiveMinutes(newDate, machineId);
        const maxQty = minutesPerUnit > 0 ? Math.floor(cap / minutesPerUnit) : 0;
        const allocQty = Math.min(simRemaining, Math.max(maxQty, 0));
        if (allocQty > 0) newEnd = newDate;
        simRemaining -= allocQty;
    }

    // Phase 2: overflow onto subsequent working days (mirrors executeMoveGroup overflow loop)
    if (simRemaining > 0 && minutesPerUnit > 0) {
        let extendDate = getNextWorkingDay(targetDays[targetDays.length - 1].newDate, machineId);
        while (simRemaining > 0 && extendDate && dateRange.value.includes(extendDate)) {
            const cap = getEffectiveMinutes(extendDate, machineId);
            const maxQty = Math.floor(cap / minutesPerUnit);
            const allocQty = Math.min(simRemaining, Math.max(maxQty, 0));
            if (allocQty > 0) newEnd = extendDate;
            simRemaining -= allocQty;
            extendDate = getNextWorkingDay(extendDate, machineId);
        }
    }

    // Get all groups on this machine (from the computed groupedAllocations)
    const machineGroups = groupedAllocations.value
        .filter(g => g.machine_id === machineId && g.group_id !== group.group_id)
        .map(g => ({
            ...g,
            allocObjs: g.alloc_keys.map(k => allocations.value.find(a => a.key === k)).filter(Boolean)
        }))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    // Cascading push: simulate all group positions after the shift
    // Uses consecutive working-day mapping to avoid splits from non-working day gaps
    const affected = [];
    let outOfBounds = false;

    const groupShifts = new Map(); // group_id -> true (just tracking which were shifted)
    const backwardPullGroups = []; // groups pulled forward to fill gap (backward shift)
    const forwardPushGroups = []; // groups pushed forward via working-day mapping

    // Always cascade forward — push conflicting groups toward the future
    {
        let currentEnd = newEnd;

        for (const otherGroup of machineGroups) {
            if (otherGroup.end_date < newStart) continue;
            if (otherGroup.start_date > currentEnd) break;

            const targetStart = addDaysToDate(currentEnd, 1);
            let workDate = targetStart;
            // Find first working day at or after targetStart
            if (!dateRange.value.includes(workDate) || getEffectiveMinutes(workDate, machineId) <= 0) {
                workDate = getNextWorkingDay(addDaysToDate(targetStart, -1), machineId);
            }
            if (!workDate) {
                outOfBounds = true;
                for (const alloc of otherGroup.allocObjs) {
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                }
                groupShifts.set(otherGroup.group_id, true);
                forwardPushGroups.push({
                    alloc_keys: otherGroup.alloc_keys.slice(),
                    targetStartDate: targetStart
                });
                continue;
            }

            let lastWorkDate = null;
            for (const alloc of otherGroup.allocObjs) {
                if (!workDate || !dateRange.value.includes(workDate)) {
                    outOfBounds = true;
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                } else if (isPastDate(workDate)) {
                    outOfBounds = true;
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                } else {
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: workDate });
                    lastWorkDate = workDate;
                    workDate = getNextWorkingDay(workDate, machineId);
                }
            }

            if (lastWorkDate && !outOfBounds) {
                const cgTotalQty = otherGroup.allocObjs.reduce((s, a) => s + a.quantity, 0);
                const cgTotalMin = otherGroup.allocObjs.reduce((s, a) => s + a.allocated_minutes, 0);
                const cgMPU = cgTotalQty > 0 ? cgTotalMin / cgTotalQty : 0;
                const cgEntries = affected.filter(e => otherGroup.alloc_keys.includes(e.allocation.key) && e.newDate);
                const cgStart = cgEntries.length > 0 ? cgEntries[0].newDate : null;
                if (cgStart && cgMPU > 0) {
                    currentEnd = simulateGroupEnd(cgTotalQty, cgMPU, cgStart, machineId);
                } else {
                    currentEnd = lastWorkDate;
                }
            }

            groupShifts.set(otherGroup.group_id, true);
            forwardPushGroups.push({
                alloc_keys: otherGroup.alloc_keys.slice(),
                targetStartDate: targetStart
            });
        }

        // For backward shifts: pull subsequent groups forward to fill the gap
        if (dayOffset < 0) {
            for (const otherGroup of machineGroups) {
                if (groupShifts.has(otherGroup.group_id)) continue;
                if (otherGroup.start_date <= group.end_date) continue;

                const nextDayAfterEnd = addDaysToDate(currentEnd, 1);
                const nextDayIdx = dates.indexOf(nextDayAfterEnd);
                if (nextDayIdx < 0) break;

                const currentGroupIdx = dates.indexOf(otherGroup.start_date);
                const pullDays = currentGroupIdx - nextDayIdx;
                if (pullDays <= 0) {
                    currentEnd = otherGroup.end_date;
                    continue;
                }

                groupShifts.set(otherGroup.group_id, -pullDays);

                // Track for executeMoveGroup in confirmShiftByDays
                backwardPullGroups.push({
                    alloc_keys: otherGroup.alloc_keys.slice(),
                    targetStartDate: nextDayAfterEnd
                });

                const pulledEnd = addDaysToDate(otherGroup.end_date, -pullDays);
                if (!dates.includes(pulledEnd)) outOfBounds = true;

                for (const alloc of otherGroup.allocObjs) {
                    const nd = addDaysToDate(alloc.operation_date, -pullDays);
                    if (!dates.includes(nd)) {
                        outOfBounds = true;
                        affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                    } else if (isPastDate(nd)) {
                        outOfBounds = true;
                        affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                    } else {
                        affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: nd });
                    }
                }

                if (!outOfBounds) {
                    const pgTotalQty = otherGroup.allocObjs.reduce((s, a) => s + a.quantity, 0);
                    const pgTotalMin = otherGroup.allocObjs.reduce((s, a) => s + a.allocated_minutes, 0);
                    const pgMPU = pgTotalQty > 0 ? pgTotalMin / pgTotalQty : 0;
                    if (pgMPU > 0) {
                        currentEnd = simulateGroupEnd(pgTotalQty, pgMPU, nextDayAfterEnd, machineId);
                    } else {
                        currentEnd = pulledEnd;
                    }
                }
            }
        }
    }

    // Build group-level summary for the confirmation table
    const affectedGroups = [];
    const seenGroups = new Set();
    for (const entry of affected) {
        const grp = machineGroups.find(g => g.alloc_keys.includes(entry.allocation.key));
        if (grp && !seenGroups.has(grp.group_id)) {
            seenGroups.add(grp.group_id);
            const grpEntries = affected.filter(e => grp.alloc_keys.includes(e.allocation.key));
            const newDates = grpEntries.map(e => e.newDate).filter(Boolean).sort();
            const pushDays = newDates.length > 0
                ? Math.round((new Date(newDates[0]) - new Date(grp.start_date)) / (1000 * 60 * 60 * 24))
                : 0;
            affectedGroups.push({
                item: grp.item,
                order: grp.order,
                dayCount: grp.allocs.length,
                oldStart: grp.start_date,
                oldEnd: grp.end_date,
                newStart: newDates[0] || null,
                newEnd: newDates[newDates.length - 1] || null,
                pushDays: Math.abs(pushDays)
            });
        }
    }

    shiftByDaysPreview.value = { affected, affectedGroups, newStart, targetDays, outOfBounds, backwardPullGroups, forwardPushGroups };
}

function confirmShiftByDays() {
    if (!selectedGroup.value || !shiftByDaysPreview.value || shiftByDaysPreview.value.error || shiftByDaysPreview.value.outOfBounds) return;

    const group = selectedGroup.value;
    const preview = shiftByDaysPreview.value;
    const machineId = group.machine_id;

    // Collect forward-push and backward-pull keys — handled via executeMoveGroup, not simple shift
    const pushKeys = new Set();
    if (preview.forwardPushGroups?.length) {
        for (const pg of preview.forwardPushGroups) {
            pg.alloc_keys.forEach(k => pushKeys.add(k));
        }
    }
    const pullKeys = new Set();
    if (preview.backwardPullGroups?.length) {
        for (const pg of preview.backwardPullGroups) {
            pg.alloc_keys.forEach(k => pullKeys.add(k));
        }
    }

    // Shift only non-push/non-pull cascade allocs (if any remain)
    const shiftedAllocations = [];
    const shiftedAllocRefs = [];
    if (preview.affected.length > 0) {
        preview.affected.forEach(({ allocation, currentDate, newDate }) => {
            if (pushKeys.has(allocation.key) || pullKeys.has(allocation.key)) return; // handled by executeMoveGroup below
            shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
            allocation.operation_date = newDate;
            const newShift = getShiftForDate(newDate, allocation.machine_id);
            allocation.shift = newShift?.name || '';
            shiftedAllocRefs.push(allocation);
        });
    }

    const refitResult = refitShiftedAllocations(shiftedAllocRefs);

    // Build groupData for executeMoveGroup
    const groupData = {
        alloc_keys: group.alloc_keys,
        machine_id: machineId,
        start_date: group.start_date,
        end_date: group.end_date
    };

    // Process forward-push groups with executeMoveGroup BEFORE primary move
    // (they vacate the area the primary group is moving into)
    const pushMoveResults = [];
    if (preview.forwardPushGroups?.length) {
        const dates = dateRange.value;
        for (const pg of preview.forwardPushGroups) {
            const pushAllocs = pg.alloc_keys
                .map(k => allocations.value.find(a => a.key === k))
                .filter(Boolean)
                .sort((a, b) => a.operation_date.localeCompare(b.operation_date));
            if (pushAllocs.length === 0) continue;

            let workDate = pg.targetStartDate;
            if (!dates.includes(workDate) || getEffectiveMinutes(workDate, machineId) <= 0) {
                workDate = getNextWorkingDay(addDaysToDate(pg.targetStartDate, -1), machineId);
            }
            if (!workDate) continue;

            const pgTargetDays = [];
            for (const alloc of pushAllocs) {
                if (!workDate || !dates.includes(workDate)) break;
                pgTargetDays.push({ alloc, newDate: workDate });
                workDate = getNextWorkingDay(workDate, machineId);
            }
            if (pgTargetDays.length === 0) continue;

            const pgData = {
                alloc_keys: pg.alloc_keys,
                machine_id: machineId,
                start_date: pushAllocs[0].operation_date,
                end_date: pushAllocs[pushAllocs.length - 1].operation_date
            };
            pushMoveResults.push(executeMoveGroup(pgData, pgTargetDays, machineId));
        }
    }

    // Execute the primary group move (after forward-push groups vacated, before backward-pull)
    const moveResult = executeMoveGroup(groupData, preview.targetDays, machineId);

    // Process backward-pull groups with executeMoveGroup (after primary group vacated its dates)
    const pullMoveResults = [];
    if (preview.backwardPullGroups?.length) {
        const dates = dateRange.value;
        for (const pg of preview.backwardPullGroups) {
            const pullAllocs = pg.alloc_keys
                .map(k => allocations.value.find(a => a.key === k))
                .filter(Boolean)
                .sort((a, b) => a.operation_date.localeCompare(b.operation_date));
            if (pullAllocs.length === 0) continue;

            // Find first working day at or after targetStartDate
            let workDate = pg.targetStartDate;
            if (!dates.includes(workDate) || getEffectiveMinutes(workDate, machineId) <= 0) {
                workDate = getNextWorkingDay(addDaysToDate(pg.targetStartDate, -1), machineId);
            }
            if (!workDate) continue;

            // Build targetDays on consecutive working days
            const pgTargetDays = [];
            for (const alloc of pullAllocs) {
                if (!workDate || !dates.includes(workDate)) break;
                pgTargetDays.push({ alloc, newDate: workDate });
                workDate = getNextWorkingDay(workDate, machineId);
            }
            if (pgTargetDays.length === 0) continue;

            const pgData = {
                alloc_keys: pg.alloc_keys,
                machine_id: machineId,
                start_date: pullAllocs[0].operation_date,
                end_date: pullAllocs[pullAllocs.length - 1].operation_date
            };

            pullMoveResults.push(executeMoveGroup(pgData, pgTargetDays, machineId));
        }
    }

    if (shiftedAllocations.length > 0 || pushMoveResults.length > 0 || pullMoveResults.length > 0) {
        saveAction('shift_and_move_group', {
            moveAllocations: moveResult.allocations,
            overflowKeys: moveResult.overflowKeys,
            removedSnapshots: moveResult.removedSnapshots,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots,
            pushAllocations: pushMoveResults.flatMap(r => r.allocations),
            pushOverflowKeys: pushMoveResults.flatMap(r => r.overflowKeys),
            pushRemovedSnapshots: pushMoveResults.flatMap(r => r.removedSnapshots),
            pullAllocations: pullMoveResults.flatMap(r => r.allocations),
            pullOverflowKeys: pullMoveResults.flatMap(r => r.overflowKeys),
            pullRemovedSnapshots: pullMoveResults.flatMap(r => r.removedSnapshots)
        });
        const groupCount = new Set(preview.affected.map(a => {
            const g = groupedAllocations.value.find(grp => grp.alloc_keys.includes(a.allocation.key));
            return g?.group_id;
        })).size;
        frappe.show_alert({ message: __(`Shifted ${groupCount} group(s) and moved group by ${shiftByDaysCount.value} day(s)`), indicator: 'green' });
    } else {
        saveAction('move_group', { allocations: moveResult.allocations, overflowKeys: moveResult.overflowKeys, removedSnapshots: moveResult.removedSnapshots });
        frappe.show_alert({ message: __(`Group shifted by ${shiftByDaysCount.value} day(s)`), indicator: 'green' });
    }

    triggerSnapAnimation(group.alloc_keys);
    closeShiftByDaysModal();
}

function computeBackfillPlan(machineId, gapStartDate, deletedKeys) {
    const dates = dateRange.value;
    const gapStartIdx = dates.indexOf(gapStartDate);
    if (gapStartIdx < 0) return { affected: [] };

    // Get subsequent allocations on the same machine after the gap start
    const subsequent = allocations.value
        .filter(a => a.machine_id === machineId && a.operation_date >= gapStartDate && !deletedKeys.includes(a.key))
        .sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    if (subsequent.length === 0) return { affected: [] };

    // Build set of occupied dates (excluding subsequent allocs that might move)
    const subsequentKeys = new Set(subsequent.map(a => a.key));
    const occupiedDates = new Set();
    allocations.value.forEach(a => {
        if (a.machine_id === machineId && !subsequentKeys.has(a.key) && !deletedKeys.includes(a.key)) {
            occupiedDates.add(a.operation_date);
        }
    });

    const affected = [];
    subsequent.forEach(alloc => {
        // Search backward from gapStartDate for earliest available slot
        let placed = false;
        for (let i = gapStartIdx; i < dates.length; i++) {
            const d = dates[i];
            if (!occupiedDates.has(d) && !isPastDate(d)) {
                if (d !== alloc.operation_date) {
                    affected.push({
                        allocation: alloc,
                        currentDate: alloc.operation_date,
                        newDate: d
                    });
                }
                occupiedDates.add(d);
                placed = true;
                break;
            }
        }
        if (!placed) {
            occupiedDates.add(alloc.operation_date);
        }
    });

    return { affected };
}

function deleteGroup() {
    if (!selectedGroup.value) return;
    closeContextMenu();

    const group = selectedGroup.value;
    const allocs = group.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);

    const undoData = allocs.map(a => ({ ...a }));
    const machineId = group.machine_id;
    const gapStartDate = group.start_date;
    const deletedKeys = group.alloc_keys;

    // Remove from local state first (needed to compute backfill gaps)
    allocs.forEach(alloc => {
        const idx = allocations.value.findIndex(a => a.key === alloc.key);
        if (idx > -1) allocations.value.splice(idx, 1);
    });

    // Check for subsequent allocations that could backfill
    const { affected } = computeBackfillPlan(machineId, gapStartDate, deletedKeys);

    if (affected.length > 0) {
        backfillModalData.value = {
            machineId,
            deletedAllocations: undoData,
            deletedKeys,
            affectedAllocations: affected
        };
        showBackfillModal.value = true;
    } else {
        // No backfill candidates — confirm before finalizing
        frappe.confirm(
            __(`Delete group: ${group.allocs.length} day(s)?`),
            () => {
                // Confirmed
                saveAction('delete_group', { allocations: undoData });
                const blockId = addDeletedBlock(group, undoData);
                actionHistory.value[actionHistory.value.length - 1].data.deletedBlockId = blockId;
                frappe.show_alert({ message: __(`Deleted group: ${group.allocs.length} day(s)`), indicator: 'green' });
            },
            () => {
                // Cancelled — restore allocations
                undoData.forEach(a => allocations.value.push(a));
            }
        );
    }

    selectedGroup.value = null;
}

function confirmBackfill() {
    if (!backfillModalData.value) return;
    const bd = backfillModalData.value;

    const shiftedAllocations = [];
    const shiftedAllocRefs = [];
    bd.affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
        shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
        allocation.operation_date = newDate;
        const newShift = getShiftForDate(newDate, allocation.machine_id);
        allocation.shift = newShift?.name || '';
        shiftedAllocRefs.push(allocation);
    });

    const refitResult = refitShiftedAllocations(shiftedAllocRefs);

    saveAction('delete_group_and_backfill', {
        allocations: bd.deletedAllocations,
        shiftedAllocations,
        refitAddedKeys: refitResult.addedKeys,
        refitRemovedSnapshots: refitResult.removedSnapshots
    });
    const blockId = addDeletedBlock(null, bd.deletedAllocations);
    actionHistory.value[actionHistory.value.length - 1].data.deletedBlockId = blockId;
    frappe.show_alert({ message: __(`Deleted group and shifted ${shiftedAllocations.length} allocation(s) backward`), indicator: 'green' });
    closeBackfillModal();
}

function declineBackfill() {
    if (!backfillModalData.value) return;
    const bd = backfillModalData.value;

    saveAction('delete_group', { allocations: bd.deletedAllocations });
    const blockId = addDeletedBlock(null, bd.deletedAllocations);
    actionHistory.value[actionHistory.value.length - 1].data.deletedBlockId = blockId;
    frappe.show_alert({ message: __('Group deleted'), indicator: 'green' });
    closeBackfillModal();
}

function cancelDeleteGroup() {
    if (backfillModalData.value) {
        backfillModalData.value.deletedAllocations.forEach(a => {
            allocations.value.push(a);
        });
    }
    closeBackfillModal();
}

function closeBackfillModal() {
    showBackfillModal.value = false;
    backfillModalData.value = null;
}

// === Reflow After Shift Alteration ===

function autoReflowAfterAlteration(dateStr, machineId, alterationType, minutes) {
    // Determine affected machines
    const affectedMachines = machineId
        ? [machineId]
        : machines.value.map(m => m.machine_id);

    const allAdded = [];
    const allRemoved = [];
    const allModified = [];
    let totalUnplaced = 0;

    for (const mId of affectedMachines) {
        const cellAllocs = getAllocations(mId, dateStr);
        if (cellAllocs.length === 0) {
            // Off-day with new capacity: pull from subsequent groups
            // Only pull if the date is a genuine off-day (0 base shift minutes or
            // naturally off weekday per default calendar), not just a working day
            // where this machine has no allocations.
            if (alterationType === 'Add' && (getShiftMinutes(dateStr, mId) === 0 || isDefaultWeekdayOff(dateStr)) && getEffectiveMinutes(dateStr, mId) > 0) {
                let searchDate = getNextDate(dateStr);
                let refAlloc = null;
                while (searchDate && !refAlloc) {
                    const sa = getAllocations(mId, searchDate);
                    if (sa.length > 0) refAlloc = sa[0];
                    else searchDate = getNextDate(searchDate);
                }

                if (refAlloc) {
                    const mpu = refAlloc.quantity > 0 ? refAlloc.allocated_minutes / refAlloc.quantity : 0;
                    if (mpu > 0) {
                        // Capture old end date
                        const groupAllocs = allocations.value.filter(a =>
                            a.machine_id === mId && a.item === refAlloc.item &&
                            a.colour === refAlloc.colour && a.size === refAlloc.size &&
                            a.order === refAlloc.order && a.process === refAlloc.process
                        );
                        const oldEndDate = groupAllocs.reduce((latest, a) =>
                            !latest || a.operation_date > latest ? a.operation_date : latest, null);

                        // Pull back allocations into the off-day
                        const result = compactAfterPull(
                            mId, dateStr, refAlloc.item, refAlloc.colour, refAlloc.size,
                            refAlloc.order, refAlloc.process, mpu
                        );
                        allAdded.push(...result.addedKeys);
                        allRemoved.push(...result.removedKeys);
                        allModified.push(...result.modified);

                        // Shift subsequent groups left if end date shrunk
                        const groupAllocsAfter = allocations.value.filter(a =>
                            a.machine_id === mId && a.item === refAlloc.item &&
                            a.colour === refAlloc.colour && a.size === refAlloc.size &&
                            a.order === refAlloc.order && a.process === refAlloc.process
                        );
                        const newEndDate = groupAllocsAfter.reduce((latest, a) =>
                            !latest || a.operation_date > latest ? a.operation_date : latest, null);

                        if (newEndDate && oldEndDate > newEndDate) {
                            const dates = dateRange.value;
                            const freedDays = dates.indexOf(oldEndDate) - dates.indexOf(newEndDate);
                            if (freedDays > 0) {
                                const shiftResult = shiftSubsequentAllocsLeft(mId, newEndDate, freedDays);
                                allModified.push(...shiftResult.modified);
                                if (shiftResult.addedKeys) allAdded.push(...shiftResult.addedKeys);
                                if (shiftResult.removedSnapshots) allRemoved.push(...shiftResult.removedSnapshots);
                            }
                        }
                    }
                }
            }
            continue;
        }

        if (alterationType === 'Reduce') {
            const result = reflowForBreak(mId, dateStr);
            allAdded.push(...result.addedKeys);
            allRemoved.push(...result.removedKeys);
            allModified.push(...result.modified);
            totalUnplaced += result.unplaced;
        } else {
            // Capture group's current end date before reflow
            const cellAllocs = getAllocations(mId, dateStr);
            const refAlloc = cellAllocs[0];
            let oldEndDate = null;
            if (refAlloc) {
                const groupAllocs = allocations.value.filter(a =>
                    a.machine_id === mId &&
                    a.item === refAlloc.item && a.colour === refAlloc.colour &&
                    a.size === refAlloc.size && a.order === refAlloc.order &&
                    a.process === refAlloc.process
                );
                oldEndDate = groupAllocs.reduce((latest, a) => {
                    return !latest || a.operation_date > latest ? a.operation_date : latest;
                }, null);
            }

            const result = reflowForOvertime(mId, dateStr);
            allAdded.push(...result.addedKeys);
            allRemoved.push(...result.removedKeys);
            allModified.push(...result.modified);

            // Check if days were freed and shift subsequent groups left
            if (refAlloc && oldEndDate) {
                const groupAllocsAfter = allocations.value.filter(a =>
                    a.machine_id === mId &&
                    a.item === refAlloc.item && a.colour === refAlloc.colour &&
                    a.size === refAlloc.size && a.order === refAlloc.order &&
                    a.process === refAlloc.process
                );
                const newEndDate = groupAllocsAfter.reduce((latest, a) => {
                    return !latest || a.operation_date > latest ? a.operation_date : latest;
                }, null);

                if (newEndDate && oldEndDate > newEndDate) {
                    const dates = dateRange.value;
                    const freedDays = dates.indexOf(oldEndDate) - dates.indexOf(newEndDate);
                    if (freedDays > 0) {
                        const shiftResult = shiftSubsequentAllocsLeft(mId, newEndDate, freedDays);
                        allModified.push(...shiftResult.modified);
                        if (shiftResult.addedKeys) allAdded.push(...shiftResult.addedKeys);
                        if (shiftResult.removedSnapshots) allRemoved.push(...shiftResult.removedSnapshots);
                    }
                }
            }
        }
    }

    // Only save undo if something changed
    if (allAdded.length || allRemoved.length || allModified.length) {
        // Deduplicate modified entries (keep first snapshot per key)
        const seenMod = new Set();
        const dedupedModified = allModified.filter(m => {
            if (seenMod.has(m.key)) return false;
            seenMod.add(m.key);
            return true;
        });

        saveAction('alteration_reflow', {
            addedKeys: [...new Set(allAdded)],
            removedKeys: allRemoved,
            modified: dedupedModified
        });

        const parts = [];
        if (allAdded.length) parts.push(`${allAdded.length} created`);
        if (allRemoved.length) parts.push(`${allRemoved.length} removed`);
        if (allModified.length) parts.push(`${allModified.length} adjusted`);
        frappe.show_alert({
            message: __('Reflow complete: ' + parts.join(', ')),
            indicator: totalUnplaced > 0 ? 'orange' : 'green'
        });

        if (totalUnplaced > 0) {
            frappe.show_alert({
                message: __(`Warning: ${totalUnplaced} qty could not be placed`),
                indicator: 'orange'
            });
        }
    }
}

function reflowForBreak(machineId, dateStr) {
    const addedKeys = [];
    const removedKeys = [];
    const modified = [];
    let unplaced = 0;

    const effectiveCap = getEffectiveMinutes(dateStr, machineId);
    const cellAllocs = getAllocations(machineId, dateStr);
    const usedMin = cellAllocs.reduce((s, a) => s + a.allocated_minutes, 0);

    if (usedMin <= effectiveCap) {
        return { addedKeys, removedKeys, modified, unplaced };
    }

    // Need to trim excess
    let excess = usedMin - effectiveCap;

    // Process allocations in reverse order (trim from last added)
    const sorted = [...cellAllocs].sort((a, b) => b.key.localeCompare(a.key));

    for (const alloc of sorted) {
        if (excess <= 0) break;

        const minutesPerUnit = alloc.quantity > 0 ? alloc.allocated_minutes / alloc.quantity : 0;
        if (minutesPerUnit <= 0) continue;

        if (alloc.allocated_minutes <= excess) {
            // Remove entire allocation and spill all qty forward
            excess -= alloc.allocated_minutes;
            removedKeys.push({ ...alloc }); // snapshot
            const idx = allocations.value.findIndex(a => a.key === alloc.key);
            if (idx > -1) allocations.value.splice(idx, 1);

            const spillResult = spillForward(
                machineId, dateStr, alloc.quantity, minutesPerUnit,
                alloc.item, alloc.colour, alloc.size, alloc.order, alloc.process, 0
            );
            addedKeys.push(...spillResult.addedKeys);
            removedKeys.push(...spillResult.cascadedRemoved);
            modified.push(...spillResult.cascadedModified);
            unplaced += spillResult.remaining;
        } else {
            // Trim partial qty
            const trimMinutes = excess;
            const trimQty = Math.floor(trimMinutes / minutesPerUnit);
            if (trimQty < 1) continue;

            const actualTrimMin = trimQty * minutesPerUnit;
            modified.push({ key: alloc.key, oldQty: alloc.quantity, oldMinutes: alloc.allocated_minutes });
            alloc.quantity -= trimQty;
            alloc.allocated_minutes -= actualTrimMin;
            excess -= actualTrimMin;

            const spillResult = spillForward(
                machineId, dateStr, trimQty, minutesPerUnit,
                alloc.item, alloc.colour, alloc.size, alloc.order, alloc.process, 0
            );
            addedKeys.push(...spillResult.addedKeys);
            removedKeys.push(...spillResult.cascadedRemoved);
            modified.push(...spillResult.cascadedModified);
            unplaced += spillResult.remaining;
        }
    }

    return { addedKeys, removedKeys, modified, unplaced };
}

function spillForward(machineId, afterDateStr, qty, minutesPerUnit, item, colour, size, order, process, depth) {
    const MAX_CASCADE = 50;
    if (depth >= MAX_CASCADE || qty < MIN_BATCH_SIZE) {
        return { addedKeys: [], cascadedRemoved: [], cascadedModified: [], remaining: qty };
    }

    const addedKeys = [];
    const cascadedRemoved = [];
    const cascadedModified = [];
    let remaining = qty;
    let currentDate = getNextDate(afterDateStr);

    while (remaining >= MIN_BATCH_SIZE && currentDate) {
        const cellAllocs = getAllocations(machineId, currentDate);
        const effectiveCap = getEffectiveMinutes(currentDate, machineId);
        const usedMin = getUsedMinutes(machineId, currentDate);
        const availMin = effectiveCap - usedMin;

        // Check if same group exists on this day
        const sameGroup = cellAllocs.find(a =>
            a.item === item && a.colour === colour && a.size === size &&
            a.order === order && a.process === process
        );

        if (sameGroup) {
            // Increase existing allocation up to available capacity
            const canFitQty = Math.floor(availMin / minutesPerUnit);
            const addQty = Math.min(remaining, canFitQty);
            if (addQty >= MIN_BATCH_SIZE) {
                cascadedModified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
                sameGroup.quantity += addQty;
                sameGroup.allocated_minutes += addQty * minutesPerUnit;
                remaining -= addQty;
            }
            currentDate = getNextDate(currentDate);
            continue;
        }

        if (cellAllocs.length === 0) {
            // Empty day — create new allocation
            const canFitQty = Math.floor(effectiveCap / minutesPerUnit);
            const allocQty = Math.min(remaining, canFitQty);
            if (allocQty >= MIN_BATCH_SIZE) {
                const shift = getShiftForDate(currentDate, machineId);
                const key = `${machineId}-${currentDate}-reflow-${Date.now()}-${addedKeys.length}`;
                allocations.value.push({
                    key,
                    machine_id: machineId,
                    operation_date: currentDate,
                    shift: shift?.name || '',
                    order,
                    item,
                    process,
                    colour,
                    size,
                    quantity: allocQty,
                    allocated_minutes: allocQty * minutesPerUnit
                });
                addedKeys.push(key);
                remaining -= allocQty;
            }
            currentDate = getNextDate(currentDate);
            continue;
        }

        // Different group on this day — displace it forward, then place ours
        const occupant = cellAllocs[0];
        const occMinPerUnit = occupant.quantity > 0 ? occupant.allocated_minutes / occupant.quantity : 0;

        // Displace occupant forward
        cascadedRemoved.push({ ...occupant });
        const occQty = occupant.quantity;
        const idx = allocations.value.findIndex(a => a.key === occupant.key);
        if (idx > -1) allocations.value.splice(idx, 1);

        const cascadeResult = spillForward(
            machineId, currentDate, occQty, occMinPerUnit,
            occupant.item, occupant.colour, occupant.size, occupant.order, occupant.process, depth + 1
        );
        addedKeys.push(...cascadeResult.addedKeys);
        cascadedRemoved.push(...cascadeResult.cascadedRemoved);
        cascadedModified.push(...cascadeResult.cascadedModified);

        // Now place our qty on the freed day
        const canFitQty = Math.floor(effectiveCap / minutesPerUnit);
        const allocQty = Math.min(remaining, canFitQty);
        if (allocQty >= MIN_BATCH_SIZE) {
            const shift = getShiftForDate(currentDate, machineId);
            const key = `${machineId}-${currentDate}-reflow-${Date.now()}-${addedKeys.length}`;
            allocations.value.push({
                key,
                machine_id: machineId,
                operation_date: currentDate,
                shift: shift?.name || '',
                order,
                item,
                process,
                colour,
                size,
                quantity: allocQty,
                allocated_minutes: allocQty * minutesPerUnit
            });
            addedKeys.push(key);
            remaining -= allocQty;
        }

        if (cascadeResult.remaining > 0) {
            // Occupant couldn't be fully placed — count as unplaced
            remaining += cascadeResult.remaining;
        }

        currentDate = getNextDate(currentDate);
    }

    return { addedKeys, cascadedRemoved, cascadedModified, remaining };
}

function reflowForOvertime(machineId, dateStr) {
    const addedKeys = [];
    const removedKeys = [];
    const modified = [];

    const effectiveCap = getEffectiveMinutes(dateStr, machineId);
    const usedMin = getUsedMinutes(machineId, dateStr);
    const freeMin = effectiveCap - usedMin;

    if (freeMin <= 0) {
        return { addedKeys, removedKeys, modified };
    }

    // Find what's on this cell to determine the group identity
    const cellAllocs = getAllocations(machineId, dateStr);
    if (cellAllocs.length === 0) {
        return { addedKeys, removedKeys, modified };
    }

    const refAlloc = cellAllocs[0];
    const groupItem = refAlloc.item;
    const groupColour = refAlloc.colour;
    const groupSize = refAlloc.size;
    const groupOrder = refAlloc.order;
    const groupProcess = refAlloc.process;
    const minutesPerUnit = refAlloc.quantity > 0 ? refAlloc.allocated_minutes / refAlloc.quantity : 0;

    if (minutesPerUnit <= 0) {
        return { addedKeys, removedKeys, modified };
    }

    let freeCapacity = freeMin;

    // Look at subsequent days for same-group allocations to pull back
    let nextDate = getNextDate(dateStr);
    while (freeCapacity > 0 && nextDate) {
        const nextAllocs = getAllocations(machineId, nextDate);
        const sameGroup = nextAllocs.find(a =>
            a.item === groupItem && a.colour === groupColour && a.size === groupSize &&
            a.order === groupOrder && a.process === groupProcess
        );

        if (!sameGroup) {
            nextDate = getNextDate(nextDate);
            continue;
        }

        const canPullQty = Math.floor(freeCapacity / minutesPerUnit);
        if (canPullQty < MIN_BATCH_SIZE) break;

        const pullQty = Math.min(canPullQty, sameGroup.quantity);
        const pullMin = pullQty * minutesPerUnit;

        // Add to current day's allocation
        modified.push({ key: refAlloc.key, oldQty: refAlloc.quantity, oldMinutes: refAlloc.allocated_minutes });
        refAlloc.quantity += pullQty;
        refAlloc.allocated_minutes += pullMin;
        freeCapacity -= pullMin;

        // Reduce or remove from next day
        if (pullQty >= sameGroup.quantity) {
            // Remove entirely
            removedKeys.push({ ...sameGroup });
            const idx = allocations.value.findIndex(a => a.key === sameGroup.key);
            if (idx > -1) allocations.value.splice(idx, 1);

            // Compact: pull further allocations into the freed day
            const compactResult = compactAfterPull(
                machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
            );
            addedKeys.push(...compactResult.addedKeys);
            removedKeys.push(...compactResult.removedKeys);
            modified.push(...compactResult.modified);
        } else {
            modified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
            sameGroup.quantity -= pullQty;
            sameGroup.allocated_minutes -= pullMin;

            // Compact the partially-reduced day — pull from further days to fill freed capacity
            const compactResult = compactAfterPull(
                machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
            );
            addedKeys.push(...compactResult.addedKeys);
            removedKeys.push(...compactResult.removedKeys);
            modified.push(...compactResult.modified);
        }

        nextDate = getNextDate(nextDate);
    }

    return { addedKeys, removedKeys, modified };
}

function compactAfterPull(machineId, freedDateStr, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit) {
    const addedKeys = [];
    const removedKeys = [];
    const modified = [];

    const effectiveCap = getEffectiveMinutes(freedDateStr, machineId);
    let freeMin = effectiveCap - getUsedMinutes(machineId, freedDateStr);

    if (freeMin <= 0) return { addedKeys, removedKeys, modified };

    // Look further out for same-group allocations
    let nextDate = getNextDate(freedDateStr);
    while (freeMin > 0 && nextDate) {
        const nextAllocs = getAllocations(machineId, nextDate);
        const sameGroup = nextAllocs.find(a =>
            a.item === groupItem && a.colour === groupColour && a.size === groupSize &&
            a.order === groupOrder && a.process === groupProcess
        );

        if (!sameGroup) {
            nextDate = getNextDate(nextDate);
            continue;
        }

        const canPullQty = Math.floor(freeMin / minutesPerUnit);
        if (canPullQty < MIN_BATCH_SIZE) break;

        const pullQty = Math.min(canPullQty, sameGroup.quantity);
        const pullMin = pullQty * minutesPerUnit;

        // Create or augment allocation on freed day
        const freedAllocs = getAllocations(machineId, freedDateStr);
        const existingOnFreed = freedAllocs.find(a =>
            a.item === groupItem && a.colour === groupColour && a.size === groupSize &&
            a.order === groupOrder && a.process === groupProcess
        );

        if (existingOnFreed) {
            modified.push({ key: existingOnFreed.key, oldQty: existingOnFreed.quantity, oldMinutes: existingOnFreed.allocated_minutes });
            existingOnFreed.quantity += pullQty;
            existingOnFreed.allocated_minutes += pullMin;
        } else {
            const shift = getShiftForDate(freedDateStr, machineId);
            const key = `${machineId}-${freedDateStr}-compact-${Date.now()}-${addedKeys.length}`;
            allocations.value.push({
                key,
                machine_id: machineId,
                operation_date: freedDateStr,
                shift: shift?.name || '',
                order: groupOrder,
                item: groupItem,
                process: groupProcess,
                colour: groupColour,
                size: groupSize,
                quantity: pullQty,
                allocated_minutes: pullMin
            });
            addedKeys.push(key);
            freeMin -= pullMin;

            // Reduce or remove source
            if (pullQty >= sameGroup.quantity) {
                removedKeys.push({ ...sameGroup });
                const idx = allocations.value.findIndex(a => a.key === sameGroup.key);
                if (idx > -1) allocations.value.splice(idx, 1);
                // Recursively compact the emptied source day to prevent gaps
                const cascadeResult = compactAfterPull(
                    machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
                );
                addedKeys.push(...cascadeResult.addedKeys);
                removedKeys.push(...cascadeResult.removedKeys);
                modified.push(...cascadeResult.modified);
            } else {
                modified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
                sameGroup.quantity -= pullQty;
                sameGroup.allocated_minutes -= pullMin;
                // Recursively compact the partially-freed source day
                const cascadeResult = compactAfterPull(
                    machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
                );
                addedKeys.push(...cascadeResult.addedKeys);
                removedKeys.push(...cascadeResult.removedKeys);
                modified.push(...cascadeResult.modified);
            }

            nextDate = getNextDate(nextDate);
            continue;
        }

        freeMin -= pullMin;

        // Reduce or remove source
        if (pullQty >= sameGroup.quantity) {
            removedKeys.push({ ...sameGroup });
            const idx = allocations.value.findIndex(a => a.key === sameGroup.key);
            if (idx > -1) allocations.value.splice(idx, 1);
            // Recursively compact the emptied source day to prevent gaps
            const cascadeResult = compactAfterPull(
                machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
            );
            addedKeys.push(...cascadeResult.addedKeys);
            removedKeys.push(...cascadeResult.removedKeys);
            modified.push(...cascadeResult.modified);
        } else {
            modified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
            sameGroup.quantity -= pullQty;
            sameGroup.allocated_minutes -= pullMin;
            // Recursively compact the partially-freed source day
            const cascadeResult = compactAfterPull(
                machineId, nextDate, groupItem, groupColour, groupSize, groupOrder, groupProcess, minutesPerUnit
            );
            addedKeys.push(...cascadeResult.addedKeys);
            removedKeys.push(...cascadeResult.removedKeys);
            modified.push(...cascadeResult.modified);
        }

        nextDate = getNextDate(nextDate);
    }

    return { addedKeys, removedKeys, modified };
}

function shiftSubsequentAllocsLeft(machineId, afterDate, dayOffset) {
    const modified = [];
    const dates = dateRange.value;
    const afterIdx = dates.indexOf(afterDate);
    if (afterIdx < 0 || dayOffset <= 0) return { modified };

    // Find all allocations on this machine with operation_date after afterDate
    const subsequent = allocations.value.filter(a =>
        a.machine_id === machineId && dates.indexOf(a.operation_date) > afterIdx
    );

    // Sort by date index ascending so we shift in order
    subsequent.sort((a, b) => dates.indexOf(a.operation_date) - dates.indexOf(b.operation_date));

    for (const alloc of subsequent) {
        const currentIdx = dates.indexOf(alloc.operation_date);
        const targetIdx = currentIdx - dayOffset;

        // Guard: don't shift into or before afterDate, don't go negative
        if (targetIdx < 0 || targetIdx <= afterIdx) continue;

        const oldDate = alloc.operation_date;
        const oldShift = alloc.shift;
        const newDate = dates[targetIdx];
        const newShift = getShiftForDate(newDate, machineId);

        modified.push({
            key: alloc.key,
            oldQty: alloc.quantity,
            oldMinutes: alloc.allocated_minutes,
            oldDate,
            oldShift
        });

        alloc.operation_date = newDate;
        alloc.shift = newShift?.name || '';
    }

    // Refit shifted allocations to new date capacities
    const refitResult = refitShiftedAllocations(subsequent);

    return { modified, addedKeys: refitResult.addedKeys, removedSnapshots: refitResult.removedSnapshots };
}

function refitShiftedAllocations(movedAllocs) {
    const addedKeys = [];
    const removedSnapshots = [];

    // Group by identity (machine/item/colour/size/order/process)
    const groups = new Map();
    for (const alloc of movedAllocs) {
        const gk = `${alloc.machine_id}|${alloc.item}|${alloc.colour}|${alloc.size}|${alloc.order}|${alloc.process}`;
        if (!groups.has(gk)) groups.set(gk, []);
        groups.get(gk).push(alloc);
    }

    for (const [, groupAllocs] of groups) {
        groupAllocs.sort((a, b) => a.operation_date.localeCompare(b.operation_date));

        const totalQty = groupAllocs.reduce((s, a) => s + a.quantity, 0);
        const totalMin = groupAllocs.reduce((s, a) => s + a.allocated_minutes, 0);
        const mpu = totalQty > 0 ? totalMin / totalQty : 0;
        if (mpu <= 0) continue;

        let remaining = totalQty;
        const toRemove = [];
        let lastKeptDate = null;

        for (const alloc of groupAllocs) {
            if (remaining < MIN_BATCH_SIZE) { toRemove.push(alloc); continue; }
            const cap = getEffectiveMinutes(alloc.operation_date, alloc.machine_id);
            const fittingQty = Math.floor(cap / mpu);
            const allocQty = Math.min(remaining, Math.max(fittingQty, 0));

            if (allocQty >= MIN_BATCH_SIZE) {
                alloc.quantity = allocQty;
                alloc.allocated_minutes = allocQty * mpu;
                remaining -= allocQty;
                lastKeptDate = alloc.operation_date;
            } else {
                toRemove.push(alloc);
            }
        }

        for (const alloc of toRemove) {
            removedSnapshots.push({ ...alloc });
            const idx = allocations.value.findIndex(a => a.key === alloc.key);
            if (idx > -1) allocations.value.splice(idx, 1);
        }

        if (remaining >= MIN_BATCH_SIZE) {
            const startDate = lastKeptDate ? getNextDate(lastKeptDate) : groupAllocs[0].operation_date;
            if (startDate) {
                const ref = groupAllocs[0];
                const result = executeAutoSplit(
                    ref.machine_id, startDate, remaining, mpu,
                    ref.item, ref.colour, ref.size, ref.order, ref.process
                );
                addedKeys.push(...result.allocationKeys);
            }
        }
    }

    return { addedKeys, removedSnapshots };
}

function simulateAutoSplit(machineId, startDateStr, totalQty, minutesPerUnit) {
    const plan = [];
    let remaining = totalQty;
    let currentDate = startDateStr;
    let isFirstDay = true;

    while (remaining >= MIN_BATCH_SIZE && currentDate) {
        // Skip occupied days (first day already validated by caller)
        if (!isFirstDay && !validateMachineDaySlot(machineId, currentDate)) {
            currentDate = getNextDate(currentDate);
            continue;
        }

        const totalMin = getEffectiveMinutes(currentDate, machineId);
        let availMin;
        if (isFirstDay) {
            const usedMin = getUsedMinutes(machineId, currentDate);
            availMin = totalMin - usedMin;
            isFirstDay = false;
        } else {
            availMin = totalMin;
        }

        if (availMin > 0) {
            const fitQty = Math.floor(availMin / minutesPerUnit);
            const allocQty = Math.min(remaining, fitQty);
            if (allocQty >= MIN_BATCH_SIZE) {
                plan.push({
                    dateStr: currentDate,
                    allocQty,
                    allocMinutes: allocQty * minutesPerUnit
                });
                remaining -= allocQty;
            }
        }
        currentDate = getNextDate(currentDate);
    }
    return plan;
}

function simulateAutoSplitForced(machineId, startDateStr, totalQty, minutesPerUnit) {
    // Like simulateAutoSplit but places contiguously — does NOT skip occupied days
    const plan = [];
    let remaining = totalQty;
    let currentDate = startDateStr;

    while (remaining >= MIN_BATCH_SIZE && currentDate) {
        const totalMin = getEffectiveMinutes(currentDate, machineId);
        if (totalMin > 0) {
            const fitQty = Math.floor(totalMin / minutesPerUnit);
            const allocQty = Math.min(remaining, fitQty);
            if (allocQty >= MIN_BATCH_SIZE) {
                plan.push({
                    dateStr: currentDate,
                    allocQty,
                    allocMinutes: allocQty * minutesPerUnit
                });
                remaining -= allocQty;
            }
        }
        currentDate = getNextDate(currentDate);
    }
    return plan;
}

function computeShiftPlanForOverlap(machineId, forcedPlan) {
    const dates = dateRange.value;
    const forcedDates = new Set(forcedPlan.map(p => p.dateStr));

    // Find existing allocations on the forced plan dates
    const overlapping = allocations.value
        .filter(a => a.machine_id === machineId && forcedDates.has(a.operation_date))
        .sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    if (overlapping.length === 0) return { affected: [], hasOverlap: false };

    // Find the last date of the forced plan
    const lastPlanDate = forcedPlan[forcedPlan.length - 1].dateStr;
    const lastPlanIdx = dates.indexOf(lastPlanDate);

    // Build occupied set: forced plan dates + other allocations on this machine
    const occupiedDates = new Set();
    forcedDates.forEach(d => occupiedDates.add(d));
    allocations.value.forEach(a => {
        if (a.machine_id === machineId && !overlapping.some(o => o.key === a.key)) {
            occupiedDates.add(a.operation_date);
        }
    });

    const affected = [];
    overlapping.forEach(alloc => {
        let placed = false;
        for (let i = lastPlanIdx + 1; i < dates.length; i++) {
            const d = dates[i];
            if (!occupiedDates.has(d) && !isPastDate(d)) {
                affected.push({
                    allocation: alloc,
                    currentDate: alloc.operation_date,
                    newDate: d
                });
                occupiedDates.add(d);
                placed = true;
                break;
            }
        }
        if (!placed) {
            affected.push({
                allocation: alloc,
                currentDate: alloc.operation_date,
                newDate: null
            });
        }
    });

    return { affected, hasOverlap: true };
}

function computeShiftPlan(machineId, dropDateStr, workloadPlan, excludeKey = null) {
    const remaining = {};
    const dates = dateRange.value;
    const dropIdx = dates.indexOf(dropDateStr);
    if (dropIdx < 0) return { affected: [] };

    for (let i = dropIdx + 1; i < dates.length; i++) {
        const d = dates[i];
        remaining[d] = getEffectiveMinutes(d, machineId);
    }

    workloadPlan.forEach(p => {
        if (p.dateStr !== dropDateStr && remaining[p.dateStr] !== undefined) {
            remaining[p.dateStr] -= p.allocMinutes;
        }
    });

    const displaced = allocations.value
        .filter(a => a.machine_id === machineId && a.operation_date > dropDateStr && a.key !== excludeKey)
        .sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    if (displaced.length === 0) return { affected: [] };

    const affected = [];
    displaced.forEach(a => {
        const allocIdx = dates.indexOf(a.operation_date);
        if (allocIdx < 0) return;

        let placed = false;
        for (let i = allocIdx; i < dates.length; i++) {
            const d = dates[i];
            if (remaining[d] === undefined) continue;
            if (remaining[d] >= a.allocated_minutes) {
                remaining[d] -= a.allocated_minutes;
                if (d !== a.operation_date) {
                    affected.push({
                        allocation: a,
                        currentDate: a.operation_date,
                        newDate: d
                    });
                }
                placed = true;
                break;
            }
        }
        if (!placed) {
            affected.push({
                allocation: a,
                currentDate: a.operation_date,
                newDate: null
            });
        }
    });

    return { affected };
}

function executeAutoSplit(machineId, startDate, qty, minutesPerUnit, item, colour, size, order, process) {
    const allocOrder = order || selectedOrder.value;
    const allocProcess = process || selectedProcess.value;
    let remainingQty = qty;
    let currentDate = startDate;
    let allocationsMade = 0;
    const allocationKeys = [];

    while (remainingQty >= MIN_BATCH_SIZE && currentDate) {
        // One-item-per-machine-day: skip occupied days
        if (!validateMachineDaySlot(machineId, currentDate)) {
            currentDate = getNextDate(currentDate);
            continue;
        }

        const shift = getShiftForDate(currentDate, machineId);
        const usedMin = getUsedMinutes(machineId, currentDate);
        const totalMin = getEffectiveMinutes(currentDate, machineId);
        const availMin = totalMin - usedMin;

        if (availMin <= 0) {
            currentDate = getNextDate(currentDate);
            continue;
        }

        const fitQty = Math.floor(availMin / minutesPerUnit);
        const allocQty = Math.min(remainingQty, fitQty);

        if (allocQty >= MIN_BATCH_SIZE) {
            const key = `${machineId}-${currentDate}-${Date.now()}-${allocationsMade}`;
            allocations.value.push({
                key,
                machine_id: machineId,
                operation_date: currentDate,
                shift: shift?.name || '',
                order: allocOrder,
                item,
                process: allocProcess,
                colour,
                size,
                quantity: allocQty,
                allocated_minutes: allocQty * minutesPerUnit
            });
            allocationKeys.push(key);
            remainingQty -= allocQty;
            allocationsMade++;
        }

        currentDate = getNextDate(currentDate);
    }

    return { allocationKeys, allocationsMade, remainingQty };
}

// Save action to history for undo
function saveAction(type, data) {
    actionHistory.value.push({ type, data, timestamp: Date.now() });
    if (actionHistory.value.length > 20) {
        actionHistory.value.shift();
    }
    redoHistory.value = [];
}

function undoLastAction() {
    if (actionHistory.value.length === 0) return;
    const action = actionHistory.value.pop();

    const snapshot = {
        allocations: JSON.parse(JSON.stringify(allocations.value)),
        splitMarkers: new Set(splitMarkers.value)
    };
    redoHistory.value.push({ action, snapshot });
    if (redoHistory.value.length > 20) {
        redoHistory.value.shift();
    }

    switch (action.type) {
        case 'add':
            action.data.keys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            break;
        case 'move':
            {
                const alloc = allocations.value.find(a => a.key === action.data.key);
                if (alloc) {
                    alloc.machine_id = action.data.oldMachineId;
                    alloc.operation_date = action.data.oldDate;
                }
            }
            break;
        case 'delete':
            allocations.value.push(action.data.allocation);
            break;
        case 'partial_move':
            {
                const pmSrc = allocations.value.find(a => a.key === action.data.sourceKey);
                if (pmSrc) {
                    pmSrc.quantity += action.data.movedQty;
                    pmSrc.allocated_minutes += action.data.movedMinutes;
                }
                const pmIdx = allocations.value.findIndex(a => a.key === action.data.newKey);
                if (pmIdx > -1) allocations.value.splice(pmIdx, 1);
            }
            break;
        case 'shift_and_add':
            action.data.addedKeys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            if (action.data.refitAddedKeys) {
                action.data.refitAddedKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.refitRemovedSnapshots) {
                action.data.refitRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                    if (oldQuantity !== undefined) a.quantity = oldQuantity;
                    if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                }
            });
            break;
        case 'shift_and_move':
            action.data.addedKeys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            if (action.data.refitAddedKeys) {
                action.data.refitAddedKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.refitRemovedSnapshots) {
                action.data.refitRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                    if (oldQuantity !== undefined) a.quantity = oldQuantity;
                    if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                }
            });
            if (action.data.sourceRemoved) {
                if (action.data.sourceSnapshot) {
                    allocations.value.push(action.data.sourceSnapshot);
                }
            } else {
                const src = allocations.value.find(a => a.key === action.data.sourceKey);
                if (src) {
                    src.quantity += action.data.movedQty;
                    src.allocated_minutes += action.data.movedMinutes;
                }
            }
            break;
        case 'move_group':
            // Remove overflow allocations first
            if (action.data.overflowKeys?.length) {
                action.data.overflowKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            // Re-add removed allocations (consolidated days that were eliminated)
            if (action.data.removedSnapshots?.length) {
                action.data.removedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            // Restore original position, quantity, and minutes
            action.data.allocations.forEach(({ key, oldMachineId, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.machine_id = oldMachineId;
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                    if (oldQuantity !== undefined) a.quantity = oldQuantity;
                    if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                }
            });
            break;
        case 'shift_and_move_group':
            // Undo backward-pull group moves first (last operations done, first to undo)
            if (action.data.pullOverflowKeys?.length) {
                action.data.pullOverflowKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.pullRemovedSnapshots?.length) {
                action.data.pullRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            if (action.data.pullAllocations?.length) {
                action.data.pullAllocations.forEach(({ key, oldMachineId, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                    const a = allocations.value.find(al => al.key === key);
                    if (a) {
                        a.machine_id = oldMachineId;
                        a.operation_date = oldDate;
                        a.shift = oldShift || '';
                        if (oldQuantity !== undefined) a.quantity = oldQuantity;
                        if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                    }
                });
            }
            // Remove primary group overflow allocations
            if (action.data.overflowKeys?.length) {
                action.data.overflowKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            // Re-add removed allocations (consolidated days that were eliminated)
            if (action.data.removedSnapshots?.length) {
                action.data.removedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            // Undo forward-push group moves (executed before primary, undone after primary)
            if (action.data.pushOverflowKeys?.length) {
                action.data.pushOverflowKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.pushRemovedSnapshots?.length) {
                action.data.pushRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            if (action.data.pushAllocations?.length) {
                action.data.pushAllocations.forEach(({ key, oldMachineId, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                    const a = allocations.value.find(al => al.key === key);
                    if (a) {
                        a.machine_id = oldMachineId;
                        a.operation_date = oldDate;
                        a.shift = oldShift || '';
                        if (oldQuantity !== undefined) a.quantity = oldQuantity;
                        if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                    }
                });
            }
            // Undo refit: remove spill allocations and restore removed allocs
            if (action.data.refitAddedKeys) {
                action.data.refitAddedKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.refitRemovedSnapshots) {
                action.data.refitRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            // Reverse shifted allocations with quantity/minutes restoration
            if (action.data.shiftedAllocations?.length) {
                action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                    const a = allocations.value.find(al => al.key === key);
                    if (a) {
                        a.operation_date = oldDate;
                        a.shift = oldShift || '';
                        if (oldQuantity !== undefined) a.quantity = oldQuantity;
                        if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                    }
                });
            }
            // Then reverse group move with quantity/minutes restoration
            action.data.moveAllocations.forEach(({ key, oldMachineId, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.machine_id = oldMachineId;
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                    if (oldQuantity !== undefined) a.quantity = oldQuantity;
                    if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                }
            });
            break;
        case 'delete_group':
            action.data.allocations.forEach(a => {
                allocations.value.push(a);
            });
            if (action.data.deletedBlockId) {
                removeDeletedBlock(action.data.deletedBlockId);
            }
            break;
        case 'delete_group_and_backfill':
            // Undo refit: remove spill allocations and restore removed allocs
            if (action.data.refitAddedKeys) {
                action.data.refitAddedKeys.forEach(key => {
                    const idx = allocations.value.findIndex(a => a.key === key);
                    if (idx > -1) allocations.value.splice(idx, 1);
                });
            }
            if (action.data.refitRemovedSnapshots) {
                action.data.refitRemovedSnapshots.forEach(snap => allocations.value.push(snap));
            }
            // Reverse shifted allocations with quantity/minutes restoration
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift, oldQuantity, oldAllocatedMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                    if (oldQuantity !== undefined) a.quantity = oldQuantity;
                    if (oldAllocatedMinutes !== undefined) a.allocated_minutes = oldAllocatedMinutes;
                }
            });
            // Then restore deleted allocations
            action.data.allocations.forEach(a => {
                allocations.value.push(a);
            });
            if (action.data.deletedBlockId) {
                removeDeletedBlock(action.data.deletedBlockId);
            }
            break;
        case 'edit_group':
            action.data.allocations.forEach(({ key, oldQty, oldMinutes }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.quantity = oldQty;
                    a.allocated_minutes = oldMinutes;
                }
            });
            break;
        case 'split_group':
            splitMarkers.value.delete(action.data.markerKey);
            break;
        case 'alteration_reflow':
            // Remove all newly created allocations
            action.data.addedKeys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            // Restore removed allocations (full snapshots)
            action.data.removedKeys.forEach(snapshot => {
                allocations.value.push(snapshot);
            });
            // Restore modified allocations to their old qty/minutes/date/shift
            action.data.modified.forEach(({ key, oldQty, oldMinutes, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    if (oldQty !== undefined) a.quantity = oldQty;
                    if (oldMinutes !== undefined) a.allocated_minutes = oldMinutes;
                    if (oldDate !== undefined) a.operation_date = oldDate;
                    if (oldShift !== undefined) a.shift = oldShift;
                }
            });
            break;
    }

    frappe.show_alert({ message: __('Action undone'), indicator: 'blue' });
}

function redoLastAction() {
    if (redoHistory.value.length === 0) return;
    const { action, snapshot } = redoHistory.value.pop();
    allocations.value = snapshot.allocations;
    splitMarkers.value = snapshot.splitMarkers;
    actionHistory.value.push(action);
    frappe.show_alert({ message: __('Action redone'), indicator: 'blue' });
}

// Auto-scroll during drag
function autoScrollDuringDrag(event) {
    const wrapper = document.querySelector('.calendar-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();

    // Use clientHeight/clientWidth — these exclude scrollbar dimensions
    const contentBottom = rect.top + wrapper.clientHeight;
    const contentRight = rect.left + wrapper.clientWidth;

    autoScrollDY = 0;
    autoScrollDX = 0;
    if (event.clientY < rect.top + SCROLL_EDGE_ZONE) autoScrollDY = -SCROLL_SPEED;
    else if (event.clientY > contentBottom - SCROLL_EDGE_ZONE) autoScrollDY = SCROLL_SPEED;
    if (event.clientX < rect.left + SCROLL_EDGE_ZONE) autoScrollDX = -SCROLL_SPEED;
    else if (event.clientX > contentRight - SCROLL_EDGE_ZONE) autoScrollDX = SCROLL_SPEED;

    if (autoScrollDX === 0 && autoScrollDY === 0) {
        stopAutoScroll();
        return;
    }

    if (!autoScrollRAF) {
        const step = () => {
            wrapper.scrollLeft += autoScrollDX;
            wrapper.scrollTop += autoScrollDY;
            autoScrollRAF = requestAnimationFrame(step);
        };
        autoScrollRAF = requestAnimationFrame(step);
    }
}

function stopAutoScroll() {
    if (autoScrollRAF) {
        cancelAnimationFrame(autoScrollRAF);
        autoScrollRAF = null;
    }
}

function onWrapperDragOver(event) {
    autoScrollDuringDrag(event);
}

// Drag and Drop
function onCellDragOver(event, machineId) {
    if (isMachineCompatible(machineId)) {
        event.preventDefault(); // allow drop only on compatible machines
    }
    autoScrollDuringDrag(event);
}

function onDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
    draggingItem.value = item;
}

function onDragEnd() {
    draggingItem.value = null;
    stopAutoScroll();
}

function getNextDate(currentDateStr) {
    const dates = dateRange.value;
    const idx = dates.indexOf(currentDateStr);
    if (idx >= 0 && idx < dates.length - 1) {
        return dates[idx + 1];
    }
    return null;
}

function onBarDrop(event, machineId) {
    // Resolve the drop position to a date column using the bar layer's coordinate space
    const barLayer = event.target.closest('.gantt-bar-layer');
    if (!barLayer) return;
    const layerRect = barLayer.getBoundingClientRect();
    const xInLayer = event.clientX - layerRect.left;
    const dateIdx = Math.floor(xInLayer / colWidth.value);
    const dates = dateRange.value;
    if (dateIdx < 0 || dateIdx >= dates.length) return;
    const dateStr = dates[dateIdx];
    onDrop(event, machineId, dateStr);
}

function onDrop(event, machineId, dateStr) {
    // Check for group drop first
    const groupData = event.dataTransfer.getData('application/gantt-group');
    if (groupData) {
        const group = JSON.parse(groupData);
        moveGroup(group, machineId, dateStr);
        return;
    }

    // Check if this is an allocation move
    const allocationData = event.dataTransfer.getData('application/allocation');
    if (allocationData) {
        const alloc = JSON.parse(allocationData);
        moveAllocation(alloc, machineId, dateStr);
        return;
    }

    // New allocation from workload or deleted block
    const item = JSON.parse(event.dataTransfer.getData('application/json'));
    const isFromDeleted = item.isDeletedBlock || false;
    const deletedBlockId = isFromDeleted ? item.deletedBlockId : null;

    // Run validations
    validationErrors.value = [];
    const errors = [];

    if (!isFromDeleted && orderData.value?.docstatus !== 1) {
        errors.push('Order must be submitted before allocation');
    }

    if (!dateRange.value.includes(dateStr)) {
        errors.push('Date is outside calendar range');
    }

    if (isPastDate(dateStr)) {
        errors.push('Cannot allocate to past dates');
    }

    const shift = getShiftForDate(dateStr, machineId);
    if (!shift) {
        errors.push('No shift defined for this date');
    }

    if (!isFromDeleted && !isValidForProcess(item)) {
        errors.push('Process not defined for this item');
    }

    // Machine GG compatibility check
    const draggedItemGG = isFromDeleted ? item.machine_gg : itemMachineGG.value.get(item.item);
    if (draggedItemGG) {
        const targetMachine = machines.value.find(m => m.machine_id === machineId);
        if (targetMachine && targetMachine.machine_gg && targetMachine.machine_gg !== draggedItemGG) {
            errors.push(`Machine GG mismatch: item requires "${draggedItemGG}" but machine has "${targetMachine.machine_gg}"`);
        }
    }

    if (errors.length > 0) {
        validationErrors.value = errors;
        frappe.show_alert({
            message: __(errors[0]),
            indicator: 'red'
        });
        return;
    }

    if (!isFromDeleted) {
        // Check if already fully allocated (only for workload items, not deleted blocks)
        const alreadyAllocated = getAllocatedQuantity(item);
        if (alreadyAllocated >= item.quantity) {
            const allocatedOrders = [...new Set(allocations.value
                .filter(a =>
                    a.item === item.item &&
                    a.process === selectedProcess.value &&
                    a.colour === item.colour &&
                    a.size === item.size
                )
                .map(a => a.order)
            )];
            const orderMsg = allocatedOrders.length > 0
                ? ` (Order: ${allocatedOrders.join(', ')})`
                : '';
            frappe.show_alert({
                message: __('This item is already fully allocated' + orderMsg),
                indicator: 'orange'
            });
            return;
        }
    }

    const remainingQuantity = isFromDeleted
        ? item.quantity
        : item.quantity - getAllocatedQuantity(item);
    const minutesPerUnit = item.minutes || 0;

    if (!minutesPerUnit || minutesPerUnit <= 0) {
        frappe.show_alert({
            message: __('Invalid process minutes for this item'),
            indicator: 'red'
        });
        return;
    }

    if (remainingQuantity < MIN_BATCH_SIZE) {
        frappe.show_alert({
            message: __(`Minimum batch size is ${MIN_BATCH_SIZE}`),
            indicator: 'red'
        });
        return;
    }

    if (isOffDay(dateStr)) {
        frappe.show_alert({
            message: __('Warning: Allocating to a weekly off day'),
            indicator: 'orange'
        });
    }

    const usedMinutes = getUsedMinutes(machineId, dateStr);
    const totalMinutes = getEffectiveMinutes(dateStr, machineId);
    const availableMinutes = totalMinutes - usedMinutes;
    const availableCapacityQty = minutesPerUnit > 0 ? Math.floor(availableMinutes / minutesPerUnit) : 0;

    pendingDrop.value = {
        type: 'workload',
        machineId,
        dateStr,
        item: item.item,
        colour: item.colour,
        size: item.size,
        minutesPerUnit,
        maxQty: remainingQuantity,
        availableCapacityQty,
        deletedBlockId,
        order: item.order || selectedOrder.value || null,
        process: item.process || selectedProcess.value || null
    };
    dropQuantity.value = remainingQuantity;
    showDropModal.value = true;
}

function moveAllocation(alloc, newMachineId, newDateStr) {
    const actualAlloc = allocations.value.find(a => a.key === alloc.key);
    if (!actualAlloc) {
        frappe.show_alert({ message: __('Allocation not found'), indicator: 'red' });
        return;
    }

    if (isPastDate(newDateStr)) {
        frappe.show_alert({ message: __('Cannot move to past date'), indicator: 'red' });
        return;
    }

    if (!dateRange.value.includes(newDateStr)) {
        frappe.show_alert({ message: __('Date outside calendar range'), indicator: 'red' });
        return;
    }

    // Machine GG compatibility check
    if (!checkMachineGGCompat(actualAlloc.item, actualAlloc.machine_id, newMachineId)) return;

    // One-item-per-machine-day validation
    if (!validateMachineDaySlot(newMachineId, newDateStr, [actualAlloc.key])) {
        frappe.show_alert({ message: __('This machine already has an allocation on this date'), indicator: 'red' });
        return;
    }

    const isSameCell = actualAlloc.machine_id === newMachineId && actualAlloc.operation_date === newDateStr;
    const usedMinutes = getUsedMinutes(newMachineId, newDateStr) - (isSameCell ? actualAlloc.allocated_minutes : 0);
    const totalMinutes = getEffectiveMinutes(newDateStr, newMachineId);
    const availableMinutes = totalMinutes - usedMinutes;
    const minutesPerUnit = actualAlloc.quantity > 0 ? actualAlloc.allocated_minutes / actualAlloc.quantity : 0;
    const availableCapacityQty = minutesPerUnit > 0 ? Math.floor(availableMinutes / minutesPerUnit) : 0;

    pendingDrop.value = {
        type: 'move',
        machineId: newMachineId,
        dateStr: newDateStr,
        allocKey: actualAlloc.key,
        item: actualAlloc.item,
        colour: actualAlloc.colour,
        size: actualAlloc.size,
        minutesPerUnit,
        maxQty: actualAlloc.quantity,
        availableCapacityQty,
        order: actualAlloc.order,
        process: actualAlloc.process
    };
    dropQuantity.value = actualAlloc.quantity;
    showDropModal.value = true;
}

function handleMoveSource(sourceAlloc, qty, minutesPerUnit) {
    const oldQty = sourceAlloc.quantity;
    const oldMinutes = sourceAlloc.allocated_minutes;
    const movedMinutes = qty * minutesPerUnit;

    if (qty === sourceAlloc.quantity) {
        const idx = allocations.value.findIndex(a => a.key === sourceAlloc.key);
        if (idx > -1) allocations.value.splice(idx, 1);
        return { sourceRemoved: true, oldQty, oldMinutes, sourceSnapshot: { ...sourceAlloc } };
    } else {
        sourceAlloc.quantity -= qty;
        sourceAlloc.allocated_minutes -= movedMinutes;
        return { sourceRemoved: false, oldQty, oldMinutes, movedQty: qty, movedMinutes };
    }
}

function confirmDrop() {
    if (!pendingDrop.value) return;

    const pd = pendingDrop.value;
    const qty = dropQuantity.value;

    if (qty < MIN_BATCH_SIZE || qty > pd.maxQty) {
        frappe.show_alert({ message: __('Invalid quantity'), indicator: 'red' });
        return;
    }

    if (pd.type === 'workload') {
        // Smart overlap detection: simulate contiguous placement and check for overlaps
        const forcedPlan = simulateAutoSplitForced(pd.machineId, pd.dateStr, qty, pd.minutesPerUnit);
        if (forcedPlan.length > 0) {
            const { affected: overlapAffected, hasOverlap } = computeShiftPlanForOverlap(pd.machineId, forcedPlan);

            if (hasOverlap && overlapAffected.length > 0) {
                const outOfBounds = overlapAffected.some(a => a.newDate === null);
                if (outOfBounds) {
                    frappe.show_alert({
                        message: __('Cannot shift: some allocations would be pushed beyond the calendar date range. Extend end date first.'),
                        indicator: 'red'
                    });
                    return;
                }

                shiftModalData.value = {
                    type: 'workload',
                    affectedAllocations: overlapAffected,
                    newWorkloadPlan: forcedPlan,
                    pendingDropData: { ...pd },
                    dropQty: qty
                };
                showShiftModal.value = true;
                return;
            }
        }

        // Existing overflow check for single-day capacity
        const dropDayUsed = getUsedMinutes(pd.machineId, pd.dateStr);
        const dropDayTotal = getEffectiveMinutes(pd.dateStr, pd.machineId);
        const dropDayAvail = dropDayTotal - dropDayUsed;
        const dropDayFitQty = pd.minutesPerUnit > 0 ? Math.floor(dropDayAvail / pd.minutesPerUnit) : 0;

        if (qty > dropDayFitQty) {
            const workloadPlan = simulateAutoSplit(pd.machineId, pd.dateStr, qty, pd.minutesPerUnit);
            const { affected } = computeShiftPlan(pd.machineId, pd.dateStr, workloadPlan);

            if (affected.length > 0) {
                const outOfBounds = affected.some(a => a.newDate === null);
                if (outOfBounds) {
                    frappe.show_alert({
                        message: __('Cannot shift: some allocations would be pushed beyond the calendar date range. Extend end date first.'),
                        indicator: 'red'
                    });
                    return;
                }

                shiftModalData.value = {
                    type: 'workload',
                    affectedAllocations: affected,
                    newWorkloadPlan: workloadPlan,
                    pendingDropData: { ...pd },
                    dropQty: qty
                };
                showShiftModal.value = true;
                return;
            }
        }

        const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
            pd.machineId, pd.dateStr, qty, pd.minutesPerUnit, pd.item, pd.colour, pd.size, pd.order, pd.process
        );

        if (allocationsMade > 0) {
            saveAction('add', { keys: allocationKeys });
            if (pd.deletedBlockId) {
                removeDeletedBlock(pd.deletedBlockId);
            } else {
                removeMatchingDeletedBlocks(pd.item, pd.colour, pd.size, pd.order, pd.process);
            }
            if (remainingQty > 0) {
                frappe.show_alert({ message: __(`Allocated across ${allocationsMade} day(s). ${remainingQty} units could not be allocated (no capacity)`), indicator: 'orange' });
            } else {
                frappe.show_alert({ message: __(`Allocated ${qty} units across ${allocationsMade} day(s)`), indicator: 'green' });
            }
        } else {
            frappe.show_alert({ message: __('No capacity available'), indicator: 'red' });
        }

    } else if (pd.type === 'move') {
        const sourceAlloc = allocations.value.find(a => a.key === pd.allocKey);
        if (!sourceAlloc) {
            frappe.show_alert({ message: __('Source allocation not found'), indicator: 'red' });
            closeDropModal();
            return;
        }

        if (qty > pd.availableCapacityQty) {
            const workloadPlan = simulateAutoSplit(pd.machineId, pd.dateStr, qty, pd.minutesPerUnit);
            const excludeKey = sourceAlloc.machine_id === pd.machineId ? sourceAlloc.key : null;
            const { affected } = computeShiftPlan(pd.machineId, pd.dateStr, workloadPlan, excludeKey);

            if (affected.length > 0) {
                const outOfBounds = affected.some(a => a.newDate === null);
                if (outOfBounds) {
                    frappe.show_alert({
                        message: __('Cannot shift: some allocations would be pushed beyond the calendar date range. Extend end date first.'),
                        indicator: 'red'
                    });
                    return;
                }

                shiftModalData.value = {
                    type: 'move',
                    affectedAllocations: affected,
                    newWorkloadPlan: workloadPlan,
                    pendingDropData: { ...pd },
                    dropQty: qty,
                    sourceKey: sourceAlloc.key,
                    sourceSnapshot: { ...sourceAlloc }
                };
                showShiftModal.value = true;
                return;
            }

            const sourceResult = handleMoveSource(sourceAlloc, qty, pd.minutesPerUnit);
            const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
                pd.machineId, pd.dateStr, qty, pd.minutesPerUnit, pd.item, pd.colour, pd.size, pd.order, pd.process
            );

            if (allocationsMade > 0 || sourceResult.sourceRemoved) {
                saveAction('shift_and_move', {
                    addedKeys: allocationKeys,
                    shiftedAllocations: [],
                    sourceRemoved: sourceResult.sourceRemoved,
                    sourceKey: pd.allocKey,
                    sourceSnapshot: sourceResult.sourceSnapshot || null,
                    movedQty: qty,
                    movedMinutes: qty * pd.minutesPerUnit
                });
                frappe.show_alert({ message: __(`Moved ${qty - remainingQty} units across ${allocationsMade} day(s)`), indicator: 'green' });
            }
        } else {
            const shift = getShiftForDate(pd.dateStr, pd.machineId);

            if (qty === sourceAlloc.quantity) {
                const oldMachineId = sourceAlloc.machine_id;
                const oldDate = sourceAlloc.operation_date;

                sourceAlloc.machine_id = pd.machineId;
                sourceAlloc.operation_date = pd.dateStr;
                sourceAlloc.shift = shift?.name || '';

                saveAction('move', { key: sourceAlloc.key, oldMachineId, oldDate });
                frappe.show_alert({ message: __('Allocation moved successfully'), indicator: 'green' });
            } else {
                const movedMinutes = qty * pd.minutesPerUnit;

                sourceAlloc.quantity -= qty;
                sourceAlloc.allocated_minutes -= movedMinutes;

                const newKey = `${pd.machineId}-${pd.dateStr}-${Date.now()}-pmove`;
                allocations.value.push({
                    key: newKey,
                    machine_id: pd.machineId,
                    operation_date: pd.dateStr,
                    shift: shift?.name || '',
                    order: sourceAlloc.order,
                    item: sourceAlloc.item,
                    process: sourceAlloc.process,
                    colour: sourceAlloc.colour,
                    size: sourceAlloc.size,
                    quantity: qty,
                    allocated_minutes: movedMinutes
                });

                saveAction('partial_move', {
                    sourceKey: sourceAlloc.key,
                    newKey,
                    movedQty: qty,
                    movedMinutes
                });
                frappe.show_alert({ message: __(`Moved ${qty} units, ${sourceAlloc.quantity} remain in source`), indicator: 'green' });
            }
        }
    }

    closeDropModal();
}

function closeDropModal() {
    showDropModal.value = false;
    pendingDrop.value = null;
    dropQuantity.value = 0;
}

function closeShiftModal() {
    showShiftModal.value = false;
    shiftModalData.value = null;
}

function confirmShift() {
    if (!shiftModalData.value) return;
    const sd = shiftModalData.value;

    if (sd.type === 'move_group') {
        // Collect forward-push keys — these will be handled via executeMoveGroup, not simple shift
        const pushKeys = new Set();
        if (sd.forwardPushGroups?.length) {
            for (const pg of sd.forwardPushGroups) {
                pg.alloc_keys.forEach(k => pushKeys.add(k));
            }
        }

        // Shift only non-push cascade allocs (if any remain)
        const shiftedAllocations = [];
        const shiftedAllocRefs = [];
        sd.affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
            if (pushKeys.has(allocation.key)) return; // handled by executeMoveGroup below
            shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
            allocation.operation_date = newDate;
            const newShift = getShiftForDate(newDate, allocation.machine_id);
            allocation.shift = newShift?.name || '';
            shiftedAllocRefs.push(allocation);
        });

        const refitResult = refitShiftedAllocations(shiftedAllocRefs);

        // Process forward-push groups with executeMoveGroup BEFORE primary move
        // (they vacate the area the primary group is moving into)
        const pushMoveResults = [];
        if (sd.forwardPushGroups?.length) {
            const dates = dateRange.value;
            const machineId = sd.targetMachineId;
            for (const pg of sd.forwardPushGroups) {
                const pushAllocs = pg.alloc_keys
                    .map(k => allocations.value.find(a => a.key === k))
                    .filter(Boolean)
                    .sort((a, b) => a.operation_date.localeCompare(b.operation_date));
                if (pushAllocs.length === 0) continue;

                let workDate = pg.targetStartDate;
                if (!dates.includes(workDate) || getEffectiveMinutes(workDate, machineId) <= 0) {
                    workDate = getNextWorkingDay(addDaysToDate(pg.targetStartDate, -1), machineId);
                }
                if (!workDate) continue;

                const pgTargetDays = [];
                for (const alloc of pushAllocs) {
                    if (!workDate || !dates.includes(workDate)) break;
                    pgTargetDays.push({ alloc, newDate: workDate });
                    workDate = getNextWorkingDay(workDate, machineId);
                }
                if (pgTargetDays.length === 0) continue;

                const pgData = {
                    alloc_keys: pg.alloc_keys,
                    machine_id: machineId,
                    start_date: pushAllocs[0].operation_date,
                    end_date: pushAllocs[pushAllocs.length - 1].operation_date
                };
                pushMoveResults.push(executeMoveGroup(pgData, pgTargetDays, machineId));
            }
        }

        // Execute the primary group move
        const moveResult = executeMoveGroup(sd.groupData, sd.targetDays, sd.targetMachineId);

        saveAction('shift_and_move_group', {
            moveAllocations: moveResult.allocations,
            overflowKeys: moveResult.overflowKeys,
            removedSnapshots: moveResult.removedSnapshots,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots,
            pushAllocations: pushMoveResults.flatMap(r => r.allocations),
            pushOverflowKeys: pushMoveResults.flatMap(r => r.overflowKeys),
            pushRemovedSnapshots: pushMoveResults.flatMap(r => r.removedSnapshots)
        });
        frappe.show_alert({ message: __(`Shifted ${sd.affectedAllocations.length} allocation(s) and moved group successfully`), indicator: 'green' });
        closeShiftModal();
        return;
    }

    if (sd.type === 'move') {
        const sourceAlloc = allocations.value.find(a => a.key === sd.sourceKey);
        if (!sourceAlloc) {
            frappe.show_alert({ message: __('Source allocation not found'), indicator: 'red' });
            closeShiftModal();
            closeDropModal();
            return;
        }
        const pd = sd.pendingDropData;
        const sourceResult = handleMoveSource(sourceAlloc, sd.dropQty, pd.minutesPerUnit);
        executeShiftAndAllocate(sd, sourceResult);
    } else {
        executeShiftAndAllocate(sd);
    }

    closeShiftModal();
    closeDropModal();
}

function executeShiftAndAllocate(shiftData, sourceResult) {
    const { affectedAllocations, pendingDropData: pd, dropQty, type } = shiftData;

    const shiftedAllocations = [];
    const shiftedAllocRefs = [];
    affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
        shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
        allocation.operation_date = newDate;
        const newShift = getShiftForDate(newDate, allocation.machine_id);
        allocation.shift = newShift?.name || '';
        shiftedAllocRefs.push(allocation);
    });

    const refitResult = refitShiftedAllocations(shiftedAllocRefs);

    const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
        pd.machineId, pd.dateStr, dropQty, pd.minutesPerUnit, pd.item, pd.colour, pd.size, pd.order, pd.process
    );

    const shiftCount = shiftedAllocations.length;
    if (type === 'move' && sourceResult) {
        saveAction('shift_and_move', {
            addedKeys: allocationKeys,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots,
            sourceRemoved: sourceResult.sourceRemoved,
            sourceKey: shiftData.sourceKey,
            sourceSnapshot: sourceResult.sourceSnapshot || null,
            movedQty: dropQty,
            movedMinutes: dropQty * pd.minutesPerUnit
        });
    } else if (allocationsMade > 0 || shiftedAllocations.length > 0) {
        saveAction('shift_and_add', {
            addedKeys: allocationKeys,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots
        });
    }

    if (pd.deletedBlockId) {
        removeDeletedBlock(pd.deletedBlockId);
    } else {
        removeMatchingDeletedBlocks(pd.item, pd.colour, pd.size, pd.order, pd.process);
    }

    if (allocationsMade > 0) {
        frappe.show_alert({
            message: __(`Shifted ${shiftCount} allocation(s). Allocated ${dropQty - remainingQty} units across ${allocationsMade} day(s).`),
            indicator: 'green'
        });
    } else {
        frappe.show_alert({ message: __('Shift completed but no new allocations could be made'), indicator: 'orange' });
    }
}

// Context Menu
function closeContextMenu() {
    contextMenu.value.show = false;
}

// API Calls
async function onOrderChange() {
    if (!selectedOrder.value) {
        orderData.value = null;
        return;
    }
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_order_data',
            args: { order_name: selectedOrder.value }
        });
        if (response.message) {
            orderData.value = response.message;
        }
    } catch (e) {
        console.error('Error loading order:', e);
    }
}

async function onProcessChange() {
    actionHistory.value = [];
    redoHistory.value = [];
}

async function refreshCalendar() {
    await loadShiftAllocations();
    await loadAllAllocations();
}

async function loadShiftAllocations() {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_shift_allocations',
            args: {
                start_date: startDate.value,
                end_date: endDate.value
            }
        });
        if (response.message) {
            shiftAllocations.value = response.message.calendars;
            defaultAllocation.value = response.message.default_calendar;
        }
    } catch (e) {
        console.error('Error loading shifts:', e);
    }
}

async function loadAllAllocations() {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_all_allocations',
            args: {
                start_date: startDate.value,
                end_date: endDate.value
            }
        });
        if (response.message && response.message.length > 0) {
            allocations.value = response.message.map((a, idx) => ({
                key: `existing-${idx}`,
                ...a
            }));
        } else {
            allocations.value = [];
        }
        actionHistory.value = [];
        redoHistory.value = [];
        splitMarkers.value = new Set();
    } catch (e) {
        console.error('Error loading allocations:', e);
        frappe.show_alert({ message: __('Error loading allocations'), indicator: 'red' });
    }
}

async function loadShiftAllocationsForRange(rangeStart, rangeEnd) {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_shift_allocations',
            args: { start_date: rangeStart, end_date: rangeEnd }
        });
        if (response.message) {
            const existingNames = new Set(shiftAllocations.value.map(c => c.name));
            const newCalendars = (response.message.calendars || []).filter(c => !existingNames.has(c.name));
            if (newCalendars.length > 0) {
                shiftAllocations.value = [...shiftAllocations.value, ...newCalendars];
            }
            if (!defaultAllocation.value && response.message.default_calendar) {
                defaultAllocation.value = response.message.default_calendar;
            }
        }
    } catch (e) {
        console.error('Error loading shift allocations for range:', e);
    }
}

async function loadAllocationsForRange(rangeStart, rangeEnd) {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_all_allocations',
            args: { start_date: rangeStart, end_date: rangeEnd }
        });
        if (response.message && response.message.length > 0) {
            const existingNames = new Set(allocations.value.map(a => a.name));
            const newAllocs = response.message
                .filter(a => !existingNames.has(a.name))
                .map((a, idx) => ({
                    key: `extend-${Date.now()}-${idx}`,
                    ...a
                }));
            if (newAllocs.length > 0) {
                allocations.value = [...allocations.value, ...newAllocs];
            }
        }
    } catch (e) {
        console.error('Error loading allocations for range:', e);
    }
}

async function extendRight() {
    if (isExtending.value) return;
    isExtending.value = true;
    try {
        const oldEnd = endDate.value;
        const newEnd = addDaysToDate(oldEnd, EXTEND_DAYS);
        suppressDateWatch.value = true;
        const fetchStart = addDaysToDate(oldEnd, 1);
        await Promise.all([
            loadShiftAllocationsForRange(fetchStart, newEnd),
            loadAllocationsForRange(fetchStart, newEnd)
        ]);
        endDate.value = newEnd;
        if (endDateControl) endDateControl.set_value(newEnd);
        await nextTick();
        await nextTick();
        suppressDateWatch.value = false;
    } finally {
        isExtending.value = false;
    }
}

async function extendLeft() {
    if (isExtending.value) return;
    isExtending.value = true;
    try {
        const oldStart = startDate.value;
        const newStart = addDaysToDate(oldStart, -EXTEND_DAYS);
        const wrapper = document.querySelector('.calendar-wrapper');
        const oldScrollLeft = wrapper ? wrapper.scrollLeft : 0;
        const oldDateCount = dateRange.value.length;
        suppressDateWatch.value = true;
        const fetchEnd = addDaysToDate(oldStart, -1);
        await Promise.all([
            loadShiftAllocationsForRange(newStart, fetchEnd),
            loadAllocationsForRange(newStart, fetchEnd)
        ]);
        startDate.value = newStart;
        if (startDateControl) startDateControl.set_value(newStart);
        await nextTick();
        await nextTick();
        suppressDateWatch.value = false;
        // Restore scroll position to compensate for prepended columns
        if (wrapper) {
            const newColumns = dateRange.value.length - oldDateCount;
            wrapper.scrollLeft = oldScrollLeft + (newColumns * colWidth.value);
        }
    } finally {
        isExtending.value = false;
    }
}

function onCalendarScroll() {
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
        if (isExtending.value) return;
        const wrapper = document.querySelector('.calendar-wrapper');
        if (!wrapper) return;
        const { scrollLeft, scrollWidth, clientWidth } = wrapper;
        if (scrollLeft < EXTEND_THRESHOLD) {
            extendLeft();
        } else if (scrollWidth - scrollLeft - clientWidth < EXTEND_THRESHOLD) {
            extendRight();
        }
    }, 200);
}

async function loadExistingAllocations() {
    await loadAllAllocations();
}

async function saveAllocations() {
    validationErrors.value = [];
    const errors = [];

    workloadItems.value.forEach(item => {
        const allocated = getAllocatedQuantity(item);
        if (allocated > item.quantity) {
            errors.push(`${item.item}: Allocated ${allocated} exceeds order ${item.quantity}`);
        }
    });

    const conflicts = allocations.value.filter(a => hasConflict(a));
    if (conflicts.length > 0) {
        errors.push(`${conflicts.length} allocation(s) have conflicts`);
    }

    if (errors.length > 0) {
        validationErrors.value = errors;
        frappe.show_alert({ message: __('Please fix validation errors before saving'), indicator: 'red' });
        return;
    }

    if (allocations.value.length === 0) {
        frappe.show_alert({ message: __('No allocations to save'), indicator: 'orange' });
        return;
    }

    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.save_allocations',
            args: {
                allocations: allocations.value,
                start_date: startDate.value,
                end_date: endDate.value
            }
        });
        if (response.message) {
            frappe.show_alert({ message: __('Allocations saved successfully'), indicator: 'green' });
            actionHistory.value = [];
            redoHistory.value = [];
            await loadAllAllocations();
            emit('saveAllocations', allocations.value);
        }
    } catch (e) {
        console.error('Error saving allocations:', e);
        frappe.show_alert({ message: __('Failed to save allocations'), indicator: 'red' });
    }
}

// Alteration dialog
function openAlterationDialog(dateStr, machineId = null) {
    alterationForm.value = {
        date: dateStr,
        machine: machineId,
        alteration_type: 'Add',
        minutes: 60,
        reason: ''
    };
    showAlterationModal.value = true;
}

function closeAlterationModal() {
    showAlterationModal.value = false;
    alterationSaving.value = false;
}

async function confirmAlteration() {
    const form = alterationForm.value;
    if (!form.minutes || form.minutes < 1) {
        frappe.show_alert({ message: __('Minutes must be at least 1'), indicator: 'red' });
        return;
    }

    alterationSaving.value = true;
    try {
        await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.add_shift_alteration',
            args: {
                date: form.date,
                alteration_type: form.alteration_type,
                minutes: form.minutes,
                machine: form.machine || null,
                reason: form.reason || null
            }
        });
        frappe.show_alert({ message: __('Shift alteration added'), indicator: 'green' });
        closeAlterationModal();
        await loadShiftAllocations();
        autoReflowAfterAlteration(form.date, form.machine || null, form.alteration_type, form.minutes);
    } catch (e) {
        console.error('Error adding alteration:', e);
        frappe.show_alert({ message: __('Error adding alteration'), indicator: 'red' });
        alterationSaving.value = false;
    }
}

// ── Edit / Delete Existing Alterations ──

function openEditAlterationsModal(dateStr, machineId) {
    const cal = getCalendarForDate(dateStr);
    if (!cal) return;

    const matching = (cal.alterations || []).filter(a => {
        if (a.date !== dateStr) return false;
        // If machineId is null, show ALL alterations for this date
        if (machineId === null) return true;
        return a.machine === machineId;
    });
    editAlterationsList.value = matching.map(a => ({ ...a }));
    editAlterationsContext.value = { date: dateStr, machine_id: machineId };
    editAlterationsSaving.value = false;
    showEditAlterationsModal.value = true;
}

function closeEditAlterationsModal() {
    showEditAlterationsModal.value = false;
    editAlterationsList.value = [];
    editAlterationsSaving.value = false;
}

async function saveAlteration(idx) {
    const row = editAlterationsList.value[idx];
    if (!row.minutes || row.minutes < 1) {
        frappe.show_alert({ message: __('Minutes must be at least 1'), indicator: 'red' });
        return;
    }
    editAlterationsSaving.value = true;
    try {
        await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.update_shift_alteration',
            args: {
                alteration_name: row.name,
                alteration_type: row.alteration_type,
                minutes: row.minutes,
                reason: row.reason || null
            }
        });
        frappe.show_alert({ message: __('Alteration updated'), indicator: 'green' });
        await loadShiftAllocations();
        // Reflow for the specific machine this alteration targets
        autoReflowAfterAlteration(
            editAlterationsContext.value.date,
            row.machine || null,
            row.alteration_type,
            row.minutes
        );
        // Refresh list with latest data
        const cal = getCalendarForDate(editAlterationsContext.value.date);
        if (cal) {
            const dateStr = editAlterationsContext.value.date;
            const ctxMachine = editAlterationsContext.value.machine_id;
            editAlterationsList.value = (cal.alterations || [])
                .filter(a => {
                    if (a.date !== dateStr) return false;
                    if (ctxMachine === null) return true;
                    return a.machine === ctxMachine;
                })
                .map(a => ({ ...a }));
        }
    } catch (e) {
        console.error('Error updating alteration:', e);
        frappe.show_alert({ message: __('Error updating alteration'), indicator: 'red' });
    }
    editAlterationsSaving.value = false;
}

async function deleteAlteration(idx) {
    const row = editAlterationsList.value[idx];
    editAlterationsSaving.value = true;
    try {
        await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.delete_shift_alteration',
            args: {
                alteration_name: row.name,
                parent_calendar: row.parent
            }
        });
        frappe.show_alert({ message: __('Alteration deleted'), indicator: 'green' });
        editAlterationsList.value.splice(idx, 1);
        await loadShiftAllocations();

        // Reflow with the opposite effect: deleting an Add is like a Reduce, and vice versa
        const reverseType = row.alteration_type === 'Add' ? 'Reduce' : 'Add';
        autoReflowAfterAlteration(
            editAlterationsContext.value.date,
            row.machine || null,
            reverseType,
            row.minutes
        );

        if (editAlterationsList.value.length === 0) {
            closeEditAlterationsModal();
        }
    } catch (e) {
        console.error('Error deleting alteration:', e);
        frappe.show_alert({ message: __('Error deleting alteration'), indicator: 'red' });
    }
    editAlterationsSaving.value = false;
}

function addNewFromEditModal() {
    const ctx = editAlterationsContext.value;
    closeEditAlterationsModal();
    openAlterationDialog(ctx.date, ctx.machine_id);
}

// ── Bulk shift update ──
function openBulkShiftModal() {
    bulkShiftMachines.value = [];
    bulkShiftSaving.value = false;
    showBulkShiftModal.value = true;
    const defaultDate = dateRange.value.length > 0 ? dateRange.value[0] : frappe.datetime.nowdate();
    bulkShiftDate.value = defaultDate;
    // Init frappe date control after DOM renders
    nextTick(() => {
        if (bulkShiftDateFieldRef.value && !bulkShiftDateControl) {
            bulkShiftDateControl = frappe.ui.form.make_control({
                df: {
                    fieldtype: 'Date',
                    fieldname: 'bulk_shift_date',
                    label: 'Date',
                    change() {
                        bulkShiftDate.value = bulkShiftDateControl.get_value() || '';
                        populateBulkShiftTable();
                    }
                },
                parent: bulkShiftDateFieldRef.value,
                render_input: true,
                only_input: true
            });
        }
        if (bulkShiftDateControl) {
            bulkShiftDateControl.set_value(defaultDate);
            bulkShiftDateControl.refresh();
        }
        populateBulkShiftTable();
    });
}

function closeBulkShiftModal() {
    showBulkShiftModal.value = false;
    bulkShiftSaving.value = false;
    bulkShiftDate.value = '';
    bulkShiftMachines.value = [];
    bulkShiftDateControl = null;
}

function populateBulkShiftTable() {
    const dateStr = bulkShiftDate.value;
    if (!dateStr) {
        bulkShiftMachines.value = [];
        return;
    }
    bulkShiftMachines.value = machines.value.map(m => ({
        machine_id: m.machine_id,
        machine_name: m.machine_name || m.machine_id,
        shift_name: getShiftNamesForDate(dateStr, m.machine_id),
        total_minutes: getEffectiveMinutes(dateStr, m.machine_id),
        allocated_minutes: getUsedMinutes(m.machine_id, dateStr),
        alteration_type: 'Add',
        update_minutes: 0
    }));
}

async function applyBulkShiftUpdates() {
    const dateStr = bulkShiftDate.value;
    const affected = bulkShiftMachines.value.filter(r => r.update_minutes > 0);
    if (affected.length === 0) return;

    bulkShiftSaving.value = true;
    try {
        // Call add_shift_alteration for each affected machine
        for (const row of affected) {
            await frappe.call({
                method: 'albion.albion.page.capacity_planning.capacity_planning.add_shift_alteration',
                args: {
                    date: dateStr,
                    alteration_type: row.alteration_type,
                    minutes: row.update_minutes,
                    machine: row.machine_id,
                    reason: null
                }
            });
        }

        // Reload shift data so getEffectiveMinutes reflects new alterations
        await loadShiftAllocations();

        // Reflow each affected machine
        for (const row of affected) {
            autoReflowAfterAlteration(dateStr, row.machine_id, row.alteration_type, row.update_minutes);
        }

        frappe.show_alert({ message: __(`Shift updated for ${affected.length} machine(s)`), indicator: 'green' });
        closeBulkShiftModal();
    } catch (e) {
        console.error('Error applying bulk shift updates:', e);
        frappe.show_alert({ message: __('Error applying shift updates'), indicator: 'red' });
        bulkShiftSaving.value = false;
    }
}

// ── Action choice dialog ──
function openActionChoice(dateStr, machineId = null) {
    actionChoiceContext.value = { date: dateStr, machine: machineId };
    showActionChoice.value = true;
}

function closeActionChoice() {
    showActionChoice.value = false;
}

function chooseUpdateTime() {
    const ctx = actionChoiceContext.value;
    closeActionChoice();
    openAlterationDialog(ctx.date, ctx.machine);
}

function chooseUpdateShift() {
    const ctx = actionChoiceContext.value;
    closeActionChoice();
    openShiftUpdateModal(ctx.date, ctx.machine);
}

// ── Shift update modal ──
function openShiftUpdateModal(dateStr, machineId = null) {
    // Pre-select all current shifts for this date (machine-aware)
    const cal = getCalendarForDate(dateStr, machineId);
    const currentShifts = cal && cal.shifts ? cal.shifts.map(s => s.shift) : [];
    shiftUpdateForm.value = { date: dateStr, shifts: [...currentShifts], machine: machineId };
    showShiftUpdateModal.value = true;
}

function closeShiftUpdateModal() {
    showShiftUpdateModal.value = false;
    shiftUpdateSaving.value = false;
}

async function confirmShiftUpdate() {
    const form = shiftUpdateForm.value;
    if (!form.shifts || form.shifts.length === 0) {
        frappe.show_alert({ message: __('Please select at least one shift'), indicator: 'red' });
        return;
    }

    shiftUpdateSaving.value = true;
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.update_date_shift',
            args: {
                date: form.date,
                shifts: JSON.stringify(form.shifts),
                machine: form.machine || null
            }
        });
        frappe.show_alert({ message: __('Shift updated'), indicator: 'green' });
        closeShiftUpdateModal();
        await loadShiftAllocations();

        // Trigger reflow if capacity changed
        const result = response.message;
        if (result) {
            const delta = (result.new_minutes || 0) - (result.old_minutes || 0);
            if (delta > 0) {
                autoReflowAfterAlteration(form.date, form.machine || null, 'Add', delta);
            } else if (delta < 0) {
                autoReflowAfterAlteration(form.date, form.machine || null, 'Reduce', Math.abs(delta));
            } else if (isDefaultWeekdayOff(form.date) && (result.new_minutes || 0) > 0) {
                // Off-day: API reports same old/new (both from calendar total_duration_minutes)
                // but effective old capacity was 0. Force pull-back.
                autoReflowAfterAlteration(form.date, form.machine || null, 'Add', result.new_minutes);
            }
        }
    } catch (e) {
        console.error('Error updating shift:', e);
        frappe.show_alert({ message: __('Error updating shift'), indicator: 'red' });
        shiftUpdateSaving.value = false;
    }
}

async function loadAllShifts() {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_all_shifts'
        });
        if (response.message) {
            allShifts.value = response.message;
        }
    } catch (e) {
        console.error('Error loading shifts:', e);
    }
}

function initFrappeControls() {
    // Customer — Link field to filter orders
    customerControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Link',
            fieldname: 'customer',
            label: 'Customer',
            options: 'Customer',
            placeholder: 'Select Customer',
            change() {
                selectedCustomer.value = customerControl.get_value() || '';
                // Update Order control query to filter by customer
                if (orderControl) {
                    orderControl.df.get_query = () => {
                        const filters = { docstatus: 1 };
                        if (selectedCustomer.value) filters.customer = selectedCustomer.value;
                        return { filters };
                    };
                    // Clear current order selection when customer changes
                    orderControl.set_value('');
                    selectedOrder.value = '';
                    orderData.value = null;
                }
            }
        },
        parent: customerFieldRef.value,
        render_input: true,
        only_input: true
    });
    customerControl.refresh();

    // Order — Link field with search
    orderControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Link',
            fieldname: 'order',
            label: 'Order',
            options: 'Order',
            placeholder: 'Select Order',
            get_query() {
                const filters = { docstatus: 1 };
                if (selectedCustomer.value) filters.customer = selectedCustomer.value;
                return { filters };
            },
            change() {
                selectedOrder.value = orderControl.get_value() || '';
                onOrderChange();
            }
        },
        parent: orderFieldRef.value,
        render_input: true,
        only_input: true
    });
    orderControl.refresh();

    // Process — Select field
    processControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Select',
            fieldname: 'process',
            label: 'Process',
            options: [{ value: '', label: 'Select Process' }],
            change() {
                selectedProcess.value = processControl.get_value() || '';
                onProcessChange();
            }
        },
        parent: processFieldRef.value,
        render_input: true,
        only_input: true
    });
    processControl.refresh();

    // View Type — Select field
    viewTypeControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Select',
            fieldname: 'view_type',
            label: 'View Type',
            options: [
                { value: 'item_wise', label: 'Item Wise' },
                { value: 'colour_wise', label: 'Colour Wise' },
                { value: 'size_wise', label: 'Size Wise' }
            ],
            default: 'item_wise',
            change() {
                viewType.value = viewTypeControl.get_value() || 'item_wise';
            }
        },
        parent: viewTypeFieldRef.value,
        render_input: true,
        only_input: true
    });
    viewTypeControl.set_value('item_wise');
    viewTypeControl.refresh();

    // Machine GG — Link field to filter machines
    machineGGControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Link',
            fieldname: 'machine_gg',
            label: 'Machine GG',
            options: 'Machine GG',
            placeholder: 'Select Machine GG',
            change() {
                selectedMachineGG.value = machineGGControl.get_value() || '';
            }
        },
        parent: machineGGFieldRef.value,
        render_input: true,
        only_input: true
    });
    machineGGControl.refresh();

    // Start Date
    startDateControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Date',
            fieldname: 'start_date',
            label: 'Start Date',
            change() {
                startDate.value = startDateControl.get_value() || '';
            }
        },
        parent: startDateFieldRef.value,
        render_input: true,
        only_input: true
    });
    startDateControl.set_value(frappe.datetime.add_days(frappe.datetime.nowdate(), -7))
    startDateControl.refresh();

    // End Date
    endDateControl = frappe.ui.form.make_control({
        df: {
            fieldtype: 'Date',
            fieldname: 'end_date',
            label: 'End Date',
            change() {
                endDate.value = endDateControl.get_value() || '';
            }
        },
        parent: endDateFieldRef.value,
        render_input: true,
        only_input: true
    });
    endDateControl.set_value(frappe.datetime.add_months(frappe.datetime.nowdate(), 5))
    endDateControl.refresh();
}

function updateProcessOptions() {
    if (!processControl) return;
    const opts = [{ value: '', label: 'Select Process' }];
    for (const proc of availableProcesses.value) {
        opts.push({ value: proc.name, label: proc.process_name });
    }
    processControl.df.options = opts;
    processControl.refresh();
}

function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLastAction();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoLastAction();
    }
}

onMounted(async () => {
    await nextTick();
    initFrappeControls();
    frappe.db.get_single_value('Albion Settings', 'apply_zoom').then(val => {
        applyZoom.value = !!val;
    });
    await loadShiftAllocations();
    loadAllShifts();
    loadAllAllocations();
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('beforeunload', onBeforeUnload);
    frappe.router.on('change', onRouteChange);

    if (!defaultAllocation.value) {
        frappe.msgprint({
            title: __('No Default Shift Allocation'),
            message: __('Please create a Shift Allocation and mark it as default for capacity planning to work correctly.'),
            indicator: 'orange'
        });
    }

    // Auto-scroll to current date
    await nextTick();
    const wrapper = document.querySelector('.calendar-wrapper');
    if (wrapper) {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayIdx = dateRange.value.indexOf(todayStr);
        if (todayIdx >= 0) {
            wrapper.scrollLeft = Math.max(0, todayIdx * colWidth.value - colWidth.value * 2);
        }
        wrapper.addEventListener('scroll', onCalendarScroll);
    }
});

function hasUnsavedChanges() {
    return actionHistory.value.length > 0;
}

function onBeforeUnload(e) {
    if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
    }
}

function onRouteChange() {
    if (hasUnsavedChanges()) {
        frappe.confirm(
            __('You have unsaved changes. Are you sure you want to leave?'),
            () => { actionHistory.value = []; redoHistory.value = []; frappe.set_route(frappe.get_route()); },
            () => { frappe.set_route('capacity-planning'); }
        );
        return false;
    }
}

onUnmounted(() => {
    document.removeEventListener('click', closeContextMenu);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('beforeunload', onBeforeUnload);
    frappe.router.off('change', onRouteChange);
    const wrapper = document.querySelector('.calendar-wrapper');
    if (wrapper) wrapper.removeEventListener('scroll', onCalendarScroll);
    if (scrollDebounceTimer) clearTimeout(scrollDebounceTimer);
});

watch([startDate, endDate], () => {
    if (suppressDateWatch.value) return;
    loadShiftAllocations();
    loadAllAllocations();
});

watch(availableProcesses, () => {
    updateProcessOptions();
});

defineExpose({
    loadData,
    loadExistingAllocations,
    refreshCalendar
});
</script>

<style scoped>
/* ===== Layout Shell ===== */
.capacity-planning {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--navbar-height, 60px));
    background: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    overflow: hidden;
}

.cp-header {
    background: white;
    padding: 12px 20px;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    position: relative;
    z-index: 10;
    flex-shrink: 0;
}

.cp-header .awesomplete > [role="listbox"] {
    z-index: 50 !important;
}

.cp-filters {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}

.filter-row {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    justify-content: flex-end;
}

.action-group {
    display: flex;
    gap: 8px;
    align-items: flex-end;
}

.compact-toggle-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin: 0;
    user-select: none;
}

.compact-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.toggle-switch {
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background: #cbd5e1;
    position: relative;
    cursor: pointer;
    transition: background 0.2s ease;
}

.toggle-switch.toggle-on {
    background: #7c3aed;
}

.toggle-knob {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: left 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch.toggle-on .toggle-knob {
    left: 20px;
}

.frappe-field {
    min-width: 160px;
}

.filter-field {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.filter-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 4px;
}

.frappe-field :deep(.frappe-control) {
    margin-bottom: 0;
}

.frappe-field :deep(.frappe-control .form-group) {
    margin-bottom: 0;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.form-group label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.4px;
}

.text-info { color: #2563eb; }
.text-danger { color: #ef4444; }

/* ===== Validation ===== */
.validation-alerts {
    padding: 8px 20px;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    flex-shrink: 0;
}

.alert {
    padding: 8px 12px;
    margin-bottom: 4px;
    border-radius: 6px;
    font-size: 13px;
}

.alert-danger {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

/* ===== Body Layout ===== */
.cp-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    z-index: 1;
}

/* ===== Left Panel - Workload ===== */
.cp-left-panel {
    width: 280px;
    min-width: 280px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.panel-header {
    padding: 16px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
}

.panel-header:hover {
    background: #f8fafc;
}

.panel-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h4 {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
}

.panel-toggle-btn {
    background: none;
    border: none;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    line-height: 1;
}

.panel-subtitle {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 2px;
}

.cp-left-panel.panel-collapsed {
    width: 44px;
    min-width: 44px;
}

.panel-collapsed .panel-header {
    padding: 12px 8px;
    border-bottom: none;
}

.panel-collapsed .panel-header-row {
    flex-direction: column;
    gap: 8px;
}

.panel-collapsed .panel-header h4 {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 12px;
}

.workload-list {
    min-height: 0;
    padding: 12px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    color: #94a3b8;
}

.empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.4;
}

.empty-text {
    font-size: 13px;
    text-align: center;
}

.workload-item {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: white;
    margin-bottom: 8px;
    border-left: 3px solid transparent;
    cursor: grab;
    transition: box-shadow 0.15s, border-color 0.15s;
}

.workload-item:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border-color: #cbd5e1;
}

.workload-item.fully-allocated {
    border-left-color: #10b981;
    background: #f8fafc;
    opacity: 0.65;
    cursor: not-allowed;
}

.workload-item.partial-allocated {
    border-left-color: #f59e0b;
}

.workload-item.pending {
    border-left-color: #3b82f6;
}

.workload-item.invalid {
    border-left-color: #ef4444;
    opacity: 0.5;
    background: #fef2f2;
    cursor: not-allowed;
}

.workload-item:active {
    cursor: grabbing;
}

.item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.drag-handle {
    color: #cbd5e1;
    cursor: grab;
    font-size: 12px;
    margin-right: 6px;
    user-select: none;
}

.item-name {
    font-weight: 600;
    font-size: 13px;
    color: #0f172a;
    flex: 1;
}

.item-qty {
    background: #f1f5f9;
    color: #334155;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 700;
}

.item-gg {
    font-size: 11px;
    font-weight: 600;
    color: #6d28d9;
    margin-top: 2px;
}

.item-detail {
    font-size: 12px;
    color: #64748b;
}

.item-minutes {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 4px;
}

.item-progress {
    height: 3px;
    background: #f1f5f9;
    border-radius: 2px;
    margin-top: 8px;
    overflow: hidden;
}

.item-progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
}

.item-progress-fill.full { background: #10b981; }
.item-progress-fill.partial { background: #f59e0b; }
.item-progress-fill.pending { background: #3b82f6; }

.allocation-status {
    font-size: 11px;
    margin-top: 4px;
    font-weight: 600;
}

.allocation-status.full { color: #059669; }
.allocation-status.partial { color: #d97706; }
.allocation-status.pending { color: #2563eb; }

.invalid-reason {
    font-size: 11px;
    color: #dc2626;
    margin-top: 4px;
}

/* ===== Recently Deleted Blocks ===== */
.deleted-blocks-section {
    border-top: 1px dashed #e2e8f0;
    flex-shrink: 0;
}

.deleted-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px 6px;
}

.deleted-title {
    font-size: 12px;
    font-weight: 600;
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.deleted-clear-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
}

.deleted-clear-btn:hover {
    background: #fee2e2;
    color: #ef4444;
}

.deleted-list {
    padding: 0 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
}

.deleted-item {
    position: relative;
    padding: 8px 28px 8px 10px;
    background: #fef2f2;
    border: 1px dashed #fca5a5;
    border-radius: 8px;
    cursor: grab;
    font-size: 12px;
    transition: all 0.15s ease;
}

.deleted-item:hover {
    background: #fee2e2;
    border-color: #f87171;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.1);
}

.deleted-item:active {
    cursor: grabbing;
    transform: translateY(0);
}

.deleted-item-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.deleted-item-name {
    font-weight: 600;
    color: #1e293b;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.deleted-item-qty {
    font-weight: 700;
    color: #dc2626;
    font-size: 13px;
}

.deleted-item-meta {
    color: #94a3b8;
    font-size: 11px;
    margin-top: 2px;
}

.deleted-dismiss-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    background: none;
    border: none;
    color: #d4d4d8;
    font-size: 11px;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    line-height: 1;
}

.deleted-dismiss-btn:hover {
    background: #fca5a5;
    color: white;
}

/* ===== Right Panel - Calendar ===== */
.cp-right-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.calendar-header {
    background: white;
    padding: 10px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}

.calendar-header h4 {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
}

.calendar-wrapper {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: #f8fafc;
}

/* ===== Gantt Grid ===== */
.gantt-grid {
    display: grid;
    width: max-content;
    padding-bottom: 120px;
}

.gantt-corner-cell {
    grid-row: 1;
    grid-column: 1;
    background: #f1f5f9;
    padding: 12px 16px;
    font-weight: 700;
    font-size: 12px;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid #e2e8f0;
    position: sticky;
    left: 0;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
}

.gantt-date-header {
    background: #f1f5f9;
    padding: 10px 8px;
    text-align: center;
    border: 1px solid #e2e8f0;
    border-left: none;
    position: sticky;
    top: 0;
    z-index: 15;
    cursor: pointer;
}

.gantt-date-header.weekly-off {
    background: #fef9c3;
}

.gantt-date-header.past-date {
    background: #f1f5f9;
    color: #94a3b8;
}

.gantt-date-header.today-date {
    background: #eff6ff;
    border-bottom: 3px solid #3b82f6;
}

.gantt-date-header.today-date .day-date {
    color: #2563eb;
}

.date-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.day-date {
    font-weight: 700;
    font-size: 12px;
    color: #1e293b;
}

.shift-info {
    font-size: 10px;
    color: #64748b;
    font-weight: 500;
}

.day-alteration-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    margin-left: 4px;
    vertical-align: middle;
}

.day-alteration-badge.clickable {
    cursor: pointer;
}

.day-alteration-badge.clickable:hover {
    filter: brightness(0.9);
    text-decoration: underline;
}

.gantt-date-header:hover {
    background: #e2e8f0 !important;
}

.gantt-machine-cell {
    grid-column: 1;
    background: #f8fafc;
    padding: 12px 16px;
    border: 1px solid #e2e8f0;
    border-top: none;
    position: sticky;
    left: 0;
    z-index: 20;
    display: flex;
    align-items: flex-start;
}

.machine-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.machine-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.machine-id {
    font-weight: 700;
    font-size: 13px;
    color: #0f172a;
}

.machine-name {
    font-size: 11px;
    color: #64748b;
}

.machine-gg-badge {
    font-size: 10px;
    font-weight: 700;
    color: #6d28d9;
    background: #ede9fe;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
}

/* ===== Date Cells (Drop Targets) ===== */
.gantt-date-cell {
    position: relative;
    border: 1px solid #e2e8f0;
    border-top: none;
    border-left: none;
    padding: 4px 6px;
    min-height: 98px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    transition: background 0.15s, box-shadow 0.15s;
}

.gantt-date-cell:hover {
    box-shadow: inset 0 0 0 2px #93c5fd;
}

.cell-available {
    background: white;
}

.cell-allocated {
    background: #f8fafc;
}

.cell-full {
    background: #fff1f2;
}

.cell-conflict {
    background: #fff1f2;
    box-shadow: inset 0 0 0 2px #f87171;
}

.cell-past {
    background: #f8f9fb !important;
}

.cell-today {
    background: #eff6ff !important;
    box-shadow: inset 0 0 0 1px #bfdbfe;
}

.cell-top-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-height: 18px;
}

.machine-shift-badge {
    position: absolute;
    bottom: 3px;
    right: 4px;
    z-index: 11;
    font-size: 9px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: #dbeafe;
    color: #1e40af;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.machine-shift-badge.clickable {
    cursor: pointer;
}

.machine-shift-badge.clickable:hover {
    background: #bfdbfe;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.alteration-badge {
    position: absolute;
    bottom: 3px;
    left: 4px;
    z-index: 11;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.alteration-badge.clickable {
    cursor: pointer;
}

.alteration-badge.clickable:hover {
    filter: brightness(0.9);
    box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
}

.badge-add {
    background: #dcfce7;
    color: #166534;
}

.badge-reduce {
    background: #fef3c7;
    color: #92400e;
}

.cell-altered-add {
    background: #f0fdf4 !important;
}

.cell-altered-reduce {
    background: #fffbeb !important;
}

.cell-add-btn {
    display: none;
    width: 18px;
    height: 18px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: white;
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    margin-left: auto;
}

.gantt-date-cell:hover .cell-add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.cell-add-btn:hover {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.cell-utilization {
    position: absolute;
    top: 3px;
    left: 4px;
    right: 4px;
    z-index: 10;
}

.util-bar {
    position: relative;
    height: 16px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
}

.util-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}

.util-label {
    position: relative;
    z-index: 1;
    display: block;
    text-align: end;
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    color: #1e293b;
}

.util-fill.bar-ok { background: #86efac; }
.util-fill.bar-warning { background: #fde68a; }
.util-fill.bar-low { background: #fca5a5; }
.util-bar.bar-ok { background: #dcfce7; }
.util-bar.bar-warning { background: #fef9c3; }
.util-bar.bar-low { background: #fee2e2; }

/* ===== Gantt Bars ===== */
.gantt-bar-layer {
    position: relative;
    pointer-events: none;
    z-index: 5;
}

.gantt-bar {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 7px 12px 6px;
    overflow: hidden;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    transition: box-shadow 0.15s, transform 0.15s;
    border: 1px solid rgba(0,0,0,0.06);
    border-left: none;
}

.gantt-bar:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08);
    transform: translateY(-1px);
    z-index: 10;
}

.gantt-bar:active {
    cursor: grabbing;
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

@keyframes snapIn {
    0%   { transform: scale(0.90); opacity: 0.5; box-shadow: 0 0 0 rgba(0,0,0,0); }
    60%  { transform: scale(1.04); opacity: 1; box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
    100% { transform: scale(1); box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06); }
}

.gantt-bar.snap-in {
    animation: snapIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* --- Bar Row: Top (Item + Qty) --- */
.bar-row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.bar-item {
    font-weight: 700;
    font-size: 13px;
    color: #0f172a;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.bar-qty {
    background: rgba(0,0,0,0.08);
    padding: 1px 7px;
    border-radius: 4px;
    font-weight: 800;
    font-size: 12px;
    color: #0f172a;
    flex-shrink: 0;
}

/* --- Bar Row: Mid (Process + Minutes) --- */
.bar-row-mid {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.bar-process {
    font-weight: 500;
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 11px;
    line-height: 1.3;
}

.bar-minutes {
    color: #475569;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 600;
}

/* --- Bar Row: Bottom (Tags) --- */
.bar-row-bot {
    display: flex;
    gap: 6px;
    align-items: center;
    overflow: hidden;
    margin-top: 2px;
}

.bar-tag {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
    font-weight: 600;
}

.bar-tag b {
    font-weight: 800;
    margin-right: 1px;
}

.order-tag {
    color: #1e40af;
    background: rgba(59, 130, 246, 0.14);
    border: 1px solid rgba(59, 130, 246, 0.2);
}

.colour-tag {
    color: #c2410c;
    background: rgba(249, 115, 22, 0.12);
    border: 1px solid rgba(249, 115, 22, 0.2);
}

.size-tag {
    color: #3f3f46;
    background: rgba(113, 113, 122, 0.12);
    border: 1px solid rgba(113, 113, 122, 0.18);
}

/* ===== Zoom-Out Bar ===== */
.zoomed-out-bar {
    cursor: default;
    padding: 2px 6px;
    gap: 0;
}

.zoomed-out-bar:hover {
    transform: none;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
}

.zoomed-out-bar:active {
    cursor: default;
    transform: none;
}

.bar-row-zoom {
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    white-space: nowrap;
}

.bar-row-zoom .bar-item {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    line-height: 1.2;
}

.bar-row-zoom .bar-qty {
    font-size: 11px;
    padding: 0 5px;
    font-weight: 800;
}

.bar-row-zoom .bar-tag {
    font-size: 11px;
    padding: 0 4px;
    flex-shrink: 0;
}

/* ===== Zoom-Out Grid Compact ===== */
.gantt-grid-zoom .gantt-date-header {
    padding: 4px 6px;
}

.gantt-grid-zoom .gantt-date-header .day-date {
    font-size: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.machine-cell-zoom {
    padding: 4px 6px !important;
    align-items: center;
    width: 120px;
    min-width: 120px;
    cursor: default;
}

.machine-id-zoom {
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.gantt-grid-zoom .gantt-date-cell {
    min-height: 30px;
    padding: 2px 4px;
}

.gantt-grid-zoom .gantt-date-cell:hover {
    box-shadow: none;
}

.gantt-grid-zoom .gantt-corner-cell {
    padding: 4px 6px;
    font-size: 10px;
    width: 120px;
    min-width: 120px;
}

/* ===== Modals ===== */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
}

.modal-content {
    background: white;
    padding: 24px;
    border-radius: 14px;
    min-width: 320px;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
}

.modal-content h4 {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 16px 0;
}

.modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 20px;
}

/* Bulk Shift Modal */
.bulk-shift-modal {
    max-width: 900px;
    min-width: 700px;
}

.bulk-shift-table-wrap {
    max-height: 450px;
    overflow-y: auto;
    margin-top: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
}

.bulk-shift-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.bulk-shift-table th {
    background: #f8fafc;
    padding: 8px 10px;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 1;
    white-space: nowrap;
}

.bulk-shift-table td {
    padding: 6px 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
}

.bulk-shift-table .text-right {
    text-align: right;
}

.bulk-shift-table .text-center {
    text-align: center;
}

.bulk-shift-input {
    width: 80px;
    padding: 4px 6px;
    text-align: right;
    font-size: 13px;
    display: inline-block;
}

.bulk-shift-select {
    width: 110px;
    padding: 4px 6px;
    font-size: 13px;
    display: inline-block;
}

.bulk-shift-delete {
    padding: 2px 6px;
    font-size: 12px;
    line-height: 1;
    border-radius: 4px;
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fca5a5;
    cursor: pointer;
}

.bulk-shift-delete:hover {
    background: #fca5a5;
    color: #991b1b;
}

/* ===== Buttons ===== */
.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s, box-shadow 0.15s;
}

.btn-primary {
    background: #2563eb;
    color: white;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
}

.btn-primary:hover {
    background: #1d4ed8;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
}

.btn-default {
    background: white;
    border: 1px solid #e2e8f0;
    color: #334155;
}

.btn-default:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.btn-secondary {
    background: #f1f5f9;
    color: #334155;
}

.btn-secondary:hover {
    background: #e2e8f0;
}

.btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
}

/* ===== Context Menu ===== */
.context-menu {
    position: fixed;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    z-index: 1000;
    min-width: 190px;
    padding: 4px;
}

.menu-item {
    padding: 9px 14px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    margin: 2px 0;
    color: #334155;
    transition: background 0.1s;
}

.menu-item:hover {
    background: #f1f5f9;
}

.menu-item.text-danger {
    color: #dc2626;
}

.menu-item.text-danger:hover {
    background: #fef2f2;
}

/* ===== Gantt Tooltip ===== */
.gantt-tooltip {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    transform: translate(-50%, -100%);
    background: #0f172a;
    color: #f1f5f9;
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 220px;
    max-width: 300px;
    animation: tooltip-in 0.15s ease-out;
}

@keyframes tooltip-in {
    from { opacity: 0; transform: translate(-50%, -100%) translateY(4px); }
    to   { opacity: 1; transform: translate(-50%, -100%) translateY(0); }
}

.gantt-tooltip::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 7px solid #0f172a;
}

.tooltip-header {
    font-weight: 700;
    font-size: 14px;
    color: white;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #334155;
}

.tooltip-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    align-items: baseline;
}

.tooltip-label {
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.tooltip-value {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
}

.tooltip-qty {
    color: #67e8f9;
}

/* ===== Shift Modal ===== */
.shift-modal {
    background: white;
    padding: 24px;
    border-radius: 14px;
    min-width: 500px;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
}

.shift-modal h4 {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 12px 0;
}

.shift-explanation {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #1e40af;
}

.shift-explanation p {
    margin: 0 0 4px 0;
}

.shift-explanation p:last-child {
    margin-bottom: 0;
}

.shift-table-wrapper {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 16px;
}

.shift-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.shift-table th {
    background: #f1f5f9;
    padding: 8px 12px;
    text-align: left;
    font-weight: 700;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.shift-table td {
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
}

.shift-table tr:last-child td {
    border-bottom: none;
}

/* ===== Backfill Modal ===== */
.backfill-explanation {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-size: 13px;
    color: #92400e;
}

.backfill-explanation p {
    margin: 0 0 4px 0;
}

.backfill-explanation p:last-child {
    margin-bottom: 0;
}

/* ===== Machine GG Disabled State ===== */
.machine-disabled {
    opacity: 0.35;
    pointer-events: none;
}

/* ===== Action Choice Dialog ===== */
.action-choice-modal {
    max-width: 340px;
    text-align: center;
}
.action-choice-date {
    color: #64748b;
    font-size: 13px;
    margin-bottom: 16px;
}
.action-choice-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-bottom: 16px;
}
.action-choice-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
}
.action-icon {
    font-size: 20px;
}

/* ===== Shift Checkbox List ===== */
.shift-checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
}
.shift-checkbox-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    margin: 0;
    font-weight: normal;
}
.shift-checkbox-item:hover {
    background: #f1f5f9;
}
.shift-checkbox-item input[type="checkbox"] {
    margin: 0;
    width: 16px;
    height: 16px;
}
.shift-checkbox-label {
    flex: 1;
}
.shift-checkbox-mins {
    color: #64748b;
    font-size: 12px;
}
</style>

