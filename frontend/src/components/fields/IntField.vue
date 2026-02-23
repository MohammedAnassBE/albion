<template>
	<input
		type="number"
		class="field-input"
		:value="modelValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		min="0"
		step="1"
		@input="$emit('update:modelValue', $event.target.value === '' ? 0 : parseInt($event.target.value, 10))"
		@blur="$emit('blur', $event)"
	/>
</template>

<script setup>
defineProps({
	modelValue: { type: [Number, null], default: 0 },
	placeholder: { type: String, default: "" },
	disabled: { type: Boolean, default: false },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue", "blur"])
</script>
