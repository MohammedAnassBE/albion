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

            <!-- Right Panel - Calendar -->
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
                    <table class="calendar-table">
                        <thead>
                            <tr>
                                <th class="machine-header">Machine</th>
                                <th v-for="date in dateRange" :key="date" class="date-header" :class="getDateHeaderClass(date)">
                                    <div class="date-cell">
                                        <span class="day-date">{{ formatDayName(date) }}, {{ formatDate(date) }}</span>
                                        <span class="shift-info">{{ getShiftForDate(date)?.shift_name || 'No Shift' }} &middot; {{ getShiftMinutes(date) }}m</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="machine in machines" :key="machine.machine_id">
                                <td class="machine-cell">
                                    <div class="machine-info">
                                        <div class="machine-title">
                                            <span class="machine-id">{{ machine.machine_id }}</span>
                                            <span class="machine-utilization" :class="getUtilizationClass(machine.machine_id)">
                                                {{ getMachineUtilization(machine.machine_id) }}%
                                            </span>
                                        </div>
                                        <span class="machine-name">{{ machine.machine_name }}</span>
                                    </div>
                                </td>
                                <td
                                    v-for="date in dateRange"
                                    :key="date"
                                    class="calendar-cell"
                                    :class="getCellClass(machine.machine_id, date)"
                                    @dragover.prevent
                                    @drop="onDrop($event, machine.machine_id, date)"
                                >
                                    <div class="cell-content">
                                        <div
                                            v-for="alloc in getAllocations(machine.machine_id, date)"
                                            :key="alloc.key"
                                            class="allocation-item"
                                            :class="{ 'conflict': hasConflict(alloc) }"
                                            :style="{ borderLeftColor: getAllocationColor(alloc) }"
                                            draggable="true"
                                            @dragstart="onAllocationDragStart($event, alloc)"
                                            @click="selectAllocation(alloc)"
                                            :title="getAllocationTooltip(alloc)"
                                        >
                                            <div class="alloc-header">
                                                <span class="alloc-item">{{ alloc.item }}</span>
                                                <span class="alloc-qty">{{ alloc.quantity }}</span>
                                            </div>
                                            <div class="alloc-process" v-if="alloc.process">{{ alloc.process }}</div>
                                            <div class="alloc-footer">
                                                <span class="alloc-mins">{{ alloc.allocated_minutes }}m</span>
                                                <button class="btn-remove" @click.stop="removeAllocation(alloc)">&times;</button>
                                            </div>
                                        </div>
                                        <div class="cell-summary" v-if="getUsedMinutes(machine.machine_id, date) > 0">
                                            <span class="used-minutes">{{ getUsedMinutes(machine.machine_id, date) }}m</span>
                                            <span class="remaining-minutes">/ {{ getShiftMinutes(date) }}m</span>
                                        </div>
                                        <div class="capacity-bar" v-if="getUsedMinutes(machine.machine_id, date) > 0">
                                            <div class="capacity-fill" :style="{ width: getCapacityPercentage(machine.machine_id, date) + '%' }" :class="getCapacityBarClass(machine.machine_id, date)"></div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Split Quantity Modal -->
        <div v-if="showSplitModal" class="modal-overlay" @click="closeSplitModal">
            <div class="modal-content" @click.stop>
                <h4>Split Quantity</h4>
                <div class="form-group">
                    <label>Original Quantity: {{ selectedAllocation?.quantity }}</label>
                </div>
                <div class="form-group">
                    <label>Split Quantity</label>
                    <input type="number" v-model.number="splitQuantity" class="form-control" min="1" :max="(selectedAllocation?.quantity || 1) - 1" />
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmSplit">Split</button>
                    <button class="btn btn-secondary" @click="closeSplitModal">Cancel</button>
                </div>
            </div>
        </div>

        <!-- Edit Quantity Modal -->
        <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
            <div class="modal-content" @click.stop>
                <h4>Edit Quantity</h4>
                <div class="form-group">
                    <label>Current Quantity: {{ selectedAllocation?.quantity }}</label>
                </div>
                <div class="form-group">
                    <label>New Quantity</label>
                    <input type="number" v-model.number="editQuantity" class="form-control" min="1" />
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" @click="confirmEdit">Update</button>
                    <button class="btn btn-secondary" @click="closeEditModal">Cancel</button>
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
                <div class="form-group" v-if="pendingDrop.type === 'workload' && dropQuantity > pendingDrop.availableCapacityQty">
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

        <!-- Right-click Context Menu -->
        <div v-if="contextMenu.show" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
            <div class="menu-item" @click="openSplitModal">Split Quantity</div>
            <div class="menu-item" @click="openEditModal">Edit Quantity</div>
            <div class="menu-item" @click="mergeAllocations">Merge with Same</div>
            <div class="menu-item text-danger" @click="deleteSelectedAllocation">Delete</div>
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
const defaultShift = ref(null);
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

// Context menu
const contextMenu = ref({ show: false, x: 0, y: 0 });

// Initialize dates
const today = new Date();
startDate.value = today.toISOString().split('T')[0];
const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
endDate.value = nextMonth.toISOString().split('T')[0];

// Constants
const MIN_BATCH_SIZE = 1;

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

const availableProcesses = computed(() => {
    if (!orderData.value || !processes.value) return [];
    // Only show processes that are defined in at least one item in the order
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

function getShiftForDate(dateStr) {
    const date = new Date(dateStr);
    for (const cal of shiftCalendars.value) {
        const start = new Date(cal.start_date);
        const end = new Date(cal.end_date);
        if (date >= start && date <= end) {
            return cal.shift;
        }
    }
    return defaultShift.value;
}

function getShiftMinutes(dateStr) {
    const shift = getShiftForDate(dateStr);
    return shift ? shift.duration_minutes : 480;
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
    const total = getShiftMinutes(dateStr);
    return total > 0 ? (used / total) * 100 : 0;
}

function getCapacityBarClass(machineId, dateStr) {
    const pct = getCapacityPercentage(machineId, dateStr);
    if (pct >= 95) return 'bar-full';
    if (pct >= 70) return 'bar-warning';
    return 'bar-ok';
}

function getCellClass(machineId, dateStr) {
    const used = getUsedMinutes(machineId, dateStr);
    const total = getShiftMinutes(dateStr);
    const hasConflicts = getAllocations(machineId, dateStr).some(a => hasConflict(a));

    if (hasConflicts) return 'cell-conflict';
    if (used >= total) return 'cell-full';
    if (used > 0) return 'cell-allocated';
    return 'cell-available';
}

function getMachineUtilization(machineId) {
    let totalUsed = 0;
    let totalCapacity = 0;
    dateRange.value.forEach(date => {
        totalUsed += getUsedMinutes(machineId, date);
        totalCapacity += getShiftMinutes(date);
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
    // Allow same item/process on different machines (parallel processing)
    // Only flag as conflict if total allocated quantity exceeds order quantity
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

function getAllocationColor(alloc) {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < alloc.item.length; i++) {
        hash = alloc.item.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getAllocationTooltip(alloc) {
    let tooltip = `Process: ${alloc.process || 'N/A'}\n`;
    tooltip += `Item: ${alloc.item}\n`;
    tooltip += `Quantity: ${alloc.quantity}\n`;
    tooltip += `Minutes: ${alloc.allocated_minutes}m\n`;
    if (alloc.colour) {
        tooltip += `Colour: ${alloc.colour}\n`;
    }
    if (alloc.size) {
        tooltip += `Size: ${alloc.size}\n`;
    }
    if (alloc.order) {
        tooltip += `Order: ${alloc.order}`;
    }
    return tooltip;
}

function getAllocatedQuantity(item) {
    // Check all allocations across all orders for this item/process/colour/size
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

// Check if item is already allocated
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
    // Both set means size_wise with colour context — shouldn't happen in current model
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
            // Remove the added allocations
            action.data.keys.forEach(key => {
                const idx = allocations.value.findIndex(a => a.key === key);
                if (idx > -1) allocations.value.splice(idx, 1);
            });
            break;
        case 'move':
            // Restore original position
            const alloc = allocations.value.find(a => a.key === action.data.key);
            if (alloc) {
                alloc.machine_id = action.data.oldMachineId;
                alloc.operation_date = action.data.oldDate;
            }
            break;
        case 'delete':
            // Restore deleted allocation
            allocations.value.push(action.data.allocation);
            break;
        case 'partial_move':
            // Restore source quantity
            const pmSrc = allocations.value.find(a => a.key === action.data.sourceKey);
            if (pmSrc) {
                pmSrc.quantity += action.data.movedQty;
                pmSrc.allocated_minutes += action.data.movedMinutes;
            }
            // Remove the new allocation
            const pmIdx = allocations.value.findIndex(a => a.key === action.data.newKey);
            if (pmIdx > -1) allocations.value.splice(pmIdx, 1);
            break;
    }

    frappe.show_alert({ message: __('Action undone'), indicator: 'blue' });
}

// Drag and Drop
function onDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
}

// Drag existing allocation
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
    // Check if this is an allocation move first
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

    // 13. Order Status Check
    if (orderData.value?.docstatus !== 1) {
        errors.push('Order must be submitted before allocation');
    }

    // 14. Date Range Check
    if (!dateRange.value.includes(dateStr)) {
        errors.push('Date is outside calendar range');
    }

    // 15. Past Date Restriction
    if (isPastDate(dateStr)) {
        errors.push('Cannot allocate to past dates');
    }

    // 5. Zero Capacity Check
    const shift = getShiftForDate(dateStr);
    if (!shift) {
        errors.push('No shift defined for this date');
    }

    // 11. Process-Item Match validation
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
    const totalMinutes = getShiftMinutes(dateStr);
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

    // Exclude this allocation's own minutes if moving within the same cell
    const isSameCell = actualAlloc.machine_id === newMachineId && actualAlloc.operation_date === newDateStr;
    const usedMinutes = getUsedMinutes(newMachineId, newDateStr) - (isSameCell ? actualAlloc.allocated_minutes : 0);
    const totalMinutes = getShiftMinutes(newDateStr);
    const availableMinutes = totalMinutes - usedMinutes;
    const minutesPerUnit = actualAlloc.quantity > 0 ? actualAlloc.allocated_minutes / actualAlloc.quantity : 0;
    const availableCapacityQty = minutesPerUnit > 0 ? Math.floor(availableMinutes / minutesPerUnit) : 0;

    if (availableCapacityQty < MIN_BATCH_SIZE) {
        frappe.show_alert({
            message: __('No capacity available on target cell'),
            indicator: 'red'
        });
        return;
    }

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
        availableCapacityQty
    };
    dropQuantity.value = Math.min(actualAlloc.quantity, availableCapacityQty);
    showDropModal.value = true;
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
        let remainingQty = qty;
        let currentDate = pd.dateStr;
        let allocationsMade = 0;
        const allocationKeys = [];

        while (remainingQty >= MIN_BATCH_SIZE && currentDate) {
            const shift = getShiftForDate(currentDate);
            const usedMin = getUsedMinutes(pd.machineId, currentDate);
            const totalMin = getShiftMinutes(currentDate);
            const availMin = totalMin - usedMin;

            if (availMin <= 0) {
                currentDate = getNextDate(currentDate);
                continue;
            }

            const fitQty = Math.floor(availMin / pd.minutesPerUnit);
            const allocQty = Math.min(remainingQty, fitQty);

            if (allocQty >= MIN_BATCH_SIZE) {
                const key = `${pd.machineId}-${currentDate}-${Date.now()}-${allocationsMade}`;
                allocations.value.push({
                    key,
                    machine_id: pd.machineId,
                    operation_date: currentDate,
                    shift: shift?.name || '',
                    order: selectedOrder.value,
                    item: pd.item,
                    process: selectedProcess.value,
                    colour: pd.colour,
                    size: pd.size,
                    quantity: allocQty,
                    allocated_minutes: allocQty * pd.minutesPerUnit
                });
                allocationKeys.push(key);
                remainingQty -= allocQty;
                allocationsMade++;
            }

            currentDate = getNextDate(currentDate);
        }

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

        const shift = getShiftForDate(pd.dateStr);

        if (qty === sourceAlloc.quantity) {
            // Full move
            const oldMachineId = sourceAlloc.machine_id;
            const oldDate = sourceAlloc.operation_date;

            sourceAlloc.machine_id = pd.machineId;
            sourceAlloc.operation_date = pd.dateStr;
            sourceAlloc.shift = shift?.name || '';

            saveAction('move', { key: sourceAlloc.key, oldMachineId, oldDate });
            frappe.show_alert({ message: __('Allocation moved successfully'), indicator: 'green' });
        } else {
            // Partial move
            const movedMinutes = qty * pd.minutesPerUnit;
            const oldQty = sourceAlloc.quantity;
            const oldMinutes = sourceAlloc.allocated_minutes;

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

    closeDropModal();
}

function closeDropModal() {
    showDropModal.value = false;
    pendingDrop.value = null;
    dropQuantity.value = 0;
}

async function removeAllocation(alloc) {
    const idx = allocations.value.findIndex(a => a.key === alloc.key);
    if (idx > -1) {
        // Delete from database if it has a name (existing record)
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
            // New allocation not yet saved to DB
            saveAction('delete', { allocation: { ...alloc } });
            allocations.value.splice(idx, 1);
            frappe.show_alert({ message: __('Allocation removed'), indicator: 'blue' });
        }
    }
}

// Selection and Context Menu
function selectAllocation(alloc, event) {
    selectedAllocation.value = alloc;
    if (event) {
        contextMenu.value = {
            show: true,
            x: event.clientX,
            y: event.clientY
        };
    }
}

function closeContextMenu() {
    contextMenu.value.show = false;
}

// Split Quantity (7)
function openSplitModal() {
    if (!selectedAllocation.value) return;
    splitQuantity.value = Math.floor(selectedAllocation.value.quantity / 2);
    showSplitModal.value = true;
    closeContextMenu();
}

function closeSplitModal() {
    showSplitModal.value = false;
    selectedAllocation.value = null;
}

function confirmSplit() {
    if (!selectedAllocation.value) return;

    const originalQty = selectedAllocation.value.quantity;
    const splitQty = splitQuantity.value;

    if (splitQty < MIN_BATCH_SIZE || splitQty >= originalQty) {
        frappe.show_alert({ message: __('Invalid split quantity'), indicator: 'red' });
        return;
    }

    const remainingQty = originalQty - splitQty;
    const minutesPerUnit = selectedAllocation.value.allocated_minutes / originalQty;

    // Update original allocation
    selectedAllocation.value.quantity = remainingQty;
    selectedAllocation.value.allocated_minutes = remainingQty * minutesPerUnit;

    // Create new allocation with split quantity
    allocations.value.push({
        key: `${selectedAllocation.value.machine_id}-${selectedAllocation.value.operation_date}-${Date.now()}-split`,
        machine_id: selectedAllocation.value.machine_id,
        operation_date: selectedAllocation.value.operation_date,
        shift: selectedAllocation.value.shift,
        order: selectedAllocation.value.order,
        item: selectedAllocation.value.item,
        process: selectedAllocation.value.process,
        colour: selectedAllocation.value.colour,
        size: selectedAllocation.value.size,
        quantity: splitQty,
        allocated_minutes: splitQty * minutesPerUnit
    });

    frappe.show_alert({ message: __('Quantity split successfully'), indicator: 'green' });
    closeSplitModal();
}

// Edit Quantity (9)
function openEditModal() {
    if (!selectedAllocation.value) return;
    editQuantity.value = selectedAllocation.value.quantity;
    showEditModal.value = true;
    closeContextMenu();
}

function closeEditModal() {
    showEditModal.value = false;
    selectedAllocation.value = null;
}

function confirmEdit() {
    if (!selectedAllocation.value) return;

    const newQty = editQuantity.value;
    const originalQty = selectedAllocation.value.quantity;

    if (newQty < MIN_BATCH_SIZE) {
        frappe.show_alert({ message: __(`Minimum quantity is ${MIN_BATCH_SIZE}`), indicator: 'red' });
        return;
    }

    // Check capacity for new quantity
    const minutesPerUnit = selectedAllocation.value.allocated_minutes / originalQty;
    const newMinutes = newQty * minutesPerUnit;
    const machineId = selectedAllocation.value.machine_id;
    const dateStr = selectedAllocation.value.operation_date;
    const currentUsed = getUsedMinutes(machineId, dateStr) - selectedAllocation.value.allocated_minutes;
    const totalMinutes = getShiftMinutes(dateStr);

    if (currentUsed + newMinutes > totalMinutes) {
        frappe.show_alert({ message: __('New quantity exceeds capacity'), indicator: 'red' });
        return;
    }

    // Check if total would exceed order quantity
    const item = workloadItems.value.find(i =>
        i.item === selectedAllocation.value.item &&
        i.colour === selectedAllocation.value.colour &&
        i.size === selectedAllocation.value.size
    );

    if (item) {
        const currentAllocated = getAllocatedQuantity(item);
        const adjustment = newQty - originalQty;
        if (currentAllocated + adjustment > item.quantity) {
            frappe.show_alert({ message: __('Cannot exceed order quantity'), indicator: 'red' });
            return;
        }
    }

    selectedAllocation.value.quantity = newQty;
    selectedAllocation.value.allocated_minutes = newMinutes;

    frappe.show_alert({ message: __('Quantity updated'), indicator: 'green' });
    closeEditModal();
}

// Merge Allocations (8)
function mergeAllocations() {
    if (!selectedAllocation.value) return;

    const alloc = selectedAllocation.value;
    const mergeTargets = allocations.value.filter(a =>
        a.key !== alloc.key &&
        a.machine_id === alloc.machine_id &&
        a.item === alloc.item &&
        a.process === alloc.process &&
        a.colour === alloc.colour &&
        a.size === alloc.size
    );

    if (mergeTargets.length === 0) {
        frappe.show_alert({ message: __('No allocations to merge'), indicator: 'orange' });
        closeContextMenu();
        return;
    }

    // Merge all into the selected allocation
    mergeTargets.forEach(target => {
        alloc.quantity += target.quantity;
        alloc.allocated_minutes += target.allocated_minutes;
        const idx = allocations.value.findIndex(a => a.key === target.key);
        if (idx > -1) allocations.value.splice(idx, 1);
    });

    frappe.show_alert({ message: __('Allocations merged'), indicator: 'green' });
    closeContextMenu();
}

function deleteSelectedAllocation() {
    if (selectedAllocation.value) {
        removeAllocation(selectedAllocation.value);
    }
    closeContextMenu();
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
            // Don't clear allocations - keep showing all machine bookings
            // so user can see capacity across all orders
        }
    } catch (e) {
        console.error('Error loading order:', e);
    }
}

async function onProcessChange() {
    // Only reload workload items, allocations already visible
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
            defaultShift.value = response.message.default_shift;
        }
    } catch (e) {
        console.error('Error loading shifts:', e);
    }
}

async function loadAllAllocations() {
    // Load ALL allocations for the date range regardless of order/process
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
    } catch (e) {
        console.error('Error loading allocations:', e);
        frappe.show_alert({ message: __('Error loading allocations'), indicator: 'red' });
    }
}

async function loadExistingAllocations() {
    // Legacy function - now just calls loadAllAllocations
    await loadAllAllocations();
}

async function saveAllocations() {
    // Run all validations before save
    validationErrors.value = [];
    const errors = [];

    // 18. Over-allocation Check
    workloadItems.value.forEach(item => {
        const allocated = getAllocatedQuantity(item);
        if (allocated > item.quantity) {
            errors.push(`${item.item}: Allocated ${allocated} exceeds order ${item.quantity}`);
        }
    });

    // 26. Conflict Check
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
            // Reload allocations to get the database names for the newly saved records
            await loadAllAllocations();
            emit('saveAllocations', allocations.value);
        }
    } catch (e) {
        console.error('Error saving allocations:', e);
        frappe.show_alert({ message: __('Failed to save allocations'), indicator: 'red' });
    }
}

onMounted(() => {
    loadShiftCalendars();
    loadAllAllocations();
    document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
    document.removeEventListener('click', closeContextMenu);
});

// Watch for date changes and reload allocations
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
.capacity-planning {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f9fafb;
}

.cp-header {
    background: white;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.cp-filters {
    display: flex;
    justify-content: space-between;
    align-items: end;
}

.filter-group {
    display: flex;
    gap: 12px;
    align-items: end;
    flex-wrap: wrap;
}

.action-group {
    display: flex;
    gap: 8px;
    align-items: end;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
}

.form-control {
    min-width: unset;
    width: 100%;
    padding: 7px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    background: white;
    transition: border-color 0.2s, box-shadow 0.2s;
}

select.form-control {
    -webkit-appearance: menulist;
    -moz-appearance: menulist;
    appearance: menulist;
    padding-block: 0;
}

.form-control:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-control:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
}

.text-info {
    color: #2563eb;
}

.border-danger {
    border-color: #ef4444 !important;
}

.text-danger {
    color: #ef4444;
}

.validation-alerts {
    padding: 10px 15px;
    background: #fef2f2;
}

.alert {
    padding: 8px 12px;
    margin-bottom: 5px;
    border-radius: 6px;
}

.alert-danger {
    background: #fee2e2;
    color: #dc2626;
}

.cp-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.cp-left-panel {
    width: 280px;
    background: white;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 14px 12px;
    border-bottom: 1px solid #e5e7eb;
}

.panel-header h4 {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin: 0 0 2px 0;
}

.panel-subtitle {
    font-size: 12px;
    color: #9ca3af;
}

.workload-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 10px 12px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
}

.summary-item {
    display: flex;
    gap: 5px;
    font-size: 11px;
}

.summary-item .label {
    color: #9ca3af;
}

.summary-item .value {
    font-weight: 600;
    color: #111827;
}

.workload-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #9ca3af;
}

.empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.5;
}

.empty-text {
    font-size: 13px;
    text-align: center;
}

.workload-item {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: white;
    margin-bottom: 8px;
    border-left: 3px solid transparent;
    cursor: grab;
    transition: all 0.2s;
}

.workload-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.workload-item.fully-allocated {
    border-left-color: #10b981;
    background: #f9fafb;
    opacity: 0.7;
    cursor: not-allowed;
}

.workload-item.partial-allocated {
    border-left-color: #f59e0b;
    background: white;
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
    opacity: 0.6;
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
    margin-bottom: 5px;
}

.drag-handle {
    color: #d1d5db;
    cursor: grab;
    font-size: 12px;
    margin-right: 6px;
    user-select: none;
}

.item-name {
    font-weight: 600;
    color: #111827;
    flex: 1;
}

.item-qty {
    background: #f3f4f6;
    color: #374151;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
}

.item-detail {
    font-size: 12px;
    color: #6b7280;
}

.item-minutes {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 5px;
}

.item-progress {
    height: 3px;
    background: #f3f4f6;
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
}

.item-progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
}

.item-progress-fill.full {
    background: #10b981;
}

.item-progress-fill.partial {
    background: #f59e0b;
}

.item-progress-fill.pending {
    background: #3b82f6;
}

.allocation-status {
    font-size: 11px;
    margin-top: 5px;
    font-weight: 600;
}

.allocation-status.full {
    color: #10b981;
}

.allocation-status.partial {
    color: #f59e0b;
}

.allocation-status.pending {
    color: #3b82f6;
}

.invalid-reason {
    font-size: 11px;
    color: #ef4444;
    margin-top: 5px;
}

.locked-reason {
    font-size: 11px;
    color: #8b5cf6;
    font-weight: 600;
    margin-top: 5px;
}

.cp-right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.calendar-header {
    background: white;
    padding: 10px 16px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.calendar-header h4 {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin: 0;
}

.calendar-legend {
    display: flex;
    gap: 15px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #6b7280;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.dot.available { background: white; border: 1px solid #e5e7eb; }
.dot.allocated { background: #f8fafc; border: 1px solid #cbd5e1; }
.dot.full { background: #fef2f2; border: 1px solid #fca5a5; }
.dot.conflict { background: #fef2f2; border: 2px solid #ef4444; }

.calendar-wrapper {
    flex: 1;
    overflow: auto;
    background: white;
}

.calendar-table {
    width: 100%;
    border-collapse: collapse;
}

.calendar-table th,
.calendar-table td {
    border: 1px solid #e5e7eb;
    min-width: 130px;
}

.machine-header {
    background: #f9fafb;
    padding: 10px;
    font-weight: 600;
    font-size: 13px;
    color: #111827;
    position: sticky;
    left: 0;
    z-index: 10;
}

.date-header {
    background: #f9fafb;
    padding: 10px 8px;
    text-align: center;
}

.date-header.weekend {
    background: #fef3c7;
}

.date-header.past-date {
    background: #fee2e2;
}

.date-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.day-date {
    font-weight: 600;
    font-size: 12px;
    color: #111827;
}

.shift-info {
    font-size: 11px;
    color: #6b7280;
}

.machine-cell {
    background: #f9fafb;
    padding: 12px;
    border-right: 1px solid #e5e7eb;
    position: sticky;
    left: 0;
    z-index: 10;
}

.machine-info {
    display: flex;
    flex-direction: column;
}

.machine-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.machine-id {
    font-weight: 600;
    font-size: 13px;
    color: #111827;
}

.machine-name {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
}

.machine-utilization {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
}

.util-low {
    background: #ecfdf5;
    color: #059669;
}

.util-medium {
    background: #fef3c7;
    color: #d97706;
}

.util-high {
    background: #fee2e2;
    color: #dc2626;
}

.calendar-cell {
    padding: 6px 8px;
    vertical-align: top;
    min-height: 80px;
    transition: background 0.2s;
}

.cell-available {
    background: white;
}

.cell-allocated {
    background: #f8fafc;
}

.cell-full {
    background: #fef2f2;
}

.cell-conflict {
    background: #fef2f2;
    border: 2px solid #ef4444;
}

.calendar-cell:hover {
    box-shadow: inset 0 0 0 2px #3b82f6;
}

.cell-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.allocation-item {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    background: white;
    border-left: 3px solid;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    cursor: grab;
    border-top: 1px solid #f3f4f6;
    border-right: 1px solid #f3f4f6;
    border-bottom: 1px solid #f3f4f6;
}

.allocation-item:hover {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.allocation-item:active {
    cursor: grabbing;
}

.allocation-item.conflict {
    border: 2px solid #ef4444;
    border-left: 3px solid #ef4444;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.alloc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.alloc-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 2px;
}

.alloc-item {
    font-weight: 600;
    color: #111827;
}

.alloc-qty {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #374151;
}

.alloc-process {
    font-size: 11px;
    color: #6b7280;
}

.alloc-mins {
    font-size: 11px;
    color: #6b7280;
}

.btn-remove {
    width: 18px;
    height: 18px;
    font-size: 12px;
    border-radius: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    opacity: 0;
    transition: opacity 0.15s;
}

.allocation-item:hover .btn-remove {
    opacity: 1;
}

.btn-remove:hover {
    background: #fee2e2;
    color: #ef4444;
}

.cell-summary {
    margin-top: auto;
    padding-top: 5px;
    border-top: 1px dashed #e5e7eb;
    font-size: 11px;
    text-align: right;
}

.used-minutes {
    font-weight: 600;
    color: #111827;
}

.remaining-minutes {
    color: #9ca3af;
}

.capacity-bar {
    height: 6px;
    background: #f3f4f6;
    border-radius: 3px;
    overflow: hidden;
    margin-top: 2px;
}

.capacity-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}

.capacity-fill.bar-ok {
    background: #10b981;
}

.capacity-fill.bar-warning {
    background: #f59e0b;
}

.capacity-fill.bar-full {
    background: #ef4444;
}

/* Modals */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    padding: 24px;
    border-radius: 12px;
    min-width: 300px;
    max-width: 400px;
}

.modal-content h4 {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0 0 15px 0;
}

.modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 15px;
}

.btn {
    padding: 7px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
}

.btn-primary {
    background: #2563eb;
    color: white;
}

.btn-primary:hover {
    background: #1d4ed8;
}

.btn-default {
    background: white;
    border: 1px solid #e5e7eb;
    color: #374151;
}

.btn-default:hover {
    background: #f9fafb;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Context Menu */
.context-menu {
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 1000;
    min-width: 150px;
    padding: 4px;
}

.menu-item {
    padding: 8px 14px;
    cursor: pointer;
    font-size: 13px;
    border-radius: 4px;
    margin: 2px 0;
    color: #374151;
}

.menu-item:hover {
    background: #f3f4f6;
}

.menu-item.text-danger {
    color: #ef4444;
}

.menu-item.text-danger:hover {
    background: #fef2f2;
}
</style>
