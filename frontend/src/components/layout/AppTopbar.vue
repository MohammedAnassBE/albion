<template>
	<header class="app-topbar">
		<span class="topbar-breadcrumb">{{ pageTitle }}</span>
		<div class="topbar-right">
			<span class="user-name">{{ fullName }}</span>
			<button class="btn btn-secondary btn-text btn-icon" @click="handleLogout">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
				</svg>
			</button>
		</div>
	</header>
</template>

<script setup>
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useAuth } from "@/composables/useAuth"

const route = useRoute()
const { fullName, logout } = useAuth()

const pageTitle = computed(() => {
	return route.meta?.title || route.name || ""
})

async function handleLogout() {
	await logout()
}
</script>

<style scoped>
.app-topbar {
	height: var(--topbar-height);
	background: var(--color-surface);
	border-bottom: 1px solid var(--color-border);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 var(--space-lg);
	position: sticky;
	top: 0;
	z-index: 50;
}

.topbar-breadcrumb {
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: var(--color-text-muted);
}

.topbar-right {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
}

.user-name {
	font-size: 13px;
	color: var(--color-text-secondary);
	font-weight: 500;
}
</style>
