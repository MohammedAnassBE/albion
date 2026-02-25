<template>
	<div class="item-card-list">
		<div class="card-list-header">
			<div class="card-list-title-group">
				<span class="card-list-title">{{ title }}</span>
				<span class="card-list-count">{{ rows.length }}</span>
			</div>
			<button
				v-if="!readonly"
				class="card-list-add-btn"
				@click="addRow"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add
			</button>
		</div>

		<div class="card-list-body">
			<div v-if="rows.length > 0" class="card-list-col-headers">
				<span class="col-header-grip"></span>
				<span class="col-header-num">#</span>
				<div class="col-header-fields">
					<span v-for="col in columns" :key="col.field" class="col-header-label">{{ col.header }}</span>
				</div>
				<span v-if="!readonly" class="col-header-action"></span>
			</div>
			<div
				v-for="(row, index) in rows"
				:key="index"
				class="card-list-row"
			>
				<span class="row-grip">
					<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
						<circle cx="2.5" cy="2" r="1.2"/><circle cx="7.5" cy="2" r="1.2"/>
						<circle cx="2.5" cy="5.5" r="1.2"/><circle cx="7.5" cy="5.5" r="1.2"/>
						<circle cx="2.5" cy="9" r="1.2"/><circle cx="7.5" cy="9" r="1.2"/>
						<circle cx="2.5" cy="12.5" r="1.2"/><circle cx="7.5" cy="12.5" r="1.2"/>
					</svg>
				</span>
				<span class="row-number">{{ String(index + 1).padStart(2, '0') }}</span>

				<div class="row-fields">
					<template v-for="col in columns" :key="col.field">
						<template v-if="readonly || col.read_only || col.readonly">
							<span class="row-field-text">{{ col.type === 'date' ? formatDate(row[col.field]) : (row[col.field] || '—') }}</span>
						</template>
						<template v-else-if="col.type === 'link'">
							<LinkField
								:modelValue="row[col.field] || ''"
								:doctype="col.options"
								:placeholder="col.header"
								@update:modelValue="(val) => updateCell(index, col.field, val)"
							/>
						</template>
						<template v-else-if="col.type === 'date'">
							<input
								type="date"
								class="field-input"
								:value="row[col.field] || ''"
								:placeholder="col.header"
								@input="updateCell(index, col.field, $event.target.value)"
							/>
						</template>
						<template v-else-if="col.type === 'float' || col.type === 'int'">
							<input
								type="number"
								class="field-input card-list-number-input"
								:value="row[col.field]"
								:placeholder="col.header"
								min="0"
								:step="col.type === 'float' ? '0.01' : '1'"
								@input="updateCell(index, col.field, col.type === 'float' ? parseFloat($event.target.value) || 0 : parseInt($event.target.value, 10) || 0)"
							/>
						</template>
						<template v-else>
							<input
								type="text"
								class="field-input"
								:value="row[col.field] || ''"
								:placeholder="col.header"
								@input="updateCell(index, col.field, $event.target.value)"
							/>
						</template>
					</template>
				</div>

				<button
					v-if="!readonly"
					class="row-delete-btn"
					@click="removeRow(index)"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
					</svg>
				</button>
			</div>

			<div v-if="rows.length === 0" class="card-list-empty">
				No {{ title.toLowerCase() }} added yet
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import LinkField from './LinkField.vue'

const props = defineProps({
	title: { type: String, default: '' },
	modelValue: { type: Array, default: () => [] },
	columns: { type: Array, required: true },
	readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const rows = computed(() => props.modelValue)

function addRow() {
	const newRow = {}
	props.columns.forEach((col) => {
		newRow[col.field] = col.type === 'float' || col.type === 'int' ? 0 : ''
	})
	emit('update:modelValue', [...props.modelValue, newRow])
}

function removeRow(index) {
	emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function updateCell(index, field, value) {
	const updated = [...props.modelValue]
	updated[index] = { ...updated[index], [field]: value }
	emit('update:modelValue', updated)
}

function formatDate(val) {
	if (!val) return '—'
	const [y, m, d] = val.split('-')
	return (y && m && d) ? `${d}-${m}-${y}` : val
}
</script>

<style scoped>
.item-card-list {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
}

/* ── Header ─────────────────────────────────────────────── */
.card-list-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px var(--space-md);
	border-bottom: 1px solid var(--color-border);
}

.card-list-title-group {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
}

.card-list-title {
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--color-primary);
}

.card-list-count {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 20px;
	height: 20px;
	padding: 0 6px;
	border-radius: 10px;
	font-size: 11px;
	font-weight: 700;
	background: var(--color-blue-stat-bg, rgba(59, 130, 246, 0.12));
	color: var(--color-blue-stat, #2563EB);
}

.card-list-add-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 10px;
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	background: transparent;
	color: var(--color-accent-hover, #d4952e);
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.3px;
	cursor: pointer;
	transition: all var(--transition-fast);
}

.card-list-add-btn:hover {
	color: var(--color-accent, #e8a838);
	background: var(--color-accent-muted);
	border-color: var(--color-accent, #e8a838);
}

/* ── Body ───────────────────────────────────────────────── */
.card-list-body {
	padding: 0;
}

/* ── Column Headers ────────────────────────────────────── */
.card-list-col-headers {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	padding: 6px var(--space-md);
	border-bottom: 1px solid var(--color-border);
	background: color-mix(in srgb, var(--color-surface) 95%, var(--color-text-muted));
}

.col-header-grip {
	width: 14px;
	flex-shrink: 0;
}

.col-header-num {
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-muted);
	width: 22px;
	flex-shrink: 0;
}

.col-header-fields {
	flex: 1;
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	min-width: 0;
}

.col-header-fields > * {
	flex: 1;
	min-width: 0;
}

.col-header-label {
	font-size: 10px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-muted);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.col-header-action {
	width: 28px;
	flex-shrink: 0;
}

/* ── Row ────────────────────────────────────────────────── */
.card-list-row {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	padding: 8px var(--space-md);
	border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
	transition: background var(--transition-fast);
}

.card-list-row:last-child {
	border-bottom: none;
}

.card-list-row:hover {
	background: var(--color-accent-light, #fdf3e0);
}

.row-grip {
	color: var(--color-text-muted);
	opacity: 0.4;
	cursor: grab;
	width: 14px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	transition: opacity var(--transition-fast);
}

.card-list-row:hover .row-grip {
	opacity: 0.7;
}

.row-number {
	font-size: 12px;
	font-weight: 600;
	color: var(--color-blue-stat, #2563EB);
	opacity: 0.6;
	width: 22px;
	flex-shrink: 0;
	font-variant-numeric: tabular-nums;
}

.row-fields {
	flex: 1;
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	min-width: 0;
}

.row-fields > * {
	flex: 1;
	min-width: 0;
}

.row-field-text {
	font-size: 14px;
	font-weight: 600;
	color: var(--color-text);
	padding: 8px 12px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card-list-number-input {
	text-align: right;
}

/* ── Delete button ──────────────────────────────────────── */
.row-delete-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	border-radius: var(--radius-sm);
	background: transparent;
	color: var(--color-text-muted);
	opacity: 0;
	cursor: pointer;
	flex-shrink: 0;
	transition: all var(--transition-fast);
}

.card-list-row:hover .row-delete-btn {
	opacity: 0.6;
}

.row-delete-btn:hover {
	opacity: 1 !important;
	color: var(--color-danger);
	background: var(--color-danger-bg);
}

/* ── Empty state ────────────────────────────────────────── */
.card-list-empty {
	padding: var(--space-xl) var(--space-md);
	text-align: center;
	color: var(--color-text-muted);
	font-size: 13px;
	font-style: italic;
}
</style>
