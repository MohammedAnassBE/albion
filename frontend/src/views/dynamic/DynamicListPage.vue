<template>
	<div class="dynamic-list-page">
		<PageHeader :title="registry?.label || docRoute">
			<template #actions>
				<span class="search-box">
					<AppIcon name="search" :size="14" />
					<input
						type="text"
						v-model="searchQuery"
						placeholder="Search..."
						class="search-input-field"
						@keyup.enter="onSearch"
					/>
				</span>
				<button v-if="permCanCreate(doctype)" class="btn btn-primary" @click="$router.push(`/${docRoute}/new`)">
					<AppIcon name="plus" :size="14" />
					New
				</button>
			</template>
		</PageHeader>

		<!-- Status Filter Tabs (submittable only) -->
		<div v-if="isSubmittable" class="filter-tabs">
			<button
				v-for="tab in statusTabs"
				:key="tab.value"
				class="filter-tab"
				:class="{ active: activeTab === tab.value }"
				@click="onTabChange(tab.value)"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- Date Filter Tabs -->
		<div v-if="dateTabField" class="filter-tabs">
			<button
				v-for="tab in dateTabOptions"
				:key="tab.value"
				class="filter-tab"
				:class="{ active: activeDateTab === tab.value }"
				@click="onDateTabChange(tab.value)"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- Advanced Filters -->
		<FilterBar
			v-if="fieldMeta"
			:key="docRoute"
			:fields="filterableFields"
			@apply="onFiltersApply"
		/>

		<!-- Error Banner -->
		<div v-if="errorMsg" class="list-error">
			<AppIcon name="alert-triangle" :size="16" />
			<span>{{ errorMsg }}</span>
			<button class="btn btn-text btn-sm" @click="listState?.refresh()">Retry</button>
		</div>

		<!-- Data Table -->
		<div class="list-card">
			<div v-if="loading" class="table-loading">Loading...</div>
			<div class="table-wrap">
				<table class="list-table">
					<thead>
						<tr>
							<th class="sortable-th" @click="toggleSort('name')">
								Name
								<span class="sort-arrows">
									<span :class="{ active: sortField === 'name' && sortDir === 'asc' }">&#9650;</span>
									<span :class="{ active: sortField === 'name' && sortDir === 'desc' }">&#9660;</span>
								</span>
							</th>
							<th
								v-for="col in listColumns"
								:key="col.fieldname"
								class="sortable-th"
								@click="toggleSort(col.fieldname)"
							>
								{{ col.label }}
								<span class="sort-arrows">
									<span :class="{ active: sortField === col.fieldname && sortDir === 'asc' }">&#9650;</span>
									<span :class="{ active: sortField === col.fieldname && sortDir === 'desc' }">&#9660;</span>
								</span>
							</th>
							<th v-if="isSubmittable && !hasDocstatusColumn" style="width: 120px">Status</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in rows"
							:key="row.name"
							class="clickable-row"
							@click="onRowClick(row)"
						>
							<td><span class="row-name">{{ row.name }}</span></td>
							<td v-for="col in listColumns" :key="col.fieldname">
								<StatusBadge
									v-if="col.fieldname === 'docstatus'"
									:docstatus="row.docstatus"
								/>
								<span v-else-if="col.fieldtype === 'Date'">
									{{ row[col.fieldname] || '\u2014' }}
								</span>
								<template v-else-if="col.fieldtype === 'Check'">
									<AppIcon
										v-if="row[col.fieldname]"
										name="check-circle"
										:size="14"
										class="check-on"
									/>
									<AppIcon v-else name="circle" :size="14" class="check-off" />
								</template>
								<span v-else>{{ row[col.fieldname] ?? '' }}</span>
							</td>
							<td v-if="isSubmittable && !hasDocstatusColumn">
								<StatusBadge :docstatus="row.docstatus" />
							</td>
						</tr>
						<tr v-if="rows.length === 0 && !loading">
							<td :colspan="1 + listColumns.length + (isSubmittable && !hasDocstatusColumn ? 1 : 0)" class="table-empty-cell">
								<div class="table-empty">
									<AppIcon name="inbox" :size="28" style="opacity: 0.4" />
									<p>No records found</p>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			<div v-if="totalPages > 1" class="pagination">
				<button
					class="btn btn-secondary btn-text btn-icon"
					:disabled="page === 1"
					@click="goToPage(page - 1)"
				>
					<AppIcon name="chevron-left" :size="14" />
				</button>
				<span class="pagination-info">
					Page {{ page }} of {{ totalPages }}
					<small>({{ totalCount }} total)</small>
				</span>
				<button
					class="btn btn-secondary btn-text btn-icon"
					:disabled="page >= totalPages"
					@click="goToPage(page + 1)"
				>
					<AppIcon name="chevron-right" :size="14" />
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from "vue"
import { useRouter } from "vue-router"
import PageHeader from "@/components/shared/PageHeader.vue"
import StatusBadge from "@/components/shared/StatusBadge.vue"
import AppIcon from "@/components/shared/AppIcon.vue"
import FilterBar from "@/components/shared/FilterBar.vue"
import { NON_FILTERABLE_FIELDTYPES } from "@/utils/filterOperators"
import { useDocList } from "@/composables/useDocList"
import { useFrontendConfig } from "@/composables/useFrontendConfig"
import { usePermissions } from "@/composables/usePermissions"
import { getRegistryByRoute } from "@/config/doctypes"

const props = defineProps({
	docRoute: { type: String, required: true },
})

const router = useRouter()
const { getFieldsForDoctype } = useFrontendConfig()
const { canCreate: permCanCreate } = usePermissions()

// Instant lookup — no async needed
const registry = computed(() => getRegistryByRoute(props.docRoute))
const doctype = computed(() => registry.value?.doctype || "")
const isSubmittable = computed(() => registry.value?.isSubmittable || false)
const dateTabField = computed(() => registry.value?.dateTabs || null)

// Field metadata (loaded async, config → meta fallback)
const fieldMeta = ref(null)

async function loadFieldMeta() {
	if (!doctype.value) return
	fieldMeta.value = await getFieldsForDoctype(doctype.value)
}

const listColumns = computed(() => {
	if (!fieldMeta.value?.fields) return []
	return fieldMeta.value.fields.filter(
		(f) => f.show_in_list && f.fieldname !== "name"
	)
})

const hasDocstatusColumn = computed(() =>
	listColumns.value.some((c) => c.fieldname === "docstatus")
)

const filterableFields = computed(() => {
	if (!fieldMeta.value?.fields) return []
	return fieldMeta.value.fields.filter(
		(f) =>
			!NON_FILTERABLE_FIELDTYPES.has(f.fieldtype) &&
			!f.hidden &&
			f.fieldname !== 'name'
	)
})

const SEARCHABLE_TYPES = new Set(['Data', 'Small Text', 'Text', 'Long Text', 'Link', 'Select'])

const searchableFields = computed(() => {
	const fields = ['name']
	for (const col of listColumns.value) {
		if (SEARCHABLE_TYPES.has(col.fieldtype) && !fields.includes(col.fieldname)) {
			fields.push(col.fieldname)
		}
	}
	return fields
})

// Fields to fetch from the API
const fetchFields = computed(() => {
	const fields = ["name"]
	for (const col of listColumns.value) {
		if (!fields.includes(col.fieldname)) {
			fields.push(col.fieldname)
		}
	}
	if (isSubmittable.value && !fields.includes("docstatus")) {
		fields.push("docstatus")
	}
	return fields
})

const statusTabs = [
	{ label: "All", value: "all" },
	{ label: "Draft", value: 0 },
	{ label: "Submitted", value: 1 },
	{ label: "Cancelled", value: 2 },
]

const activeTab = ref("all")
const activeDateTab = ref("all")
const searchQuery = ref("")

const dateTabOptions = [
	{ label: "Today", value: "today" },
	{ label: "This Week", value: "week" },
	{ label: "This Month", value: "month" },
	{ label: "All", value: "all" },
]

function getDateRange(tab) {
	const now = new Date()
	const yyyy = (d) => d.getFullYear()
	const mm = (d) => String(d.getMonth() + 1).padStart(2, '0')
	const dd = (d) => String(d.getDate()).padStart(2, '0')
	const fmt = (d) => `${yyyy(d)}-${mm(d)}-${dd(d)}`

	if (tab === 'today') {
		const today = fmt(now)
		return [today, today]
	}
	if (tab === 'week') {
		const day = now.getDay() // 0=Sun
		const monday = new Date(now)
		monday.setDate(now.getDate() - ((day + 6) % 7))
		const sunday = new Date(monday)
		sunday.setDate(monday.getDate() + 6)
		return [fmt(monday), fmt(sunday)]
	}
	if (tab === 'month') {
		const first = new Date(now.getFullYear(), now.getMonth(), 1)
		const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
		return [fmt(first), fmt(last)]
	}
	return null
}

// Sort state
const sortField = ref("modified")
const sortDir = ref("desc")

const listState = shallowRef(null)

async function initList() {
	if (!doctype.value) return
	activeTab.value = "all"
	activeDateTab.value = "all"
	searchQuery.value = ""
	sortField.value = "modified"
	sortDir.value = "desc"

	// Load field metadata first
	await loadFieldMeta()

	const newList = useDocList(doctype.value, {
		fields: fetchFields.value,
		orderBy: "modified desc",
		pageSize: 20,
		immediate: true,
	})
	newList.clearOrFilters()
	listState.value = newList
}

// Re-init when docRoute changes
watch(() => props.docRoute, () => initList(), { immediate: true })

const rows = computed(() => {
	if (!listState.value) return []
	return listState.value.data.value || []
})
const errorMsg = computed(() => {
	if (!listState.value) return null
	return listState.value.error.value || null
})
const totalCount = computed(() => {
	if (!listState.value) return 0
	const c = listState.value.totalCount.value
	return typeof c === "number" ? c : 0
})
const loading = computed(() => {
	if (!listState.value) return false
	return listState.value.loading.value
})
const page = computed(() => {
	if (!listState.value) return 1
	return listState.value.page.value
})
const totalPages = computed(() => {
	if (!listState.value) return 1
	const ps = listState.value.pageSize ?? 20
	return Math.max(1, Math.ceil(totalCount.value / ps))
})

function toggleSort(fieldname) {
	if (sortField.value === fieldname) {
		sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
	} else {
		sortField.value = fieldname
		sortDir.value = 'desc'
	}
	if (listState.value) {
		listState.value.setOrderBy(`${sortField.value} ${sortDir.value}`)
	}
}

function onTabChange(value) {
	activeTab.value = value
	if (!listState.value) return
	if (value === "all") {
		listState.value.setFilter("docstatus", null)
	} else {
		listState.value.setFilter("docstatus", value)
	}
	listState.value.fetch()
}

function onDateTabChange(value) {
	activeDateTab.value = value
	if (!listState.value || !dateTabField.value) return
	const range = getDateRange(value)
	if (range) {
		listState.value.setFilter(dateTabField.value, ['between', range])
	} else {
		listState.value.setFilter(dateTabField.value, null)
	}
	listState.value.fetch()
}

function onFiltersApply(advancedFilters) {
	if (!listState.value) return
	// Clear all non-managed keys, then apply new advanced filters
	const preserve = ['docstatus', 'name']
	if (dateTabField.value) preserve.push(dateTabField.value)
	listState.value.clearFilters(preserve)
	for (const [key, val] of Object.entries(advancedFilters)) {
		listState.value.setFilter(key, val)
	}
	listState.value.fetch()
}

function onSearch() {
	if (!listState.value) return
	const q = searchQuery.value.trim()
	if (q) {
		listState.value.setFilter("name", null)
		listState.value.setOrFilters(
			searchableFields.value.map(f => [f, 'like', `%${q}%`])
		)
	} else {
		listState.value.setOrFilters(null)
	}
	listState.value.fetch()
}

function goToPage(p) {
	if (listState.value) listState.value.setPage(p)
}

function onRowClick(row) {
	if (row?.name) {
		router.push(`/${props.docRoute}/${encodeURIComponent(row.name)}`)
	}
}
</script>

<style scoped>
.dynamic-list-page {
	padding: var(--space-lg);
}

.search-box {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	padding: 0 var(--space-sm);
}

.search-box .app-icon {
	color: var(--color-text-muted);
}

.search-input-field {
	border: none;
	background: none;
	outline: none;
	font-size: 13px;
	color: var(--color-text);
	padding: 7px 4px;
	width: 140px;
	font-family: inherit;
}

.search-input-field::placeholder {
	color: var(--color-text-muted);
}

/* ── Filter Tabs ──────────────────────────────────────────── */
.filter-tabs {
	display: flex;
	gap: 2px;
	margin-bottom: var(--space-md);
	border-bottom: 2px solid var(--color-border);
	padding-bottom: 0;
}

.filter-tab {
	padding: var(--space-sm) var(--space-md);
	font-size: 0.8125rem;
	font-weight: 500;
	color: var(--color-text-secondary);
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	margin-bottom: -2px;
	cursor: pointer;
	transition: color var(--transition-fast), border-color var(--transition-fast);
}

.filter-tab:hover {
	color: var(--color-text);
	border-bottom-color: var(--color-border-strong);
}

.filter-tab.active {
	color: var(--color-primary);
	border-bottom-color: var(--color-accent);
	font-weight: 600;
}

/* ── List Card ────────────────────────────────────────────── */
.list-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: hidden;
}

.table-wrap {
	overflow-x: auto;
}

.table-loading {
	padding: var(--space-md);
	text-align: center;
	font-size: 13px;
	color: var(--color-text-muted);
}

.list-table {
	width: 100%;
	border-collapse: collapse;
}

.list-table thead th {
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
	padding: 6px 14px;
	text-align: left;
	background: var(--color-surface);
	border-bottom: 1px solid var(--color-border);
	white-space: nowrap;
}

.list-table tbody td {
	padding: 6px 14px;
	font-size: 13px;
	border-bottom: 1px solid var(--color-bg);
}

.list-table tbody tr:last-child td {
	border-bottom: none;
}

.clickable-row {
	cursor: pointer;
	transition: background var(--transition-fast);
}

.clickable-row:hover {
	background: var(--color-surface-hover);
}

.row-name {
	font-weight: 500;
	font-size: 0.8125rem;
	color: var(--color-primary);
}

.check-on {
	color: #059669;
}

.check-off {
	color: #CBD5E1;
}

.table-empty-cell {
	padding: 0 !important;
	border: none !important;
}

/* ── Sortable Column Headers ─────────────────────────────── */
.sortable-th {
	cursor: pointer;
	user-select: none;
}

.sortable-th:hover {
	color: var(--color-text);
}

.sort-arrows {
	display: inline-flex;
	flex-direction: column;
	vertical-align: middle;
	margin-left: 4px;
	line-height: 1;
	gap: 0;
}

.sort-arrows span {
	font-size: 7px;
	line-height: 7px;
	color: var(--color-border-strong, #cbd5e1);
	transition: color var(--transition-fast);
}

.sort-arrows span.active {
	color: var(--color-primary);
}

/* ── Pagination ───────────────────────────────────────────── */
.pagination {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-md);
	padding: var(--space-sm) var(--space-md);
	border-top: 1px solid var(--color-border);
}

.pagination-info {
	font-size: 0.8125rem;
	color: var(--color-text-secondary);
}

.pagination-info small {
	color: var(--color-text-muted);
	margin-left: var(--space-xs);
}

/* ── Error Banner ────────────────────────────────────────── */
.list-error {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-sm) var(--space-md);
	margin-bottom: var(--space-md);
	background: #fef2f2;
	border: 1px solid #fecaca;
	border-radius: var(--radius-md);
	color: #991b1b;
	font-size: 0.8125rem;
}

.list-error .app-icon {
	color: #dc2626;
	flex-shrink: 0;
}

.list-error span {
	flex: 1;
}

/* ── Empty State ──────────────────────────────────────────── */
.table-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-xl) 0;
	color: var(--color-text-muted);
}

.table-empty p {
	margin: 0;
	font-size: 13px;
}
</style>
