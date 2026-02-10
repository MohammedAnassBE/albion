<template>
    <div class="capacity-planning">
        <div class="cp-header">
            <div class="cp-filters">
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
                    <select v-model="selectedProcess" @change="onProcessChange" class="form-control">
                        <option value="">Select Process</option>
                        <option v-for="proc in processes" :key="proc.name" :value="proc.name">
                            {{ proc.process_name }}
                        </option>
                    </select>
                </div>
                <div class="form-group">
                    <label>View Type</label>
                    <select v-model="viewType" class="form-control">
                        <option value="item_wise">Item Wise</option>
                        <option value="colour_wise">Colour Wise</option>
                        <option value="size_wise">Size Wise</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" v-model="startDate" class="form-control" />
                </div>
                <div class="form-group">
                    <label>End Date</label>
                    <input type="date" v-model="endDate" class="form-control" />
                </div>
                <div class="form-group">
                    <button class="btn btn-primary" @click="refreshCalendar">Refresh</button>
                    <button class="btn btn-success" @click="saveAllocations">Save</button>
                </div>
            </div>
        </div>

        <div class="cp-body">
            <!-- Left Panel - Workload List -->
            <div class="cp-left-panel">
                <div class="panel-header">
                    <h4>Workload</h4>
                    <span class="text-muted">Drag items to calendar</span>
                </div>
                <div class="workload-list">
                    <div v-if="workloadItems.length === 0" class="text-muted">
                        Select order and process to view workload
                    </div>
                    <div
                        v-for="item in workloadItems"
                        :key="item.key"
                        class="workload-item"
                        draggable="true"
                        @dragstart="onDragStart($event, item)"
                    >
                        <div class="item-header">
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
                    </div>
                </div>
                <div class="calendar-wrapper">
                    <table class="calendar-table">
                        <thead>
                            <tr>
                                <th class="machine-header">Machine</th>
                                <th v-for="date in dateRange" :key="date" class="date-header">
                                    <div class="date-cell">
                                        <span class="day-name">{{ formatDayName(date) }}</span>
                                        <span class="day-date">{{ formatDate(date) }}</span>
                                        <span class="shift-name">{{ getShiftForDate(date)?.shift_name || 'No Shift' }}</span>
                                        <span class="shift-duration">{{ getShiftMinutes(date) }} mins</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="machine in machines" :key="machine.machine_id">
                                <td class="machine-cell">
                                    <div class="machine-info">
                                        <span class="machine-id">{{ machine.machine_id }}</span>
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
                                            :style="{ backgroundColor: getAllocationColor(alloc) }"
                                        >
                                            <span class="alloc-item">{{ alloc.item }}</span>
                                            <span class="alloc-qty">{{ alloc.quantity }}</span>
                                            <span class="alloc-mins">{{ alloc.allocated_minutes }}m</span>
                                            <button class="btn-remove" @click="removeAllocation(alloc)">×</button>
                                        </div>
                                        <div class="cell-summary">
                                            <span class="used-minutes">{{ getUsedMinutes(machine.machine_id, date) }}m</span>
                                            <span class="remaining-minutes">/ {{ getShiftMinutes(date) }}m</span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
    orders: Array,
    processes: Array,
    machines: Array
});

const emit = defineEmits(['saveAllocations']);

// State
const selectedOrder = ref('');
const selectedProcess = ref('');
const viewType = ref('item_wise');
const startDate = ref('');
const endDate = ref('');
const orderData = ref(null);
const shiftCalendars = ref([]);
const defaultShift = ref(null);
const allocations = ref([]);

// Initialize dates
const today = new Date();
startDate.value = today.toISOString().split('T')[0];
const nextMonth = new Date(today.setMonth(today.getMonth() + 1));
endDate.value = nextMonth.toISOString().split('T')[0];

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

const workloadItems = computed(() => {
    if (!orderData.value || !selectedProcess.value) return [];

    const items = [];
    const processMinutes = getProcessMinutes();

    if (viewType.value === 'item_wise') {
        const itemTotals = {};
        orderData.value.order_details.forEach(detail => {
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
        orderData.value.order_details.forEach(detail => {
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
        orderData.value.order_details.forEach(detail => {
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

// Methods
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
    return shift ? shift.duration_minutes : 480; // Default 8 hours
}

function getAllocations(machineId, dateStr) {
    return allocations.value.filter(a => a.machine_id === machineId && a.operation_date === dateStr);
}

function getUsedMinutes(machineId, dateStr) {
    return getAllocations(machineId, dateStr).reduce((sum, a) => sum + a.allocated_minutes, 0);
}

function getCellClass(machineId, dateStr) {
    const used = getUsedMinutes(machineId, dateStr);
    const total = getShiftMinutes(dateStr);
    if (used >= total) return 'cell-full';
    if (used > 0) return 'cell-allocated';
    return 'cell-available';
}

function getAllocationColor(alloc) {
    const colors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec', '#e0f2f1'];
    let hash = 0;
    for (let i = 0; i < alloc.item.length; i++) {
        hash = alloc.item.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Drag and Drop
function onDragStart(event, item) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
}

function onDrop(event, machineId, dateStr) {
    const item = JSON.parse(event.dataTransfer.getData('application/json'));
    const shift = getShiftForDate(dateStr);
    const usedMinutes = getUsedMinutes(machineId, dateStr);
    const totalMinutes = getShiftMinutes(dateStr);
    const neededMinutes = item.quantity * item.minutes;

    // Check if there's capacity
    if (usedMinutes + neededMinutes > totalMinutes) {
        frappe.show_alert({
            message: __('Not enough capacity on this date'),
            indicator: 'red'
        });
        return;
    }

    // Add allocation
    allocations.value.push({
        key: `${machineId}-${dateStr}-${Date.now()}`,
        machine_id: machineId,
        operation_date: dateStr,
        shift: shift?.name || '',
        order: selectedOrder.value,
        item: item.item,
        process: selectedProcess.value,
        colour: item.colour,
        size: item.size,
        quantity: item.quantity,
        allocated_minutes: neededMinutes
    });

    frappe.show_alert({
        message: __('Allocation added'),
        indicator: 'green'
    });
}

function removeAllocation(alloc) {
    const idx = allocations.value.findIndex(a => a.key === alloc.key);
    if (idx > -1) {
        allocations.value.splice(idx, 1);
    }
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

function onProcessChange() {
    // Process change triggers recalculation via computed
}

async function refreshCalendar() {
    await loadShiftCalendars();
    await loadExistingAllocations();
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

async function loadExistingAllocations() {
    if (!selectedOrder.value || !selectedProcess.value) return;
    try {
        const response = await frappe.call({
            method: 'albion.albion.page.capacity_planning.capacity_planning.get_existing_allocations',
            args: {
                order: selectedOrder.value,
                process: selectedProcess.value
            }
        });
        if (response.message) {
            allocations.value = response.message.map((a, idx) => ({
                key: `existing-${idx}`,
                ...a
            }));
        }
    } catch (e) {
        console.error('Error loading allocations:', e);
    }
}

async function saveAllocations() {
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
            emit('saveAllocations', allocations.value);
        }
    } catch (e) {
        console.error('Error saving allocations:', e);
        frappe.show_alert({ message: __('Failed to save allocations'), indicator: 'red' });
    }
}

onMounted(() => {
    loadShiftCalendars();
});

defineExpose({
    loadExistingAllocations,
    refreshCalendar
});
</script>

<style scoped>
.capacity-planning {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f5f7fa;
}

.cp-header {
    background: white;
    padding: 15px;
    border-bottom: 1px solid #d1d8dd;
}

.cp-filters {
    display: flex;
    gap: 15px;
    align-items: flex-end;
    flex-wrap: wrap;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.form-group label {
    font-size: 12px;
    font-weight: 600;
    color: #36414c;
}

.form-control {
    min-width: 150px;
    padding: 6px 10px;
    border: 1px solid #d1d8dd;
    border-radius: 4px;
}

.cp-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.cp-left-panel {
    width: 300px;
    background: white;
    border-right: 1px solid #d1d8dd;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 15px;
    border-bottom: 1px solid #d1d8dd;
}

.panel-header h4 {
    margin: 0 0 5px 0;
}

.workload-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

.workload-item {
    background: #f8f9fa;
    border: 1px solid #d1d8dd;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 10px;
    cursor: grab;
    transition: all 0.2s;
}

.workload-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-color: #5e64ff;
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

.item-name {
    font-weight: 600;
    color: #36414c;
}

.item-qty {
    background: #5e64ff;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
}

.item-detail {
    font-size: 12px;
    color: #8d99a6;
}

.item-minutes {
    font-size: 11px;
    color: #8d99a6;
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
    padding: 15px;
    border-bottom: 1px solid #d1d8dd;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.calendar-header h4 {
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
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.dot.available { background: #e8f5e9; }
.dot.allocated { background: #fff3e0; }
.dot.full { background: #ffebee; }

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
    border: 1px solid #d1d8dd;
    min-width: 120px;
}

.machine-header {
    background: #f8f9fa;
    padding: 10px;
    font-weight: 600;
    position: sticky;
    left: 0;
    z-index: 10;
}

.date-header {
    background: #f8f9fa;
    padding: 8px;
    text-align: center;
}

.date-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.day-name {
    font-size: 11px;
    color: #8d99a6;
}

.day-date {
    font-weight: 600;
    font-size: 13px;
}

.shift-name {
    font-size: 10px;
    color: #5e64ff;
}

.shift-duration {
    font-size: 10px;
    color: #8d99a6;
}

.machine-cell {
    background: #f8f9fa;
    padding: 10px;
    position: sticky;
    left: 0;
    z-index: 10;
}

.machine-info {
    display: flex;
    flex-direction: column;
}

.machine-id {
    font-weight: 600;
    font-size: 12px;
}

.machine-name {
    font-size: 11px;
    color: #8d99a6;
}

.calendar-cell {
    padding: 5px;
    vertical-align: top;
    min-height: 80px;
    transition: background 0.2s;
}

.cell-available {
    background: #e8f5e9;
}

.cell-allocated {
    background: #fff3e0;
}

.cell-full {
    background: #ffebee;
}

.calendar-cell:hover {
    box-shadow: inset 0 0 0 2px #5e64ff;
}

.cell-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.allocation-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 11px;
    flex-wrap: wrap;
}

.alloc-item {
    font-weight: 600;
}

.alloc-qty {
    background: rgba(0, 0, 0, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
}

.alloc-mins {
    color: #666;
}

.btn-remove {
    margin-left: auto;
    background: rgba(0, 0, 0, 0.2);
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    cursor: pointer;
    line-height: 1;
}

.btn-remove:hover {
    background: rgba(255, 0, 0, 0.3);
}

.cell-summary {
    margin-top: auto;
    padding-top: 5px;
    border-top: 1px dashed #d1d8dd;
    font-size: 11px;
    text-align: right;
}

.used-minutes {
    font-weight: 600;
}

.remaining-minutes {
    color: #8d99a6;
}
</style>
