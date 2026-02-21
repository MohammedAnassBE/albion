<template>
	<InputNumber
		:modelValue="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		:min="0"
		:minFractionDigits="0"
		:maxFractionDigits="0"
		fluid
		@update:modelValue="$emit('update:modelValue', $event)"
		@blur="$emit('blur', $event)"
	/>
</template>

<script setup>
import InputNumber from "primevue/inputnumber"

defineProps({
	modelValue: { type: [Number, null], default: 0 },
	placeholder: { type: String, default: "" },
	disabled: { type: Boolean, default: false },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue", "blur"])
</script>
