<template>
	<div class="page-header">
		<div class="page-header-left">
			<button
				v-if="backRoute"
				class="btn btn-secondary btn-text btn-icon"
				@click="$router.push(backRoute)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
				</svg>
			</button>
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
	position: sticky;
	top: calc(-1 * var(--space-lg));
	z-index: 100;
	background: var(--color-bg, #fff);
	padding: var(--space-lg) 0 var(--space-md);
	margin-top: calc(-1 * var(--space-lg));
	margin-left: calc(-1 * var(--space-lg));
	margin-right: calc(-1 * var(--space-lg));
	padding-left: var(--space-lg);
	padding-right: var(--space-lg);
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
