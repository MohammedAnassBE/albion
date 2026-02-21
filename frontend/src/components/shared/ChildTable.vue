<template>
	<div class="child-table">
		<div class="child-table-header">
			<span class="child-table-title">{{ title }}</span>
			<Button
				v-if="!readonly"
				icon="pi pi-plus"
				label="Add Row"
				severity="secondary"
				text
				size="small"
				@click="addRow"
			/>
		</div>
		<DataTable :value="rows" size="small" :rowHover="true" class="child-datatable">
			<Column
				v-for="col in columns"
				:key="col.field"
				:field="col.field"
				:header="col.header"
				:style="col.style"
			>
				<template #body="{ data, index }">
					<template v-if="readonly || col.readonly">
						{{ data[col.field] }}
					</template>
					<template v-else-if="col.type === 'link'">
						<LinkField
							:modelValue="data[col.field]"
							:doctype="col.options"
							:placeholder="col.header"
							@update:modelValue="(val) => updateCell(index, col.field, val)"
						/>
					</template>
					<template v-else-if="col.type === 'float' || col.type === 'int'">
						<InputNumber
							:modelValue="data[col.field]"
							@update:modelValue="(val) => updateCell(index, col.field, val)"
							:min="0"
							:minFractionDigits="col.type === 'float' ? 2 : 0"
							size="small"
							fluid
						/>
					</template>
					<template v-else>
						<InputText
							:modelValue="data[col.field]"
							@update:modelValue="(val) => updateCell(index, col.field, val)"
							size="small"
							fluid
						/>
					</template>
				</template>
			</Column>
			<Column v-if="!readonly" header="" style="width: 40px">
				<template #body="{ index }">
					<Button
						icon="pi pi-trash"
						severity="danger"
						text
						size="small"
						@click="removeRow(index)"
					/>
				</template>
			</Column>
			<template #empty>
				<div class="child-table-empty">No rows added</div>
			</template>
		</DataTable>
	</div>
</template>

<script setup>
import { computed } from "vue"
import DataTable from "primevue/datatable"
import Column from "primevue/column"
import Button from "primevue/button"
import InputText from "primevue/inputtext"
import InputNumber from "primevue/inputnumber"
import LinkField from "./LinkField.vue"

const props = defineProps({
	title: { type: String, default: "" },
	modelValue: { type: Array, default: () => [] },
	columns: { type: Array, required: true },
	readonly: { type: Boolean, default: false },
	defaultRow: { type: Object, default: () => ({}) },
})

const emit = defineEmits(["update:modelValue"])

const rows = computed(() => props.modelValue)

function addRow() {
	const newRow = { ...props.defaultRow }
	props.columns.forEach((col) => {
		if (!(col.field in newRow)) {
			newRow[col.field] = col.type === "float" || col.type === "int" ? 0 : ""
		}
	})
	const updated = [...props.modelValue, newRow]
	emit("update:modelValue", updated)
}

function removeRow(index) {
	const updated = props.modelValue.filter((_, i) => i !== index)
	emit("update:modelValue", updated)
}

function updateCell(index, field, value) {
	const updated = [...props.modelValue]
	updated[index] = { ...updated[index], [field]: value }
	emit("update:modelValue", updated)
}
</script>

<style scoped>
.child-table {
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	overflow: hidden;
}

.child-table-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-sm) var(--space-md);
	background: var(--color-surface-hover);
	border-bottom: 1px solid var(--color-border);
}

.child-table-title {
	font-size: 12px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
}

.child-table-empty {
	text-align: center;
	padding: var(--space-lg);
	color: var(--color-text-muted);
	font-size: 13px;
}

.child-datatable :deep(.p-datatable-thead > tr > th) {
	background: var(--color-surface);
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
	padding: var(--space-sm);
}

.child-datatable :deep(.p-datatable-tbody > tr > td) {
	padding: var(--space-xs) var(--space-sm);
}
</style>
