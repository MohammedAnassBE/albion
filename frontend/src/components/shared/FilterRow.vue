<template>
	<div class="filter-row">
		<!-- Field selector -->
		<select
			class="field-select filter-field-select"
			:value="fieldname"
			@change="onFieldChange($event.target.value)"
		>
			<option value="" disabled>Field...</option>
			<option v-for="f in fields" :key="f.fieldname" :value="f.fieldname">
				{{ f.label }}
			</option>
		</select>

		<!-- Operator selector -->
		<select
			class="field-select filter-operator-select"
			:value="operator"
			@change="onOperatorChange($event.target.value)"
		>
			<option v-for="op in operators" :key="op" :value="op">{{ op }}</option>
		</select>

		<!-- Value input (switches by fieldtype + operator) -->
		<div class="filter-value-wrap">
			<!-- is set / not set -->
			<select
				v-if="operator === 'is'"
				class="field-select"
				:value="value"
				@change="onValueChange($event.target.value)"
			>
				<option value="set">Set</option>
				<option value="not set">Not Set</option>
			</select>

			<!-- Check → Yes/No -->
			<select
				v-else-if="currentFieldtype === 'Check'"
				class="field-select"
				:value="value"
				@change="onValueChange($event.target.value)"
			>
				<option value="Yes">Yes</option>
				<option value="No">No</option>
			</select>

			<!-- Select → options from field.options -->
			<select
				v-else-if="currentFieldtype === 'Select'"
				class="field-select"
				:value="value"
				@change="onValueChange($event.target.value)"
			>
				<option value="">--</option>
				<option v-for="opt in selectOptions" :key="opt" :value="opt">{{ opt }}</option>
			</select>

			<!-- Link (= or !=) → LinkField autocomplete -->
			<LinkField
				v-else-if="currentFieldtype === 'Link' && (operator === '=' || operator === '!=')"
				:modelValue="value"
				:doctype="currentField?.options || ''"
				placeholder="Select..."
				@update:modelValue="onLinkSelect"
			/>

			<!-- Date Between → two date inputs -->
			<div v-else-if="isDateType && operator === 'Between'" class="filter-between">
				<input
					type="date"
					class="field-input"
					:value="betweenFrom"
					@change="onBetweenChange(0, $event.target.value)"
				/>
				<span class="between-sep">to</span>
				<input
					type="date"
					class="field-input"
					:value="betweenTo"
					@change="onBetweenChange(1, $event.target.value)"
				/>
			</div>

			<!-- Date (non-Between) → single date input -->
			<input
				v-else-if="isDateType"
				type="date"
				class="field-input"
				:value="value"
				@change="onValueChange($event.target.value)"
			/>

			<!-- Default text input -->
			<input
				v-else
				type="text"
				class="field-input"
				:value="value"
				placeholder="Value..."
				@input="onValueChange($event.target.value)"
				@keyup.enter="$emit('apply')"
			/>
		</div>

		<!-- Remove button -->
		<button class="filter-remove" @click="$emit('remove')" title="Remove filter">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { getOperatorsForFieldtype } from '@/utils/filterOperators'
import LinkField from './LinkField.vue'

const props = defineProps({
	fields: { type: Array, required: true },
	fieldname: { type: String, default: '' },
	operator: { type: String, default: '=' },
	value: { type: [String, Number, Array], default: '' },
})

const emit = defineEmits(['update:fieldname', 'update:operator', 'update:value', 'remove', 'apply'])

const currentField = computed(() =>
	props.fields.find((f) => f.fieldname === props.fieldname) || null
)

const currentFieldtype = computed(() => currentField.value?.fieldtype || 'Data')

const operators = computed(() => getOperatorsForFieldtype(currentFieldtype.value))

const isDateType = computed(() =>
	currentFieldtype.value === 'Date' || currentFieldtype.value === 'Datetime'
)

const selectOptions = computed(() => {
	if (currentFieldtype.value !== 'Select' || !currentField.value?.options) return []
	return currentField.value.options.split('\n').filter(Boolean)
})

const betweenFrom = computed(() => (Array.isArray(props.value) ? props.value[0] || '' : ''))
const betweenTo = computed(() => (Array.isArray(props.value) ? props.value[1] || '' : ''))

function onFieldChange(newFieldname) {
	const newField = props.fields.find((f) => f.fieldname === newFieldname)
	const newFieldtype = newField?.fieldtype || 'Data'
	const newOps = getOperatorsForFieldtype(newFieldtype)
	emit('update:fieldname', newFieldname)
	emit('update:operator', newOps[0])
	emit('update:value', '')
}

function onOperatorChange(newOp) {
	emit('update:operator', newOp)
	if (newOp === 'is') {
		emit('update:value', 'set')
	} else if (newOp === 'Between') {
		emit('update:value', ['', ''])
	} else {
		emit('update:value', '')
	}
}

function onValueChange(val) {
	emit('update:value', val)
}

function onLinkSelect(val) {
	emit('update:value', val)
	if (val) emit('apply')
}

function onBetweenChange(index, val) {
	const pair = Array.isArray(props.value) ? [...props.value] : ['', '']
	pair[index] = val
	emit('update:value', pair)
}
</script>

<style scoped>
.filter-row {
	display: flex;
	align-items: center;
	gap: 8px;
}

.filter-field-select {
	width: 160px;
	flex-shrink: 0;
}

.filter-operator-select {
	width: 100px;
	flex-shrink: 0;
}

.filter-value-wrap {
	flex: 1;
	min-width: 0;
}

.filter-value-wrap .field-input,
.filter-value-wrap .field-select {
	width: 100%;
}

.filter-between {
	display: flex;
	align-items: center;
	gap: 6px;
}

.filter-between .field-input {
	flex: 1;
}

.between-sep {
	font-size: 12px;
	color: var(--color-text-muted);
	flex-shrink: 0;
}

.filter-remove {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: none;
	background: none;
	color: var(--color-text-muted);
	cursor: pointer;
	border-radius: var(--radius-sm);
	flex-shrink: 0;
	transition: color var(--transition-fast), background var(--transition-fast);
}

.filter-remove:hover {
	color: var(--color-danger);
	background: var(--color-danger-bg, rgba(239, 68, 68, 0.08));
}
</style>
