<template>
	<Dialog
		v-model:visible="visible"
		:header="isEdit ? `Edit ${entityName}` : `New ${entityName}`"
		:modal="true"
		:style="{ width: dialogWidth }"
		@hide="onHide"
	>
		<slot :data="formData" :update="updateField" />
		<template #footer>
			<Button label="Cancel" severity="secondary" text @click="visible = false" />
			<Button
				:label="isEdit ? 'Update' : 'Create'"
				:loading="saving"
				@click="handleSave"
			/>
		</template>
	</Dialog>
</template>

<script setup>
import { ref, watch, computed } from "vue"
import Dialog from "primevue/dialog"
import Button from "primevue/button"

const props = defineProps({
	modelValue: { type: Boolean, default: false },
	entityName: { type: String, default: "Record" },
	editData: { type: Object, default: null },
	dialogWidth: { type: String, default: "450px" },
})

const emit = defineEmits(["update:modelValue", "save"])

const visible = computed({
	get: () => props.modelValue,
	set: (val) => emit("update:modelValue", val),
})

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
