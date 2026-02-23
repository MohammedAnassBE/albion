<template>
	<aside :class="['app-sidebar', { collapsed }]">
		<div class="sidebar-header">
			<div class="logo" @click="$router.push('/')">
				<span class="logo-mark">A</span>
				<span v-if="!collapsed" class="logo-text">ALBION</span>
			</div>
			<button class="collapse-btn" @click="$emit('toggle')">
				<AppIcon :name="collapsed ? 'chevron-right' : 'chevron-left'" :size="16" />
			</button>
		</div>

		<nav class="sidebar-nav">
			<!-- Tools -->
			<div class="nav-group">
				<router-link to="/dashboard" class="nav-item" active-class="active">
					<AppIcon name="grid" :size="16" />
					<span v-if="!collapsed">Dashboard</span>
				</router-link>
				<router-link to="/capacity-planning" class="nav-item" active-class="active">
					<AppIcon name="bar-chart" :size="16" />
					<span v-if="!collapsed">Capacity Planning</span>
				</router-link>
			</div>

			<!-- DocType groups from static registry -->
			<div v-for="group in sidebarGroups" :key="group.group" class="nav-group">
				<span v-if="!collapsed" class="nav-group-label">{{ group.group }}</span>
				<router-link
					v-for="item in group.items"
					:key="item.route"
					:to="`/${item.route}`"
					class="nav-item"
					active-class="active"
				>
					<AppIcon :name="item.icon" :size="16" />
					<span v-if="!collapsed">{{ item.label }}</span>
				</router-link>
			</div>
		</nav>

		<div class="sidebar-footer">
			<a href="/app" class="nav-item back-link">
				<AppIcon name="arrow-left" :size="16" />
				<span v-if="!collapsed">Back to Desk</span>
			</a>
			<div class="user-row" v-if="!collapsed || true">
				<div class="user-avatar">{{ initials }}</div>
				<div v-if="!collapsed" class="user-meta">
					<span class="user-name-text">{{ fullName }}</span>
					<span class="user-role">{{ accessLabel }}</span>
				</div>
			</div>
		</div>
	</aside>
</template>

<script setup>
import { computed } from "vue"
import { useAuth } from "@/composables/useAuth"
import { usePermissions } from "@/composables/usePermissions"
import { getSidebarGroups } from "@/config/doctypes"
import AppIcon from "@/components/shared/AppIcon.vue"

defineProps({
	collapsed: Boolean,
})

defineEmits(["toggle"])

const { fullName } = useAuth()
const { canRead, accessLabel } = usePermissions()
const _allGroups = getSidebarGroups()

const sidebarGroups = computed(() =>
	_allGroups
		.map((g) => ({
			...g,
			items: g.items.filter((item) => canRead(item.doctype)),
		}))
		.filter((g) => g.items.length > 0)
)

const initials = computed(() => {
	if (!fullName.value) return "U"
	const parts = fullName.value.trim().split(" ")
	return parts.length >= 2
		? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
		: parts[0].slice(0, 2).toUpperCase()
})
</script>

<style scoped>
.app-sidebar {
	width: var(--sidebar-width);
	height: 100vh;
	background: #fff;
	color: #334155;
	border-right: 1px solid #E2E8F0;
	display: flex;
	flex-direction: column;
	transition: width var(--transition-normal);
	overflow: hidden;
	position: fixed;
	left: 0;
	top: 0;
	z-index: 100;
}

.app-sidebar.collapsed {
	width: var(--sidebar-collapsed-width);
}

.sidebar-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-md);
	height: var(--topbar-height);
	border-bottom: 1px solid #E2E8F0;
}

.logo {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	cursor: pointer;
	min-width: 0;
}

.logo-mark {
	width: 32px;
	height: 32px;
	background: var(--color-accent);
	color: var(--color-primary);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20px;
	font-weight: 400;
	border-radius: var(--radius-sm);
	flex-shrink: 0;
}

.logo-text {
	font-size: 16px;
	letter-spacing: 2px;
	white-space: nowrap;
	color: var(--color-primary);
}

.collapse-btn {
	background: none;
	border: none;
	color: #94A3B8;
	cursor: pointer;
	padding: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--radius-sm);
	transition: color var(--transition-fast), background var(--transition-fast);
}

.collapse-btn:hover {
	color: #475569;
	background: #F1F5F9;
}

.sidebar-nav {
	flex: 1;
	overflow-y: auto;
	padding: var(--space-sm) 0;
}

.nav-group {
	padding: var(--space-xs) 0;
}

.nav-group-label {
	display: block;
	padding: var(--space-sm) var(--space-md);
	font-size: 10px;
	font-weight: 600;
	letter-spacing: 1.5px;
	text-transform: uppercase;
	color: #94A3B8;
}

.nav-item {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	padding: 10px var(--space-md);
	color: #64748B;
	text-decoration: none;
	font-size: 13px;
	font-weight: 500;
	transition: all var(--transition-fast);
	cursor: pointer;
	border: none;
	background: none;
	width: 100%;
	text-align: left;
	white-space: nowrap;
}

.nav-item:hover {
	background: #F8FAFC;
	color: #334155;
}

.nav-item.active {
	color: #059669;
	background: rgba(16, 185, 129, 0.08);
	border-left: 3px solid #059669;
}

.sidebar-footer {
	border-top: 1px solid #E2E8F0;
	padding: var(--space-xs) 0;
}

.back-link {
	font-size: 12px;
	color: #94A3B8;
}

.back-link:hover {
	color: #334155;
	background: #F8FAFC;
}

.user-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px var(--space-md);
}

.user-avatar {
	width: 30px;
	height: 30px;
	border-radius: 50%;
	background: #E2E8F0;
	color: #475569;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	font-weight: 700;
	flex-shrink: 0;
	letter-spacing: 0.5px;
}

.user-meta {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.user-name-text {
	font-size: 12px;
	font-weight: 600;
	color: #334155;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.user-role {
	font-size: 10px;
	color: #94A3B8;
}

.collapsed .nav-item {
	justify-content: center;
	padding: 10px;
}

.collapsed .user-row {
	justify-content: center;
	padding: 10px;
}
</style>
