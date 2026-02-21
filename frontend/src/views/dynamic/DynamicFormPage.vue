<template>
	<div class="dynamic-form-page">
		<PageHeader
			:title="isNew ? `New ${registry?.label || ''}` : (doc?.name || registry?.label || docRoute)"
			:backRoute="isSingle ? null : `/${docRoute}`"
		>
			<template #actions>
				<StatusBadge v-if="!isNew && doc && isSubmittable" :docstatus="doc.docstatus" />
			</template>
		</PageHeader>

		<!-- Loading State -->
		<div v-if="docLoading" class="loading-state">
			<i class="pi pi-spin pi-spinner" />
			<span>Loading...</span>
		</div>

		<!-- Error State -->
		<div v-else-if="docError && !doc && !isNew" class="error-state">
			<i class="pi pi-exclamation-triangle" />
			<p>{{ docError }}</p>
			<Button v-if="!isSingle" label="Back" severity="secondary" @click="$router.push(`/${docRoute}`)" />
		</div>

		<!-- Form -->
		<template v-else>
			<div class="form-surface" :class="{ 'form-surface--readonly': isReadonly }">
				<div class="form-grid">
					<template v-for="field in formFields" :key="field.fieldname">
						<!-- Table fields rendered outside grid -->
						<template v-if="field.fieldtype === 'Table'" />

						<FormField
							v-else
							:label="field.label"
							:required="!!field.reqd"
							:error="validationErrors[field.fieldname]"
							:readonly="isReadonly || !!field.read_only"
						>
							<!-- Link -->
							<LinkField
								v-if="field.fieldtype === 'Link'"
								:modelValue="form[field.fieldname] || ''"
								:doctype="field.options"
								:placeholder="`Select ${field.label}`"
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Select -->
							<Select
								v-else-if="field.fieldtype === 'Select'"
								:modelValue="form[field.fieldname]"
								:options="parseSelectOptions(field.options)"
								:placeholder="`Select ${field.label}`"
								:disabled="isReadonly"
								fluid
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Date -->
							<DatePicker
								v-else-if="field.fieldtype === 'Date'"
								:modelValue="form[field.fieldname]"
								dateFormat="yy-mm-dd"
								:placeholder="`Select ${field.label.toLowerCase()}`"
								showIcon
								fluid
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Int -->
							<InputNumber
								v-else-if="field.fieldtype === 'Int'"
								:modelValue="form[field.fieldname]"
								:min="0"
								:minFractionDigits="0"
								:maxFractionDigits="0"
								fluid
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Float / Currency / Percent -->
							<InputNumber
								v-else-if="field.fieldtype === 'Float' || field.fieldtype === 'Currency' || field.fieldtype === 'Percent'"
								:modelValue="form[field.fieldname]"
								:min="0"
								:minFractionDigits="2"
								:maxFractionDigits="2"
								fluid
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Check -->
							<Checkbox
								v-else-if="field.fieldtype === 'Check'"
								:modelValue="!!form[field.fieldname]"
								binary
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val ? 1 : 0"
							/>

							<!-- Textarea types -->
							<Textarea
								v-else-if="field.fieldtype === 'Small Text' || field.fieldtype === 'Text' || field.fieldtype === 'Long Text' || field.fieldtype === 'Text Editor'"
								:modelValue="form[field.fieldname] || ''"
								rows="3"
								fluid
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>

							<!-- Fallback: InputText -->
							<InputText
								v-else
								:modelValue="form[field.fieldname] || ''"
								:placeholder="field.label"
								fluid
								:disabled="isReadonly"
								@update:modelValue="(val) => form[field.fieldname] = val"
							/>
						</FormField>
					</template>
				</div>
			</div>

			<!-- Child Tables -->
			<div
				v-for="field in tableFields"
				:key="field.fieldname"
				class="section-block"
			>
				<ChildTable
					:title="field.label"
					:modelValue="form[field.fieldname] || []"
					:columns="childTableColumns[field.fieldname] || []"
					:readonly="isReadonly"
					@update:modelValue="(val) => form[field.fieldname] = val"
				/>
			</div>

			<!-- Action Buttons -->
			<div class="form-actions">
				<Button
					v-if="!isReadonly"
					label="Save"
					icon="pi pi-save"
					:loading="docSaving"
					@click="handleSave"
				/>
				<Button
					v-if="canSubmit"
					label="Submit"
					icon="pi pi-check"
					severity="success"
					:loading="docSaving"
					@click="handleSubmit"
				/>
				<Button
					v-if="canCancel"
					label="Cancel"
					icon="pi pi-times"
					severity="danger"
					outlined
					:loading="docSaving"
					@click="handleCancel"
				/>
				<Button
					v-if="canDelete"
					label="Delete"
					icon="pi pi-trash"
					severity="danger"
					text
					:loading="docSaving"
					@click="handleDelete"
				/>
			</div>
		</template>
	</div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue"
import { useRouter } from "vue-router"
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import InputNumber from "primevue/inputnumber"
import Textarea from "primevue/textarea"
import DatePicker from "primevue/datepicker"
import Checkbox from "primevue/checkbox"
import Select from "primevue/select"
import { useConfirm } from "primevue/useconfirm"
import PageHeader from "@/components/shared/PageHeader.vue"
import StatusBadge from "@/components/shared/StatusBadge.vue"
import FormField from "@/components/shared/FormField.vue"
import LinkField from "@/components/shared/LinkField.vue"
import ChildTable from "@/components/shared/ChildTable.vue"
import { useDoc } from "@/composables/useDoc"
import { useAppToast } from "@/composables/useToast"
import { useFrontendConfig } from "@/composables/useFrontendConfig"
import { callMethod } from "@/api/client"
import { getRegistryByRoute } from "@/config/doctypes"

const props = defineProps({
	docRoute: { type: String, required: true },
	id: { type: String, default: null },
})

const router = useRouter()
const confirm = useConfirm()
const toast = useAppToast()
const { getFieldsForDoctype } = useFrontendConfig()

// Instant lookup from static registry
const registry = computed(() => getRegistryByRoute(props.docRoute))
const doctype = computed(() => registry.value?.doctype || "")
const isSingle = computed(() => registry.value?.isSingle || false)
const isSubmittable = computed(() => registry.value?.isSubmittable || false)

// For single doctypes, the id is the doctype name itself
const effectiveId = computed(() => {
	if (isSingle.value) return registry.value.doctype
	return props.id || null
})

const isNew = computed(() => !effectiveId.value)

// Field metadata (loaded async, config → meta fallback)
const fieldMeta = ref(null)

async function loadFieldMeta() {
	if (!doctype.value) return
	fieldMeta.value = await getFieldsForDoctype(doctype.value)
}

// Doc composable — re-created when doctype changes
const docState = ref(null)

const doc = computed(() => docState.value?.doc?.value ?? null)
const docLoading = computed(() => docState.value?.loading?.value ?? false)
const docSaving = computed(() => docState.value?.saving?.value ?? false)
const docError = computed(() => docState.value?.error?.value ?? null)

const form = reactive({})
const validationErrors = reactive({})
const childTableColumns = ref({})

// Fields for the form (non-table)
const formFields = computed(() => {
	if (!fieldMeta.value?.fields) return []
	return fieldMeta.value.fields.filter(
		(f) => f.show_in_form && f.fieldtype !== "Table"
	)
})

// Table fields
const tableFields = computed(() => {
	if (!fieldMeta.value?.fields) return []
	return fieldMeta.value.fields.filter(
		(f) => f.show_in_form && f.fieldtype === "Table"
	)
})

const isReadonly = computed(() => {
	if (isNew.value) return false
	if (!isSubmittable.value) return false
	return doc.value?.docstatus !== 0
})

const canSubmit = computed(() =>
	!isNew.value && isSubmittable.value && doc.value?.docstatus === 0
)
const canCancel = computed(() =>
	!isNew.value && isSubmittable.value && doc.value?.docstatus === 1
)
const canDelete = computed(() => {
	if (isSingle.value) return false
	return !isNew.value && (!isSubmittable.value || doc.value?.docstatus === 0)
})

function parseSelectOptions(optionsStr) {
	if (!optionsStr) return []
	return optionsStr.split("\n").filter(Boolean).map((o) => ({ label: o, value: o }))
}

function initForm() {
	// Clear form
	Object.keys(form).forEach((k) => delete form[k])
	Object.keys(validationErrors).forEach((k) => delete validationErrors[k])

	if (!fieldMeta.value?.fields) return

	for (const field of fieldMeta.value.fields) {
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
	if (!data || !fieldMeta.value?.fields) return

	for (const field of fieldMeta.value.fields) {
		const val = data[field.fieldname]
		if (field.fieldtype === "Table") {
			form[field.fieldname] = Array.isArray(val) ? val.map((row) => ({ ...row })) : []
		} else if (field.fieldtype === "Date") {
			form[field.fieldname] = val ? new Date(val) : null
		} else if (field.fieldtype === "Check") {
			form[field.fieldname] = val ? 1 : 0
		} else {
			form[field.fieldname] = val ?? ""
		}
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
	if (!fieldMeta.value?.fields) return valid

	for (const field of fieldMeta.value.fields) {
		if (!field.reqd || !field.show_in_form) continue
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
	if (!fieldMeta.value?.fields) return payload

	for (const field of fieldMeta.value.fields) {
		if (!field.show_in_form) continue

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

async function loadChildTableMeta() {
	for (const field of tableFields.value) {
		if (childTableColumns.value[field.fieldname]) continue
		try {
			const meta = await callMethod(
				"albion.albion.doctype.albion_frontend_doctype.albion_frontend_doctype.get_child_table_meta",
				{ doctype: field.options }
			)
			childTableColumns.value[field.fieldname] = (meta || [])
				.filter((f) => f.in_list_view)
				.map((f) => ({
					field: f.fieldname,
					header: f.label,
					type: f.fieldtype === "Link" ? "link"
						: f.fieldtype === "Float" || f.fieldtype === "Currency" || f.fieldtype === "Percent" ? "float"
						: f.fieldtype === "Int" ? "int"
						: "text",
					options: f.options || "",
				}))
		} catch (e) {
			console.error(`Failed to load child table meta for ${field.options}:`, e)
		}
	}
}

async function initDoc() {
	if (!doctype.value) return

	// Load field metadata first
	await loadFieldMeta()

	docState.value = useDoc(doctype.value)
	initForm()

	if (effectiveId.value) {
		await docState.value.load(effectiveId.value)
		if (docState.value.doc.value) {
			populateForm(docState.value.doc.value)
		}
	}

	await loadChildTableMeta()
}

// Watch for route/config changes
watch([() => props.docRoute, () => props.id], () => initDoc())

onMounted(() => {
	initDoc()
})

// Watch doc changes (e.g. after save/submit)
watch(doc, (val) => {
	if (val) populateForm(val)
})

async function handleSave() {
	if (!validate()) return
	if (!docState.value) return

	try {
		const result = await docState.value.save(buildPayload(), effectiveId.value || null)
		toast.success("Saved", `${registry.value?.label || "Record"} saved successfully`)
		if (isNew.value && result?.name) {
			router.replace(`/${props.docRoute}/${encodeURIComponent(result.name)}`)
		}
	} catch (e) {
		toast.error("Save Failed", e.message)
	}
}

async function handleSubmit() {
	confirm.require({
		message: `Submit this ${registry.value?.label || "record"}? It will no longer be editable.`,
		header: "Confirm Submit",
		icon: "pi pi-check-circle",
		rejectLabel: "Cancel",
		rejectProps: { severity: "secondary", text: true },
		acceptLabel: "Submit",
		acceptProps: { severity: "success" },
		accept: async () => {
			try {
				await docState.value.submit()
				toast.success("Submitted", `${registry.value?.label || "Record"} submitted successfully`)
			} catch (e) {
				toast.error("Submit Failed", e.message)
			}
		},
	})
}

async function handleCancel() {
	confirm.require({
		message: `Cancel this ${registry.value?.label || "record"}? This action cannot be undone.`,
		header: "Confirm Cancel",
		icon: "pi pi-exclamation-triangle",
		rejectLabel: "Keep",
		rejectProps: { severity: "secondary", text: true },
		acceptLabel: "Cancel Record",
		acceptProps: { severity: "danger" },
		accept: async () => {
			try {
				await docState.value.cancel()
				toast.success("Cancelled", `${registry.value?.label || "Record"} cancelled`)
			} catch (e) {
				toast.error("Cancel Failed", e.message)
			}
		},
	})
}

async function handleDelete() {
	confirm.require({
		message: `Delete this ${registry.value?.label || "record"}? This cannot be undone.`,
		header: "Confirm Delete",
		icon: "pi pi-trash",
		rejectLabel: "Keep",
		rejectProps: { severity: "secondary", text: true },
		acceptLabel: "Delete",
		acceptProps: { severity: "danger" },
		accept: async () => {
			try {
				await docState.value.remove()
				toast.success("Deleted", `${registry.value?.label || "Record"} deleted`)
				router.push(`/${props.docRoute}`)
			} catch (e) {
				toast.error("Delete Failed", e.message)
			}
		},
	})
}
</script>

<style scoped>
.dynamic-form-page {
	padding: var(--space-lg);
	max-width: 900px;
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

.loading-state i,
.error-state i {
	font-size: 1.5rem;
}

.error-state {
	color: var(--color-danger);
}

.error-state p {
	margin: 0;
}

/* ── Form Surface ─────────────────────────────────────────── */
.form-surface {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-left: 3px solid var(--color-accent, #e8a838);
	border-radius: var(--radius-lg);
	padding: var(--space-xl) var(--space-lg);
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.3s var(--transition-normal, ease) both;
}

.form-surface--readonly {
	border-left-color: var(--color-text-muted, #94a3b8);
	opacity: 0.95;
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

/* ── Section Block (child tables) ─────────────────────────── */
.section-block {
	margin-bottom: var(--space-lg);
	animation: surfaceReveal 0.35s var(--transition-normal, ease) 0.08s both;
}

/* ── Action Buttons ───────────────────────────────────────── */
.form-actions {
	display: flex;
	gap: var(--space-sm);
	flex-wrap: wrap;
	padding: var(--space-md) var(--space-lg);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	margin-bottom: var(--space-lg);
}
</style>
