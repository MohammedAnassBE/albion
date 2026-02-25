<template>
	<Teleport to="body">
		<div class="toast-container" aria-live="polite">
			<TransitionGroup name="toast">
				<div
					v-for="msg in messages"
					:key="msg.id"
					class="toast-message"
					:class="'toast-' + msg.severity"
				>
					<div class="toast-content">
						<div class="toast-icon">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="severityIcon(msg.severity)" />
						</div>
						<div class="toast-text">
							<div class="toast-summary">{{ msg.summary }}</div>
							<div v-if="msg.detail" class="toast-detail">{{ msg.detail }}</div>
						</div>
					</div>
					<button class="toast-close" @click="remove(msg.id)" aria-label="Close">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
						</svg>
					</button>
				</div>
			</TransitionGroup>
		</div>
	</Teleport>
</template>

<script setup>
import { ref, provide } from 'vue'

const messages = ref([])
let nextId = 0

const ICONS = {
	success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
	error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
	warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
	info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
}

function severityIcon(severity) {
	return ICONS[severity] || ICONS.info
}

function add({ severity = 'info', summary = '', detail = '', life = 3000 }) {
	const id = ++nextId
	messages.value.push({ id, severity, summary, detail })
	if (life > 0) {
		setTimeout(() => remove(id), life)
	}
}

function remove(id) {
	messages.value = messages.value.filter((m) => m.id !== id)
}

const toastApi = {
	add,
	success(summary, detail = '') { add({ severity: 'success', summary, detail, life: 3000 }) },
	error(summary, detail = '') { add({ severity: 'error', summary, detail, life: 5000 }) },
	warn(summary, detail = '') { add({ severity: 'warn', summary, detail, life: 4000 }) },
	info(summary, detail = '') { add({ severity: 'info', summary, detail, life: 3000 }) },
}

provide('toast', toastApi)
</script>

<style scoped>
.toast-container {
	position: fixed;
	top: 16px;
	right: 16px;
	z-index: 2000;
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-width: 380px;
	width: 100%;
	pointer-events: none;
}

.toast-message {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 12px 14px;
	background: var(--color-surface, #fff);
	border: 1px solid var(--color-border, #e2ddd5);
	border-radius: var(--radius-md, 8px);
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
	pointer-events: auto;
	border-left: 4px solid;
}

.toast-success { border-left-color: var(--color-success, #2d8a4e); }
.toast-error { border-left-color: var(--color-danger, #dc2626); }
.toast-warn { border-left-color: var(--color-warning, #d97706); }
.toast-info { border-left-color: #3b82f6; }

.toast-content {
	display: flex;
	gap: 10px;
	flex: 1;
	min-width: 0;
}

.toast-icon {
	flex-shrink: 0;
	margin-top: 1px;
}

.toast-success .toast-icon { color: var(--color-success, #2d8a4e); }
.toast-error .toast-icon { color: var(--color-danger, #dc2626); }
.toast-warn .toast-icon { color: var(--color-warning, #d97706); }
.toast-info .toast-icon { color: #3b82f6; }

.toast-text {
	min-width: 0;
}

.toast-summary {
	font-size: 13px;
	font-weight: 600;
	color: var(--color-text, #1c1c1c);
}

.toast-detail {
	font-size: 12px;
	color: var(--color-text-secondary, #6b7280);
	margin-top: 2px;
}

.toast-close {
	background: none;
	border: none;
	color: var(--color-text-muted, #9ca3af);
	cursor: pointer;
	padding: 2px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 4px;
	transition: color 150ms;
}

.toast-close:hover {
	color: var(--color-text, #1c1c1c);
}

/* Transitions */
.toast-enter-active {
	transition: all 300ms ease;
}

.toast-leave-active {
	transition: all 200ms ease;
}

.toast-enter-from {
	opacity: 0;
	transform: translateX(100%);
}

.toast-leave-to {
	opacity: 0;
	transform: translateX(100%);
}

.toast-move {
	transition: transform 200ms ease;
}
</style>
