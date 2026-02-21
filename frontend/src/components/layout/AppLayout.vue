<template>
	<div class="app-layout">
		<AppSidebar :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
		<div :class="['app-main', { 'sidebar-collapsed': sidebarCollapsed }]">
			<AppTopbar />
			<main class="app-content">
				<router-view />
			</main>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import AppSidebar from "./AppSidebar.vue"
import AppTopbar from "./AppTopbar.vue"
import { useAuth } from "@/composables/useAuth"
import { useFrontendConfig } from "@/composables/useFrontendConfig"

const { checkAuth } = useAuth()
const { fetchConfig } = useFrontendConfig()
const sidebarCollapsed = ref(false)

onMounted(() => {
	checkAuth()
	// Still fetch config for column metadata (used by list/form pages)
	fetchConfig()
})
</script>

<style scoped>
.app-layout {
	min-height: 100vh;
	background: var(--color-bg);
}

.app-main {
	margin-left: 260px;
	margin-left: var(--sidebar-width);
	transition: margin-left var(--transition-normal);
	display: flex;
	flex-direction: column;
	min-height: 100vh;
}

.app-main.sidebar-collapsed {
	margin-left: 64px;
	margin-left: var(--sidebar-collapsed-width);
}

.app-content {
	flex: 1;
	padding: var(--space-lg);
}
</style>
