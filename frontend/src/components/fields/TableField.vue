<template>
	<ChildTable
		:title="title"
		:modelValue="modelValue"
		:columns="columns"
		:readonly="readonly"
		@update:modelValue="$emit('update:modelValue', $event)"
	/>
</template>

<script setup>
import ChildTable from "@/components/shared/ChildTable.vue"

defineProps({
	title: { type: String, default: "" },
	modelValue: { type: Array, default: () => [] },
	columns: { type: Array, default: () => [] },
	readonly: { type: Boolean, default: false },
})

defineEmits(["update:modelValue"])
</script>
