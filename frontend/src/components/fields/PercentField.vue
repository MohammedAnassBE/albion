<template>
	<div class="percent-field">
		<input
			type="number"
			class="field-input"
			:value="modelValue"
			:placeholder="placeholder"
			:disabled="disabled"
			:readonly="readonly"
			min="0"
			max="100"
			step="0.01"
			@input="$emit('update:modelValue', $event.target.value === '' ? 0 : parseFloat($event.target.value))"
			@blur="$emit('blur', $event)"
		/>
		<span class="percent-suffix">%</span>
	</div>
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

<style scoped>
.percent-field {
	position: relative;
	width: 100%;
}

.percent-field .field-input {
	padding-right: 28px;
}

.percent-suffix {
	position: absolute;
	right: 10px;
	top: 50%;
	transform: translateY(-50%);
	font-size: 13px;
	color: var(--color-text-muted);
	pointer-events: none;
}
</style>
