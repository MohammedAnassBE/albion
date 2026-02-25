<template>
	<div class="filter-bar-wrap">
		<div v-if="activeFilters.length > 0" class="filter-bar">
			<FilterRow
				v-for="filter in activeFilters"
				:key="filter.id"
				:fields="filterableFields"
				:fieldname="filter.fieldname"
				:operator="filter.operator"
				:value="filter.value"
				@update:fieldname="filter.fieldname = $event"
				@update:operator="filter.operator = $event"
				@update:value="filter.value = $event; applyFilters()"
				@remove="removeFilter(filter.id)"
				@apply="applyFilters()"
			/>
		</div>
		<div class="filter-actions">
			<button class="btn btn-secondary btn-sm" @click="addFilter">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
				Add Filter
			</button>
			<button
				v-if="activeFilters.length > 0"
				class="btn btn-text btn-sm"
				@click="clearAll"
			>
				Clear All
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import FilterRow from './FilterRow.vue'
import { NON_FILTERABLE_FIELDTYPES, serializeFilterValue } from '@/utils/filterOperators'

const props = defineProps({
	fields: { type: Array, required: true },
})

const emit = defineEmits(['apply'])

const filterableFields = computed(() =>
	props.fields.filter(
		(f) =>
			!NON_FILTERABLE_FIELDTYPES.has(f.fieldtype) &&
			!f.hidden &&
			f.fieldname !== 'name'
	)
)

let nextId = 1
const activeFilters = ref([])

function addFilter() {
	const firstField = filterableFields.value[0]
	activeFilters.value.push({
		id: nextId++,
		fieldname: firstField?.fieldname || '',
		operator: '=',
		value: '',
	})
}

function removeFilter(id) {
	activeFilters.value = activeFilters.value.filter((f) => f.id !== id)
	applyFilters()
}

function clearAll() {
	activeFilters.value = []
	applyFilters()
}

function applyFilters() {
	const result = {}
	for (const f of activeFilters.value) {
		if (!f.fieldname) continue
		// Skip empty values (except 'is' operator which always has a value)
		if (f.operator !== 'is' && (f.value === '' || f.value === null || f.value === undefined)) continue
		if (f.operator === 'Between') {
			const pair = Array.isArray(f.value) ? f.value : ['', '']
			if (!pair[0] && !pair[1]) continue
		}
		const field = filterableFields.value.find((fd) => fd.fieldname === f.fieldname)
		const fieldtype = field?.fieldtype || 'Data'
		result[f.fieldname] = serializeFilterValue(f.operator, f.value, fieldtype)
	}
	emit('apply', result)
}

defineExpose({ addFilter })
</script>

<style scoped>
.filter-bar-wrap {
	margin-bottom: var(--space-md);
}

.filter-bar {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: var(--space-sm) var(--space-md);
	margin-bottom: 8px;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
}

.filter-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}
</style>
