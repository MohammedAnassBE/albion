<template>
	<div class="report-page">
		<PageHeader title="Production Report" subtitle="Aggregated output by machine, style, colour and size">
			<template #actions>
				<button class="btn-run" :disabled="loading" @click="runReport">
					<AppIcon v-if="loading" name="loader" :size="14" spin />
					<AppIcon v-else name="bar-chart" :size="14" />
					{{ loading ? 'Loading...' : 'Run Report' }}
				</button>
			</template>
		</PageHeader>

		<!-- Filters -->
		<div class="filter-strip">
			<div class="filter-group">
				<label class="filter-label">From</label>
				<input type="date" v-model="startDate" class="filter-input" />
			</div>
			<div class="filter-group">
				<label class="filter-label">To</label>
				<input type="date" v-model="endDate" class="filter-input" />
			</div>
			<div class="filter-group">
				<label class="filter-label">Machine</label>
				<LinkField v-model="filterMachine" doctype="Machine" placeholder="All machines" />
			</div>
			<div class="filter-group">
				<label class="filter-label">Style</label>
				<LinkField v-model="filterStyle" doctype="Style" placeholder="All styles" />
			</div>
			<div class="filter-group">
				<label class="filter-label">Process</label>
				<LinkField v-model="filterProcess" doctype="Process" placeholder="All processes" />
			</div>
			<div class="filter-group">
				<label class="filter-label">Order</label>
				<LinkField v-model="filterOrder" doctype="Order" placeholder="All orders" :filters="{ docstatus: 1 }" />
			</div>
			<div class="filter-group">
				<label class="filter-label">Group By</label>
				<select v-model="groupBy" class="filter-input">
					<option value="">Detailed</option>
					<option value="style">Style Wise</option>
					<option value="machine">Machine Wise</option>
				</select>
			</div>
		</div>

		<!-- Summary Strip -->
		<div v-if="rows.length" class="summary-strip" :style="{ gridTemplateColumns: `repeat(${summaryCards.length}, 1fr)` }">
			<div v-for="card in summaryCards" :key="card.label" class="summary-card">
				<span class="summary-value">{{ card.value }}</span>
				<span class="summary-label">{{ card.label }}</span>
			</div>
		</div>

		<!-- Table -->
		<div v-if="rows.length" class="table-wrap">
			<table class="report-table">
				<thead>
					<tr>
						<th v-for="col in columns" :key="col.key" @click="toggleSort(col.key)" class="sortable-th">
							{{ col.label }}
							<span v-if="sortKey === col.key" class="sort-arrow">{{ sortDir === 'asc' ? '\u25B2' : '\u25BC' }}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(row, i) in sortedRows" :key="i">
						<td v-for="col in columns" :key="col.key"
							:class="{
								'cell-machine': col.key === 'machine_id',
								'cell-num': col.numeric
							}">
							{{ col.numeric ? row[col.key]?.toLocaleString() : row[col.key] }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Empty state -->
		<div v-else-if="!loading && hasRun" class="empty-state">
			<AppIcon name="inbox" :size="32" />
			<p>No production data found for the selected filters.</p>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/shared/PageHeader.vue'
import AppIcon from '@/components/shared/AppIcon.vue'
import LinkField from '@/components/shared/LinkField.vue'
import { getProductionReport } from '@/api/reports'

const now = new Date()
const startDate = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const endDate = ref(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))

const filterMachine = ref('')
const filterStyle = ref('')
const filterProcess = ref('')
const filterOrder = ref('')
const groupBy = ref('')

const loading = ref(false)
const hasRun = ref(false)
const rows = ref([])

const sortKey = ref('machine_id')
const sortDir = ref('asc')

const DETAIL_COLUMNS = [
	{ key: 'machine_id', label: 'Machine' },
	{ key: 'order', label: 'Order' },
	{ key: 'style', label: 'Style' },
	{ key: 'process_name', label: 'Process' },
	{ key: 'colour', label: 'Colour' },
	{ key: 'size', label: 'Size' },
	{ key: 'total_quantity', label: 'Quantity', numeric: true },
	{ key: 'total_minutes', label: 'Minutes', numeric: true },
]

const STYLE_COLUMNS = [
	{ key: 'style', label: 'Style' },
	{ key: 'total_quantity', label: 'Quantity', numeric: true },
]

const MACHINE_COLUMNS = [
	{ key: 'machine_id', label: 'Machine' },
	{ key: 'total_quantity', label: 'Quantity', numeric: true },
]

const columns = computed(() => {
	if (groupBy.value === 'style') return STYLE_COLUMNS
	if (groupBy.value === 'machine') return MACHINE_COLUMNS
	return DETAIL_COLUMNS
})

const totalQty = computed(() => rows.value.reduce((s, r) => s + (r.total_quantity || 0), 0))
const totalMinutes = computed(() => rows.value.reduce((s, r) => s + (r.total_minutes || 0), 0))
const uniqueMachines = computed(() => new Set(rows.value.map((r) => r.machine_id)).size)

const summaryCards = computed(() => {
	const cards = [
		{ label: 'Total Quantity', value: totalQty.value.toLocaleString() },
	]
	if (!groupBy.value) {
		cards.push({ label: 'Total Minutes', value: totalMinutes.value.toLocaleString() })
		cards.push({ label: 'Machines', value: uniqueMachines.value })
	}
	cards.push({ label: 'Rows', value: rows.value.length })
	return cards
})

const sortedRows = computed(() => {
	const arr = [...rows.value]
	const dir = sortDir.value === 'asc' ? 1 : -1
	const key = sortKey.value
	arr.sort((a, b) => {
		const va = a[key] ?? ''
		const vb = b[key] ?? ''
		if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
		return String(va).localeCompare(String(vb)) * dir
	})
	return arr
})

function toggleSort(key) {
	if (sortKey.value === key) {
		sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
	} else {
		sortKey.value = key
		sortDir.value = 'asc'
	}
}

async function runReport() {
	loading.value = true
	hasRun.value = true
	try {
		rows.value = await getProductionReport({
			startDate: startDate.value,
			endDate: endDate.value,
			machine: filterMachine.value || null,
			style: filterStyle.value || null,
			process: filterProcess.value || null,
			order: filterOrder.value || null,
			groupBy: groupBy.value || null,
		})
	} catch (e) {
		console.error('Production report error:', e)
		rows.value = []
	} finally {
		loading.value = false
	}
}
</script>

<style scoped>
.report-page {
	padding: var(--space-lg);
	max-width: 1400px;
}

/* ── Filters ───────────────────────────────────────────── */
.filter-strip {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-md);
	margin-bottom: var(--space-lg);
	padding: var(--space-md) var(--space-lg);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
}

.filter-group {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 160px;
	flex: 1;
}

.filter-label {
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.6px;
	color: var(--color-text-muted);
}

.filter-input {
	height: 36px;
	padding: 0 var(--space-sm);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	font-size: 0.8125rem;
	color: var(--color-text);
	background: var(--color-bg);
	outline: none;
	transition: border-color var(--transition-fast);
}

.filter-input:focus {
	border-color: var(--color-primary);
}

/* ── Run button ────────────────────────────────────────── */
.btn-run {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 36px;
	padding: 0 var(--space-md);
	background: var(--color-primary);
	color: #fff;
	border: none;
	border-radius: var(--radius-md);
	font-size: 0.8125rem;
	font-weight: 600;
	cursor: pointer;
	transition: all var(--transition-fast);
	letter-spacing: 0.01em;
}

.btn-run:hover:not(:disabled) {
	background: var(--color-primary-light);
}

.btn-run:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

/* ── Summary ───────────────────────────────────────────── */
.summary-strip {
	display: grid;
	gap: var(--space-md);
	margin-bottom: var(--space-lg);
}

.summary-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	padding: var(--space-md) var(--space-lg);
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.summary-value {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--color-primary);
	line-height: 1.2;
	letter-spacing: -0.02em;
}

.summary-label {
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.6px;
	color: var(--color-text-muted);
}

/* ── Table ─────────────────────────────────────────────── */
.table-wrap {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: auto;
}

.report-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.8125rem;
}

.report-table thead {
	position: sticky;
	top: 0;
	z-index: 2;
}

.report-table th {
	background: var(--color-primary);
	color: #fff;
	text-align: center;
	padding: 10px 14px;
	font-weight: 600;
	font-size: 0.6875rem;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	white-space: nowrap;
	user-select: none;
}

.report-table th:first-child {
	border-radius: var(--radius-lg) 0 0 0;
}

.report-table th:last-child {
	border-radius: 0 var(--radius-lg) 0 0;
}

.sortable-th {
	cursor: pointer;
	transition: background var(--transition-fast);
}

.sortable-th:hover {
	background: var(--color-primary-light);
}

.sort-arrow {
	font-size: 9px;
	margin-left: 4px;
	opacity: 0.8;
}

.report-table td {
	padding: 9px 14px;
	border-bottom: 1px solid var(--color-bg);
	color: var(--color-text);
	text-align: center;
}

.report-table tbody tr:hover {
	background: var(--color-surface-hover);
}

.report-table tbody tr:last-child td {
	border-bottom: none;
}

.cell-machine {
	font-weight: 600;
	color: var(--color-primary);
}

.cell-num {
	text-align: right;
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}

/* ── Empty State ───────────────────────────────────────── */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-2xl) 0;
	color: var(--color-text-muted);
	font-size: 0.875rem;
}

.empty-state p {
	margin: 0;
}

/* ── Responsive ────────────────────────────────────────── */
@media (max-width: 900px) {
	.filter-strip {
		flex-direction: column;
	}
	.summary-strip {
		grid-template-columns: repeat(2, 1fr);
	}
}
</style>
