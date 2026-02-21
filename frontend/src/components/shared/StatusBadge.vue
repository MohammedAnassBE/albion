<template>
	<span :class="['status-badge', statusClass]">
		<span class="status-dot" />
		{{ label }}
	</span>
</template>

<script setup>
import { computed } from "vue"

const props = defineProps({
	docstatus: { type: Number, default: 0 },
})

const label = computed(() => {
	switch (props.docstatus) {
		case 0: return "Draft"
		case 1: return "Submitted"
		case 2: return "Cancelled"
		default: return "Unknown"
	}
})

const statusClass = computed(() => {
	switch (props.docstatus) {
		case 0: return "warning"
		case 1: return "success"
		case 2: return "danger"
		default: return "secondary"
	}
})
</script>

<style scoped>
.status-badge {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12.5px;
	font-weight: 600;
}

.status-dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;
}

.status-badge.success { color: #059669; }
.status-badge.warning { color: #D97706; }
.status-badge.danger { color: #DC2626; }
.status-badge.secondary { color: #64748B; }
</style>
