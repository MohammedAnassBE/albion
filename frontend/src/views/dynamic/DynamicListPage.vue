<template>
	<div class="dynamic-list-page">
		<PageHeader :title="registry?.label || docRoute">
			<template #actions>
				<span class="search-box">
					<i class="pi pi-search" />
					<InputText
						v-model="searchQuery"
						placeholder="Search..."
						size="small"
						@keyup.enter="onSearch"
					/>
				</span>
				<Button
					label="New"
					icon="pi pi-plus"
					@click="$router.push(`/${docRoute}/new`)"
				/>
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

		<!-- Error Banner -->
		<div v-if="errorMsg" class="list-error">
			<i class="pi pi-exclamation-triangle" />
			<span>{{ errorMsg }}</span>
			<Button label="Retry" text size="small" @click="listState?.refresh()" />
		</div>

		<!-- Data Table -->
		<div class="list-card">
			<DataTable
				:value="rows"
				:loading="loading"
				:rowHover="true"
				size="small"
				dataKey="name"
				@row-click="onRowClick"
				class="clickable-table"
				stripedRows
			>
				<!-- Name column always first -->
				<Column field="name" header="Name" sortable>
					<template #body="{ data }">
						<span class="row-name">{{ data.name }}</span>
					</template>
				</Column>

				<!-- Dynamic columns from config/meta -->
				<Column
					v-for="col in listColumns"
					:key="col.fieldname"
					:field="col.fieldname"
					:header="col.label"
					sortable
				>
					<template #body="{ data }">
						<StatusBadge
							v-if="col.fieldname === 'docstatus'"
							:docstatus="data.docstatus"
						/>
						<span v-else-if="col.fieldtype === 'Date'">
							{{ data[col.fieldname] || '\u2014' }}
						</span>
						<i
							v-else-if="col.fieldtype === 'Check'"
							:class="data[col.fieldname] ? 'pi pi-check-circle check-on' : 'pi pi-circle check-off'"
						/>
						<span v-else>{{ data[col.fieldname] ?? '' }}</span>
					</template>
				</Column>

				<!-- Docstatus column for submittable (if not already in list columns) -->
				<Column
					v-if="isSubmittable && !hasDocstatusColumn"
					field="docstatus"
					header="Status"
					style="width: 120px"
				>
					<template #body="{ data }">
						<StatusBadge :docstatus="data.docstatus" />
					</template>
				</Column>

				<template #empty>
					<div class="table-empty">
						<i class="pi pi-inbox" />
						<p>No records found</p>
					</div>
				</template>
			</DataTable>

			<!-- Pagination -->
			<div v-if="totalPages > 1" class="pagination">
				<Button
					icon="pi pi-chevron-left"
					severity="secondary"
					text
					size="small"
					:disabled="page === 1"
					@click="goToPage(page - 1)"
				/>
				<span class="pagination-info">
					Page {{ page }} of {{ totalPages }}
					<small>({{ totalCount }} total)</small>
				</span>
				<Button
					icon="pi pi-chevron-right"
					severity="secondary"
					text
					size="small"
					:disabled="page >= totalPages"
					@click="goToPage(page + 1)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from "vue"
import { useRouter } from "vue-router"
import DataTable from "primevue/datatable"
import Column from "primevue/column"
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import PageHeader from "@/components/shared/PageHeader.vue"
import StatusBadge from "@/components/shared/StatusBadge.vue"
import { useDocList } from "@/composables/useDocList"
import { useFrontendConfig } from "@/composables/useFrontendConfig"
import { getRegistryByRoute } from "@/config/doctypes"

const props = defineProps({
	docRoute: { type: String, required: true },
})

const router = useRouter()
const { getFieldsForDoctype } = useFrontendConfig()

// Instant lookup — no async needed
const registry = computed(() => getRegistryByRoute(props.docRoute))
const doctype = computed(() => registry.value?.doctype || "")
const isSubmittable = computed(() => registry.value?.isSubmittable || false)

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
const searchQuery = ref("")

const listState = shallowRef(null)

async function initList() {
	if (!doctype.value) return
	activeTab.value = "all"
	searchQuery.value = ""

	// Load field metadata first
	await loadFieldMeta()

	listState.value = useDocList(doctype.value, {
		fields: fetchFields.value,
		orderBy: "modified desc",
		pageSize: 20,
		immediate: true,
	})
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

function onSearch() {
	if (!listState.value) return
	if (searchQuery.value.trim()) {
		listState.value.setFilter("name", ["like", `%${searchQuery.value.trim()}%`])
	} else {
		listState.value.setFilter("name", null)
	}
	listState.value.fetch()
}

function goToPage(p) {
	if (listState.value) listState.value.setPage(p)
}

function onRowClick(event) {
	const name = event.data?.name
	if (name) {
		router.push(`/${props.docRoute}/${encodeURIComponent(name)}`)
	}
}
</script>

<style scoped>
.dynamic-list-page {
	padding: var(--space-lg);
	max-width: 1100px;
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

.search-box i {
	color: var(--color-text-muted);
	font-size: 14px;
}

.search-box :deep(.p-inputtext) {
	border: none;
	background: none;
	box-shadow: none;
	padding-left: 0;
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

.row-name {
	font-weight: 500;
	font-size: 0.8125rem;
	color: var(--color-primary);
}

.clickable-table :deep(.p-datatable-tbody > tr) {
	cursor: pointer;
}

.check-on {
	color: #059669;
	font-size: 14px;
}

.check-off {
	color: #CBD5E1;
	font-size: 14px;
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

.list-error i {
	font-size: 16px;
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

.table-empty i {
	font-size: 28px;
	opacity: 0.4;
}

.table-empty p {
	margin: 0;
	font-size: 13px;
}
</style>
