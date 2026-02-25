<template>
	<div class="dynamic-list-page">
		<PageHeader title="Order Tracking">
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
				<button class="btn btn-secondary btn-icon" title="Customize Columns" @click="showColumnsModal = true">
					<AppIcon name="sliders" :size="14" />
				</button>
				<button class="btn btn-primary" @click="$router.push('/order-tracking/new')">
					<AppIcon name="plus" :size="14" />
					New
				</button>
			</template>
		</PageHeader>

		<!-- Date Filter Tabs -->
		<div class="filter-tabs">
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

		<!-- Error Banner -->
		<div v-if="errorMsg" class="list-error">
			<AppIcon name="alert-triangle" :size="16" />
			<span>{{ errorMsg }}</span>
			<button class="btn btn-text btn-sm" @click="listState?.refresh()">Retry</button>
		</div>

		<!-- Inline Form (only on Today tab) -->
		<div v-if="activeDateTab === 'today'" class="inline-form-card">
			<div class="inline-form-header">
				<h3>{{ editingRow ? `Edit ${editingRow.name}` : 'Quick Add' }}</h3>
			</div>
			<div class="form-grid--inline">
				<!-- Completion Date -->
				<div class="inline-field">
					<label>Completion Date <span class="req">*</span></label>
					<input
						type="date"
						class="field-input"
						v-model="inlineForm.completion_date"
					/>
				</div>

				<!-- Order (only allocated in Machine Operation) -->
				<div class="inline-field">
					<label>Order <span class="req">*</span></label>
					<select
						class="field-select"
						:value="inlineForm.order"
						@change="onInlineOrderChange($event.target.value)"
					>
						<option value="">Select Order</option>
						<option v-for="o in allocatedOrders" :key="o" :value="o">{{ o }}</option>
					</select>
				</div>

				<!-- Item -->
				<div class="inline-field">
					<label>Item <span class="req">*</span></label>
					<select
						class="field-select"
						v-model="inlineForm.item"
						:disabled="!inlineForm.order || orderLoading"
						@change="onInlineItemChange(inlineForm.item)"
					>
						<option value="">{{ !inlineForm.order ? 'Select Order first' : orderLoading ? 'Loading...' : 'Select Item' }}</option>
						<option v-for="it in availableItems" :key="it" :value="it">{{ it }}</option>
					</select>
				</div>

				<!-- Colour -->
				<div class="inline-field">
					<label>Colour <span class="req">*</span></label>
					<select
						class="field-select"
						v-model="inlineForm.colour"
						:disabled="!inlineForm.item"
					>
						<option value="">{{ !inlineForm.item ? 'Select Item first' : 'Select Colour' }}</option>
						<option v-for="c in availableColours" :key="c" :value="c">{{ c }}</option>
					</select>
				</div>

				<!-- Size -->
				<div class="inline-field">
					<label>Size <span class="req">*</span></label>
					<select
						class="field-select"
						v-model="inlineForm.size"
						:disabled="!inlineForm.item"
					>
						<option value="">{{ !inlineForm.item ? 'Select Item first' : 'Select Size' }}</option>
						<option v-for="s in availableSizes" :key="s" :value="s">{{ s }}</option>
					</select>
				</div>

				<!-- Quantity -->
				<div class="inline-field">
					<label>Quantity <span class="req">*</span></label>
					<input
						type="number"
						class="field-input"
						v-model.number="inlineForm.quantity"
						min="1"
						step="1"
					/>
				</div>

				<!-- Knitter -->
				<div class="inline-field">
					<label>Knitter <span class="req">*</span></label>
					<LinkField
						:modelValue="inlineForm.knitter || ''"
						doctype="Knitter"
						placeholder="Select Knitter"
						@update:modelValue="val => inlineForm.knitter = val"
					/>
				</div>
			</div>

			<!-- Validation Error -->
			<div v-if="formError" class="form-error">{{ formError }}</div>

			<!-- Actions -->
			<div class="inline-form-actions">
				<button
					class="btn btn-primary"
					:disabled="formSaving"
					@click="handleSubmit"
				>
					{{ editingRow ? 'Update' : 'Add' }}
				</button>
				<button
					v-if="editingRow"
					class="btn btn-secondary"
					@click="cancelEdit"
				>
					Cancel
				</button>
			</div>
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
							<th style="width: 120px"></th>
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
								<template v-if="col.fieldtype === 'Check'">
									<AppIcon
										v-if="row[col.fieldname]"
										name="check-circle"
										:size="14"
										class="check-on"
									/>
									<AppIcon v-else name="circle" :size="14" class="check-off" />
								</template>
								<span v-else-if="col.fieldtype === 'Date'">
									{{ formatDate(row[col.fieldname]) }}
								</span>
								<span v-else-if="col.fieldtype === 'Int' || col.fieldtype === 'Float'">
									{{ row[col.fieldname] ?? '' }}
								</span>
								<span v-else>{{ row[col.fieldname] || '' }}</span>
							</td>
							<td>
								<div v-if="row.owner === currentUser" class="row-actions">
									<button
										class="btn btn-secondary btn-xs"
										@click.stop="startEdit(row)"
									>
										Edit
									</button>
									<button
										class="btn btn-danger btn-xs"
										@click.stop="confirmDelete(row)"
									>
										Delete
									</button>
								</div>
							</td>
						</tr>
						<tr v-if="rows.length === 0 && !loading">
							<td :colspan="2 + listColumns.length" class="table-empty-cell">
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

		<!-- Customize Columns Modal -->
		<ColumnCustomizerModal
			v-model:visible="showColumnsModal"
			doctype="Order Tracking"
			:fields="fieldMeta?.fields || []"
			@saved="initList()"
		/>
	</div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, onMounted } from "vue"
import { useRouter } from "vue-router"
import PageHeader from "@/components/shared/PageHeader.vue"
import AppIcon from "@/components/shared/AppIcon.vue"
import LinkField from "@/components/shared/LinkField.vue"
import ColumnCustomizerModal from "@/components/shared/ColumnCustomizerModal.vue"
import { useDocList } from "@/composables/useDocList"
import { useFrontendConfig } from "@/composables/useFrontendConfig"
import { useAuth } from "@/composables/useAuth"
import { useAppToast } from "@/composables/useToast"
import { useAppConfirm } from "@/composables/useConfirm"
import { createDoc, updateDoc, deleteDoc, getDoc, getList } from "@/api/client"

const router = useRouter()
const toast = useAppToast()
const confirm = useAppConfirm()
const { getFieldsForDoctype } = useFrontendConfig()

const DOCTYPE = 'Order Tracking'
const DATE_FIELD = 'completion_date'

const { user: currentUser } = useAuth()

// ── Field Metadata & Dynamic Columns ────────────────────────
const fieldMeta = ref(null)
const showColumnsModal = ref(false)

const listColumns = computed(() => {
	if (!fieldMeta.value?.fields) return []
	return fieldMeta.value.fields.filter(
		(f) => f.show_in_list && f.fieldname !== "name"
	)
})

// Always fetch 'owner' for permission checks on Edit/Delete buttons
const REQUIRED_FIELDS = ['owner']

const fetchFields = computed(() => {
	const fields = ["name"]
	for (const col of listColumns.value) {
		if (!fields.includes(col.fieldname)) {
			fields.push(col.fieldname)
		}
	}
	for (const f of REQUIRED_FIELDS) {
		if (!fields.includes(f)) fields.push(f)
	}
	return fields
})

// ── List State ──────────────────────────────────────────────
const listState = shallowRef(null)
const searchQuery = ref("")
const sortField = ref("modified")
const sortDir = ref("desc")

const dateTabOptions = [
	{ label: "Today", value: "today" },
	{ label: "This Week", value: "week" },
	{ label: "This Month", value: "month" },
	{ label: "All", value: "all" },
]
const activeDateTab = ref("today")

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
		const day = now.getDay()
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

const rows = computed(() => listState.value?.data.value || [])
const errorMsg = computed(() => listState.value?.error.value || null)
const totalCount = computed(() => {
	const c = listState.value?.totalCount.value
	return typeof c === 'number' ? c : 0
})
const loading = computed(() => listState.value?.loading.value || false)
const page = computed(() => listState.value?.page.value || 1)
const totalPages = computed(() => {
	const ps = listState.value?.pageSize ?? 20
	return Math.max(1, Math.ceil(totalCount.value / ps))
})

async function initList() {
	activeDateTab.value = "today"
	searchQuery.value = ""
	sortField.value = "modified"
	sortDir.value = "desc"

	fieldMeta.value = await getFieldsForDoctype(DOCTYPE)

	const ls = useDocList(DOCTYPE, {
		fields: fetchFields.value,
		orderBy: 'modified desc',
		pageSize: 20,
		immediate: false,
	})

	// Apply today filter by default
	const range = getDateRange('today')
	if (range) {
		ls.setFilter(DATE_FIELD, ['between', range])
	}

	listState.value = ls
	ls.fetch()
}

function onDateTabChange(value) {
	activeDateTab.value = value
	if (!listState.value) return
	const range = getDateRange(value)
	if (range) {
		listState.value.setFilter(DATE_FIELD, ['between', range])
	} else {
		listState.value.setFilter(DATE_FIELD, null)
	}
	listState.value.fetch()
}

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

function onSearch() {
	if (!listState.value) return
	const q = searchQuery.value.trim()
	if (q) {
		listState.value.setFilter('name', null)
		listState.value.setOrFilters(
			searchableFields.value.map(f => [f, 'like', `%${q}%`])
		)
	} else {
		listState.value.setOrFilters(null)
	}
	listState.value.fetch()
}

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

function goToPage(p) {
	if (listState.value) listState.value.setPage(p)
}

function formatDate(val) {
	if (!val) return '\u2014'
	const [y, m, d] = val.split('-')
	return (y && m && d) ? `${d}-${m}-${y}` : val
}

function onRowClick(row) {
	if (row?.name) {
		router.push(`/order-tracking/${encodeURIComponent(row.name)}`)
	}
}

// ── Inline Form ─────────────────────────────────────────────
const editingRow = ref(null)
const formSaving = ref(false)
const formError = ref('')

function todayStr() {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inlineForm = reactive({
	completion_date: todayStr(),
	order: '',
	item: '',
	colour: '',
	size: '',
	quantity: 0,
	knitter: '',
})

// Allocated orders from Machine Operation
const allocatedOrders = ref([])

async function fetchAllocatedOrders() {
	try {
		const { data } = await getList('Machine Operation', {
			fields: ['distinct `order` as `order`'],
			filters: { order: ['is', 'set'] },
			limit_page_length: 0,
		})
		const allOrders = data.map(r => r.order)
		// Exclude closed orders
		if (allOrders.length > 0) {
			const { data: closedData } = await getList('Order', {
				fields: ['name'],
				filters: { name: ['in', allOrders], status: 'Closed' },
				limit_page_length: 0,
			})
			const closedSet = new Set(closedData.map(r => r.name))
			allocatedOrders.value = allOrders.filter(o => !closedSet.has(o)).sort()
		} else {
			allocatedOrders.value = []
		}
	} catch {
		allocatedOrders.value = []
	}
}

// Cascading dropdown data
const orderDetails = ref([])
const orderLoading = ref(false)

const availableItems = computed(() => {
	const items = new Set()
	for (const row of orderDetails.value) {
		if (row.item) items.add(row.item)
	}
	return [...items].sort()
})

const availableColours = computed(() => {
	if (!inlineForm.item) return []
	const colours = new Set()
	for (const row of orderDetails.value) {
		if (row.item === inlineForm.item && row.colour) colours.add(row.colour)
	}
	return [...colours].sort()
})

const availableSizes = computed(() => {
	if (!inlineForm.item) return []
	const sizes = new Set()
	for (const row of orderDetails.value) {
		if (row.item === inlineForm.item && row.size) sizes.add(row.size)
	}
	return [...sizes].sort()
})

async function fetchOrderDetails(orderName) {
	if (!orderName) {
		orderDetails.value = []
		return
	}
	orderLoading.value = true
	try {
		const orderDoc = await getDoc('Order', orderName)
		orderDetails.value = orderDoc.order_details || []
	} catch {
		orderDetails.value = []
	} finally {
		orderLoading.value = false
	}
}

function onInlineOrderChange(val) {
	inlineForm.order = val
	inlineForm.item = ''
	inlineForm.colour = ''
	inlineForm.size = ''
	fetchOrderDetails(val)
}

function onInlineItemChange(val) {
	inlineForm.item = val
	inlineForm.colour = ''
	inlineForm.size = ''
}

function resetForm() {
	inlineForm.completion_date = todayStr()
	inlineForm.order = ''
	inlineForm.item = ''
	inlineForm.colour = ''
	inlineForm.size = ''
	inlineForm.quantity = 0
	inlineForm.knitter = ''
	orderDetails.value = []
	editingRow.value = null
	formError.value = ''
}

function startEdit(row) {
	editingRow.value = row
	inlineForm.completion_date = row.completion_date || ''
	inlineForm.order = row.order || ''
	inlineForm.item = row.item || ''
	inlineForm.colour = row.colour || ''
	inlineForm.size = row.size || ''
	inlineForm.quantity = row.quantity || 0
	inlineForm.knitter = row.knitter || ''
	formError.value = ''

	if (row.order) {
		fetchOrderDetails(row.order)
	}
}

function cancelEdit() {
	resetForm()
}

function validate() {
	if (!inlineForm.completion_date) return 'Completion Date is required'
	if (!inlineForm.order) return 'Order is required'
	if (!inlineForm.item) return 'Item is required'
	if (!inlineForm.colour) return 'Colour is required'
	if (!inlineForm.size) return 'Size is required'
	if (!inlineForm.quantity || inlineForm.quantity <= 0) return 'Quantity must be greater than 0'
	if (!inlineForm.knitter) return 'Knitter is required'
	return ''
}

async function handleSubmit() {
	const err = validate()
	if (err) {
		formError.value = err
		return
	}
	formError.value = ''
	formSaving.value = true

	const payload = {
		order: inlineForm.order,
		item: inlineForm.item,
		colour: inlineForm.colour,
		size: inlineForm.size,
		quantity: inlineForm.quantity,
		knitter: inlineForm.knitter,
		completion_date: inlineForm.completion_date,
	}

	try {
		if (editingRow.value) {
			await updateDoc(DOCTYPE, editingRow.value.name, payload)
			toast.success('Updated', `${editingRow.value.name} updated`)
		} else {
			await createDoc(DOCTYPE, payload)
			toast.success('Created', 'Order Tracking record created')
		}
		resetForm()
		listState.value?.refresh()
	} catch (e) {
		formError.value = e.message || 'Save failed'
	} finally {
		formSaving.value = false
	}
}

function confirmDelete(row) {
	confirm.require({
		message: `Delete ${row.name}? This cannot be undone.`,
		header: 'Confirm Delete',
		acceptLabel: 'Delete',
		acceptProps: { severity: 'danger' },
		rejectLabel: 'Cancel',
		accept: async () => {
			try {
				await deleteDoc(DOCTYPE, row.name)
				toast.success('Deleted', `${row.name} deleted`)
				listState.value?.refresh()
			} catch (e) {
				toast.error('Delete Failed', e.message || 'Could not delete')
			}
		},
	})
}

onMounted(() => {
	initList()
	fetchAllocatedOrders()
})
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

.row-actions {
	display: flex;
	gap: 4px;
}

.table-empty-cell {
	padding: 0 !important;
	border: none !important;
}

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

/* ── Inline Form Card ────────────────────────────────────── */
.inline-form-card {
	margin-bottom: var(--space-lg);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	padding: var(--space-lg);
	box-shadow: var(--shadow-sm);
}

.inline-form-header h3 {
	font-size: 15px;
	font-weight: 700;
	color: var(--color-primary);
	margin: 0 0 var(--space-md);
}

.form-grid--inline {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--space-sm) var(--space-lg);
}

@media (max-width: 900px) {
	.form-grid--inline {
		grid-template-columns: repeat(2, 1fr);
	}
}

@media (max-width: 600px) {
	.form-grid--inline {
		grid-template-columns: 1fr;
	}
}

.inline-field label {
	display: block;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
	margin-bottom: 4px;
}

.inline-field .req {
	color: var(--color-danger, #dc2626);
}

.field-input,
.field-select {
	width: 100%;
	padding: 7px 10px;
	font-size: 13px;
	font-family: inherit;
	color: var(--color-text);
	background: var(--color-bg, #fff);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	outline: none;
	transition: border-color var(--transition-fast);
}

.field-input:focus,
.field-select:focus {
	border-color: var(--color-accent);
}

.field-input:disabled,
.field-select:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.form-error {
	margin-top: var(--space-sm);
	padding: var(--space-xs) var(--space-sm);
	font-size: 12px;
	color: #991b1b;
	background: #fef2f2;
	border: 1px solid #fecaca;
	border-radius: var(--radius-sm);
}

.inline-form-actions {
	display: flex;
	gap: var(--space-sm);
	margin-top: var(--space-md);
}

/* ── Shared button styles ────────────────────────────────── */
.btn {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 14px;
	font-size: 13px;
	font-weight: 500;
	font-family: inherit;
	border: 1px solid transparent;
	border-radius: var(--radius-md);
	cursor: pointer;
	transition: background var(--transition-fast), border-color var(--transition-fast);
}

.btn-primary {
	background: var(--color-accent);
	color: #fff;
	border-color: var(--color-accent);
}

.btn-primary:hover {
	background: var(--color-accent-hover, #d4952e);
}

.btn-primary:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.btn-secondary {
	background: var(--color-surface);
	color: var(--color-text);
	border-color: var(--color-border);
}

.btn-secondary:hover {
	background: var(--color-surface-hover);
}

.btn-danger {
	background: #dc2626;
	color: #fff;
	border-color: #dc2626;
}

.btn-danger:hover {
	background: #b91c1c;
}

.btn-text {
	background: none;
	border-color: transparent;
}

.btn-xs {
	padding: 3px 8px;
	font-size: 11px;
}

.btn-sm {
	padding: 4px 10px;
	font-size: 12px;
}

.btn-icon {
	padding: 6px;
}
</style>
