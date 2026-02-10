<template>
    <div class="order-matrix">
        <div v-if="Object.keys(matrixData).length === 0" class="text-muted">
            No items added. Please add items in the Items table above.
        </div>
        <div v-for="(itemData, itemName) in matrixData" :key="itemName" class="item-section">
            <div class="item-header">
                <h5 class="item-title">{{ itemName }}</h5>
                <div v-if="!readOnly()" class="item-actions">
                    <button class="btn btn-xs btn-default" @click="refreshItem(itemName)">
                        Refresh
                    </button>
                </div>
            </div>
            <table class="table table-bordered table-sm" v-if="itemData.colours.length > 0 && itemData.sizes.length > 0">
                <thead>
                    <tr>
                        <th class="colour-header">Colour</th>
                        <th v-for="size in itemData.sizes" :key="size" class="size-header">{{ size }}</th>
                        <th class="total-header">Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="colour in itemData.colours" :key="colour">
                        <td class="colour-cell">{{ colour }}</td>
                        <td v-for="size in itemData.sizes" :key="size">
                            <input
                                type="number"
                                class="form-control form-control-sm qty-input"
                                v-model="itemData.quantities[colour][size]"
                                @change="onQuantityChange"
                                min="0"
                                step="0.01"
                                :readonly="readOnly()"
                            />
                        </td>
                        <td class="total-cell">
                            {{ getRowTotal(itemData.quantities[colour]) }}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div v-else class="text-muted">
                Loading colours and sizes from item master...
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
        const itemName = item.item;
        if (!itemName) return;

        matrixData.value[itemName] = {
            sizes: [],
            colours: [],
            quantities: {}
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

        if (!item.colours.includes(detail.colour)) {
            item.colours.push(detail.colour);
            item.quantities[detail.colour] = {};
        }

        if (!item.sizes.includes(detail.size)) {
            item.sizes.push(detail.size);
        }

        item.quantities[detail.colour][detail.size] = detail.quantity;
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
            
            // Load colours
            response.message.colours.forEach(colour => {
                if (!itemData.colours.includes(colour.colour)) {
                    itemData.colours.push(colour.colour);
                    itemData.quantities[colour.colour] = {};
                }
            });
            
            // Load sizes
            response.message.sizes.forEach(size => {
                if (!itemData.sizes.includes(size.size)) {
                    itemData.sizes.push(size.size);
                }
            });
            
            // Initialize quantities
            itemData.colours.forEach(colour => {
                itemData.sizes.forEach(size => {
                    if (!itemData.quantities[colour][size]) {
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

async function refreshItem(itemName) {
    await loadFromItem(itemName);
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
    return total.toFixed(2);
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
                        quantity: quantity
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
    margin-top: 20px;
}
.item-section {
    margin-bottom: 30px;
    padding: 15px;
    border: 1px solid #d1d8dd;
    border-radius: 4px;
}
.item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid #d1d8dd;
}
.item-title {
    margin: 0;
}
.item-actions {
    display: flex;
    gap: 8px;
}
.qty-input {
    width: 80px;
    text-align: right;
}
.colour-header, .colour-cell {
    min-width: 100px;
    font-weight: bold;
}
.size-header {
    min-width: 80px;
    text-align: center;
}
.total-header, .total-cell {
    min-width: 80px;
    text-align: right;
    font-weight: bold;
}
</style>