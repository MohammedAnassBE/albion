<template>
	<div class="order-completion-matrix">
		<div v-if="itemList.length === 0" class="empty-state">
			<p>No completion data available.</p>
		</div>

		<div v-for="itemEntry in itemList" :key="itemEntry.itemName" class="item-card">
			<!-- Card Header -->
			<div class="item-card-header">
				<div class="item-card-title">
					<span class="item-badge">{{ itemEntry.itemName }}</span>
					<span class="item-grand-total">
						Completed: <strong>{{ itemEntry.completedTotal }}</strong>
						<span class="slash">/</span>
						{{ itemEntry.orderedTotal }}
					</span>
				</div>
				<span class="completion-pct" :class="pctClass(itemEntry._completedRaw, itemEntry._orderedRaw)">
					{{ pctLabel(itemEntry._completedRaw, itemEntry._orderedRaw) }}
				</span>
			</div>

			<!-- Matrix Table -->
			<div class="matrix-table-wrapper" v-if="itemEntry.colours.length > 0 && itemEntry.sizes.length > 0">
				<table class="matrix-table">
					<thead>
						<tr>
							<th class="th-colour">Colour</th>
							<th v-for="size in itemEntry.sizes" :key="size" class="th-size">{{ size }}</th>
							<th class="th-total">Total</th>
							<th class="th-rate">Total Rate</th>
							<th class="th-gbp">GBP Value</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="colour in itemEntry.colours" :key="colour">
							<td class="td-colour">{{ colour }}</td>
							<td
								v-for="size in itemEntry.sizes"
								:key="size"
								class="td-qty"
								:class="cellClass(itemEntry.cells[colour]?.[size])"
							>
								<span class="qty-done">{{ formatQty(itemEntry.cells[colour]?.[size]?.completed ?? 0) }}</span>
								<span class="qty-slash">/</span>
								<span class="qty-target">{{ formatQty(itemEntry.cells[colour]?.[size]?.ordered ?? 0) }}</span>
							</td>
							<td class="td-row-total" :class="totalClass(rowCompleted(itemEntry, colour), rowOrdered(itemEntry, colour))">
								<span class="qty-done">{{ formatQty(rowCompleted(itemEntry, colour)) }}</span>
								<span class="qty-slash">/</span>
								<span class="qty-target">{{ formatQty(rowOrdered(itemEntry, colour)) }}</span>
							</td>
							<td class="td-rate">{{ formatCurrency(rowTotalRate(itemEntry, colour)) }}</td>
							<td class="td-gbp">{{ formatCurrency(rowGbpValue(itemEntry, colour)) }}</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td class="tf-label">Total</td>
							<td v-for="size in itemEntry.sizes" :key="size" class="tf-col-total">
								<span class="qty-done">{{ formatQty(colCompleted(itemEntry, size)) }}</span>
								<span class="qty-slash">/</span>
								<span class="qty-target">{{ formatQty(colOrdered(itemEntry, size)) }}</span>
							</td>
							<td class="tf-grand-total">
								<span class="qty-done">{{ itemEntry.completedTotal }}</span>
								<span class="qty-slash">/</span>
								<span class="qty-target">{{ itemEntry.orderedTotal }}</span>
							</td>
							<td class="tf-rate">{{ formatCurrency(itemTotalRate(itemEntry)) }}</td>
							<td class="tf-gbp">{{ formatCurrency(itemTotalGbp(itemEntry)) }}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	orderDetails: { type: Array, default: () => [] },
	completionData: { type: Object, default: () => ({}) },
	currencyType: { type: String, default: '' },
	exchangeRates: { type: Array, default: () => [] },
})

const itemList = computed(() => {
	const itemMap = {}
	for (const d of props.orderDetails) {
		if (!d.style) continue
		if (!itemMap[d.style]) {
			itemMap[d.style] = { colours: [], sizes: [], cells: {}, ratePerColour: {}, deliveryDatePerColour: {} }
		}
		const entry = itemMap[d.style]
		if (!entry.colours.includes(d.colour)) entry.colours.push(d.colour)
		if (!entry.sizes.includes(d.size)) entry.sizes.push(d.size)
		if (!entry.cells[d.colour]) entry.cells[d.colour] = {}
		const completed = props.completionData?.[d.style]?.[d.colour]?.[d.size] ?? 0
		entry.cells[d.colour][d.size] = {
			ordered: parseFloat(d.quantity) || 0,
			completed: parseFloat(completed) || 0,
		}
		// Store rate and delivery_date per colour (same for all sizes in a colour; take first)
		if (entry.ratePerColour[d.colour] === undefined) {
			entry.ratePerColour[d.colour] = parseFloat(d.rate) || 0
		}
		if (!entry.deliveryDatePerColour[d.colour]) {
			entry.deliveryDatePerColour[d.colour] = d.delivery_date || ''
		}
	}

	return Object.entries(itemMap).map(([itemName, data]) => {
		let orderedTotal = 0
		let completedTotal = 0
		for (const colour of data.colours) {
			for (const size of data.sizes) {
				const cell = data.cells[colour]?.[size]
				if (cell) {
					orderedTotal += cell.ordered
					completedTotal += cell.completed
				}
			}
		}
		return {
			itemName,
			colours: data.colours,
			sizes: data.sizes,
			cells: data.cells,
			ratePerColour: data.ratePerColour,
			deliveryDatePerColour: data.deliveryDatePerColour,
			orderedTotal: formatQty(orderedTotal),
			completedTotal: formatQty(completedTotal),
			_orderedRaw: orderedTotal,
			_completedRaw: completedTotal,
		}
	})
})

function getExchangeRate(deliveryDate, currencyType) {
	if (!deliveryDate || currencyType === 'GBP') return 1
	const row = props.exchangeRates.find(r => r.month_year === deliveryDate)
	if (!row) return 0
	if (currencyType === 'Euro') return row.euro_rate || 0
	if (currencyType === 'Dollar') return row.dollar_rate || 0
	return 0
}

function formatQty(val) {
	const n = parseFloat(val) || 0
	return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)
}

function formatCurrency(val) {
	const n = parseFloat(val) || 0
	return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function cellClass(cell) {
	if (!cell) return ''
	if (cell.completed >= cell.ordered && cell.ordered > 0) return 'cell-complete'
	if (cell.completed > 0) return 'cell-partial'
	return ''
}

function totalClass(completed, ordered) {
	if (ordered > 0 && completed >= ordered) return 'total-complete'
	if (completed > 0) return 'total-partial'
	return ''
}

function pctClass(completed, ordered) {
	if (ordered > 0 && completed >= ordered) return 'pct-complete'
	if (completed > 0) return 'pct-partial'
	return 'pct-none'
}

function pctLabel(completed, ordered) {
	if (ordered === 0) return '0%'
	return Math.min(100, Math.round((completed / ordered) * 100)) + '%'
}

function rowCompleted(item, colour) {
	let total = 0
	for (const size of item.sizes) total += item.cells[colour]?.[size]?.completed ?? 0
	return total
}

function rowOrdered(item, colour) {
	let total = 0
	for (const size of item.sizes) total += item.cells[colour]?.[size]?.ordered ?? 0
	return total
}

function rowTotalRate(item, colour) {
	const completed = rowCompleted(item, colour)
	const rate = item.ratePerColour[colour] || 0
	return completed * rate
}

function rowGbpValue(item, colour) {
	const totalRate = rowTotalRate(item, colour)
	if (totalRate === 0) return 0
	const exRate = getExchangeRate(item.deliveryDatePerColour[colour], props.currencyType)
	if (exRate === 0) return 0
	if (exRate === 1) return totalRate // Already GBP
	return totalRate / exRate
}

function itemTotalRate(item) {
	let total = 0
	for (const colour of item.colours) total += rowTotalRate(item, colour)
	return total
}

function itemTotalGbp(item) {
	let total = 0
	for (const colour of item.colours) total += rowGbpValue(item, colour)
	return total
}

function colCompleted(item, size) {
	let total = 0
	for (const colour of item.colours) total += item.cells[colour]?.[size]?.completed ?? 0
	return total
}

function colOrdered(item, size) {
	let total = 0
	for (const colour of item.colours) total += item.cells[colour]?.[size]?.ordered ?? 0
	return total
}
</script>

<style scoped>
.order-completion-matrix {
	padding: 0;
}

.empty-state {
	padding: 32px 16px;
	text-align: center;
	color: var(--color-text-muted);
	font-size: 0.8125rem;
}

/* ── Item Card ──────────────────────────────────────────────── */
.item-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-left: 3px solid var(--color-success, #22c55e);
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
.item-grand-total .slash {
	margin: 0 2px;
}

/* Percentage badge */
.completion-pct {
	font-size: 0.6875rem;
	font-weight: 700;
	padding: 3px 10px;
	border-radius: 20px;
	letter-spacing: 0.02em;
}
.pct-complete {
	background: rgba(34, 197, 94, 0.14);
	color: #16a34a;
}
.pct-partial {
	background: rgba(245, 158, 11, 0.14);
	color: #d97706;
}
.pct-none {
	background: var(--color-surface);
	color: var(--color-text-muted);
	border: 1px solid var(--color-border);
}

/* ── Table ──────────────────────────────────────────────────── */
.matrix-table-wrapper {
	overflow-x: auto;
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
	width: 100px;
	padding-right: 24px;
	border-left: 1px solid var(--color-border);
}
.th-rate,
.th-gbp {
	text-align: right;
	width: 110px;
	padding-right: 20px;
	border-left: 1px solid var(--color-border);
}

/* ── Body ───────────────────────────────────────────────────── */
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

/* ── Qty cells ──────────────────────────────────────────────── */
.td-qty {
	text-align: right;
	padding: 10px 16px;
	font-variant-numeric: tabular-nums;
	font-size: 0.8125rem;
	white-space: nowrap;
}

.qty-done {
	font-weight: 700;
	color: var(--color-text);
}

.qty-slash {
	margin: 0 2px;
	color: var(--color-text);
	font-weight: 400;
}

.qty-target {
	font-weight: 500;
	color: var(--color-text);
}

/* ── Cell states ────────────────────────────────────────────── */
.cell-complete {
	background: rgba(34, 197, 94, 0.1);
}
.cell-complete .qty-done {
	color: #16a34a;
}

.cell-partial {
	background: rgba(245, 158, 11, 0.08);
}
.cell-partial .qty-done {
	color: #d97706;
}

/* ── Row total ──────────────────────────────────────────────── */
.td-row-total {
	text-align: right;
	font-variant-numeric: tabular-nums;
	padding: 10px 24px;
	white-space: nowrap;
	background: var(--color-surface-alt);
	border-left: 1px solid var(--color-border);
}
.td-row-total .qty-done {
	font-size: 0.8125rem;
}

.total-complete .qty-done { color: #16a34a; }
.total-partial .qty-done  { color: #d97706; }

/* ── Rate & GBP columns ───────────────────────────────────── */
.td-rate,
.td-gbp {
	text-align: right;
	font-variant-numeric: tabular-nums;
	padding: 10px 20px;
	white-space: nowrap;
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--color-text);
	border-left: 1px solid var(--color-border);
	background: rgba(59, 130, 246, 0.04);
}

/* ── Footer ─────────────────────────────────────────────────── */
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
.tf-col-total .qty-done {
	color: var(--color-text);
}

.tf-grand-total {
	text-align: right;
	padding-right: 24px;
	background: var(--color-surface-alt);
	border-left: 1px solid var(--color-border);
}
.tf-grand-total .qty-done {
	color: var(--color-text);
	font-weight: 800;
}

.tf-rate,
.tf-gbp {
	text-align: right;
	padding-right: 20px;
	font-weight: 800;
	color: var(--color-text);
	border-left: 1px solid var(--color-border);
	background: rgba(59, 130, 246, 0.04);
}
</style>
