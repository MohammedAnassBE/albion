<template>
	<div class="item-form-page">
		<PageHeader
			:title="isNew ? 'New Item' : (doc?.name || 'Item')"
			backRoute="/items"
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
			<button class="btn btn-secondary" @click="$router.push('/items')">Back</button>
		</div>

		<!-- Form -->
		<template v-else>
			<!-- Item Details Card -->
			<div class="detail-card" :class="{ 'detail-card--readonly': isReadonly }">
				<div class="detail-card-header">
					<div class="detail-card-icon">
						<AppIcon name="box" :size="20" />
					</div>
					<div>
						<h3 class="detail-card-title">Item Details</h3>
						<p class="detail-card-subtitle">Basic information about this item</p>
					</div>
				</div>
				<div class="form-grid">
					<FormField
						label="Item Code"
						:required="true"
						:error="validationErrors.item_code"
						:readonly="isReadonly"
					>
						<input
							type="text"
							class="field-input"
							:value="form.item_code || ''"
							placeholder="Item Code"
							:disabled="isReadonly"
							@input="form.item_code = $event.target.value"
						/>
					</FormField>

					<FormField
						label="Item Name"
						:required="true"
						:error="validationErrors.item_name"
						:readonly="isReadonly"
					>
						<input
							type="text"
							class="field-input"
							:value="form.item_name || ''"
							placeholder="Item Name"
							:disabled="isReadonly"
							@input="form.item_name = $event.target.value"
						/>
					</FormField>

					<FormField
						label="Machine GG"
						:required="true"
						:error="validationErrors.machine_gg"
						:readonly="isReadonly"
					>
						<LinkField
							:modelValue="form.machine_gg || ''"
							doctype="Machine GG"
							placeholder="Select Machine GG"
							:disabled="isReadonly"
							@update:modelValue="(val) => form.machine_gg = val"
						/>
					</FormField>

					<FormField
						label="Size Range"
						:readonly="isReadonly"
					>
						<LinkField
							:modelValue="form.size_range || ''"
							doctype="Size Range"
							placeholder="Select Size Range"
							:disabled="isReadonly"
							@update:modelValue="onSizeRangeChange"
						/>
					</FormField>
				</div>
			</div>

			<!-- Colours + Sizes side by side -->
			<div class="child-tables-row">
				<ItemCardList
					title="Colours"
					:modelValue="form.colours || []"
					:columns="colourColumns"
					:readonly="isReadonly"
					@update:modelValue="(val) => form.colours = val"
				/>
				<ItemCardList
					title="Sizes"
					:modelValue="form.sizes || []"
					:columns="sizeColumns"
					:readonly="isReadonly"
					@update:modelValue="(val) => form.sizes = val"
				/>
			</div>

			<!-- Processes full width -->
			<ItemCardList
				title="Processes"
				:modelValue="form.processes || []"
				:columns="processColumns"
				:readonly="isReadonly"
				@update:modelValue="(val) => form.processes = val"
			/>
		</template>
	</div>
</template>

<script setup>
import { shallowRef, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/shared/PageHeader.vue'
import FormField from '@/components/shared/FormField.vue'
import LinkField from '@/components/shared/LinkField.vue'
import AppIcon from '@/components/shared/AppIcon.vue'
import ItemCardList from '@/components/shared/ItemCardList.vue'
import { useDoc } from '@/composables/useDoc'
import { useAppToast } from '@/composables/useToast'
import { useAppConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'
import { getDoc } from '@/api/client'

const props = defineProps({ id: { type: String, default: null } })

const router = useRouter()
const confirm = useAppConfirm()
const toast = useAppToast()
const { canCreate: permCanCreate, canWrite: permCanWrite, canDelete: permCanDelete } = usePermissions()

const isNew = computed(() => !props.id)

// Child table column definitions
const colourColumns = [{ field: 'colour', header: 'Colour', type: 'link', options: 'Colour' }]
const sizeColumns = [{ field: 'size', header: 'Size', type: 'link', options: 'Size' }]
const processColumns = [
	{ field: 'process_name', header: 'Process', type: 'link', options: 'Process' },
	{ field: 'minutes', header: 'Minutes', type: 'float' },
]

// Doc composable
const docState = shallowRef(null)
const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

const form = reactive({})
const validationErrors = reactive({})

const isReadonly = computed(() => {
	if (isNew.value) return !permCanCreate('Item')
	return !permCanWrite('Item')
})

const canDelete = computed(() => !isNew.value && permCanDelete('Item'))

// All fields for init/populate/validate/payload
const fields = [
	{ fieldname: 'item_code', fieldtype: 'Data', label: 'Item Code', reqd: 1 },
	{ fieldname: 'item_name', fieldtype: 'Data', label: 'Item Name', reqd: 1 },
	{ fieldname: 'machine_gg', fieldtype: 'Link', label: 'Machine GG', reqd: 1 },
	{ fieldname: 'size_range', fieldtype: 'Link', label: 'Size Range' },
	{ fieldname: 'colours', fieldtype: 'Table' },
	{ fieldname: 'sizes', fieldtype: 'Table' },
	{ fieldname: 'processes', fieldtype: 'Table' },
]

function initForm() {
	Object.keys(form).forEach(k => delete form[k])
	Object.keys(validationErrors).forEach(k => delete validationErrors[k])

	for (const field of fields) {
		if (field.fieldtype === 'Table') {
			form[field.fieldname] = []
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
		} else {
			form[field.fieldname] = val ?? ''
		}
	}
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
		if (field.fieldtype === 'Table') {
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

// Size range onChange handler
async function onSizeRangeChange(val) {
	form.size_range = val
	if (!val) {
		form.sizes = []
		return
	}
	try {
		const sizeRangeDoc = await getDoc('Size Range', val)
		if (sizeRangeDoc?.sizes) {
			form.sizes = sizeRangeDoc.sizes.map(row => ({ size: row.size }))
		}
	} catch {
		// Silently fail — user can add sizes manually
	}
}

async function initDoc() {
	docState.value = useDoc('Item')
	initForm()

	if (props.id) {
		await docState.value.load(props.id)
		if (docState.value.doc.value) populateForm(docState.value.doc.value)
	}
}

watch(() => props.id, () => initDoc())
onMounted(() => {
	initDoc()
	window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown)
})
watch(doc, val => { if (val) populateForm(val) })

function onKeydown(e) {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		if (!isReadonly.value && !docSaving.value) handleSave()
	}
}

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
		toast.success('Saved', 'Item saved successfully')
		if (isNew.value && result?.name) {
			router.replace(`/items/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		showError('Save Failed', e)
	}
}

async function handleDelete() {
	confirm.require({
		message: 'Delete this Item? This cannot be undone.',
		header: 'Confirm Delete',
		acceptLabel: 'Delete',
		acceptProps: { severity: 'danger' },
		rejectLabel: 'Keep',
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success('Deleted', 'Item deleted')
				router.push('/items')
			} catch (e) {
				showError('Delete Failed', e)
			}
		},
	})
}
</script>

<style scoped>
.item-form-page {
	padding: var(--space-lg);
	max-width: 100%;
}

/* ── Loading / Error States ───────────────────────────────── */
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

/* ── Detail Card ──────────────────────────────────────────── */
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

/* ── Child Tables Row (Colours + Sizes side by side) ──────── */
.child-tables-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-lg);
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.35s ease 0.06s both;
}

/* Processes (full width) */
.item-form-page > :deep(.item-card-list:last-child) {
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.35s ease 0.12s both;
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

@media (max-width: 768px) {
	.form-grid {
		grid-template-columns: 1fr;
	}

	.child-tables-row {
		grid-template-columns: 1fr;
	}
}
</style>
