<template>
    <div class="capacity-planning">
        <div class="cp-header">
            <div class="cp-filters">
                <div class="filter-group">
                    <div class="form-group">
                        <label>Order</label>
                        <select v-model="selectedOrder" @change="onOrderChange" class="form-control">
                            <option value="">Select Order</option>
                            <option v-for="order in orders" :key="order.name" :value="order.name">
                                {{ order.name }}
                            </option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Process</label>
                        <select v-model="selectedProcess" @change="onProcessChange" class="form-control" :disabled="!orderData">
                            <option value="">Select Process</option>
                            <option v-for="proc in availableProcesses" :key="proc.name" :value="proc.name">
                                {{ proc.process_name }}
                            </option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>View type</label>
                        <select v-model="viewType" class="form-control">
                            <option value="item_wise">Item Wise</option>
                            <option value="colour_wise">Colour Wise</option>
                            <option value="size_wise">Size Wise</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Start date</label>
                        <input type="date" v-model="startDate" class="form-control" />
                    </div>
                    <div class="form-group">
                        <label>End date</label>
                        <input type="date" v-model="endDate" class="form-control" />
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
                <div class="workload-summary" v-if="workloadItems.length > 0">
                    <div class="summary-item">
                        <span class="label">Total Items</span>
                        <span class="value">{{ workloadItems.length }}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Fully Allocated</span>
                        <span class="value">{{ fullyAllocatedCount }}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Partial</span>
                        <span class="value">{{ partialAllocatedCount }}</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">Pending</span>
                        <span class="value">{{ pendingCount }}</span>
                    </div>
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
                            'invalid': !isValidForProcess(item),
                            'locked': isLockedToOtherView(item)
                        }"
                        :draggable="isValidForProcess(item) && getAllocationStatus(item) !== 'full' && !isLockedToOtherView(item)"
                        @dragstart="onDragStart($event, item)"
                    >
                        <div class="item-header">
                            <span class="drag-handle" v-if="isValidForProcess(item) && getAllocationStatus(item) !== 'full' && !isLockedToOtherView(item)">&#8942;&#8942;</span>
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
                        <div v-else-if="isLockedToOtherView(item)" class="locked-reason">
                            Allocated in {{ getLockedViewTypeLabel(item) }} view
                        </div>
                        <div v-else-if="getAllocatedQuantity(item) > 0" class="allocation-status" :class="getAllocationStatus(item)">
                            Allocated: {{ getAllocatedQuantity(item) }} / {{ item.quantity }}
                        </div>
                        <div v-if="getAllocatedQuantity(item) > 0 && !isLockedToOtherView(item)" class="item-progress">
                            <div class="item-progress-fill" :style="{ width: Math.min(100, (getAllocatedQuantity(item) / item.quantity) * 100) + '%' }" :class="getAllocationStatus(item)"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel - Gantt Calendar -->
            <div class="cp-right-panel">
                <div class="calendar-header">
                    <h4>Capacity Calendar</h4>
                    <div class="calendar-legend">
                        <span class="legend-item"><span class="dot available"></span> Available</span>
                        <span class="legend-item"><span class="dot allocated"></span> Allocated</span>
                        <span class="legend-item"><span class="dot full"></span> Full</span>
                        <span class="legend-item"><span class="dot conflict"></span> Conflict</span>
                    </div>
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
                        <template v-for="(machine, mIdx) in machines" :key="machine.machine_id">
                            <!-- Machine label cell -->
                            <div class="gantt-machine-cell" :style="{ gridRow: mIdx + 2 }">
                                <div class="machine-info">
                                    <div class="machine-title">
                                        <span class="machine-id">{{ machine.machine_id }}</span>
                                        <span class="machine-utilization" :class="getUtilizationClass(machine.machine_id)">
                                            {{ getMachineUtilization(machine.machine_id) }}%
                                        </span>
                                    </div>
                                    <span class="machine-name">{{ machine.machine_name }}</span>
                                </div>
                            </div>

                            <!-- Date cells (drop targets) -->
                            <div v-for="(date, dIdx) in dateRange"
                                 :key="machine.machine_id+'-'+date"
                                 class="gantt-date-cell"
                                 :class="getCellClass(machine.machine_id, date)"
                                 :style="{ gridRow: mIdx + 2, gridColumn: dIdx + 2 }"
                                 @dragover.prevent
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
                                 :style="{ gridRow: mIdx + 2, gridColumn: `2 / ${dateRange.length + 2}`, minHeight: getBarLayerHeight(machine.machine_id) + 'px' }">
                                <div v-for="group in getGroupsForMachine(machine.machine_id)"
                                     :key="group.group_id"
                                     class="gantt-bar"
                                     :style="getBarStyle(group)"
                                     :title="getGroupTooltip(group)"
                                     draggable="true"
                                     @dragstart="onGroupDragStart($event, group)"
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
                <h4>{{ shiftModalData.type === 'move_group' ? 'Shift Allocations to Move Group' : 'Shift Allocations Forward' }}</h4>
                <div class="shift-explanation">
                    <template v-if="shiftModalData.type === 'move_group'">
                        <p>Moving group to <strong>{{ shiftModalData.targetMachineId }}</strong> conflicts with <strong>{{ shiftModalData.affectedAllocations.length }}</strong> existing allocation(s).</p>
                        <p>These allocations will be shifted forward to make room.</p>
                    </template>
                    <template v-else>
                        <p>The new workload needs <strong>{{ shiftModalData.newWorkloadPlan.length }}</strong> day(s) on <strong>{{ shiftModalData.pendingDropData.machineId }}</strong>.</p>
                        <p><strong>{{ shiftModalData.affectedAllocations.length }}</strong> existing allocation(s) will be shifted forward to make room.</p>
                    </template>
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

        <!-- Right-click Context Menu -->
        <div v-if="contextMenu.show" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
            <template v-if="selectedGroup">
                <div class="menu-item" @click="openEditGroupModal">Edit Group Quantity</div>
                <div class="menu-item" v-if="selectedGroup.allocs.length > 1" @click="openSplitGroupModal">Split Group at Date</div>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const emit = defineEmits(['saveAllocations']);

// State - internal refs that can be updated via load_data
const orders = ref([]);
const processes = ref([]);
const machines = ref([]);

const selectedOrder = ref('');
const selectedProcess = ref('');
const viewType = ref('item_wise');
const startDate = ref('');
const endDate = ref('');
const orderData = ref(null);
const shiftCalendars = ref([]);
const defaultCalendar = ref(null);
const allocations = ref([]);
const actionHistory = ref([]);
const validationErrors = ref([]);

// Modal states
const showSplitModal = ref(false);
const showEditModal = ref(false);
const selectedAllocation = ref(null);
const splitQuantity = ref(0);
const editQuantity = ref(0);

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

const fullyAllocatedCount = computed(() => workloadItems.value.filter(item => getAllocationStatus(item) === 'full').length);
const partialAllocatedCount = computed(() => workloadItems.value.filter(item => getAllocationStatus(item) === 'partial').length);
const pendingCount = computed(() => workloadItems.value.filter(item => getAllocationStatus(item) === 'pending').length);

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
    if (data.orders) orders.value = data.orders;
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

function hasDayLevelAlterations(dateStr) {
    const cal = getCalendarForDate(dateStr);
    if (!cal || !cal.alterations) return false;
    return cal.alterations.some(a => a.date === dateStr && !a.machine);
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

function isWeekend(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6;
}

function isPastDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function getDateHeaderClass(dateStr) {
    if (isPastDate(dateStr)) return 'past-date';
    if (isWeekend(dateStr)) return 'weekend';
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

function getMachineUtilization(machineId) {
    let totalUsed = 0;
    let totalCapacity = 0;
    dateRange.value.forEach(date => {
        totalUsed += getUsedMinutes(machineId, date);
        totalCapacity += getEffectiveMinutes(date, machineId);
    });
    return totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
}

function getUtilizationClass(machineId) {
    const pct = getMachineUtilization(machineId);
    if (pct >= 90) return 'util-high';
    if (pct >= 50) return 'util-medium';
    return 'util-low';
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

function isItemAllocated(item) {
    return allocations.value.some(a =>
        a.item === item.item &&
        a.process === selectedProcess.value &&
        a.colour === item.colour &&
        a.size === item.size
    );
}

// View type lock detection
function getLockedViewType(itemCode) {
    const itemAllocations = allocations.value.filter(a =>
        a.item === itemCode &&
        a.process === selectedProcess.value &&
        a.order === selectedOrder.value
    );
    if (itemAllocations.length === 0) return null;

    const sample = itemAllocations[0];
    if (sample.colour && !sample.size) return 'colour_wise';
    if (!sample.colour && sample.size) return 'size_wise';
    if (!sample.colour && !sample.size) return 'item_wise';
    return null;
}

function isLockedToOtherView(item) {
    const locked = getLockedViewType(item.item);
    return locked !== null && locked !== viewType.value;
}

const VIEW_TYPE_LABELS = { item_wise: 'Item Wise', colour_wise: 'Colour Wise', size_wise: 'Size Wise' };

function getLockedViewTypeLabel(item) {
    const locked = getLockedViewType(item.item);
    return locked ? VIEW_TYPE_LABELS[locked] : '';
}

// === Gantt Grouping Helpers ===

function isNextDay(dateA, dateB) {
    const [y, m, d] = dateA.split('-').map(Number);
    const next = new Date(y, m - 1, d + 1);
    const expected = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    return expected === dateB;
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
    const undoData = targetDays.map(({ alloc }) => ({
        key: alloc.key,
        oldMachineId: alloc.machine_id,
        oldDate: alloc.operation_date,
        oldShift: alloc.shift
    }));

    targetDays.forEach(({ alloc, newDate }) => {
        alloc.machine_id = newMachineId;
        alloc.operation_date = newDate;
        alloc.shift = getShiftForDate(newDate)?.name || '';
    });

    return undoData;
}

function computeGroupMoveShiftPlan(machineId, targetDays, conflicting, excludeKeys) {
    const dates = dateRange.value;
    const targetDateSet = new Set(targetDays.map(t => t.newDate));

    // Build a set of occupied dates on the target machine after shifting
    const occupiedDates = new Set();
    // The group's target dates will be occupied by the group
    targetDateSet.forEach(d => occupiedDates.add(d));
    // Other existing allocations on this machine (not conflicting, not being moved)
    allocations.value.forEach(a => {
        if (a.machine_id === machineId && !excludeKeys.includes(a.key) && !conflicting.some(c => c.key === a.key)) {
            occupiedDates.add(a.operation_date);
        }
    });

    // Find the last target date to start searching from after it
    const lastTargetDate = targetDays[targetDays.length - 1].newDate;
    const lastTargetIdx = dates.indexOf(lastTargetDate);

    const affected = [];
    // Sort conflicting by date
    const sorted = [...conflicting].sort((a, b) => a.operation_date.localeCompare(b.operation_date));

    sorted.forEach(alloc => {
        let placed = false;
        // Search forward from after the last target date
        for (let i = lastTargetIdx + 1; i < dates.length; i++) {
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

    return { affected };
}

function moveGroup(groupData, newMachineId, newStartDate) {
    const oldStart = new Date(groupData.start_date);
    const newStart = new Date(newStartDate);
    const dayOffset = Math.round((newStart - oldStart) / (1000 * 60 * 60 * 24));

    if (dayOffset === 0 && groupData.machine_id === newMachineId) return;

    const groupAllocs = groupData.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);

    if (groupAllocs.length === 0) {
        frappe.show_alert({ message: __('Group allocations not found'), indicator: 'red' });
        return;
    }

    const targetDays = groupAllocs.map(alloc => ({
        alloc,
        newDate: addDaysToDate(alloc.operation_date, dayOffset)
    }));

    // Validate date range and past dates
    for (const { newDate } of targetDays) {
        if (!dateRange.value.includes(newDate)) {
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
        const undoData = executeMoveGroup(groupData, targetDays, newMachineId);
        saveAction('move_group', { allocations: undoData });
        frappe.show_alert({ message: __('Group moved successfully'), indicator: 'green' });
        return;
    }

    // Compute shift plan for conflicting allocations
    const { affected } = computeGroupMoveShiftPlan(newMachineId, targetDays, conflicting, groupData.alloc_keys);
    const outOfBounds = affected.some(a => a.newDate === null);

    if (outOfBounds) {
        frappe.show_alert({
            message: __('Cannot move: some conflicting allocations would be pushed beyond the calendar date range. Extend end date first.'),
            indicator: 'red'
        });
        return;
    }

    // Show shift modal for confirmation
    shiftModalData.value = {
        type: 'move_group',
        affectedAllocations: affected,
        groupData,
        targetDays,
        targetMachineId: newMachineId
    };
    showShiftModal.value = true;
}

function openEditGroupModal() {
    if (!selectedGroup.value) return;
    editGroupQuantity.value = selectedGroup.value.total_quantity;
    showEditGroupModal.value = true;
    closeContextMenu();
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

function openSplitGroupModal() {
    if (!selectedGroup.value || selectedGroup.value.allocs.length < 2) {
        frappe.show_alert({ message: __('Cannot split a single-day group'), indicator: 'orange' });
        closeContextMenu();
        return;
    }
    splitGroupDate.value = selectedGroup.value.allocs[1].operation_date;
    showSplitGroupModal.value = true;
    closeContextMenu();
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

async function deleteGroup() {
    if (!selectedGroup.value) return;
    closeContextMenu();

    const group = selectedGroup.value;
    const allocs = group.alloc_keys.map(key => allocations.value.find(a => a.key === key)).filter(Boolean);

    const savedAllocs = allocs.filter(a => a.name);
    for (const alloc of savedAllocs) {
        try {
            await frappe.call({
                method: 'albion.albion.page.capacity_planning.capacity_planning.delete_allocation',
                args: { allocation_name: alloc.name }
            });
        } catch (e) {
            console.error('Error deleting allocation:', e);
            frappe.show_alert({ message: __('Error deleting some allocations'), indicator: 'red' });
            return;
        }
    }

    const undoData = allocs.map(a => ({ ...a }));
    const machineId = group.machine_id;
    const gapStartDate = group.start_date;
    const deletedKeys = group.alloc_keys;

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
            affectedAllocations: affected
        };
        showBackfillModal.value = true;
    } else {
        saveAction('delete_group', { allocations: undoData });
        frappe.show_alert({ message: __(`Deleted group: ${group.allocs.length} day(s)`), indicator: 'green' });
    }

    selectedGroup.value = null;
}

function confirmBackfill() {
    if (!backfillModalData.value) return;
    const bd = backfillModalData.value;

    const shiftedAllocations = [];
    bd.affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
        shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift });
        allocation.operation_date = newDate;
        const newShift = getShiftForDate(newDate);
        allocation.shift = newShift?.name || '';
    });

    saveAction('delete_group_and_backfill', {
        allocations: bd.deletedAllocations,
        shiftedAllocations
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

function closeBackfillModal() {
    showBackfillModal.value = false;
    backfillModalData.value = null;
}

// Shift helpers
function getDateAtOffset(dateStr, offset) {
    const dates = dateRange.value;
    const idx = dates.indexOf(dateStr);
    if (idx < 0) return null;
    const target = idx + offset;
    return target >= 0 && target < dates.length ? dates[target] : null;
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
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                }
            });
            break;
        case 'shift_and_move':
            action.data.addedKeys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
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
            action.data.allocations.forEach(({ key, oldMachineId, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.machine_id = oldMachineId;
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                }
            });
            break;
        case 'shift_and_move_group':
            // Reverse shifted allocations first
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                }
            });
            // Then reverse group move
            action.data.moveAllocations.forEach(({ key, oldMachineId, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.machine_id = oldMachineId;
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
                }
            });
            break;
        case 'delete_group':
            action.data.allocations.forEach(a => {
                allocations.value.push(a);
            });
            break;
        case 'delete_group_and_backfill':
            // Reverse shifted allocations first
            action.data.shiftedAllocations.forEach(({ key, oldDate, oldShift }) => {
                const a = allocations.value.find(al => al.key === key);
                if (a) {
                    a.operation_date = oldDate;
                    a.shift = oldShift || '';
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
    }

    frappe.show_alert({ message: __('Action undone'), indicator: 'blue' });
}

// Drag and Drop
function onDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
}

function onAllocationDragStart(event, alloc) {
    event.dataTransfer.setData('application/allocation', JSON.stringify(alloc));
}

function getNextDate(currentDateStr) {
    const dates = dateRange.value;
    const idx = dates.indexOf(currentDateStr);
    if (idx >= 0 && idx < dates.length - 1) {
        return dates[idx + 1];
    }
    return null;
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

    if (errors.length > 0) {
        validationErrors.value = errors;
        frappe.show_alert({
            message: __(errors[0]),
            indicator: 'red'
        });
        return;
    }

    // One-item-per-machine-day validation
    if (!validateMachineDaySlot(machineId, dateStr)) {
        frappe.show_alert({
            message: __('This machine already has an allocation on this date. One item per machine per day.'),
            indicator: 'red'
        });
        return;
    }

    // View type lock check
    const lockedView = getLockedViewType(item.item);
    if (lockedView && lockedView !== viewType.value) {
        frappe.show_alert({
            message: __(`This item is already allocated in ${VIEW_TYPE_LABELS[lockedView]} view. Delete existing allocations first to use a different view type.`),
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

    if (isWeekend(dateStr)) {
        frappe.show_alert({
            message: __('Warning: Allocating to weekend'),
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
        sd.affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
            shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift });
            allocation.operation_date = newDate;
            const newShift = getShiftForDate(newDate);
            allocation.shift = newShift?.name || '';
        });

        // Execute the group move
        const moveUndoData = executeMoveGroup(sd.groupData, sd.targetDays, sd.targetMachineId);

        saveAction('shift_and_move_group', {
            moveAllocations: moveUndoData,
            shiftedAllocations
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
    affectedAllocations.forEach(({ allocation, currentDate, newDate }) => {
        shiftedAllocations.push({ key: allocation.key, oldDate: currentDate, oldShift: allocation.shift });
        allocation.operation_date = newDate;
        const newShift = getShiftForDate(newDate);
        allocation.shift = newShift?.name || '';
    });

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
            sourceRemoved: sourceResult.sourceRemoved,
            sourceKey: shiftData.sourceKey,
            sourceSnapshot: sourceResult.sourceSnapshot || null,
            movedQty: dropQty,
            movedMinutes: dropQty * pd.minutesPerUnit
        });
    } else if (allocationsMade > 0 || shiftedAllocations.length > 0) {
        saveAction('shift_and_add', {
            addedKeys: allocationKeys,
            shiftedAllocations
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

async function removeAllocation(alloc) {
    const idx = allocations.value.findIndex(a => a.key === alloc.key);
    if (idx > -1) {
        if (alloc.name) {
            try {
                const response = await frappe.call({
                    method: 'albion.albion.page.capacity_planning.capacity_planning.delete_allocation',
                    args: { allocation_name: alloc.name }
                });
                if (response.message && response.message.success) {
                    saveAction('delete', { allocation: { ...alloc } });
                    allocations.value.splice(idx, 1);
                    frappe.show_alert({ message: __('Allocation deleted'), indicator: 'green' });
                } else {
                    frappe.show_alert({ message: __('Failed to delete: ') + (response.message?.message || 'Unknown error'), indicator: 'red' });
                }
            } catch (e) {
                console.error('Error deleting allocation:', e);
                frappe.show_alert({ message: __('Error deleting allocation'), indicator: 'red' });
            }
        } else {
            saveAction('delete', { allocation: { ...alloc } });
            allocations.value.splice(idx, 1);
            frappe.show_alert({ message: __('Allocation removed'), indicator: 'blue' });
        }
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
        console.log('Loading all allocations for:', startDate.value, 'to', endDate.value);
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_all_allocations',
            args: {
                start_date: startDate.value,
                end_date: endDate.value
            }
        });
        console.log('All allocations response:', response.message);
        if (response.message && response.message.length > 0) {
            allocations.value = response.message.map((a, idx) => ({
                key: `existing-${idx}`,
                ...a
            }));
            console.log('Loaded allocations:', allocations.value);
        } else {
            allocations.value = [];
            console.log('No allocations found for date range');
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
            args: { allocations: allocations.value }
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
    } catch (e) {
        console.error('Error adding alteration:', e);
        frappe.show_alert({ message: __('Error adding alteration'), indicator: 'red' });
        alterationSaving.value = false;
    }
}

onMounted(async () => {
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

defineExpose({
    loadData,
    loadExistingAllocations,
    refreshCalendar
});
</script>

<style scoped>
/* ===== Design System Tokens ===== */
/* Spacing: 4px scale (4, 8, 12, 16, 20, 24, 32) */
/* Radius: 4 (sm), 6 (md), 10 (lg), 14 (xl) */
/* Shadows: sm, md, lg */
/* Font: 10, 11, 12, 13, 14, 16 */
/* Colors: slate-50..900 base, blue/green/amber/red semantic */

/* ===== Layout Shell ===== */
.capacity-planning {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
}

.cp-header {
    background: white;
    padding: 12px 20px;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.cp-filters {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
}

.filter-group {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
}

.action-group {
    display: flex;
    gap: 8px;
    align-items: flex-end;
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

.form-control {
    min-width: unset;
    width: 100%;
    padding: 7px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    color: #1e293b;
    transition: border-color 0.15s, box-shadow 0.15s;
}

select.form-control {
    -webkit-appearance: menulist;
    -moz-appearance: menulist;
    appearance: menulist;
    padding-block: 0;
}

.form-control:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.form-control:disabled {
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
}

.text-info { color: #2563eb; }
.text-danger { color: #ef4444; }

/* ===== Validation ===== */
.validation-alerts {
    padding: 8px 20px;
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
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
    overflow: hidden;
}

/* ===== Left Panel - Workload ===== */
.cp-left-panel {
    width: 280px;
    background: white;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 16px;
    border-bottom: 1px solid #e2e8f0;
}

.panel-header h4 {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 2px 0;
}

.panel-subtitle {
    font-size: 12px;
    color: #94a3b8;
}

.workload-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.summary-item {
    display: flex;
    gap: 4px;
    font-size: 11px;
}

.summary-item .label {
    color: #94a3b8;
}

.summary-item .value {
    font-weight: 700;
    color: #0f172a;
}

.workload-list {
    flex: 1;
    overflow-y: auto;
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

.workload-item.locked {
    border-left-color: #8b5cf6;
    opacity: 0.55;
    background: #faf5ff;
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

.locked-reason {
    font-size: 11px;
    color: #7c3aed;
    font-weight: 600;
    margin-top: 4px;
}

/* ===== Right Panel - Calendar ===== */
.cp-right-panel {
    flex: 1;
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
}

.calendar-header h4 {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
}

.calendar-legend {
    display: flex;
    gap: 16px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748b;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dot.available { background: white; border: 1.5px solid #cbd5e1; }
.dot.allocated { background: #e2e8f0; border: 1.5px solid #94a3b8; }
.dot.full { background: #fecaca; border: 1.5px solid #f87171; }
.dot.conflict { background: #fecaca; border: 2px solid #ef4444; }

.calendar-wrapper {
    flex: 1;
    overflow: auto;
    background: #f8fafc;
}

/* ===== Gantt Grid ===== */
.gantt-grid {
    display: grid;
    width: max-content;
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
}

.gantt-date-header.weekend {
    background: #fef9c3;
}

.gantt-date-header.past-date {
    background: #fef2f2;
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

.gantt-date-header {
    cursor: pointer;
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

.machine-utilization {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
}

.util-low {
    background: #dcfce7;
    color: #166534;
}

.util-medium {
    background: #fef3c7;
    color: #92400e;
}

.util-high {
    background: #fee2e2;
    color: #991b1b;
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

.cell-top-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-height: 18px;
}

.alteration-badge {
    position: absolute;
    top: 3px;
    left: 4px;
    z-index: 11;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
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
</style>
