<template>
	<BaseModal
		:visible="!!current"
		:header="current?.header || 'Confirm'"
		width="420px"
		:closable="true"
		@update:visible="onClose"
	>
		<div v-if="current" class="confirm-body">
			<p class="confirm-message">{{ current.message }}</p>
		</div>
		<template #footer>
			<button v-if="current?.rejectLabel" class="btn btn-secondary btn-text" @click="onReject">
				{{ current.rejectLabel }}
			</button>
			<button
				class="btn"
				:class="acceptClass"
				@click="onAccept"
			>
				{{ current?.acceptLabel || 'OK' }}
			</button>
		</template>
	</BaseModal>
</template>

<script setup>
import { computed } from 'vue'
import { confirmState } from '@/composables/useConfirm'
import BaseModal from './BaseModal.vue'

const current = confirmState

const acceptClass = computed(() => {
	const severity = current.value?.acceptProps?.severity || current.value?.severity || 'primary'
	return `btn-${severity}`
})

function onAccept() {
	const accept = current.value?.accept
	current.value = null
	if (accept) accept()
}

function onReject() {
	const reject = current.value?.reject
	current.value = null
	if (reject) reject()
}

function onClose(val) {
	if (!val) onReject()
}
</script>

<style scoped>
.confirm-body {
	padding: 4px 0;
}

.confirm-message {
	font-size: 14px;
	color: var(--color-text, #1c1c1c);
	line-height: 1.5;
	margin: 0;
}
</style>
