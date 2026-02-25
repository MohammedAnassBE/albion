<template>
    <div class="order-matrix">
        <div v-if="Object.keys(matrixData).length === 0" class="empty-state">
            <div class="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
            </div>
            <p>No items added. Add items in the table above to start entering quantities.</p>
        </div>

        <div v-for="(itemData, itemName) in matrixData" :key="itemName" class="item-card">
            <!-- Card Header -->
            <div class="item-card-header">
                <div class="item-card-title">
                    <span class="item-badge">{{ itemName }}</span>
                    <span class="item-grand-total" v-if="itemData.colours.length > 0 && itemData.sizes.length > 0">
                        Total: <strong>{{ getItemGrandTotal(itemData) }}</strong>
                    </span>
                </div>
                <div v-if="!readOnly()" class="item-card-actions">
                    <button class="btn-refresh" @click="refreshItem(itemName)" title="Refresh from Item master">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Colour Selector -->
            <div v-if="!readOnly() && itemData.availableColours.length > 0" class="colour-selector">
                <span class="colour-selector-label">Select Colours</span>
                <div class="colour-chips">
                    <span
                        v-for="colour in itemData.availableColours"
                        :key="colour"
                        class="colour-chip"
                        :class="{ active: itemData.colours.includes(colour) }"
                        @click="toggleColour(itemName, colour)"
                    >
                        <svg v-if="itemData.colours.includes(colour)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {{ colour }}
                    </span>
                </div>
            </div>

            <!-- Matrix Table -->
            <div class="matrix-table-wrapper" v-if="itemData.colours.length > 0 && itemData.sizes.length > 0">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th class="th-colour">Colour</th>
                            <th class="th-rate">Rate</th>
                            <th class="th-delivery-date">Delivery</th>
                            <th v-for="size in itemData.sizes" :key="size" class="th-size">{{ size }}</th>
                            <th class="th-total">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="colour in itemData.colours" :key="colour">
                            <td class="td-colour">{{ colour }}</td>
                            <td class="td-rate">
                                <input
                                    type="number"
                                    class="rate-input"
                                    v-model="itemData.rates[colour]"
                                    @change="onQuantityChange"
                                    @focus="$event.target.select()"
                                    min="0"
                                    step="0.01"
                                    :readonly="readOnly()"
                                    placeholder="0"
                                />
                            </td>
                            <td class="td-delivery-date">
                                <input
                                    type="date"
                                    class="date-input"
                                    v-model="itemData.deliveryDates[colour]"
                                    @change="onQuantityChange"
                                    :readonly="readOnly()"
                                />
                            </td>
                            <td v-for="size in itemData.sizes" :key="size" class="td-qty">
                                <input
                                    type="number"
                                    class="qty-input"
                                    v-model="itemData.quantities[colour][size]"
                                    @change="onQuantityChange"
                                    @focus="$event.target.select()"
                                    min="0"
                                    step="0.01"
                                    :readonly="readOnly()"
                                    placeholder="0"
                                />
                            </td>
                            <td class="td-row-total">
                                {{ getRowTotal(itemData.quantities[colour]) }}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class="tf-label">Total</td>
                            <td class="tf-spacer"></td>
                            <td class="tf-spacer"></td>
                            <td v-for="size in itemData.sizes" :key="size" class="tf-col-total">
                                {{ getColumnTotal(itemData, size) }}
                            </td>
                            <td class="tf-grand-total">
                                {{ getItemGrandTotal(itemData) }}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- Empty state for item -->
            <div v-else class="item-empty">
                <template v-if="itemData.availableColours.length > 0 && itemData.colours.length === 0">
                    Select colours above to start entering quantities.
                </template>
                <template v-else>
                    Loading colours and sizes from item master...
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, unref } from 'vue';

const props = defineProps({
    items: Array,
    orderDetails: Array,
    isReadOnly: {
        type: [Boolean, Object],
        default: false
    }
});

const emit = defineEmits(['updated']);
const matrixData = ref({});

function readOnly() {
    return unref(props.isReadOnly);
}

async function initMatrix(items = null, orderDetails = null) {
    matrixData.value = {};

    const itemList = items || props.items || [];
    const details = orderDetails || props.orderDetails || [];

    if (!itemList || itemList.length === 0) return;

    itemList.forEach(item => {
        const itemName = item.style;
        if (!itemName) return;

        matrixData.value[itemName] = {
            availableColours: [],
            sizes: [],
            colours: [],
            quantities: {},
            rates: {},
            deliveryDates: {}
        };
    });

    for (const item of itemList) {
        if (item.item) {
            await loadFromItem(item.item);
        }
    }

    if (details && details.length > 0) {
        loadOrderDetails(details);
    }
}

function loadOrderDetails(orderDetails = null) {
    const details = orderDetails || props.orderDetails || [];
    if (!details || details.length === 0) return;

    details.forEach(detail => {
        const itemName = detail.item;
        if (!matrixData.value[itemName]) return;

        const item = matrixData.value[itemName];

        if (!item.availableColours.includes(detail.colour)) {
            item.availableColours.push(detail.colour);
        }

        if (!item.colours.includes(detail.colour)) {
            item.colours.push(detail.colour);
            item.quantities[detail.colour] = {};
            item.rates[detail.colour] = 0;
            item.deliveryDates[detail.colour] = '';
        }

        if (!item.sizes.includes(detail.size)) {
            item.sizes.push(detail.size);
        }

        item.quantities[detail.colour][detail.size] = detail.quantity;

        // Pick rate and delivery_date from first row for this item+colour
        if (detail.rate && !item.rates[detail.colour]) {
            item.rates[detail.colour] = detail.rate;
        }
        if (detail.delivery_date && !item.deliveryDates[detail.colour]) {
            item.deliveryDates[detail.colour] = detail.delivery_date;
        }
    });

    // Ensure all selected colours have entries for all sizes
    Object.keys(matrixData.value).forEach(itemName => {
        const item = matrixData.value[itemName];
        item.colours.forEach(colour => {
            item.sizes.forEach(size => {
                if (item.quantities[colour][size] === undefined) {
                    item.quantities[colour][size] = 0;
                }
            });
        });
    });
}

async function loadFromItem(itemName) {
    try {
        const response = await frappe.call({
            method: 'albion.albion.doctype.order.order.get_item_details',
            args: { item_code: itemName }
        });

        if (response.message) {
            const itemData = matrixData.value[itemName];

            response.message.colours.forEach(colour => {
                if (!itemData.availableColours.includes(colour.colour)) {
                    itemData.availableColours.push(colour.colour);
                }
            });

            response.message.sizes.forEach(size => {
                if (!itemData.sizes.includes(size.size)) {
                    itemData.sizes.push(size.size);
                }
            });

            itemData.colours.forEach(colour => {
                if (!itemData.quantities[colour]) {
                    itemData.quantities[colour] = {};
                }
                itemData.sizes.forEach(size => {
                    if (itemData.quantities[colour][size] === undefined) {
                        itemData.quantities[colour][size] = 0;
                    }
                });
            });
        }
    } catch (e) {
        console.error('Error loading item details:', e);
        frappe.msgprint('Error loading item details');
    }
}

function toggleColour(itemName, colour) {
    const itemData = matrixData.value[itemName];
    const idx = itemData.colours.indexOf(colour);

    if (idx === -1) {
        itemData.colours.push(colour);
        itemData.quantities[colour] = {};
        itemData.rates[colour] = 0;
        itemData.deliveryDates[colour] = '';
        itemData.sizes.forEach(size => {
            itemData.quantities[colour][size] = 0;
        });
    } else {
        const hasQty = itemData.sizes.some(size => {
            return (parseFloat(itemData.quantities[colour][size]) || 0) > 0;
        });
        if (hasQty) {
            frappe.msgprint(__('Remove quantities for {0} first before deselecting.', [colour]));
            return;
        }
        itemData.colours.splice(idx, 1);
        delete itemData.quantities[colour];
        delete itemData.rates[colour];
        delete itemData.deliveryDates[colour];
    }

    const details = getData();
    emit('updated', details);
    if (!cur_frm.is_dirty()) {
        cur_frm.dirty();
    }
}

async function refreshItem(itemName) {
    const itemData = matrixData.value[itemName];
    const prevColours = [...itemData.colours];
    const prevQuantities = JSON.parse(JSON.stringify(itemData.quantities));
    const prevRates = JSON.parse(JSON.stringify(itemData.rates || {}));
    const prevDeliveryDates = JSON.parse(JSON.stringify(itemData.deliveryDates || {}));

    itemData.availableColours = [];
    itemData.sizes = [];

    await loadFromItem(itemName);

    itemData.colours = prevColours.filter(c => itemData.availableColours.includes(c));
    itemData.quantities = {};
    itemData.rates = {};
    itemData.deliveryDates = {};
    itemData.colours.forEach(colour => {
        itemData.quantities[colour] = {};
        itemData.rates[colour] = prevRates[colour] || 0;
        itemData.deliveryDates[colour] = prevDeliveryDates[colour] || '';
        itemData.sizes.forEach(size => {
            itemData.quantities[colour][size] = (prevQuantities[colour] && prevQuantities[colour][size] !== undefined)
                ? prevQuantities[colour][size]
                : 0;
        });
    });
}

function onQuantityChange() {
    const details = getData();
    emit('updated', details);
    if(!cur_frm.is_dirty()){
        cur_frm.dirty()
    }
}

function getRowTotal(quantities) {
    let total = 0;
    Object.values(quantities).forEach(qty => {
        total += parseFloat(qty) || 0;
    });
    return formatQty(total);
}

function getColumnTotal(itemData, size) {
    let total = 0;
    itemData.colours.forEach(colour => {
        total += parseFloat(itemData.quantities[colour][size]) || 0;
    });
    return formatQty(total);
}

function getItemGrandTotal(itemData) {
    let total = 0;
    itemData.colours.forEach(colour => {
        Object.values(itemData.quantities[colour] || {}).forEach(qty => {
            total += parseFloat(qty) || 0;
        });
    });
    return formatQty(total);
}

function formatQty(val) {
    return val % 1 === 0 ? val.toLocaleString() : val.toFixed(2);
}

function getData() {
    const details = [];

    Object.keys(matrixData.value).forEach(item => {
        const itemData = matrixData.value[item];
        itemData.colours.forEach(colour => {
            itemData.sizes.forEach(size => {
                const quantity = parseFloat(itemData.quantities[colour][size]) || 0;
                if (quantity > 0) {
                    details.push({
                        item: item,
                        colour: colour,
                        size: size,
                        quantity: quantity,
                        rate: parseFloat(itemData.rates[colour]) || 0,
                        delivery_date: itemData.deliveryDates[colour] || ''
                    });
                }
            });
        });
    });

    return details;
}

watch(() => props.items, (newItems) => initMatrix(newItems, props.orderDetails), { deep: true });
watch(() => props.orderDetails, loadOrderDetails, { deep: true });

onMounted(initMatrix);

defineExpose({ getData, matrixData, loadFromItem, initMatrix, refreshItem, isReadOnly: props.isReadOnly });
</script>

<style scoped>
.order-matrix {
    padding: 0;
}

/* Empty State */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    color: var(--text-muted);
}
.empty-state-icon {
    margin-bottom: 14px;
    opacity: 0.35;
}
.empty-state p {
    margin: 0;
    font-size: 13px;
}

/* Item Card */
.item-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
}

.item-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: var(--subtle-fg, #f8fafc);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.item-card-title {
    display: flex;
    align-items: center;
    gap: 14px;
}

.item-badge {
    display: inline-flex;
    align-items: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-color);
    letter-spacing: 0.02em;
}

.item-grand-total {
    font-size: 12px;
    color: var(--text-muted);
}
.item-grand-total strong {
    color: var(--text-color);
    font-weight: 700;
    font-size: 13px;
}

.item-card-actions {
    display: flex;
    gap: 6px;
}

.btn-refresh {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    background: var(--control-bg, #f0f0f0);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.btn-refresh:hover {
    color: var(--text-color);
    border-color: var(--gray-400);
    background: var(--fg-color, #fff);
}

/* Colour Selector */
.colour-selector {
    padding: 12px 16px;
    background: var(--subtle-fg, #f8fafc);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
}
.colour-selector-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
}
.colour-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.colour-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
    border: 1px solid var(--border-color, #e2e8f0);
    background: #fff;
    color: var(--text-muted);
}
.colour-chip:hover {
    border-color: var(--gray-400);
    color: var(--text-color);
}
.colour-chip.active {
    background: var(--text-color);
    border-color: var(--text-color);
    color: #fff;
}

/* Matrix Table */
.matrix-table-wrapper {
    overflow-x: auto;
    padding: 0;
}

.matrix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    table-layout: auto;
}

.matrix-table thead tr {
    background: var(--subtle-fg, #f8fafc);
}

.matrix-table th {
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-color, #e2e8f0);
    white-space: nowrap;
}

.th-colour {
    text-align: left;
    width: 140px;
}
.th-rate {
    text-align: right;
    width: 100px;
}
.th-delivery-date {
    text-align: left;
    width: 130px;
}
.th-size {
    text-align: right;
    padding-right: 20px;
}
.th-total {
    text-align: right;
    width: 90px;
}

.matrix-table tbody tr {
    transition: background 0.1s ease;
}
.matrix-table tbody tr:nth-child(even) {
    background: rgba(248, 250, 252, 0.5);
}
.matrix-table tbody tr:hover {
    background: var(--subtle-fg, #f8fafc);
}

.matrix-table td {
    padding: 0;
    border-bottom: 1px solid var(--border-color, #f1f5f9);
}

.td-colour {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-color);
    padding: 10px 16px;
    white-space: nowrap;
}

.td-rate {
    padding: 4px 8px;
}
.td-delivery-date {
    padding: 4px 8px;
}

.rate-input {
    width: 100%;
    max-width: 90px;
    display: block;
    padding: 7px 12px;
    text-align: right;
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--control-bg, #f5f5f5);
    color: var(--text-color);
    transition: all 0.15s ease;
    -moz-appearance: textfield;
}
.rate-input::-webkit-outer-spin-button,
.rate-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.rate-input:focus {
    outline: none;
    border-color: var(--gray-400);
    background: #fff;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.06);
}
.rate-input::placeholder {
    color: var(--text-light, #ccc);
}
.rate-input[readonly] {
    cursor: default;
    background: transparent;
    border-color: transparent;
    font-weight: 600;
    color: var(--text-color);
}

.date-input {
    width: 100%;
    max-width: 130px;
    display: block;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--control-bg, #f5f5f5);
    color: var(--text-color);
    transition: all 0.15s ease;
}
.date-input:focus {
    outline: none;
    border-color: var(--gray-400);
    background: #fff;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.06);
}
.date-input[readonly] {
    cursor: default;
    background: transparent;
    border-color: transparent;
    font-weight: 600;
    color: var(--text-color);
}

.td-qty {
    text-align: right;
    padding: 4px 8px;
}

.qty-input {
    width: 100%;
    max-width: 80px;
    margin: 0 0 0 auto;
    display: block;
    padding: 7px 12px;
    text-align: right;
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--control-bg, #f5f5f5);
    color: var(--text-color);
    transition: all 0.15s ease;
    -moz-appearance: textfield;
}
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.qty-input:focus {
    outline: none;
    border-color: var(--gray-400);
    background: #fff;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.06);
}
.qty-input::placeholder {
    color: var(--text-light, #ccc);
}
.qty-input[readonly] {
    cursor: default;
    background: transparent;
    border-color: transparent;
    padding: 7px 16px 7px 8px;
    font-weight: 600;
    color: var(--text-color);
}

.td-row-total {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-color);
    padding: 10px 16px;
    white-space: nowrap;
    font-size: 13px;
    background: rgba(241, 245, 249, 0.5);
    border-left: 1px solid var(--border-color, #f1f5f9);
}

/* Footer */
.matrix-table tfoot tr {
    background: var(--subtle-fg, #f8fafc);
}
.matrix-table tfoot td {
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    border-top: 2px solid var(--border-color, #e2e8f0);
    border-bottom: none;
    font-variant-numeric: tabular-nums;
}

.tf-label {
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 10px;
}
.tf-spacer {
    /* empty spacer for rate/delivery columns in footer */
}
.tf-col-total {
    text-align: right;
    padding-right: 20px;
}
.tf-grand-total {
    text-align: right;
    color: var(--text-color);
    font-size: 13px;
    font-weight: 800;
    background: rgba(241, 245, 249, 0.5);
    border-left: 1px solid var(--border-color, #f1f5f9);
}

/* Item empty state */
.item-empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
}
</style>
