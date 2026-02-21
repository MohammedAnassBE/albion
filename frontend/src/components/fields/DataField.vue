<template>
	<InputText
		:modelValue="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		fluid
		@update:modelValue="$emit('update:modelValue', $event)"
		@blur="$emit('blur', $event)"
	/>
</template>

<script setup>
import InputText from "primevue/inputtext"

defineProps({
	modelValue: { type: [String, null], default: "" },
	placeholder: { type: String, default: "" },
	disabled: { type: Boolean, default: false },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue", "blur"])
</script>
