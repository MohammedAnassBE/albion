<template>
	<div class="dynamic-form-page">
		<PageHeader
			:title="isNew ? 'New Order' : (doc?.name || 'Order')"
			backRoute="/orders"
		>
			<template #actions>
				<StatusBadge v-if="!isNew && doc" :docstatus="doc.docstatus" />
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
					v-if="canSubmit"
					class="btn btn-success"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleSubmit"
				>
					<AppIcon name="check" :size="14" />
					Submit
				</button>
				<button
					v-if="canCancel"
					class="btn btn-danger btn-outlined"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleCancel"
				>
					<AppIcon name="x" :size="14" />
					Cancel
				</button>
				<button
					v-if="canAmend"
					class="btn btn-primary"
					:class="{ 'btn-loading': docSaving }"
					:disabled="docSaving"
					@click="handleAmend"
				>
					<AppIcon name="copy" :size="14" />
					Amend
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
			<button class="btn btn-secondary" @click="$router.push('/orders')">Back</button>
		</div>

		<!-- Form -->
		<template v-else>
			<div class="detail-card" :class="{ 'detail-card--readonly': isReadonly }">
				<div class="detail-card-header">
					<div class="detail-card-icon">
						<AppIcon :name="cardIcon" :size="20" />
					</div>
					<div>
						<h3 class="detail-card-title">Order Details</h3>
						<p class="detail-card-subtitle">{{ cardSubtitle }}</p>
					</div>
				</div>
				<div class="form-grid">
					<template v-for="field in formFields" :key="field.fieldname">
						<FormField
							:label="field.label"
							:required="!!field.reqd"
							:error="validationErrors[field.fieldname]"
							:readonly="isReadonly || !!field.read_only"
						>
							<LinkField
								v-if="field.fieldtype === 'Link'"
								:modelValue="form[field.fieldname] || ''"
								:doctype="field.options"
								:placeholder="`Select ${field.label}`"
								:disabled="isReadonly || !!field.read_only"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>
							<input
								v-else-if="field.fieldtype === 'Date'"
								type="date"
								class="field-input"
								:value="formatDateForInput(form[field.fieldname])"
								:disabled="isReadonly"
								@input="form[field.fieldname] = $event.target.value"
							/>
							<input
								v-else
								type="text"
								class="field-input"
								:value="form[field.fieldname] || ''"
								:placeholder="field.label"
								:disabled="isReadonly"
								@input="form[field.fieldname] = $event.target.value"
							/>
						</FormField>
					</template>
				</div>
			</div>

			<!-- Items Table -->
			<ItemCardList
				class="child-table-animated"
				:style="{ animationDelay: '0.06s' }"
				title="Items"
				:modelValue="form.items || []"
				:columns="itemColumns"
				:readonly="isReadonly"
				@update:modelValue="(val) => form.items = val"
			/>

			<!-- Order Matrix -->
			<OrderMatrix
				v-if="!isNew"
				:items="form.items || []"
				:orderDetails="form.order_details || []"
				:readonly="isReadonly"
				@update:orderDetails="(details) => form.order_details = details"
			/>

			<!-- Completion Status (submitted orders only) -->
			<div v-if="doc?.docstatus === 1 && (form.order_details || []).length > 0" class="completion-section">
				<div class="completion-header">
					<div class="completion-header-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
					</div>
					<div>
						<h3 class="completion-title">Completion Status</h3>
						<p class="completion-subtitle">Order tracking progress by colour and size</p>
					</div>
				</div>
				<OrderCompletionMatrix
					:orderDetails="form.order_details || []"
					:completionData="completionData"
				/>
			</div>

		</template>
	</div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/shared/PageHeader.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import FormField from '@/components/shared/FormField.vue'
import LinkField from '@/components/shared/LinkField.vue'
import ItemCardList from '@/components/shared/ItemCardList.vue'
import AppIcon from '@/components/shared/AppIcon.vue'
import OrderMatrix from '@/components/shared/OrderMatrix.vue'
import OrderCompletionMatrix from '@/components/shared/OrderCompletionMatrix.vue'
import { useDoc } from '@/composables/useDoc'
import { useAppToast } from '@/composables/useToast'
import { useAppConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'
import { callMethod } from '@/api/client'
import config from '@/config/fields/order'

const props = defineProps({ id: { type: String, default: null } })

const router = useRouter()
const confirm = useAppConfirm()
const toast = useAppToast()
const { canCreate: permCanCreate, canWrite: permCanWrite, canDelete: permCanDelete, canSubmit: permCanSubmit, canCancel: permCanCancel, canAmend: permCanAmend } = usePermissions()

const fields = config.fields
const isNew = computed(() => !props.id)

const cardIcon = computed(() => config.icon || 'shopping-cart')
const cardSubtitle = computed(() => config.subtitle || 'Customer order with items and quantities')

const itemColumns = [{ field: 'item', header: 'Item', type: 'link', options: 'Item' }]

// Doc composable
const docState = shallowRef(null)
const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

const form = reactive({})
const validationErrors = reactive({})
const completionData = ref({})

async function fetchCompletion(orderName) {
	if (!orderName) return
	try {
		const result = await callMethod('albion.albion.doctype.order.order.get_order_completion', { order: orderName })
		completionData.value = result || {}
	} catch (e) {
		console.error('Error fetching completion data:', e)
		completionData.value = {}
	}
}

const formFields = computed(() => fields.filter(f => {
	if (f.fieldtype === 'Table') return false
	if (f.hidden_if_empty && !form[f.fieldname]) return false
	return true
}))

const isReadonly = computed(() => {
	if (isNew.value) return !permCanCreate('Order')
	return doc.value?.docstatus !== 0 || !permCanWrite('Order')
})

const canSubmit = computed(() => !isNew.value && doc.value?.docstatus === 0 && permCanSubmit('Order'))
const canCancel = computed(() => !isNew.value && doc.value?.docstatus === 1 && permCanCancel('Order'))
const canDelete = computed(() => !isNew.value && doc.value?.docstatus === 0 && permCanDelete('Order'))
const canAmend = computed(() => !isNew.value && doc.value?.docstatus === 2 && permCanAmend('Order'))

function formatDateForInput(val) {
	if (!val) return ''
	if (val instanceof Date) {
		const y = val.getFullYear()
		const m = String(val.getMonth() + 1).padStart(2, '0')
		const d = String(val.getDate()).padStart(2, '0')
		return `${y}-${m}-${d}`
	}
	return String(val)
}

function initForm() {
	Object.keys(form).forEach(k => delete form[k])
	Object.keys(validationErrors).forEach(k => delete validationErrors[k])

	for (const field of fields) {
		if (field.fieldtype === 'Table') {
			form[field.fieldname] = []
		} else if (field.fieldtype === 'Check') {
			form[field.fieldname] = 0
		} else if (['Int', 'Float', 'Currency', 'Percent'].includes(field.fieldtype)) {
			form[field.fieldname] = 0
		} else {
			form[field.fieldname] = ''
		}
		if (field.reqd) validationErrors[field.fieldname] = ''
	}
}

function populateForm(data) {
	if (!data) return

	for (const field of fields) {
		const val = data[field.fieldname]
		if (field.fieldtype === 'Table') {
			form[field.fieldname] = Array.isArray(val) ? val.map(row => ({ ...row })) : []
		} else if (field.fieldtype === 'Check') {
			form[field.fieldname] = val ? 1 : 0
		} else {
			form[field.fieldname] = val ?? ''
		}
	}

	if (data.docstatus != null) form.docstatus = data.docstatus
}

function formatDate(d) {
	if (!d) return null
	if (typeof d === 'string') return d
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function validate() {
	let valid = true
	for (const field of fields) {
		if (!field.reqd || field.fieldtype === 'Table') continue
		const val = form[field.fieldname]
		const empty = val === null || val === undefined || val === '' || (typeof val === 'string' && !val.trim())
		if (empty) {
			validationErrors[field.fieldname] = `${field.label} is required`
			valid = false
		} else {
			validationErrors[field.fieldname] = ''
		}
	}
	return valid
}

function buildPayload() {
	const payload = {}
	for (const field of fields) {
		const val = form[field.fieldname]
		if (field.fieldtype === 'Date') {
			payload[field.fieldname] = formatDate(val)
		} else if (field.fieldtype === 'Table') {
			payload[field.fieldname] = (val || []).map(row => {
				const clean = {}
				for (const [k, v] of Object.entries(row)) {
					if (['name', 'creation', 'modified', 'modified_by', 'owner', 'docstatus', 'doctype', 'parent', 'parentfield', 'parenttype', 'idx'].includes(k)) {
						if (row.name && !row.__isNew) clean[k] = v
						continue
					}
					clean[k] = v
				}
				return clean
			})
		} else {
			payload[field.fieldname] = val
		}
	}
	return payload
}

async function initDoc() {
	docState.value = useDoc('Order')
	initForm()
	completionData.value = {}

	if (props.id) {
		await docState.value.load(props.id)
		if (docState.value.doc.value) {
			populateForm(docState.value.doc.value)
			if (docState.value.doc.value.docstatus === 1) {
				fetchCompletion(props.id)
			}
		}
	}
}

watch(() => props.id, () => initDoc())

function onKeydown(e) {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		if (!isReadonly.value && !docSaving.value) handleSave()
	}
}

onMounted(() => {
	initDoc()
	window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown)
})

watch(doc, val => { if (val) populateForm(val) })

function showError(header, e) {
	confirm.require({
		message: e.message || 'An unknown error occurred.',
		header,
		acceptLabel: 'OK',
		acceptProps: { severity: 'danger' },
	})
}

async function handleSave() {
	if (!validate() || !docState.value) return

	try {
		const result = await docState.value.save(buildPayload(), props.id || null)
		toast.success('Saved', 'Order saved successfully')
		if (isNew.value && result?.name) {
			router.replace(`/orders/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		showError('Save Failed', e)
	}
}

async function handleSubmit() {
	confirm.require({
		message: 'Submit this Order? It will no longer be editable.',
		header: 'Confirm Submit',
		acceptLabel: 'Submit',
		acceptProps: { severity: 'success' },
		rejectLabel: 'Cancel',
		accept: async () => {
			try {
				await docState.value.submit()
				toast.success('Submitted', 'Order submitted successfully')
			} catch (e) {
				showError('Submit Failed', e)
			}
		},
	})
}

async function handleCancel() {
	confirm.require({
		message: 'Cancel this Order? This action cannot be undone.',
		header: 'Confirm Cancel',
		acceptLabel: 'Cancel Order',
		acceptProps: { severity: 'danger' },
		rejectLabel: 'Keep',
		accept: async () => {
			try {
				await docState.value.cancel()
				toast.success('Cancelled', 'Order cancelled')
			} catch (e) {
				showError('Cancel Failed', e)
			}
		},
	})
}

async function handleAmend() {
	try {
		const result = await docState.value.amend()
		router.push(`/orders/${encodeURIComponent(result.name)}`)
		toast.success('Amended', 'New amended Order created')
	} catch (e) {
		showError('Amend Failed', e)
	}
}

async function handleDelete() {
	confirm.require({
		message: 'Delete this Order? This cannot be undone.',
		header: 'Confirm Delete',
		acceptLabel: 'Delete',
		acceptProps: { severity: 'danger' },
		rejectLabel: 'Keep',
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success('Deleted', 'Order deleted')
				router.push('/orders')
			} catch (e) {
				showError('Delete Failed', e)
			}
		},
	})
}
</script>

<style scoped>
.dynamic-form-page {
	padding: var(--space-lg);
	max-width: 100%;
}

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

/* -- Child Table Animation ----------------------------------------- */
.child-table-animated {
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.35s ease both;
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

/* -- Completion Section --------------------------------------------- */
.completion-section {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	margin-bottom: var(--space-lg);
	box-shadow: var(--shadow-sm);
	animation: surfaceReveal 0.35s ease both;
	animation-delay: 0.1s;
	overflow: hidden;
}

.completion-header {
	display: flex;
	align-items: center;
	gap: var(--space-md);
	padding: var(--space-md) var(--space-lg);
	border-bottom: 1px solid var(--color-border);
}

.completion-header-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: var(--radius-md);
	background: rgba(34, 197, 94, 0.1);
	color: #16a34a;
	flex-shrink: 0;
}

.completion-title {
	font-size: 14px;
	font-weight: 700;
	color: var(--color-primary);
	margin: 0;
	letter-spacing: 0.2px;
}

.completion-subtitle {
	font-size: 11px;
	color: var(--color-text-muted);
	margin: 2px 0 0;
}
</style>
