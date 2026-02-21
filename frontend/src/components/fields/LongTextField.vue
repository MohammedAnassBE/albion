<template>
	<Textarea
		:modelValue="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		rows="6"
		fluid
		@update:modelValue="$emit('update:modelValue', $event)"
		@blur="$emit('blur', $event)"
	/>
</template>

<script setup>
import Textarea from "primevue/textarea"

defineProps({
	modelValue: { type: [String, null], default: "" },
	placeholder: { type: String, default: "" },
	disabled: { type: Boolean, default: false },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue", "blur"])
</script>
