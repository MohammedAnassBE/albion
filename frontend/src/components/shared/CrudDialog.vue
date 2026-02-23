<template>
	<BaseModal
		:visible="modelValue"
		:header="isEdit ? `Edit ${entityName}` : `New ${entityName}`"
		:width="dialogWidth"
		@update:visible="(val) => emit('update:modelValue', val)"
		@hide="onHide"
	>
		<slot :data="formData" :update="updateField" />
		<template #footer>
			<button class="btn btn-secondary btn-text" @click="emit('update:modelValue', false)">Cancel</button>
			<button
				class="btn btn-primary"
				:class="{ 'btn-loading': saving }"
				:disabled="saving"
				@click="handleSave"
			>
				{{ isEdit ? 'Update' : 'Create' }}
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { ref, watch, computed } from "vue"
import BaseModal from "./BaseModal.vue"

const props = defineProps({
	modelValue: { type: Boolean, default: false },
	entityName: { type: String, default: "Record" },
	editData: { type: Object, default: null },
	dialogWidth: { type: String, default: "450px" },
})

const emit = defineEmits(["update:modelValue", "save"])

const formData = ref({})
const saving = ref(false)
const isEdit = computed(() => !!props.editData)

watch(() => props.modelValue, (val) => {
	if (val) {
		formData.value = props.editData ? { ...props.editData } : {}
	}
})

function updateField(field, value) {
	formData.value[field] = value
}

async function handleSave() {
	saving.value = true
	try {
		await emit("save", { data: formData.value, isEdit: isEdit.value })
	} finally {
		saving.value = false
	}
}

function onHide() {
	formData.value = {}
}
</script>
