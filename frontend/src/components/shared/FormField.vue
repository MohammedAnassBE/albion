<template>
	<div class="form-field" :class="{
		required: required,
		'has-error': error,
		'is-readonly': readonly,
	}">
		<label v-if="label" class="form-field-label">
			{{ label }}
			<span v-if="required" class="required-mark">*</span>
		</label>
		<slot />
		<small v-if="error" class="form-field-error">{{ error }}</small>
		<small v-else-if="help" class="form-field-help">{{ help }}</small>
	</div>
</template>

<script setup>
defineProps({
	label: { type: String, default: "" },
	required: { type: Boolean, default: false },
	error: { type: String, default: "" },
	help: { type: String, default: "" },
	readonly: { type: Boolean, default: false },
})
</script>

<style scoped>
.form-field {
	margin-bottom: var(--space-md);
	padding-bottom: var(--space-xs);
	border-left: 3px solid transparent;
	padding-left: var(--space-sm);
	transition: border-color 0.15s ease, background 0.15s ease;
}

.form-field-label {
	display: block;
	font-size: 11px;
	font-weight: 700;
	color: var(--color-text-secondary);
	margin-bottom: 6px;
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.required-mark {
	color: var(--color-danger);
}

.form-field-error {
	display: block;
	color: var(--color-danger);
	font-size: 11px;
	font-weight: 500;
	margin-top: 4px;
}

.form-field-help {
	display: block;
	color: var(--color-text-muted);
	font-size: 11px;
	margin-top: 4px;
}

/* ── Error accent ─────────────────────────────────────────── */
.has-error {
	border-left-color: var(--color-danger);
}

.has-error :deep(.field-input),
.has-error :deep(.field-select) {
	border-color: var(--color-danger);
}

/* ── Readonly treatment ───────────────────────────────────── */
.is-readonly {
	border-left-color: transparent;
}

.is-readonly :deep(.field-input),
.is-readonly :deep(.field-select) {
	background: var(--color-surface-hover, #f8fafc);
	opacity: 0.8;
	cursor: default;
}

/* ── Global field width ───────────────────────────────────── */
.form-field :deep(input),
.form-field :deep(.field-input),
.form-field :deep(.field-select) {
	width: 100%;
}
</style>
