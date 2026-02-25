<template>
	<div class="dynamic-form-page">
		<PageHeader
			:title="isNew ? `New ${registry?.label || ''}` : (doc?.name || registry?.label || route)"
			:backRoute="isSingle ? null : `/${route}`"
		>
			<template #actions>
				<StatusBadge v-if="!isNew && doc && isSubmittable" :docstatus="doc.docstatus" />
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
			<button v-if="!isSingle" class="btn btn-secondary" @click="$router.push(`/${route}`)">Back</button>
		</div>

		<!-- Form -->
		<template v-else>
			<div class="detail-card" :class="{ 'detail-card--readonly': isReadonly }">
				<div class="detail-card-header">
					<div class="detail-card-icon">
						<AppIcon :name="cardIcon" :size="20" />
					</div>
					<div>
						<h3 class="detail-card-title">{{ registry?.label || doctype }} Details</h3>
						<p class="detail-card-subtitle">{{ cardSubtitle }}</p>
					</div>
				</div>
				<div class="form-grid">
					<template v-for="field in formFields" :key="field.fieldname">
						<!-- Table fields rendered outside grid -->
						<template v-if="field.fieldtype === 'Table'" />
						<template v-else-if="field.depends_on && !form[field.depends_on]" />
						<template v-else-if="field.hide_when && form[field.hide_when]" />

						<FormField
							v-else
							:label="field.fieldtype === 'Check' ? '' : field.label"
							:required="!!field.reqd"
							:error="validationErrors[field.fieldname]"
							:readonly="isReadonly || !!field.read_only"
							:class="{ 'form-field--check': field.fieldtype === 'Check' }"
						>
							<!-- Link -->
							<LinkField
								v-if="field.fieldtype === 'Link'"
								:modelValue="form[field.fieldname] || ''"
								:doctype="field.options"
								:placeholder="`Select ${field.label}`"
								:disabled="isReadonly || !!field.read_only"
								@update:modelValue="(val) => { form[field.fieldname] = val; handleChange(field, val) }"
							/>

							<!-- Select -->
							<select
								v-else-if="field.fieldtype === 'Select'"
								class="field-select"
								:value="form[field.fieldname]"
								:disabled="isReadonly"
								@change="form[field.fieldname] = $event.target.value"
							>
								<option value="">Select {{ field.label }}</option>
								<option
									v-for="opt in parseSelectOptions(field.options)"
									:key="opt.value"
									:value="opt.value"
								>{{ opt.label }}</option>
							</select>

							<!-- Date -->
							<input
								v-else-if="field.fieldtype === 'Date'"
								type="date"
								class="field-input"
								:value="formatDateForInput(form[field.fieldname])"
								:disabled="isReadonly"
								@input="form[field.fieldname] = $event.target.value"
							/>

							<!-- Time -->
							<input
								v-else-if="field.fieldtype === 'Time'"
								type="time"
								class="field-input"
								:value="form[field.fieldname] || ''"
								:disabled="isReadonly || !!field.read_only"
								@input="form[field.fieldname] = $event.target.value"
							/>

							<!-- Int -->
							<input
								v-else-if="field.fieldtype === 'Int'"
								type="number"
								class="field-input"
								:value="form[field.fieldname]"
								min="0"
								step="1"
								:disabled="isReadonly || !!field.read_only"
								@input="form[field.fieldname] = parseInt($event.target.value, 10) || 0"
							/>

							<!-- Float / Currency / Percent -->
							<input
								v-else-if="field.fieldtype === 'Float' || field.fieldtype === 'Currency' || field.fieldtype === 'Percent'"
								type="number"
								class="field-input"
								:value="form[field.fieldname]"
								min="0"
								step="0.01"
								:disabled="isReadonly"
								@input="form[field.fieldname] = parseFloat($event.target.value) || 0"
							/>

							<!-- Check -->
							<label v-else-if="field.fieldtype === 'Check'" class="check-inline">
								<input
									type="checkbox"
									class="field-checkbox"
									:checked="!!form[field.fieldname]"
									:disabled="isReadonly"
									@change="form[field.fieldname] = $event.target.checked ? 1 : 0"
								/>
								<span class="check-inline-label">{{ field.label }}</span>
							</label>

							<!-- Textarea types -->
							<textarea
								v-else-if="field.fieldtype === 'Small Text' || field.fieldtype === 'Text' || field.fieldtype === 'Long Text' || field.fieldtype === 'Text Editor'"
								class="field-input"
								:value="form[field.fieldname] || ''"
								rows="3"
								:disabled="isReadonly"
								@input="form[field.fieldname] = $event.target.value"
							/>

							<!-- Fallback: text input -->
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

			<!-- Child Tables -->
			<ItemCardList
				v-for="(field, idx) in tableFields"
				:key="field.fieldname"
				class="child-table-animated"
				:style="{ animationDelay: `${0.06 + idx * 0.06}s` }"
				:title="field.label"
				:modelValue="form[field.fieldname] || []"
				:columns="childTableColumns[field.fieldname] || []"
				:readonly="isReadonly || !!field.read_only"
				@update:modelValue="(val) => form[field.fieldname] = val"
			/>

		</template>
	</div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, watch, onMounted, onUnmounted } from "vue"
import { useRouter } from "vue-router"
import PageHeader from "@/components/shared/PageHeader.vue"
import StatusBadge from "@/components/shared/StatusBadge.vue"
import FormField from "@/components/shared/FormField.vue"
import LinkField from "@/components/shared/LinkField.vue"
import ItemCardList from "@/components/shared/ItemCardList.vue"
import AppIcon from "@/components/shared/AppIcon.vue"
import { useDoc } from "@/composables/useDoc"
import { useAppToast } from "@/composables/useToast"
import { useAppConfirm } from "@/composables/useConfirm"
import { usePermissions } from "@/composables/usePermissions"
import { getRegistryByDoctype } from "@/config/doctypes"

const props = defineProps({
	config: { type: Object, required: true },
	id: { type: String, default: null },
	route: { type: String, required: true },
})

const router = useRouter()
const confirm = useAppConfirm()
const toast = useAppToast()
const { canCreate: permCanCreate, canWrite: permCanWrite, canDelete: permCanDelete, canSubmit: permCanSubmit, canCancel: permCanCancel } = usePermissions()

// Lookup from static registry using doctype name
const registry = computed(() => getRegistryByDoctype(props.config.doctype))
const doctype = computed(() => props.config.doctype)
const isSingle = computed(() => registry.value?.isSingle || false)
const isSubmittable = computed(() => registry.value?.isSubmittable || false)

const cardIcon = computed(() => props.config.icon || 'file-edit')
const cardSubtitle = computed(() => props.config.subtitle || `${registry.value?.label || doctype.value} details`)

// For single doctypes, the id is the doctype name itself
const effectiveId = computed(() => {
	if (isSingle.value) return props.config.doctype
	return props.id || null
})

const isNew = computed(() => !effectiveId.value)

// Doc composable
const docState = shallowRef(null)

const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

const form = reactive({})
const validationErrors = reactive({})

// Build child table columns from static config
const childTableColumns = computed(() => {
	const cols = {}
	for (const field of props.config.fields) {
		if (field.fieldtype === 'Table' && field.columns) {
			cols[field.fieldname] = field.columns
		}
	}
	return cols
})

// Non-table fields
const formFields = computed(() =>
	props.config.fields.filter((f) => f.fieldtype !== "Table")
)

// Table fields
const tableFields = computed(() =>
	props.config.fields.filter((f) => f.fieldtype === "Table")
)

const isReadonly = computed(() => {
	if (isNew.value) return !permCanCreate(doctype.value)
	if (!isSubmittable.value) return !permCanWrite(doctype.value)
	return doc.value?.docstatus !== 0 || !permCanWrite(doctype.value)
})

const canSubmit = computed(() =>
	!isNew.value && isSubmittable.value && doc.value?.docstatus === 0 && permCanSubmit(doctype.value)
)
const canCancel = computed(() =>
	!isNew.value && isSubmittable.value && doc.value?.docstatus === 1 && permCanCancel(doctype.value)
)
const canDelete = computed(() => {
	if (!permCanDelete(doctype.value)) return false
	if (isSingle.value) return false
	return !isNew.value && (!isSubmittable.value || doc.value?.docstatus === 0)
})

function parseSelectOptions(optionsStr) {
	if (!optionsStr) return []
	return optionsStr.split("\n").filter(Boolean).map((o) => ({ label: o, value: o }))
}

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
	Object.keys(form).forEach((k) => delete form[k])
	Object.keys(validationErrors).forEach((k) => delete validationErrors[k])

	for (const field of props.config.fields) {
		if (field.fieldtype === "Table") {
			form[field.fieldname] = []
		} else if (field.fieldtype === "Check") {
			form[field.fieldname] = 0
		} else if (field.fieldtype === "Int" || field.fieldtype === "Float" || field.fieldtype === "Currency" || field.fieldtype === "Percent") {
			form[field.fieldname] = 0
		} else {
			form[field.fieldname] = ""
		}
		if (field.reqd) {
			validationErrors[field.fieldname] = ""
		}
	}
}

function populateForm(data) {
	if (!data) return

	for (const field of props.config.fields) {
		const val = data[field.fieldname]
		if (field.fieldtype === "Table") {
			form[field.fieldname] = Array.isArray(val) ? val.map((row) => ({ ...row })) : []
		} else if (field.fieldtype === "Check") {
			form[field.fieldname] = val ? 1 : 0
		} else {
			form[field.fieldname] = val ?? ""
		}
	}

	// Always carry docstatus for submittable doctypes
	if (isSubmittable.value && data.docstatus != null) {
		form.docstatus = data.docstatus
	}
}

function formatDate(d) {
	if (!d) return null
	if (typeof d === "string") return d
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

function validate() {
	let valid = true

	for (const field of props.config.fields) {
		if (!field.reqd) continue
		if (field.fieldtype === "Table") continue

		const val = form[field.fieldname]
		const empty =
			val === null ||
			val === undefined ||
			val === "" ||
			(typeof val === "string" && !val.trim())

		if (empty) {
			validationErrors[field.fieldname] = `${field.label} is required`
			valid = false
		} else {
			validationErrors[field.fieldname] = ""
		}
	}
	return valid
}

function buildPayload() {
	const payload = {}

	for (const field of props.config.fields) {
		const val = form[field.fieldname]
		if (field.fieldtype === "Date") {
			payload[field.fieldname] = formatDate(val)
		} else if (field.fieldtype === "Table") {
			payload[field.fieldname] = (val || []).map((row) => {
				const clean = {}
				for (const [k, v] of Object.entries(row)) {
					if (["name", "creation", "modified", "modified_by", "owner", "docstatus", "doctype", "parent", "parentfield", "parenttype", "idx"].includes(k)) {
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

function handleChange(field, val) {
	if (field.onChange) {
		field.onChange(val, form)
	}
}

async function initDoc() {
	if (!doctype.value) return

	docState.value = useDoc(doctype.value)
	initForm()

	if (effectiveId.value) {
		await docState.value.load(effectiveId.value)
		if (docState.value.doc.value) {
			populateForm(docState.value.doc.value)
		}
	}
}

// Watch for route/config changes
watch([() => props.config, () => props.id], () => initDoc())

function onKeydown(e) {
	if ((e.ctrlKey || e.metaKey) && e.key === 's') {
		e.preventDefault()
		if (!isReadonly.value && !docSaving.value) {
			handleSave()
		}
	}
}

onMounted(() => {
	initDoc()
	window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeydown)
})

// Watch doc changes (e.g. after save/submit)
watch(doc, (val) => {
	if (val) populateForm(val)
})

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
		const result = await docState.value.save(buildPayload(), effectiveId.value || null)
		toast.success("Saved", `${registry.value?.label || "Record"} saved successfully`)
		if (isNew.value && result?.name) {
			router.replace(`/${props.route}/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		showError("Save Failed", e)
	}
}

async function handleSubmit() {
	confirm.require({
		message: `Submit this ${registry.value?.label || "record"}? It will no longer be editable.`,
		header: "Confirm Submit",
		acceptLabel: "Submit",
		acceptProps: { severity: "success" },
		rejectLabel: "Cancel",
		accept: async () => {
			try {
				await docState.value.submit()
				toast.success("Submitted", `${registry.value?.label || "Record"} submitted successfully`)
			} catch (e) {
				showError("Submit Failed", e)
			}
		},
	})
}

async function handleCancel() {
	confirm.require({
		message: `Cancel this ${registry.value?.label || "record"}? This action cannot be undone.`,
		header: "Confirm Cancel",
		acceptLabel: "Cancel Record",
		acceptProps: { severity: "danger" },
		rejectLabel: "Keep",
		accept: async () => {
			try {
				await docState.value.cancel()
				toast.success("Cancelled", `${registry.value?.label || "Record"} cancelled`)
			} catch (e) {
				showError("Cancel Failed", e)
			}
		},
	})
}

async function handleDelete() {
	confirm.require({
		message: `Delete this ${registry.value?.label || "record"}? This cannot be undone.`,
		header: "Confirm Delete",
		acceptLabel: "Delete",
		acceptProps: { severity: "danger" },
		rejectLabel: "Keep",
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success("Deleted", `${registry.value?.label || "Record"} deleted`)
				router.push(`/${props.route}`)
			} catch (e) {
				showError("Delete Failed", e)
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

/* -- Child Table Animation ----------------------------------------- */
.child-table-animated {
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.35s ease both;
}

/* -- Checkbox inline layout ---------------------------------------- */
.form-field--check {
	display: flex;
	align-items: center;
	padding-top: var(--space-sm);
}

.form-field--check :deep(.form-field-label) {
	display: none;
}

.check-inline {
	display: flex;
	align-items: center;
	gap: 10px;
	cursor: pointer;
	user-select: none;
}

.check-inline .field-checkbox {
	width: 20px;
	height: 20px;
	accent-color: var(--color-primary);
	cursor: pointer;
	flex-shrink: 0;
}

.check-inline-label {
	font-size: 13px;
	font-weight: 700;
	color: var(--color-text);
	text-transform: uppercase;
	letter-spacing: 0.5px;
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
