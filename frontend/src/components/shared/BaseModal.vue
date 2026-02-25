<template>
	<Teleport to="body">
		<Transition name="modal">
			<div v-if="visible" class="modal-mask" @mousedown.self="onOverlayClick">
				<div class="modal-container" :style="containerStyle" role="dialog" aria-modal="true">
					<div v-if="header || closable" class="modal-header">
						<h3 class="modal-title">{{ header }}</h3>
						<button v-if="closable" class="modal-close" @click="close" type="button" aria-label="Close">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
					<div class="modal-body">
						<slot />
					</div>
					<div v-if="$slots.footer" class="modal-footer">
						<slot name="footer" />
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
	visible: { type: Boolean, default: false },
	header: { type: String, default: '' },
	width: { type: String, default: '450px' },
	closable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:visible', 'hide'])

const containerStyle = computed(() => ({
	width: props.width,
	maxWidth: '95vw',
}))

function close() {
	emit('update:visible', false)
	emit('hide')
}

function onOverlayClick() {
	if (props.closable) close()
}

function onKeydown(e) {
	if (e.key === 'Escape' && props.visible && props.closable) close()
}

watch(() => props.visible, (val) => {
	if (val) {
		document.body.style.overflow = 'hidden'
	} else {
		document.body.style.overflow = ''
	}
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
	document.removeEventListener('keydown', onKeydown)
	document.body.style.overflow = ''
})
</script>

<style scoped>
.modal-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	padding: 24px;
}

.modal-container {
	background: var(--color-surface, #fff);
	border: 1px solid var(--color-border, #e2ddd5);
	border-radius: var(--radius-lg, 12px);
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
	display: flex;
	flex-direction: column;
	max-height: calc(100vh - 48px);
	overflow: hidden;
}

.modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px;
	border-bottom: 1px solid var(--color-border, #e2ddd5);
	flex-shrink: 0;
}

.modal-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: var(--color-primary, #1a1f36);
	margin: 0;
	line-height: 1.3;
}

.modal-close {
	background: none;
	border: none;
	color: var(--color-text-muted, #9ca3af);
	cursor: pointer;
	padding: 4px;
	border-radius: var(--radius-sm, 4px);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: color 150ms, background 150ms;
}

.modal-close:hover {
	color: var(--color-text, #1c1c1c);
	background: var(--color-bg, #f3f4f6);
}

.modal-body {
	padding: 20px;
	overflow-y: auto;
	flex: 1;
}

.modal-footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	padding: 12px 20px;
	border-top: 1px solid var(--color-border, #e2ddd5);
	flex-shrink: 0;
}

/* Transitions */
.modal-enter-active {
	transition: opacity 200ms ease;
}
.modal-enter-active .modal-container {
	transition: transform 200ms ease, opacity 200ms ease;
}

.modal-leave-active {
	transition: opacity 150ms ease;
}
.modal-leave-active .modal-container {
	transition: transform 150ms ease, opacity 150ms ease;
}

.modal-enter-from {
	opacity: 0;
}
.modal-enter-from .modal-container {
	transform: scale(0.95) translateY(10px);
	opacity: 0;
}

.modal-leave-to {
	opacity: 0;
}
.modal-leave-to .modal-container {
	transform: scale(0.95) translateY(10px);
	opacity: 0;
}
</style>
