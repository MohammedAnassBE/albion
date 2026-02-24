<template>
	<div class="dynamic-form-page">
		<PageHeader
			:title="isNew ? 'New Order Tracking' : (doc?.name || 'Order Tracking')"
			backRoute="/order-tracking"
		>
			<template #actions>
				<button
					v-if="!isReadonly"
					class="btn btn-primary"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleSave"
				>
					<AppIcon name="save" :size="14" />
					Save
				</button>
				<button
					v-if="canDelete"
					class="btn btn-danger btn-text"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleDelete"
				>
					<AppIcon name="trash" :size="14" />
					Delete
				</button>
			</template>
		</PageHeader>

		<!-- Loading State -->
		<div v-if="docLoading" class="loading-state">
			<AppIcon name="loader" :size="24" :spin="true" />
			<span>Loading...</span>
		</div>

		<!-- Error State -->
		<div v-else-if="docError && !doc && !isNew" class="error-state">
			<AppIcon name="alert-triangle" :size="24" />
			<p>{{ docError }}</p>
			<button class="btn btn-secondary" @click="$router.push('/order-tracking')">Back</button>
		</div>

		<!-- Form -->
		<template v-else>
			<div class="detail-card" :class="{ 'detail-card--readonly': isReadonly }">
				<div class="detail-card-header">
					<div class="detail-card-icon">
						<AppIcon name="check-circle" :size="20" />
					</div>
					<div>
						<h3 class="detail-card-title">Order Tracking Details</h3>
						<p class="detail-card-subtitle">Track order completion by colour and size</p>
					</div>
				</div>
				<div class="form-grid">
					<!-- Order (LinkField) -->
					<FormField label="Order" :required="true" :error="validationErrors.order" :readonly="isReadonly">
						<LinkField
							:modelValue="form.order || ''"
							doctype="Order"
							placeholder="Select Order"
							:disabled="isReadonly"
							@update:modelValue="onOrderChange"
						/>
					</FormField>

					<!-- Item (cascading select) -->
					<FormField label="Item" :required="true" :error="validationErrors.item" :readonly="isReadonly">
						<select
							class="field-select"
							:value="form.item"
							:disabled="isReadonly || !form.order || orderLoading"
							@change="onItemChange($event.target.value)"
						>
							<option value="">{{ !form.order ? 'Select Order first' : orderLoading ? 'Loading...' : 'Select Item' }}</option>
							<option v-for="item in availableItems" :key="item" :value="item">{{ item }}</option>
						</select>
					</FormField>

					<!-- Colour (cascading select) -->
					<FormField label="Colour" :error="validationErrors.colour" :readonly="isReadonly">
						<select
							class="field-select"
							:value="form.colour"
							:disabled="isReadonly || !form.item"
							@change="form.colour = $event.target.value"
						>
							<option value="">{{ !form.item ? 'Select Item first' : 'Select Colour' }}</option>
							<option v-for="c in availableColours" :key="c" :value="c">{{ c }}</option>
						</select>
					</FormField>

					<!-- Size (cascading select) -->
					<FormField label="Size" :error="validationErrors.size" :readonly="isReadonly">
						<select
							class="field-select"
							:value="form.size"
							:disabled="isReadonly || !form.item"
							@change="form.size = $event.target.value"
						>
							<option value="">{{ !form.item ? 'Select Item first' : 'Select Size' }}</option>
							<option v-for="s in availableSizes" :key="s" :value="s">{{ s }}</option>
						</select>
					</FormField>

					<!-- Quantity -->
					<FormField label="Quantity" :required="true" :error="validationErrors.quantity" :readonly="isReadonly">
						<input
							type="number"
							class="field-input"
							:value="form.quantity"
							min="0"
							step="1"
							:disabled="isReadonly"
							@input="form.quantity = parseInt($event.target.value, 10) || 0"
						/>
					</FormField>

					<!-- Completion Date -->
					<FormField label="Completion Date" :required="true" :error="validationErrors.completion_date" :readonly="isReadonly">
						<input
							type="date"
							class="field-input"
							:value="form.completion_date || ''"
							:disabled="isReadonly"
							@input="form.completion_date = $event.target.value"
						/>
					</FormField>

					<!-- User (read-only) -->
					<FormField label="User" :readonly="true">
						<input
							type="text"
							class="field-input"
							:value="form.user || ''"
							disabled
						/>
					</FormField>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, watch, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import PageHeader from "@/components/shared/PageHeader.vue"
import FormField from "@/components/shared/FormField.vue"
import LinkField from "@/components/shared/LinkField.vue"
import AppIcon from "@/components/shared/AppIcon.vue"
import { useDoc } from "@/composables/useDoc"
import { useAppToast } from "@/composables/useToast"
import { useAppConfirm } from "@/composables/useConfirm"
import { usePermissions } from "@/composables/usePermissions"
import { getDoc } from "@/api/client"

const props = defineProps({
	id: { type: String, default: null },
})

const router = useRouter()
const confirm = useAppConfirm()
const toast = useAppToast()
const { canCreate: permCanCreate, canWrite: permCanWrite, canDelete: permCanDelete } = usePermissions()

const DOCTYPE = 'Order Tracking'
const isNew = computed(() => !props.id)

// Doc composable
const docState = shallowRef(null)
const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

// Form state
const form = reactive({
	order: '',
	item: '',
	colour: '',
	size: '',
	quantity: 0,
	completion_date: '',
	user: '',
})
const validationErrors = reactive({
	order: '',
	item: '',
	quantity: '',
	completion_date: '',
})

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
	if (!form.item) return []
	const colours = new Set()
	for (const row of orderDetails.value) {
		if (row.item === form.item && row.colour) colours.add(row.colour)
	}
	return [...colours].sort()
})
const availableSizes = computed(() => {
	if (!form.item) return []
	const sizes = new Set()
	for (const row of orderDetails.value) {
		if (row.item === form.item && row.size) sizes.add(row.size)
	}
	return [...sizes].sort()
})

// Permissions
const isReadonly = computed(() => {
	if (isNew.value) return !permCanCreate(DOCTYPE)
	return !permCanWrite(DOCTYPE)
})
const canDelete = computed(() => {
	if (!permCanDelete(DOCTYPE)) return false
	return !isNew.value
})

// Fetch order details for cascading
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

// Change handlers
function onOrderChange(val) {
	form.order = val
	form.item = ''
	form.colour = ''
	form.size = ''
	fetchOrderDetails(val)
}

function onItemChange(val) {
	form.item = val
	form.colour = ''
	form.size = ''
}

// Validation
function validate() {
	let valid = true
	const required = { order: 'Order', item: 'Item', quantity: 'Quantity', completion_date: 'Completion Date' }
	for (const [field, label] of Object.entries(required)) {
		const val = form[field]
		const empty = val === null || val === undefined || val === '' || (typeof val === 'string' && !val.trim())
		if (empty) {
			validationErrors[field] = `${label} is required`
			valid = false
		} else {
			validationErrors[field] = ''
		}
	}
	return valid
}

function buildPayload() {
	return {
		order: form.order,
		item: form.item,
		colour: form.colour,
		size: form.size,
		quantity: form.quantity,
		completion_date: form.completion_date,
	}
}

function showError(header, e) {
	confirm.require({
		message: e.message || "An unknown error occurred.",
		header,
		acceptLabel: "OK",
		acceptProps: { severity: "danger" },
	})
}

async function handleSave() {
	if (!validate()) return
	if (!docState.value) return
	try {
		const result = await docState.value.save(buildPayload(), props.id || null)
		toast.success("Saved", "Order Tracking saved successfully")
		if (isNew.value && result?.name) {
			router.replace(`/order-tracking/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		showError("Save Failed", e)
	}
}

async function handleDelete() {
	confirm.require({
		message: "Delete this Order Tracking? This cannot be undone.",
		header: "Confirm Delete",
		acceptLabel: "Delete",
		acceptProps: { severity: "danger" },
		rejectLabel: "Keep",
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success("Deleted", "Order Tracking deleted")
				router.push("/order-tracking")
			} catch (e) {
				showError("Delete Failed", e)
			}
		},
	})
}

async function initDoc() {
	docState.value = useDoc(DOCTYPE)

	if (props.id) {
		await docState.value.load(props.id)
		if (docState.value.doc.value) {
			populateForm(docState.value.doc.value)
		}
	}
}

function populateForm(data) {
	if (!data) return
	form.order = data.order || ''
	form.item = data.item || ''
	form.colour = data.colour || ''
	form.size = data.size || ''
	form.quantity = data.quantity || 0
	form.completion_date = data.completion_date || ''
	form.user = data.user || ''

	// Fetch order details so dropdowns are populated for existing docs
	if (data.order) {
		fetchOrderDetails(data.order)
	}
}

// Keyboard shortcut
function onKeydown(e) {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		if (!isReadonly.value && !docSaving.value) {
			handleSave()
		}
	}
}

// Watch for route changes (id prop)
watch(() => props.id, () => initDoc())

// Watch doc changes (e.g. after save)
watch(doc, (val) => {
	if (val) populateForm(val)
})

onMounted(() => {
	initDoc()
	window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.dynamic-form-page {
	padding: var(--space-lg);
	max-width: 100%;
}

/* -- Loading / Error States ---------------------------------------- */
.loading-state,
.error-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-md);
	padding: var(--space-2xl) 0;
	color: var(--color-text-muted);
	font-size: 0.875rem;
}

.error-state {
	color: var(--color-danger);
}

.error-state p {
	margin: 0;
}

/* -- Detail Card --------------------------------------------------- */
.detail-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	padding: var(--space-lg);
	margin-bottom: var(--space-lg);
	box-shadow: var(--shadow-sm);
	animation: surfaceReveal 0.3s ease both;
}

.detail-card--readonly {
	opacity: 0.95;
}

.detail-card-header {
	display: flex;
	align-items: center;
	gap: var(--space-md);
	margin-bottom: var(--space-lg);
	padding-bottom: var(--space-md);
	border-bottom: 1px solid var(--color-border);
}

.detail-card-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border-radius: var(--radius-md);
	background: var(--color-accent-muted);
	color: var(--color-accent-hover, #d4952e);
	flex-shrink: 0;
}

.detail-card-title {
	font-size: 15px;
	font-weight: 700;
	color: var(--color-primary);
	margin: 0;
	letter-spacing: 0.2px;
}

.detail-card-subtitle {
	font-size: 12px;
	color: var(--color-text-muted);
	margin: 2px 0 0;
}

.form-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-xs) var(--space-xl);
}

@media (max-width: 600px) {
	.form-grid {
		grid-template-columns: 1fr;
	}
}

@keyframes surfaceReveal {
	from {
		opacity: 0;
		transform: translateY(6px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
