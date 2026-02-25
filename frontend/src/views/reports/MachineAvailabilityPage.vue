<template>
	<div class="availability-page">
		<PageHeader title="Machine Availability" subtitle="Capacity utilisation across machines and dates">
			<template #actions>
				<button class="btn-run" :disabled="loading" @click="fetchData">
					<AppIcon v-if="loading" name="loader" :size="14" spin />
					<AppIcon v-else name="calendar" :size="14" />
					{{ loading ? 'Loading...' : 'Show Availability' }}
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
		</div>

		<!-- Legend -->
		<div v-if="dates.length" class="legend-strip">
			<span class="legend-item"><span class="legend-dot dot-free" /> Free</span>
			<span class="legend-item"><span class="legend-dot dot-partial" /> Partial</span>
			<span class="legend-item"><span class="legend-dot dot-full" /> Fully booked</span>
			<span class="legend-item"><span class="legend-dot dot-off" /> Off day</span>
		</div>

		<!-- Grid -->
		<div v-if="dates.length" class="grid-wrap">
			<table class="avail-grid">
				<thead>
					<tr>
						<th class="machine-col">Machine</th>
						<th v-for="d in dates" :key="d" class="date-col">
							<span class="date-weekday">{{ monthName(d) }}</span>
							<span class="date-day">{{ dayNum(d) }}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="m in machines" :key="m.machine_id">
						<td class="machine-cell">{{ m.machine_id }}</td>
						<td
							v-for="d in dates"
							:key="d"
							class="avail-cell"
							:class="cellClass(m.machine_id, d)"
							:title="cellTitle(m.machine_id, d)"
						>
							<template v-if="cellData(m.machine_id, d).capacity > 0">
								<span class="cell-used">{{ cellData(m.machine_id, d).used }}</span>
								<span class="cell-cap">/ {{ cellData(m.machine_id, d).capacity }}</span>
							</template>
							<span v-else class="cell-off">&mdash;</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Summary Table -->
		<div v-if="dates.length" class="summary-section">
			<h3 class="section-title">Machine Summary</h3>
			<table class="summary-table">
				<thead>
					<tr>
						<th>Machine</th>
						<th>Name</th>
						<th class="num-col">Total Capacity</th>
						<th class="num-col">Used</th>
						<th class="num-col">Available</th>
						<th class="num-col">Utilisation</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="s in machineSummary" :key="s.machine_id">
						<td class="cell-machine">{{ s.machine_id }}</td>
						<td>{{ s.machine_gg }}</td>
						<td class="num-col">{{ s.capacity.toLocaleString() }}</td>
						<td class="num-col">{{ s.used.toLocaleString() }}</td>
						<td class="num-col">{{ s.available.toLocaleString() }}</td>
						<td class="num-col">
							<span class="util-badge" :class="utilClass(s.pct)">{{ s.pct }}%</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Empty state -->
		<div v-else-if="!loading && hasRun" class="empty-state">
			<AppIcon name="inbox" :size="32" />
			<p>No availability data. Select a date range and click Show Availability.</p>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/shared/PageHeader.vue'
import AppIcon from '@/components/shared/AppIcon.vue'
import { getMachineAvailability } from '@/api/reports'

// Default to current week (Mon–Sun)
const now = new Date()
const dayOfWeek = now.getDay()
const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
const monday = new Date(now)
monday.setDate(now.getDate() + mondayOffset)
const sunday = new Date(monday)
sunday.setDate(monday.getDate() + 6)

const startDate = ref(monday.toISOString().slice(0, 10))
const endDate = ref(sunday.toISOString().slice(0, 10))

const loading = ref(false)
const hasRun = ref(false)
const machines = ref([])
const dates = ref([])
const availability = ref({})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthName(dateStr) {
	const d = new Date(dateStr + 'T00:00:00')
	return MONTHS[d.getMonth()]
}

function dayNum(dateStr) {
	return dateStr.slice(8)
}

function cellData(machineId, dateStr) {
	return availability.value[machineId]?.[dateStr] || { capacity: 0, used: 0, available: 0 }
}

function cellClass(machineId, dateStr) {
	const c = cellData(machineId, dateStr)
	if (c.capacity === 0) return 'cell-off-day'
	if (c.used === 0) return 'cell-free'
	if (c.used >= c.capacity) return 'cell-full'
	return 'cell-partial'
}

function cellTitle(machineId, dateStr) {
	const c = cellData(machineId, dateStr)
	if (c.capacity === 0) return 'Off day'
	return `Used: ${c.used} / ${c.capacity} min  (${c.available} free)`
}

function utilClass(pct) {
	if (pct >= 90) return 'util-high'
	if (pct >= 50) return 'util-mid'
	return 'util-low'
}

const machineSummary = computed(() =>
	machines.value.map((m) => {
		let capacity = 0
		let used = 0
		for (const d of dates.value) {
			const c = cellData(m.machine_id, d)
			capacity += c.capacity
			used += c.used
		}
		const available = Math.max(0, capacity - used)
		const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0
		return { ...m, capacity, used, available, pct }
	})
)

async function fetchData() {
	loading.value = true
	hasRun.value = true
	try {
		const result = await getMachineAvailability(startDate.value, endDate.value)
		machines.value = result.machines || []
		dates.value = result.dates || []
		availability.value = result.availability || {}
	} catch (e) {
		console.error('Machine availability error:', e)
		machines.value = []
		dates.value = []
		availability.value = {}
	} finally {
		loading.value = false
	}
}
</script>

<style scoped>
.availability-page {
	padding: var(--space-lg);
	max-width: 1600px;
}

/* ── Filters ───────────────────────────────────────────── */
.filter-strip {
	display: flex;
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

/* ── Legend ─────────────────────────────────────────────── */
.legend-strip {
	display: flex;
	gap: var(--space-lg);
	margin-bottom: var(--space-md);
	font-size: 0.75rem;
	color: var(--color-text-secondary);
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 6px;
}

.legend-dot {
	width: 12px;
	height: 12px;
	border-radius: 3px;
}

.dot-free { background: var(--color-success-bg); border: 1px solid var(--color-success); }
.dot-partial { background: var(--color-warning-bg); border: 1px solid var(--color-warning); }
.dot-full { background: var(--color-danger-bg); border: 1px solid var(--color-danger); }
.dot-off { background: var(--color-bg); border: 1px solid var(--color-border); }

/* ── Availability Grid ─────────────────────────────────── */
.grid-wrap {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: auto;
	margin-bottom: var(--space-xl);
}

.avail-grid {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.75rem;
}

.avail-grid th {
	background: var(--color-primary);
	color: #fff;
	padding: 8px 6px;
	text-align: center;
	font-weight: 600;
	white-space: nowrap;
	font-size: 0.6875rem;
	text-transform: uppercase;
	letter-spacing: 0.3px;
}

.avail-grid th:first-child {
	border-radius: var(--radius-lg) 0 0 0;
	text-align: left;
	padding-left: 14px;
}

.avail-grid th:last-child {
	border-radius: 0 var(--radius-lg) 0 0;
}

.machine-col {
	min-width: 100px;
}

.date-col {
	min-width: 70px;
}

.date-weekday {
	display: block;
	font-size: 0.625rem;
	opacity: 0.7;
	letter-spacing: 0.5px;
}

.date-day {
	display: block;
	font-size: 0.8125rem;
	font-weight: 700;
}

.machine-cell {
	font-weight: 600;
	color: var(--color-primary);
	padding: 8px 14px;
	border-bottom: 1px solid var(--color-bg);
	white-space: nowrap;
}

.avail-cell {
	text-align: center;
	padding: 8px 6px;
	border-bottom: 1px solid var(--color-bg);
	transition: background var(--transition-fast);
	font-variant-numeric: tabular-nums;
}

.cell-free {
	background: var(--color-success-bg);
}

.cell-partial {
	background: var(--color-warning-bg);
}

.cell-full {
	background: var(--color-danger-bg);
}

.cell-off-day {
	background: var(--color-bg);
}

.cell-used {
	font-weight: 700;
	color: var(--color-text);
}

.cell-cap {
	color: var(--color-text-muted);
	font-size: 0.625rem;
}

.cell-off {
	color: var(--color-text-muted);
}

.avail-grid tbody tr:hover .avail-cell:not(.cell-off-day) {
	filter: brightness(0.95);
}

.avail-grid tbody tr:last-child td {
	border-bottom: none;
}

/* ── Summary Section ───────────────────────────────────── */
.summary-section {
	margin-bottom: var(--space-lg);
}

.section-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--color-text);
	margin: 0 0 var(--space-md);
}

.summary-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.8125rem;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: hidden;
}

.summary-table thead th {
	background: var(--color-surface-alt);
	color: var(--color-text-secondary);
	text-align: center;
	padding: 10px 14px;
	font-weight: 600;
	font-size: 0.6875rem;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	border-bottom: 1px solid var(--color-border);
}

.summary-table td {
	padding: 9px 14px;
	border-bottom: 1px solid var(--color-bg);
	color: var(--color-text);
	text-align: center;
}

.summary-table tbody tr:hover {
	background: var(--color-surface-hover);
}

.summary-table tbody tr:last-child td {
	border-bottom: none;
}

.num-col {
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.cell-machine {
	font-weight: 600;
	color: var(--color-primary);
}

/* ── Utilisation badge ─────────────────────────────────── */
.util-badge {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 0.6875rem;
	font-weight: 700;
	letter-spacing: 0.02em;
}

.util-high {
	background: var(--color-danger-bg);
	color: var(--color-danger);
}

.util-mid {
	background: var(--color-warning-bg);
	color: var(--color-warning);
}

.util-low {
	background: var(--color-success-bg);
	color: var(--color-success);
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
}
</style>
