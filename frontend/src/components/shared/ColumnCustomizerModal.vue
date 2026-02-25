<template>
	<BaseModal
		:visible="visible"
		header="Customize Columns"
		width="480px"
		@update:visible="$emit('update:visible', $event)"
	>
		<div class="columns-list">
			<label
				v-for="field in modalFields"
				:key="field.fieldname"
				class="column-item"
			>
				<input type="checkbox" v-model="field.enabled" class="column-check" />
				<span class="column-label">{{ field.label }}</span>
				<span class="column-type">{{ field.fieldtype }}</span>
			</label>
		</div>
		<template #footer>
			<button class="btn btn-secondary" @click="resetColumns" :disabled="saving">
				Reset to Default
			</button>
			<button class="btn btn-primary" @click="saveColumns" :disabled="saving">
				{{ saving ? 'Saving...' : 'Save' }}
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { callMethod, deleteDoc } from '@/api/client'
import { useFrontendConfig } from '@/composables/useFrontendConfig'

const NON_LISTABLE_FIELDTYPES = new Set([
	'Table', 'Text Editor', 'Long Text', 'Small Text', 'Text', 'HTML', 'HTML Editor',
	'Section Break', 'Column Break', 'Tab Break', 'Fold', 'Heading',
])

const props = defineProps({
	visible: { type: Boolean, default: false },
	doctype: { type: String, required: true },
	fields: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'saved'])
const { invalidateUserListviewCache } = useFrontendConfig()

const modalFields = ref([])
const saving = ref(false)

watch(() => props.visible, (val) => {
	if (val && props.fields.length) {
		modalFields.value = props.fields
			.filter((f) => f.fieldname !== 'name' && !NON_LISTABLE_FIELDTYPES.has(f.fieldtype))
			.map((f) => reactive({
				fieldname: f.fieldname,
				fieldtype: f.fieldtype,
				label: f.label,
				enabled: !!f.show_in_list,
			}))
	}
})

async function saveColumns() {
	saving.value = true
	try {
		const enabledFields = modalFields.value
			.filter((f) => f.enabled)
			.map((f) => f.fieldname)
		await callMethod(
			'albion.albion.doctype.user_listview.user_listview.save_user_listview',
			{ doctype_name: props.doctype, enabled_fields: JSON.stringify(enabledFields) }
		)
		emit('update:visible', false)
		invalidateUserListviewCache(props.doctype)
		emit('saved')
	} catch (e) {
		console.error('Failed to save column preferences:', e)
	} finally {
		saving.value = false
	}
}

async function resetColumns() {
	saving.value = true
	try {
		const user = window.frappe?.boot?.user_info?.[window.frappe?.boot?.user]?.name || window.frappe?.boot?.user
		await deleteDoc('User Listview', `${user}-${props.doctype}`)
	} catch (e) {
		// Record may not exist — that's fine
	}
	invalidateUserListviewCache(props.doctype)
	emit('update:visible', false)
	saving.value = false
	emit('saved')
}
</script>

<style scoped>
.columns-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
	max-height: 400px;
	overflow-y: auto;
}

.column-item {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 8px 10px;
	border-radius: var(--radius-sm);
	cursor: pointer;
	transition: background var(--transition-fast);
}

.column-item:hover {
	background: var(--color-surface-hover, #f5f5f4);
}

.column-check {
	width: 16px;
	height: 16px;
	accent-color: var(--color-accent, #2563eb);
	cursor: pointer;
	flex-shrink: 0;
}

.column-label {
	flex: 1;
	font-size: 13px;
	font-weight: 500;
	color: var(--color-text);
}

.column-type {
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-muted);
	background: var(--color-bg, #f3f4f6);
	padding: 2px 6px;
	border-radius: var(--radius-sm);
}
</style>
