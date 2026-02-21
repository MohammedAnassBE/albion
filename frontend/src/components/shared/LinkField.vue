<template>
	<AutoComplete
		v-model="selected"
		:suggestions="suggestions"
		:loading="searching"
		optionLabel="_label"
		:placeholder="placeholder"
		:disabled="disabled"
		forceSelection
		@complete="search"
		@item-select="onSelect"
		@clear="onClear"
		:inputClass="inputClass"
	/>
</template>

<script setup>
import { ref, watch } from "vue"
import AutoComplete from "primevue/autocomplete"
import { searchLink } from "@/api/client"

const props = defineProps({
	modelValue: { type: String, default: "" },
	doctype: { type: String, required: true },
	placeholder: { type: String, default: "Search..." },
	disabled: { type: Boolean, default: false },
	filters: { type: Object, default: () => ({}) },
	searchField: { type: String, default: "name" },
	displayField: { type: String, default: "" },
	inputClass: { type: String, default: "" },
})

const emit = defineEmits(["update:modelValue", "select"])

const selected = ref(props.modelValue ? { _label: props.modelValue, name: props.modelValue } : null)
const suggestions = ref([])
const searching = ref(false)

watch(() => props.modelValue, (val) => {
	if (!val) {
		selected.value = null
	} else if (!selected.value || selected.value.name !== val) {
		selected.value = { _label: val, name: val }
	}
})

async function search(event) {
	searching.value = true
	try {
		const results = await searchLink(props.doctype, event.query, props.filters)
		suggestions.value = results.map((r) => ({
			...r,
			_label: props.displayField ? `${r.name} — ${r[props.displayField]}` : r.name,
		}))
	} catch {
		suggestions.value = []
	} finally {
		searching.value = false
	}
}

function onSelect(event) {
	emit("update:modelValue", event.value.name)
	emit("select", event.value)
}

function onClear() {
	emit("update:modelValue", "")
	emit("select", null)
}
</script>
