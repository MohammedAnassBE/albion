<template>
	<div class="search-input" :class="{ focused, disabled, 'has-value': !!inputValue }">
		<input
			ref="inputEl"
			type="text"
			class="field-input"
			:value="inputValue"
			:placeholder="placeholder"
			:disabled="disabled"
			@input="onInput"
			@focus="onFocus"
			@blur="onBlur"
			@keydown="onKeydown"
		/>
		<button
			v-if="inputValue && !disabled"
			class="search-clear"
			type="button"
			@mousedown.prevent="onClear"
			tabindex="-1"
		>
			<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
		<Teleport to="body">
			<div
				v-if="showPanel && filteredSuggestions.length > 0"
				class="search-panel"
				:style="panelStyle"
				@mousedown.prevent
			>
				<div
					v-for="(item, i) in filteredSuggestions"
					:key="i"
					class="search-option"
					:class="{ highlighted: i === highlightIndex }"
					@mousedown.prevent="selectItem(item)"
					@mouseenter="highlightIndex = i"
				>
					{{ getLabel(item) }}
				</div>
			</div>
		</Teleport>
	</div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

const props = defineProps({
	modelValue: { type: [String, Object], default: '' },
	suggestions: { type: Array, default: () => [] },
	optionLabel: { type: String, default: 'value' },
	placeholder: { type: String, default: '' },
	disabled: { type: Boolean, default: false },
	forceSelection: { type: Boolean, default: false },
	loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'complete', 'item-select', 'clear'])

const inputEl = ref(null)
const inputValue = ref('')
const focused = ref(false)
const showPanel = ref(false)
const highlightIndex = ref(-1)
const panelStyle = ref({})

function getLabel(item) {
	if (typeof item === 'string') return item
	return item?.[props.optionLabel] ?? item?.name ?? ''
}

// Sync modelValue → inputValue
watch(() => props.modelValue, (val) => {
	inputValue.value = typeof val === 'string' ? val : getLabel(val)
}, { immediate: true })

const filteredSuggestions = computed(() => props.suggestions || [])

function updatePanelPosition() {
	if (!inputEl.value) return
	const rect = inputEl.value.getBoundingClientRect()
	panelStyle.value = {
		position: 'fixed',
		top: rect.bottom + 4 + 'px',
		left: rect.left + 'px',
		width: rect.width + 'px',
		zIndex: 2001,
	}
}

function onInput(e) {
	inputValue.value = e.target.value
	highlightIndex.value = -1
	emit('complete', { query: e.target.value })
	showPanel.value = true
	nextTick(updatePanelPosition)
}

function onFocus() {
	focused.value = true
	emit('complete', { query: inputValue.value || '' })
	showPanel.value = true
	nextTick(updatePanelPosition)
}

function onBlur() {
	focused.value = false
	setTimeout(() => {
		showPanel.value = false
		if (props.forceSelection && inputValue.value) {
			const match = filteredSuggestions.value.find(
				(s) => getLabel(s).toLowerCase() === inputValue.value.toLowerCase()
			)
			if (!match) {
				inputValue.value = typeof props.modelValue === 'string' ? props.modelValue : getLabel(props.modelValue)
			}
		}
	}, 150)
}

function onKeydown(e) {
	if (!showPanel.value || filteredSuggestions.value.length === 0) return

	if (e.key === 'ArrowDown') {
		e.preventDefault()
		highlightIndex.value = Math.min(highlightIndex.value + 1, filteredSuggestions.value.length - 1)
	} else if (e.key === 'ArrowUp') {
		e.preventDefault()
		highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
	} else if (e.key === 'Enter') {
		e.preventDefault()
		if (highlightIndex.value >= 0) {
			selectItem(filteredSuggestions.value[highlightIndex.value])
		}
	} else if (e.key === 'Escape') {
		showPanel.value = false
	}
}

function selectItem(item) {
	inputValue.value = getLabel(item)
	showPanel.value = false
	highlightIndex.value = -1
	emit('update:modelValue', item)
	emit('item-select', { value: item })
}

function onClear() {
	inputValue.value = ''
	showPanel.value = false
	emit('update:modelValue', '')
	emit('clear')
	inputEl.value?.focus()
}

function onScroll() {
	if (showPanel.value) updatePanelPosition()
}

watch(showPanel, (open) => {
	if (open) {
		window.addEventListener('scroll', onScroll, true)
	} else {
		window.removeEventListener('scroll', onScroll, true)
	}
})
onUnmounted(() => window.removeEventListener('scroll', onScroll, true))
</script>

<style scoped>
.search-input {
	position: relative;
	display: flex;
	align-items: center;
}

.search-input .field-input {
	width: 100%;
	padding-right: 28px;
}

.search-clear {
	position: absolute;
	right: 8px;
	background: none;
	border: none;
	color: var(--color-text-muted, #9ca3af);
	cursor: pointer;
	padding: 2px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 3px;
}

.search-clear:hover {
	color: var(--color-text, #1c1c1c);
}
</style>

<style>
/* Panel uses Teleport so needs global styles */
.search-panel {
	background: var(--color-surface, #fff);
	border: 1px solid var(--color-border, #e2ddd5);
	border-radius: var(--radius-md, 8px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	max-height: 220px;
	overflow-y: auto;
	padding: 4px 0;
}

.search-option {
	padding: 8px 12px;
	font-size: 13px;
	cursor: pointer;
	color: var(--color-text, #1c1c1c);
	transition: background 100ms;
}

.search-option:hover,
.search-option.highlighted {
	background: var(--color-surface-hover, #faf8f5);
}
</style>
