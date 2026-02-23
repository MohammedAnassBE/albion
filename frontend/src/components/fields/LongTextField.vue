<template>
	<textarea
		class="field-input"
		:value="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		rows="6"
		@input="$emit('update:modelValue', $event.target.value)"
		@blur="$emit('blur', $event)"
	/>
</template>

<script setup>
defineProps({
	modelValue: { type: [String, null], default: "" },
	placeholder: { type: String, default: "" },
	disabled: { type: Boolean, default: false },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue", "blur"])
</script>
