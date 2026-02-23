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
				<div v-if="!readonly" class="item-card-actions">
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
			<div v-if="!readonly && itemData.availableColours.length > 0" class="colour-selector">
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
							<th v-for="size in itemData.sizes" :key="size" class="th-size">{{ size }}</th>
							<th class="th-total">Total</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="colour in itemData.colours" :key="colour">
							<td class="td-colour">{{ colour }}</td>
							<td v-for="size in itemData.sizes" :key="size" class="td-qty">
								<input
									type="number"
									class="qty-input"
									v-model="itemData.quantities[colour][size]"
									@change="onQuantityChange"
									@focus="$event.target.select()"
									min="0"
									step="0.01"
									:readonly="readonly"
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
import { ref, watch, onMounted } from 'vue'
import { callMethod } from '@/api/client'

const props = defineProps({
	items: { type: Array, default: () => [] },
	orderDetails: { type: Array, default: () => [] },
	readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:orderDetails'])
const matrixData = ref({})
const warning = ref('')

async function initMatrix(items = null, orderDetails = null) {
	matrixData.value = {}

	const itemList = items || props.items || []
	const details = orderDetails || props.orderDetails || []

	if (!itemList || itemList.length === 0) return

	itemList.forEach(item => {
		const itemName = item.item
		if (!itemName) return

		matrixData.value[itemName] = {
			availableColours: [],
			sizes: [],
			colours: [],
			quantities: {},
		}
	})

	for (const item of itemList) {
		if (item.item) {
			await loadFromItem(item.item)
		}
	}

	if (details && details.length > 0) {
		loadOrderDetails(details)
	}
}

function loadOrderDetails(orderDetails = null) {
	const details = orderDetails || props.orderDetails || []
	if (!details || details.length === 0) return

	details.forEach(detail => {
		const itemName = detail.item
		if (!matrixData.value[itemName]) return

		const item = matrixData.value[itemName]

		if (!item.availableColours.includes(detail.colour)) {
			item.availableColours.push(detail.colour)
		}

		if (!item.colours.includes(detail.colour)) {
			item.colours.push(detail.colour)
			item.quantities[detail.colour] = {}
		}

		if (!item.sizes.includes(detail.size)) {
			item.sizes.push(detail.size)
		}

		item.quantities[detail.colour][detail.size] = detail.quantity
	})

	// Ensure all selected colours have entries for all sizes
	Object.keys(matrixData.value).forEach(itemName => {
		const item = matrixData.value[itemName]
		item.colours.forEach(colour => {
			item.sizes.forEach(size => {
				if (item.quantities[colour][size] === undefined) {
					item.quantities[colour][size] = 0
				}
			})
		})
	})
}

async function loadFromItem(itemName) {
	try {
		const result = await callMethod(
			'albion.albion.doctype.order.order.get_item_details',
			{ item_code: itemName }
		)

		if (result) {
			const itemData = matrixData.value[itemName]

			result.colours.forEach(colour => {
				if (!itemData.availableColours.includes(colour.colour)) {
					itemData.availableColours.push(colour.colour)
				}
			})

			result.sizes.forEach(size => {
				if (!itemData.sizes.includes(size.size)) {
					itemData.sizes.push(size.size)
				}
			})

			itemData.colours.forEach(colour => {
				if (!itemData.quantities[colour]) {
					itemData.quantities[colour] = {}
				}
				itemData.sizes.forEach(size => {
					if (itemData.quantities[colour][size] === undefined) {
						itemData.quantities[colour][size] = 0
					}
				})
			})
		}
	} catch (e) {
		console.error('Error loading item details:', e)
		warning.value = `Error loading details for ${itemName}`
	}
}

function toggleColour(itemName, colour) {
	const itemData = matrixData.value[itemName]
	const idx = itemData.colours.indexOf(colour)

	if (idx === -1) {
		itemData.colours.push(colour)
		itemData.quantities[colour] = {}
		itemData.sizes.forEach(size => {
			itemData.quantities[colour][size] = 0
		})
	} else {
		itemData.colours.splice(idx, 1)
		delete itemData.quantities[colour]
	}

	emitData()
}

async function refreshItem(itemName) {
	const itemData = matrixData.value[itemName]
	const prevColours = [...itemData.colours]
	const prevQuantities = JSON.parse(JSON.stringify(itemData.quantities))

	itemData.availableColours = []
	itemData.sizes = []

	await loadFromItem(itemName)

	itemData.colours = prevColours.filter(c => itemData.availableColours.includes(c))
	itemData.quantities = {}
	itemData.colours.forEach(colour => {
		itemData.quantities[colour] = {}
		itemData.sizes.forEach(size => {
			itemData.quantities[colour][size] = (prevQuantities[colour] && prevQuantities[colour][size] !== undefined)
				? prevQuantities[colour][size]
				: 0
		})
	})
}

function onQuantityChange() {
	emitData()
}

function emitData() {
	emit('update:orderDetails', getData())
}

function getRowTotal(quantities) {
	let total = 0
	Object.values(quantities).forEach(qty => {
		total += parseFloat(qty) || 0
	})
	return formatQty(total)
}

function getColumnTotal(itemData, size) {
	let total = 0
	itemData.colours.forEach(colour => {
		total += parseFloat(itemData.quantities[colour][size]) || 0
	})
	return formatQty(total)
}

function getItemGrandTotal(itemData) {
	let total = 0
	itemData.colours.forEach(colour => {
		Object.values(itemData.quantities[colour] || {}).forEach(qty => {
			total += parseFloat(qty) || 0
		})
	})
	return formatQty(total)
}

function formatQty(val) {
	return val % 1 === 0 ? val.toLocaleString() : val.toFixed(2)
}

function getData() {
	const details = []

	Object.keys(matrixData.value).forEach(item => {
		const itemData = matrixData.value[item]
		itemData.colours.forEach(colour => {
			itemData.sizes.forEach(size => {
				const quantity = parseFloat(itemData.quantities[colour][size]) || 0
				if (quantity > 0) {
					details.push({ item, colour, size, quantity })
				}
			})
		})
	})

	return details
}

watch(() => props.items, (newItems) => initMatrix(newItems, props.orderDetails), { deep: true })

onMounted(() => initMatrix())

defineExpose({ getData, matrixData, initMatrix, refreshItem })
</script>

<style scoped>
.order-matrix {
	padding: 0;
}

/* Warning */
.matrix-warning {
	padding: var(--space-sm) var(--space-md);
	background: var(--color-warning-bg);
	color: var(--color-warning);
	font-size: 0.8125rem;
	font-weight: 600;
	border-radius: var(--radius-md);
	margin-bottom: var(--space-md);
}

/* Empty State */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 48px 20px;
	color: var(--color-text-muted);
}
.empty-state-icon {
	margin-bottom: 14px;
	opacity: 0.35;
}
.empty-state p {
	margin: 0;
	font-size: 0.8125rem;
}

/* Item Card */
.item-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-left: 3px solid var(--color-accent);
	border-radius: var(--radius-lg);
	margin-bottom: var(--space-md);
	overflow: hidden;
}

.item-card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 16px;
	background: var(--color-surface-alt);
	border-bottom: 1px solid var(--color-border);
}

.item-card-title {
	display: flex;
	align-items: center;
	gap: 14px;
}

.item-badge {
	display: inline-flex;
	align-items: center;
	font-size: 0.8125rem;
	font-weight: 700;
	color: var(--color-text);
	letter-spacing: 0.02em;
}

.item-grand-total {
	font-size: 0.75rem;
	color: var(--color-text-muted);
}
.item-grand-total strong {
	color: var(--color-text);
	font-weight: 700;
	font-size: 0.8125rem;
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
	font-size: 0.6875rem;
	font-weight: 600;
	color: var(--color-text-muted);
	background: var(--color-surface-alt);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	cursor: pointer;
	transition: all 0.15s ease;
}
.btn-refresh:hover {
	color: var(--color-text);
	border-color: var(--color-border-strong);
	background: var(--color-surface);
}

/* Colour Selector */
.colour-selector {
	padding: 12px 16px;
	background: var(--color-surface-alt);
	border-bottom: 1px solid var(--color-border);
}
.colour-selector-label {
	display: block;
	font-size: 0.625rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--color-text-muted);
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
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	user-select: none;
	transition: all 0.15s ease;
	border: 1px solid var(--color-border);
	background: var(--color-surface);
	color: var(--color-text-muted);
}
.colour-chip:hover {
	border-color: var(--color-border-strong);
	color: var(--color-text);
}
.colour-chip.active {
	background: var(--color-accent);
	border-color: var(--color-accent);
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
	font-size: 0.8125rem;
	table-layout: auto;
}

.matrix-table thead tr {
	background: var(--color-surface-alt);
}

.matrix-table th {
	padding: 10px 16px;
	font-size: 0.6875rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--color-text-muted);
	border-bottom: 1px solid var(--color-border);
	white-space: nowrap;
}

.th-colour {
	text-align: left;
	width: 140px;
	border-right: 1px solid var(--color-border);
}
.th-size {
	text-align: right;
	padding-right: 20px;
}
.th-total {
	text-align: right;
	width: 90px;
	padding-right: 24px;
	border-left: 1px solid var(--color-border);
}

.matrix-table tbody tr {
	transition: background 0.1s ease;
}
.matrix-table tbody tr:nth-child(even) {
	background: rgba(249, 250, 251, 0.5);
}
.matrix-table tbody tr:hover {
	background: var(--color-surface-hover);
}

.matrix-table td {
	border-bottom: 1px solid var(--color-border);
}

.td-colour {
	font-weight: 600;
	font-size: 0.8125rem;
	color: var(--color-text);
	padding: 10px 16px;
	white-space: nowrap;
	border-right: 1px solid var(--color-border);
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
	font-size: 0.8125rem;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
	border: 1px solid transparent;
	border-radius: var(--radius-md);
	background: var(--color-surface-alt);
	color: var(--color-text);
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
	border-color: var(--color-accent);
	background: var(--color-surface);
	box-shadow: 0 0 0 2px var(--color-accent-muted);
}
.qty-input::placeholder {
	color: var(--color-text-muted);
	opacity: 0.5;
}
.qty-input[readonly] {
	cursor: default;
	background: transparent;
	border-color: transparent;
	padding: 7px 16px 7px 8px;
	font-weight: 600;
	color: var(--color-text);
}

.td-row-total {
	text-align: right;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	color: var(--color-text);
	padding: 10px 24px;
	white-space: nowrap;
	font-size: 0.8125rem;
	background: var(--color-surface-alt);
	border-left: 1px solid var(--color-border);
}

/* Footer */
.matrix-table tfoot tr {
	background: var(--color-surface-alt);
}
.matrix-table tfoot td {
	padding: 10px 16px;
	font-size: 0.75rem;
	font-weight: 700;
	color: var(--color-text-muted);
	border-top: 2px solid var(--color-border);
	border-bottom: none;
	font-variant-numeric: tabular-nums;
}

.tf-label {
	text-align: left;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	font-size: 0.625rem;
	border-right: 1px solid var(--color-border);
}
.tf-col-total {
	text-align: right;
	padding-right: 20px;
}
.tf-grand-total {
	text-align: right;
	color: var(--color-text);
	font-size: 0.8125rem;
	font-weight: 800;
	padding-right: 24px;
	background: var(--color-surface-alt);
	border-left: 1px solid var(--color-border);
}

/* Item empty state */
.item-empty {
	padding: 32px 16px;
	text-align: center;
	color: var(--color-text-muted);
	font-size: 0.8125rem;
}
</style>
