<template>
	<div class="page-header">
		<div class="page-header-left">
			<Button
				v-if="backRoute"
				icon="pi pi-arrow-left"
				severity="secondary"
				text
				size="small"
				@click="$router.push(backRoute)"
			/>
			<div>
				<h2 class="page-title-text">{{ title }}</h2>
				<p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
			</div>
		</div>
		<div class="page-header-actions">
			<slot name="actions" />
		</div>
	</div>
</template>

<script setup>
import Button from "primevue/button"

defineProps({
	title: { type: String, required: true },
	subtitle: { type: String, default: "" },
	backRoute: { type: [String, Object], default: null },
})
</script>

<style scoped>
.page-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: var(--space-lg);
}

.page-header-left {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
}

.page-header-subtitle {
	font-size: 13px;
	color: var(--color-text-secondary);
	margin: 2px 0 0;
}

.page-header-actions {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
}
</style>
