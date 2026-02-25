<template>
	<div class="child-table">
		<div class="child-table-header">
			<span class="child-table-title">{{ title }}</span>
			<button
				v-if="!readonly"
				class="btn btn-secondary btn-text btn-sm"
				@click="addRow"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add Row
			</button>
		</div>
		<div class="child-table-wrap">
			<table class="child-datatable">
				<thead>
					<tr>
						<th v-for="col in columns" :key="col.field" :style="col.style">{{ col.header }}</th>
						<th v-if="!readonly" style="width: 40px"></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(data, index) in rows" :key="index">
						<td v-for="col in columns" :key="col.field">
							<template v-if="readonly || col.readonly">
								{{ col.type === 'date' ? formatDate(data[col.field]) : data[col.field] }}
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
								<input
									type="number"
									class="field-input"
									:value="data[col.field]"
									:min="0"
									:step="col.type === 'float' ? '0.01' : '1'"
									@input="updateCell(index, col.field, col.type === 'float' ? parseFloat($event.target.value) || 0 : parseInt($event.target.value, 10) || 0)"
								/>
							</template>
							<template v-else>
								<input
									type="text"
									class="field-input"
									:value="data[col.field]"
									@input="updateCell(index, col.field, $event.target.value)"
								/>
							</template>
						</td>
						<td v-if="!readonly">
							<button
								class="btn btn-danger btn-text btn-icon"
								@click="removeRow(index)"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
								</svg>
							</button>
						</td>
					</tr>
					<tr v-if="rows.length === 0">
						<td :colspan="columns.length + (readonly ? 0 : 1)" class="child-table-empty">
							No rows added
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue"
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

function formatDate(val) {
	if (!val) return '\u2014'
	const [y, m, d] = val.split('-')
	return (y && m && d) ? `${d}-${m}-${y}` : val
}
</script>

<style scoped>
/* Card wrapper — gold accent continuity with form surface */
.child-table {
	border: 1px solid var(--color-border);
	border-left: 3px solid var(--color-accent, #e8a838);
	border-radius: var(--radius-lg);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
	background: var(--color-surface);
}

/* Section header */
.child-table-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px var(--space-md);
	background: var(--color-surface);
	border-bottom: 1px solid var(--color-border);
}

/* Title typography — stronger weight, navy color */
.child-table-title {
	font-size: 13px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--color-primary);
}

/* Add Row button — gold accent */
.child-table-header .btn {
	color: var(--color-accent-hover, #d4952e);
	font-weight: 600;
	font-size: 12px;
	letter-spacing: 0.3px;
}

.child-table-header .btn:hover {
	color: var(--color-accent, #e8a838);
	background: var(--color-accent-muted);
}

.child-table-wrap {
	overflow-x: auto;
}

.child-datatable {
	width: 100%;
	border-collapse: collapse;
}

/* Column headers — warm background tint */
.child-datatable thead th {
	background: var(--color-surface-hover);
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.6px;
	color: var(--color-text-secondary);
	padding: var(--space-sm) var(--space-md);
	text-align: left;
	border-bottom: 1px solid var(--color-border);
}

/* Data rows — better padding, softer borders */
.child-datatable tbody td {
	padding: var(--space-sm) var(--space-md);
	border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
	font-size: 13px;
	vertical-align: middle;
}

.child-datatable tbody tr:last-child td {
	border-bottom: none;
}

/* Row hover — warm accent tint */
.child-datatable tbody tr:hover {
	background: var(--color-accent-light, #fdf3e0);
}

/* Delete button — muted by default, danger on hover */
.child-datatable .btn-danger {
	color: var(--color-text-muted);
	opacity: 0.5;
	transition: all var(--transition-fast);
}

.child-datatable tbody tr:hover .btn-danger {
	opacity: 1;
	color: var(--color-text-secondary);
}

.child-datatable .btn-danger:hover {
	opacity: 1;
	color: var(--color-danger);
	background: var(--color-danger-bg);
}

/* Empty state */
.child-table-empty {
	text-align: center;
	padding: var(--space-xl) var(--space-lg);
	color: var(--color-text-muted);
	font-size: 13px;
	font-style: italic;
}
</style>
