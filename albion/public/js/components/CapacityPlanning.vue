<template>
    <div class="capacity-planning">
        <div class="cp-header">
            <div class="cp-filters">
                <div class="filter-rows">
                    <div class="filter-row">
                        <div class="filter-field">
                            <label class="filter-label">Customer</label>
                            <div class="frappe-field" ref="customerFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">Order</label>
                            <div class="frappe-field" ref="orderFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">Start Date</label>
                            <div class="frappe-field" ref="startDateFieldRef"></div>
                        </div>
                        <div class="filter-field">
                            <label class="filter-label">End Date</label>
                            <div class="frappe-field" ref="endDateFieldRef"></div>
                        </div>
                    </div>
                    <div class="filter-row">
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
                </div>
                <div class="action-group">
                    <button class="btn btn-default" @click="undoLastAction" :disabled="actionHistory.length === 0">Undo</button>
                    <button class="btn btn-default" @click="refreshCalendar">Refresh</button>
                    <button class="btn btn-primary" @click="saveAllocations">Save</button>
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
            <div class="cp-left-panel">
                <div class="panel-header">
                    <h4>Workload</h4>
                    <span class="panel-subtitle">Drag items to calendar</span>
                </div>
                <div class="workload-list">
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
            </div>

            <!-- Right Panel - Gantt Calendar -->
            <div class="cp-right-panel">
                <div class="calendar-header">
                    <h4>Capacity Calendar</h4>
                </div>
                <div class="calendar-wrapper">
                    <div class="gantt-grid" :style="ganttGridStyle">
                        <!-- Header row -->
                        <div class="gantt-corner-cell">Machine</div>
                        <div v-for="(date, dIdx) in dateRange" :key="'hdr-'+date"
                             class="gantt-date-header" :class="getDateHeaderClass(date)"
                             :style="{ gridRow: 1, gridColumn: dIdx + 2 }"
                             @click="openAlterationDialog(date)">
                            <div class="date-cell">
                                <span class="day-date">{{ formatDayName(date) }}, {{ formatDate(date) }}</span>
                                <span class="shift-info">
                                    {{ getShiftNamesForDate(date) }} &middot; {{ getEffectiveMinutes(date) }}m
                                    <span v-if="getDayAlterationDelta(date)" class="day-alteration-badge" :class="getDayAlterationDelta(date).cls">
                                        {{ getDayAlterationDelta(date).label }}
                                    </span>
                                </span>
                            </div>
                        </div>

                        <!-- Machine rows -->
                        <template v-for="(machine, mIdx) in filteredMachines" :key="machine.machine_id">
                            <!-- Machine label cell -->
                            <div class="gantt-machine-cell" :class="{ 'machine-disabled': !isMachineCompatible(machine.machine_id) }" :style="{ gridRow: mIdx + 2 }">
                                <div class="machine-info">
                                    <div class="machine-title">
                                        <span class="machine-id">{{ machine.machine_id }}</span>
                                    </div>
                                    <span class="machine-name">{{ machine.machine_name }}</span>
                                </div>
                            </div>

                            <!-- Date cells (drop targets) -->
                            <div v-for="(date, dIdx) in dateRange"
                                 :key="machine.machine_id+'-'+date"
                                 class="gantt-date-cell"
                                 :class="[getCellClass(machine.machine_id, date), { 'machine-disabled': !isMachineCompatible(machine.machine_id) }]"
                                 :style="{ gridRow: mIdx + 2, gridColumn: dIdx + 2 }"
                                 @dragover="onCellDragOver($event, machine.machine_id)"
                                 @drop="onDrop($event, machine.machine_id, date)">
                                <span v-if="getCellAlterationBadge(date, machine.machine_id)"
                                      class="alteration-badge"
                                      :class="getCellAlterationBadge(date, machine.machine_id).cls">
                                    {{ getCellAlterationBadge(date, machine.machine_id).label }}
                                </span>
                                <div class="cell-top-row">
                                    <button class="cell-add-btn" @click.stop="openAlterationDialog(date, machine.machine_id)" title="Add overtime/break">+</button>
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
                            </div>

                            <!-- Gantt bar layer (overlays date cells in same row) -->
                            <div class="gantt-bar-layer"
                                 :class="{ 'machine-disabled': !isMachineCompatible(machine.machine_id) }"
                                 :style="{ gridRow: mIdx + 2, gridColumn: `2 / ${dateRange.length + 2}`, minHeight: getBarLayerHeight(machine.machine_id) + 'px' }">
                                <div v-for="group in getGroupsForMachine(machine.machine_id)"
                                     :key="group.group_id"
                                     class="gantt-bar"
                                     :style="getBarStyle(group)"
                                     :title="getGroupTooltip(group)"
                                     draggable="true"
                                     @dragstart="onGroupDragStart($event, group)"
                                     @dragend="onDragEnd"
                                     @dragover="onCellDragOver($event, machine.machine_id)"
                                     @drop="onBarDrop($event, machine.machine_id)"
                                     @contextmenu.prevent="onBarContextMenu($event, group)"
                                     @click.stop="selectGroup(group)">
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
                    <label>Target: {{ pendingDrop.machineId }} &middot; {{ pendingDrop.dateStr }}</label>
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
                                <td>{{ grp.oldStart }} to {{ grp.oldEnd }}</td>
                                <td>&rarr;</td>
                                <td>{{ grp.newStart && grp.newEnd ? `${grp.newStart} to ${grp.newEnd}` : 'Out of range' }}</td>
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
                                <td>{{ entry.currentDate }}</td>
                                <td>&rarr;</td>
                                <td>{{ entry.newDate }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmShift">
                        {{ shiftModalData.type === 'move_group' ? 'Shift & Move' : 'Shift & Allocate' }}
                    </button>
                    <button v-if="shiftModalData.type !== 'move_group'" class="btn btn-default" @click="allocateWithoutShift">Allocate Without Shifting</button>
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
                                <td>{{ entry.currentDate }}</td>
                                <td>&larr;</td>
                                <td>{{ entry.newDate }}</td>
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
                    <label>Dates: {{ selectedGroup.start_date }} to {{ selectedGroup.end_date }} ({{ selectedGroup.allocs.length }} days)</label>
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
                            {{ alloc.operation_date }}
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
                    <label>{{ selectedGroup.item }} &mdash; {{ selectedGroup.start_date }} to {{ selectedGroup.end_date }} ({{ selectedGroup.allocs.length }} days)</label>
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
                            <p>Group moves from <strong>{{ selectedGroup.start_date }}</strong> &rarr; <strong>{{ shiftByDaysPreview.newStart }}</strong></p>
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
                                        <td>{{ grp.oldStart }} to {{ grp.oldEnd }}</td>
                                        <td>&rarr;</td>
                                        <td>{{ grp.newStart && grp.newEnd ? `${grp.newStart} to ${grp.newEnd}` : 'Out of range' }}</td>
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
    </div>
</template>

<script setup>
import './CapacityPlanning.css';
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
const orderData = ref(null);

// Template refs for Frappe fields
const customerFieldRef = ref(null);
const machineGGFieldRef = ref(null);
const orderFieldRef = ref(null);
const processFieldRef = ref(null);
const viewTypeFieldRef = ref(null);
const startDateFieldRef = ref(null);
const endDateFieldRef = ref(null);

// Frappe control instances
let customerControl = null;
let machineGGControl = null;
let orderControl = null;
let processControl = null;
let viewTypeControl = null;
let startDateControl = null;
let endDateControl = null;
const shiftCalendars = ref([]);
const defaultCalendar = ref(null);
const allocations = ref([]);
const actionHistory = ref([]);
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

// Group state
const selectedGroup = ref(null);
const splitMarkers = ref(new Set());
const showEditGroupModal = ref(false);
const editGroupQuantity = ref(0);
const showSplitGroupModal = ref(false);
const splitGroupDate = ref('');

// Drag tracking for machine_gg filtering
const draggingItem = ref(null);

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

// Initialize dates
const today = new Date();
startDate.value = today.toISOString().split('T')[0];
const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
endDate.value = nextMonth.toISOString().split('T')[0];

// Constants
const MIN_BATCH_SIZE = 1;
const COL_WIDTH = 152;
const BAR_HEIGHT = 68;
const BAR_GAP = 4;
const BAR_TOP_OFFSET = 22;

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
    const itemGG = itemMachineGG.value.get(draggingItem.value.item);
    if (!itemGG) return true; // no machine_gg on item → all machines allowed
    const machine = machines.value.find(m => m.machine_id === machineId);
    if (!machine || !machine.machine_gg) return true; // no machine_gg on machine → allowed
    return machine.machine_gg === itemGG;
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

const ganttGridStyle = computed(() => ({
    gridTemplateColumns: `180px repeat(${dateRange.value.length}, ${COL_WIDTH}px)`,
}));

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
                size: null
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
                size: null
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
                size: data.size
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

function getCalendarForDate(dateStr) {
    for (const cal of shiftCalendars.value) {
        if (dateStr >= cal.start_date && dateStr <= cal.end_date) {
            return cal;
        }
    }
    return defaultCalendar.value;
}

function getShiftForDate(dateStr) {
    const cal = getCalendarForDate(dateStr);
    if (cal && cal.shifts && cal.shifts.length > 0) {
        return cal.shifts[0];
    }
    return null;
}

function getShiftNamesForDate(dateStr) {
    const cal = getCalendarForDate(dateStr);
    if (!cal || !cal.shifts || cal.shifts.length === 0) return 'No Shift';
    return cal.shifts.map(s => s.shift_name).join(', ');
}

function getShiftMinutes(dateStr) {
    if (isOffDay(dateStr)) return 0;
    const cal = getCalendarForDate(dateStr);
    return cal ? (cal.total_duration_minutes || 480) : 480;
}

function getEffectiveMinutes(dateStr, machineId = null) {
    let base = getShiftMinutes(dateStr);
    const cal = getCalendarForDate(dateStr);
    if (!cal || !cal.alterations) return base;

    for (const alt of cal.alterations) {
        if (alt.date !== dateStr) continue;
        // Day-level alterations (no machine)
        if (!alt.machine) {
            base += alt.alteration_type === 'Add' ? alt.minutes : -alt.minutes;
        }
    }

    if (machineId) {
        for (const alt of cal.alterations) {
            if (alt.date !== dateStr) continue;
            if (alt.machine === machineId) {
                base += alt.alteration_type === 'Add' ? alt.minutes : -alt.minutes;
            }
        }
    }

    return Math.max(0, base);
}

function getCellAlterationBadge(dateStr, machineId) {
    const base = getShiftMinutes(dateStr);
    const effective = getEffectiveMinutes(dateStr, machineId);
    const delta = effective - base;
    if (delta === 0) return null;
    return {
        label: delta > 0 ? `+${delta}m` : `${delta}m`,
        cls: delta > 0 ? 'badge-add' : 'badge-reduce'
    };
}

function getDayAlterationDelta(dateStr) {
    const base = getShiftMinutes(dateStr);
    const effective = getEffectiveMinutes(dateStr);
    const delta = effective - base;
    if (delta === 0) return null;
    return {
        label: delta > 0 ? `+${delta}m` : `${delta}m`,
        cls: delta > 0 ? 'badge-add' : 'badge-reduce'
    };
}

function isOffDay(dateStr) {
    const cal = defaultCalendar.value;
    if (!cal) return false;
    const dayIndex = new Date(dateStr).getDay(); // 0=Sun..6=Sat
    const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return !cal[dayFields[dayIndex]];
}

function isPastDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function getDateHeaderClass(dateStr) {
    if (isPastDate(dateStr)) return 'past-date';
    if (isOffDay(dateStr)) return 'weekly-off';
    return '';
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
    return allocations.value
        .filter(a =>
            a.item === item.item &&
            a.process === selectedProcess.value &&
            a.colour === item.colour &&
            a.size === item.size
        )
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
        if (!isOffDay(cursor)) return false;
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
    return lanes * (BAR_HEIGHT + BAR_GAP) + BAR_TOP_OFFSET * 2;
}

function getBarStyle(group) {
    const dates = dateRange.value;
    const startIdx = dates.indexOf(group.start_date);
    const endIdx = dates.indexOf(group.end_date);

    if (startIdx < 0 || endIdx < 0) return { display: 'none' };

    const left = startIdx * COL_WIDTH + BAR_GAP;
    const width = (endIdx - startIdx + 1) * COL_WIDTH - BAR_GAP * 2;
    const top = (group.lane || 0) * (BAR_HEIGHT + BAR_GAP) + BAR_TOP_OFFSET;

    const colors = getAllocationColor(group);

    return {
        position: 'absolute',
        left: left + 'px',
        top: top + 'px',
        width: width + 'px',
        height: BAR_HEIGHT + 'px',
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '4px',
        pointerEvents: 'auto',
    };
}

function getGroupTooltip(group) {
    let tooltip = `Item: ${group.item}\n`;
    tooltip += `Process: ${group.process}\n`;
    tooltip += `Order: ${group.order}\n`;
    tooltip += `Dates: ${group.start_date} to ${group.end_date}\n`;
    tooltip += `Days: ${group.allocs.length}\n`;
    tooltip += `Total Qty: ${group.total_quantity}\n`;
    tooltip += `Total Minutes: ${group.total_minutes}m\n`;
    if (group.colour) tooltip += `Colour: ${group.colour}\n`;
    if (group.size) tooltip += `Size: ${group.size}\n`;
    return tooltip;
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
    }));
    event.dataTransfer.effectAllowed = 'move';
    draggingItem.value = { item: group.item };
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
        alloc.shift = getShiftForDate(newDate)?.name || '';
    });

    // Redistribute total quantity across target days based on each day's capacity
    let remaining = totalQty;
    const removedSnapshots = [];

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

        alloc.quantity = allocQty;
        alloc.allocated_minutes = allocQty * minutesPerUnit;
        remaining -= allocQty;
    }

    // Place overflow on subsequent available days if quantity remains
    const overflowKeys = [];
    if (remaining > 0 && minutesPerUnit > 0) {
        const lastTargetDate = targetDays[targetDays.length - 1].newDate;
        const allMovedKeys = targetDays.map(({ alloc }) => alloc.key);
        let currentDate = getNextDate(lastTargetDate);
        const refAlloc = targetDays[0].alloc;

        while (remaining > 0 && currentDate) {
            if (!isPastDate(currentDate) && validateMachineDaySlot(newMachineId, currentDate, allMovedKeys)) {
                const effectiveCap = getEffectiveMinutes(currentDate, newMachineId);
                const maxQty = Math.floor(effectiveCap / minutesPerUnit);
                const allocQty = Math.min(remaining, maxQty);

                if (allocQty > 0) {
                    const key = `${newMachineId}-${currentDate}-gmove-${Date.now()}-${overflowKeys.length}`;
                    const shift = getShiftForDate(currentDate);
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
    const oldStart = new Date(groupData.start_date);
    const newStart = new Date(newStartDate);
    const dayOffset = Math.round((newStart - oldStart) / (1000 * 60 * 60 * 24));

    if (dayOffset === 0 && groupData.machine_id === newMachineId) return;

    // Machine GG compatibility check
    const itemGG = itemMachineGG.value.get(groupData.item);
    if (itemGG) {
        const targetMachine = machines.value.find(m => m.machine_id === newMachineId);
        if (targetMachine && targetMachine.machine_gg && targetMachine.machine_gg !== itemGG) {
            frappe.show_alert({ message: __(`Cannot move: item requires Machine GG "${itemGG}" but target machine has "${targetMachine.machine_gg}"`), indicator: 'red' });
            return;
        }
    }

    const groupAllocs = groupData.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);

    if (groupAllocs.length === 0) {
        frappe.show_alert({ message: __('Group allocations not found'), indicator: 'red' });
        return;
    }

    const targetDays = groupAllocs.map(alloc => ({
        alloc,
        newDate: addDaysToDate(alloc.operation_date, dayOffset)
    }));

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

    // Always cascade forward — push conflicting groups toward the future
    {
        let currentEnd = newEndDate;
        for (const otherGroup of machineGroups) {
            if (otherGroup.end_date < newStartDate) continue;
            if (otherGroup.start_date > currentEnd) break;

            const nextFree = addDaysToDate(currentEnd, 1);
            const pushDays = dates.indexOf(nextFree) - dates.indexOf(otherGroup.start_date);
            if (pushDays <= 0) continue;

            const pushedEnd = addDaysToDate(otherGroup.end_date, pushDays);
            if (!dates.includes(pushedEnd)) outOfBounds = true;

            for (const alloc of otherGroup.allocObjs) {
                const nd = addDaysToDate(alloc.operation_date, pushDays);
                if (!dates.includes(nd) || isPastDate(nd)) {
                    outOfBounds = true;
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
                } else {
                    affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: nd });
                }
            }

            currentEnd = outOfBounds ? currentEnd : pushedEnd;
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
        targetMachineId: newMachineId
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

    // Compute the primary group's new target dates
    const groupAllocs = group.alloc_keys
        .map(key => allocations.value.find(a => a.key === key))
        .filter(Boolean);

    if (groupAllocs.length === 0) {
        shiftByDaysPreview.value = { error: 'Group allocations not found' };
        return;
    }

    const targetDays = groupAllocs.map(alloc => ({
        alloc,
        newDate: addDaysToDate(alloc.operation_date, dayOffset)
    }));

    const newStart = addDaysToDate(group.start_date, dayOffset);
    const newEnd = addDaysToDate(group.end_date, dayOffset);

    // Validate primary group's target dates
    for (const { newDate } of targetDays) {
        if (!dates.includes(newDate)) {
            shiftByDaysPreview.value = { error: 'Shift would place days outside calendar range. Extend the end date first.' };
            return;
        }
        if (isPastDate(newDate)) {
            shiftByDaysPreview.value = { error: 'Cannot shift to past dates' };
            return;
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
    // Start with the primary group's new end date, then push any overlapping groups
    const affected = [];
    let outOfBounds = false;

    // Build a schedule of "occupied ranges" — start with the shifted primary group
    // Then iterate through other groups in date order, pushing each one if it overlaps
    const groupShifts = new Map(); // group_id -> dayOffset for that group

    // For cascading: track the "occupied end" as we push groups forward/backward
    // We process groups in the direction of the shift
    // Always cascade forward — push conflicting groups toward the future
    {
        let currentEnd = newEnd;

        for (const otherGroup of machineGroups) {
            if (otherGroup.end_date < newStart) continue;
            if (otherGroup.start_date > currentEnd) break;

            const pushDays = dates.indexOf(addDaysToDate(currentEnd, 1)) - dates.indexOf(otherGroup.start_date);
            if (pushDays <= 0) continue;

            groupShifts.set(otherGroup.group_id, pushDays);

            const pushedEnd = addDaysToDate(otherGroup.end_date, pushDays);
            if (!dates.includes(pushedEnd)) {
                outOfBounds = true;
            }

            for (const alloc of otherGroup.allocObjs) {
                const nd = addDaysToDate(alloc.operation_date, pushDays);
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

            currentEnd = outOfBounds ? currentEnd : pushedEnd;
        }
    }

    // Shift all subsequent groups on the same machine by dayOffset
    for (const otherGroup of machineGroups) {
        if (groupShifts.has(otherGroup.group_id)) continue; // already handled by cascade
        if (otherGroup.start_date <= group.end_date) continue; // not subsequent

        groupShifts.set(otherGroup.group_id, dayOffset);

        const pushedEnd = addDaysToDate(otherGroup.end_date, dayOffset);
        if (!dates.includes(pushedEnd)) outOfBounds = true;

        for (const alloc of otherGroup.allocObjs) {
            const nd = addDaysToDate(alloc.operation_date, dayOffset);
            if (!dates.includes(nd) || isPastDate(nd)) {
                outOfBounds = true;
                affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: null });
            } else {
                affected.push({ allocation: alloc, currentDate: alloc.operation_date, newDate: nd });
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

    shiftByDaysPreview.value = { affected, affectedGroups, newStart, targetDays, outOfBounds };
}

function confirmShiftByDays() {
    if (!selectedGroup.value || !shiftByDaysPreview.value || shiftByDaysPreview.value.error || shiftByDaysPreview.value.outOfBounds) return;

    const group = selectedGroup.value;
    const preview = shiftByDaysPreview.value;
    const machineId = group.machine_id;

    // Shift cascading allocations first (before moving the primary group)
    const shiftedAllocations = [];
    const shiftedAllocRefs = [];
    if (preview.affected.length > 0) {
        preview.affected.forEach(({ allocation, currentDate, newDate }) => {
            shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
            allocation.operation_date = newDate;
            const newShift = getShiftForDate(newDate);
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

    // Execute the primary group move
    const moveResult = executeMoveGroup(groupData, preview.targetDays, machineId);

    if (shiftedAllocations.length > 0) {
        saveAction('shift_and_move_group', {
            moveAllocations: moveResult.allocations,
            overflowKeys: moveResult.overflowKeys,
            removedSnapshots: moveResult.removedSnapshots,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots
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
        const newShift = getShiftForDate(newDate);
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
    frappe.show_alert({ message: __(`Deleted group and shifted ${shiftedAllocations.length} allocation(s) backward`), indicator: 'green' });
    closeBackfillModal();
}

function declineBackfill() {
    if (!backfillModalData.value) return;
    const bd = backfillModalData.value;

    saveAction('delete_group', { allocations: bd.deletedAllocations });
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
            // Off-day with new overtime: pull from subsequent groups
            if (alterationType === 'Add' && getEffectiveMinutes(dateStr, mId) > 0) {
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
                const shift = getShiftForDate(currentDate);
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
            const shift = getShiftForDate(currentDate);
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
            const shift = getShiftForDate(freedDateStr);
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
            } else {
                modified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
                sameGroup.quantity -= pullQty;
                sameGroup.allocated_minutes -= pullMin;
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
        } else {
            modified.push({ key: sameGroup.key, oldQty: sameGroup.quantity, oldMinutes: sameGroup.allocated_minutes });
            sameGroup.quantity -= pullQty;
            sameGroup.allocated_minutes -= pullMin;
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
        const newShift = getShiftForDate(newDate);

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

        const shift = getShiftForDate(currentDate);
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
}

function undoLastAction() {
    if (actionHistory.value.length === 0) return;
    const action = actionHistory.value.pop();

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

// Drag and Drop
function onCellDragOver(event, machineId) {
    if (isMachineCompatible(machineId)) {
        event.preventDefault(); // allow drop only on compatible machines
    }
}

function onDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
    draggingItem.value = item;
}

function onDragEnd() {
    draggingItem.value = null;
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
    const dateIdx = Math.floor(xInLayer / COL_WIDTH);
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

    // New allocation from workload
    const item = JSON.parse(event.dataTransfer.getData('application/json'));

    // Run validations
    validationErrors.value = [];
    const errors = [];

    if (orderData.value?.docstatus !== 1) {
        errors.push('Order must be submitted before allocation');
    }

    if (!dateRange.value.includes(dateStr)) {
        errors.push('Date is outside calendar range');
    }

    if (isPastDate(dateStr)) {
        errors.push('Cannot allocate to past dates');
    }

    const shift = getShiftForDate(dateStr);
    if (!shift) {
        errors.push('No shift defined for this date');
    }

    if (!isValidForProcess(item)) {
        errors.push('Process not defined for this item');
    }

    // Machine GG compatibility check
    const draggedItemGG = itemMachineGG.value.get(item.item);
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

    // Check if already fully allocated
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

    const remainingQuantity = item.quantity - alreadyAllocated;
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
        availableCapacityQty
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
    const itemGG = itemMachineGG.value.get(actualAlloc.item);
    if (itemGG) {
        const targetMachine = machines.value.find(m => m.machine_id === newMachineId);
        if (targetMachine && targetMachine.machine_gg && targetMachine.machine_gg !== itemGG) {
            frappe.show_alert({ message: __(`Cannot move: Machine GG mismatch`), indicator: 'red' });
            return;
        }
    }

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
            pd.machineId, pd.dateStr, qty, pd.minutesPerUnit, pd.item, pd.colour, pd.size
        );

        if (allocationsMade > 0) {
            saveAction('add', { keys: allocationKeys });
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
            const shift = getShiftForDate(pd.dateStr);

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
        // Shift conflicting allocations to new dates
        const shiftedAllocations = [];
        const shiftedAllocRefs = [];
        sd.affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
            shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift, oldQuantity: allocation.quantity, oldAllocatedMinutes: allocation.allocated_minutes });
            allocation.operation_date = newDate;
            const newShift = getShiftForDate(newDate);
            allocation.shift = newShift?.name || '';
            shiftedAllocRefs.push(allocation);
        });

        const refitResult = refitShiftedAllocations(shiftedAllocRefs);

        // Execute the group move
        const moveResult = executeMoveGroup(sd.groupData, sd.targetDays, sd.targetMachineId);

        saveAction('shift_and_move_group', {
            moveAllocations: moveResult.allocations,
            overflowKeys: moveResult.overflowKeys,
            removedSnapshots: moveResult.removedSnapshots,
            shiftedAllocations,
            refitAddedKeys: refitResult.addedKeys,
            refitRemovedSnapshots: refitResult.removedSnapshots
        });
        frappe.show_alert({ message: __(`Shifted ${shiftedAllocations.length} allocation(s) and moved group successfully`), indicator: 'green' });
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

function allocateWithoutShift() {
    if (!shiftModalData.value) return;
    const sd = shiftModalData.value;
    const pd = sd.pendingDropData;

    if (sd.type === 'move') {
        const sourceAlloc = allocations.value.find(a => a.key === sd.sourceKey);
        if (!sourceAlloc) {
            frappe.show_alert({ message: __('Source allocation not found'), indicator: 'red' });
            closeShiftModal();
            closeDropModal();
            return;
        }
        const sourceResult = handleMoveSource(sourceAlloc, sd.dropQty, pd.minutesPerUnit);
        const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
            pd.machineId, pd.dateStr, sd.dropQty, pd.minutesPerUnit, pd.item, pd.colour, pd.size, pd.order, pd.process
        );

        if (allocationsMade > 0 || sourceResult.sourceRemoved) {
            saveAction('shift_and_move', {
                addedKeys: allocationKeys,
                shiftedAllocations: [],
                sourceRemoved: sourceResult.sourceRemoved,
                sourceKey: pd.allocKey,
                sourceSnapshot: sourceResult.sourceSnapshot || null,
                movedQty: sd.dropQty,
                movedMinutes: sd.dropQty * pd.minutesPerUnit
            });
            frappe.show_alert({ message: __(`Moved ${sd.dropQty - remainingQty} units across ${allocationsMade} day(s)`), indicator: 'green' });
        } else {
            frappe.show_alert({ message: __('No capacity available'), indicator: 'red' });
        }
    } else {
        const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
            pd.machineId, pd.dateStr, sd.dropQty, pd.minutesPerUnit, pd.item, pd.colour, pd.size
        );

        if (allocationsMade > 0) {
            saveAction('add', { keys: allocationKeys });
            if (remainingQty > 0) {
                frappe.show_alert({ message: __(`Allocated across ${allocationsMade} day(s). ${remainingQty} units could not be allocated (no capacity)`), indicator: 'orange' });
            } else {
                frappe.show_alert({ message: __(`Allocated ${sd.dropQty} units across ${allocationsMade} day(s)`), indicator: 'green' });
            }
        } else {
            frappe.show_alert({ message: __('No capacity available'), indicator: 'red' });
        }
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
        const newShift = getShiftForDate(newDate);
        allocation.shift = newShift?.name || '';
        shiftedAllocRefs.push(allocation);
    });

    const refitResult = refitShiftedAllocations(shiftedAllocRefs);

    const orderForSplit = type === 'move' ? pd.order : undefined;
    const processForSplit = type === 'move' ? pd.process : undefined;
    const { allocationKeys, allocationsMade, remainingQty } = executeAutoSplit(
        pd.machineId, pd.dateStr, dropQty, pd.minutesPerUnit, pd.item, pd.colour, pd.size, orderForSplit, processForSplit
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
}

async function refreshCalendar() {
    await loadShiftCalendars();
    await loadAllAllocations();
}

async function loadShiftCalendars() {
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_shift_calendars',
            args: {
                start_date: startDate.value,
                end_date: endDate.value
            }
        });
        if (response.message) {
            shiftCalendars.value = response.message.calendars;
            defaultCalendar.value = response.message.default_calendar;
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
        splitMarkers.value = new Set();
    } catch (e) {
        console.error('Error loading allocations:', e);
        frappe.show_alert({ message: __('Error loading allocations'), indicator: 'red' });
    }
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
        await loadShiftCalendars();
        autoReflowAfterAlteration(form.date, form.machine || null, form.alteration_type, form.minutes);
    } catch (e) {
        console.error('Error adding alteration:', e);
        frappe.show_alert({ message: __('Error adding alteration'), indicator: 'red' });
        alterationSaving.value = false;
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

onMounted(async () => {
    await nextTick();
    initFrappeControls();
    await loadShiftCalendars();
    loadAllAllocations();
    document.addEventListener('click', closeContextMenu);

    if (!defaultCalendar.value) {
        frappe.msgprint({
            title: __('No Default Shift Calendar'),
            message: __('Please create a Shift Calendar and mark it as default for capacity planning to work correctly.'),
            indicator: 'orange'
        });
    }
});

onUnmounted(() => {
    document.removeEventListener('click', closeContextMenu);
});

watch([startDate, endDate], () => {
    loadShiftCalendars();
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

