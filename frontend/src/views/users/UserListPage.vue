<template>
	<div class="dynamic-list-page">
		<PageHeader title="Users">
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
				<button v-if="permCanCreate('User')" class="btn btn-primary" @click="$router.push('/users/new')">
					<AppIcon name="plus" :size="14" />
					New
				</button>
			</template>
		</PageHeader>

		<!-- Filter Tabs -->
		<div class="filter-tabs">
			<button
				v-for="tab in filterTabs"
				:key="tab.value"
				class="filter-tab"
				:class="{ active: activeTab === tab.value }"
				@click="onTabChange(tab.value)"
			>
				{{ tab.label }}
			</button>
		</div>

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
								Email
								<span class="sort-arrows">
									<span :class="{ active: sortField === 'name' && sortDir === 'asc' }">&#9650;</span>
									<span :class="{ active: sortField === 'name' && sortDir === 'desc' }">&#9660;</span>
								</span>
							</th>
							<th class="sortable-th" @click="toggleSort('full_name')">
								Full Name
								<span class="sort-arrows">
									<span :class="{ active: sortField === 'full_name' && sortDir === 'asc' }">&#9650;</span>
									<span :class="{ active: sortField === 'full_name' && sortDir === 'desc' }">&#9660;</span>
								</span>
							</th>
							<th class="sortable-th" @click="toggleSort('user_type')">
								User Type
								<span class="sort-arrows">
									<span :class="{ active: sortField === 'user_type' && sortDir === 'asc' }">&#9650;</span>
									<span :class="{ active: sortField === 'user_type' && sortDir === 'desc' }">&#9660;</span>
								</span>
							</th>
							<th style="width: 80px">Enabled</th>
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
							<td>{{ row.full_name || '\u2014' }}</td>
							<td>{{ row.user_type || '\u2014' }}</td>
							<td>
								<AppIcon
									v-if="row.enabled"
									name="check-circle"
									:size="14"
									class="check-on"
								/>
								<AppIcon v-else name="circle" :size="14" class="check-off" />
							</td>
						</tr>
						<tr v-if="rows.length === 0 && !loading">
							<td colspan="4" class="table-empty-cell">
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
import AppIcon from "@/components/shared/AppIcon.vue"
import { useDocList } from "@/composables/useDocList"
import { usePermissions } from "@/composables/usePermissions"

const router = useRouter()
const { canCreate: permCanCreate } = usePermissions()

const filterTabs = [
	{ label: "All", value: "all" },
	{ label: "System User", value: "System User" },
	{ label: "Website User", value: "Website User" },
	{ label: "Disabled", value: "disabled" },
]

const activeTab = ref("all")
const searchQuery = ref("")
const sortField = ref("modified")
const sortDir = ref("desc")

const listState = shallowRef(null)

function initList() {
	activeTab.value = "all"
	searchQuery.value = ""
	sortField.value = "modified"
	sortDir.value = "desc"

	const newList = useDocList("User", {
		fields: ["name", "full_name", "enabled", "user_type"],
		orderBy: "modified desc",
		pageSize: 20,
		immediate: true,
	})
	newList.clearOrFilters()
	listState.value = newList
}

initList()

const rows = computed(() => listState.value?.data.value || [])
const errorMsg = computed(() => listState.value?.error.value || null)
const totalCount = computed(() => {
	const c = listState.value?.totalCount.value
	return typeof c === "number" ? c : 0
})
const loading = computed(() => listState.value?.loading.value ?? false)
const page = computed(() => listState.value?.page.value ?? 1)
const totalPages = computed(() => {
	const ps = listState.value?.pageSize ?? 20
	return Math.max(1, Math.ceil(totalCount.value / ps))
})

function toggleSort(fieldname) {
	if (sortField.value === fieldname) {
		sortDir.value = sortDir.value === "asc" ? "desc" : "asc"
	} else {
		sortField.value = fieldname
		sortDir.value = "desc"
	}
	if (listState.value) {
		listState.value.setOrderBy(`${sortField.value} ${sortDir.value}`)
	}
}

function onTabChange(value) {
	activeTab.value = value
	if (!listState.value) return
	// Clear previous tab filters
	listState.value.setFilter("user_type", null)
	listState.value.setFilter("enabled", null)

	if (value === "disabled") {
		listState.value.setFilter("enabled", 0)
	} else if (value !== "all") {
		listState.value.setFilter("user_type", value)
	}
	listState.value.fetch()
}

function onSearch() {
	if (!listState.value) return
	const q = searchQuery.value.trim()
	if (q) {
		listState.value.setFilter("name", null)
		listState.value.setOrFilters([
			["name", "like", `%${q}%`],
			["full_name", "like", `%${q}%`],
		])
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
		router.push(`/users/${encodeURIComponent(row.name)}`)
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
	font-size: 12px;
	font-weight: 800;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
	padding: 12px 14px;
	text-align: left;
	background: var(--color-surface);
	border-bottom: 1px solid var(--color-border);
	white-space: nowrap;
}

.list-table tbody td {
	padding: 12px 14px;
	font-size: 14px;
	font-weight: 500;
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
	font-weight: 700;
	font-size: 14px;
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
