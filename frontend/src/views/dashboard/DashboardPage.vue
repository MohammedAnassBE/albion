<template>
	<div class="dashboard-page">
		<header class="dash-header">
			<div>
				<h1 class="dash-title">Dashboard</h1>
				<p class="dash-subtitle">Production overview</p>
			</div>
			<button class="refresh-btn" :class="{ spinning: loading }" @click="load">
				<AppIcon name="refresh-cw" :size="16" />
			</button>
		</header>

		<!-- Stat Cards -->
		<div class="stat-grid">
			<div
				v-for="card in statCards"
				:key="card.label"
				class="stat-card"
				:style="{
					'--card-accent': card.color,
					'--card-accent-light': card.lightColor,
				}"
				@click="card.route && $router.push(card.route)"
			>
				<div class="card-top-bar" />
				<div class="card-content">
					<div class="card-icon">
						<AppIcon :name="card.icon" :size="16" />
					</div>
					<div class="card-number">{{ card.value }}</div>
					<div class="card-label">{{ card.label }}</div>
					</div>
			</div>
		</div>

		<!-- Recent Orders -->
		<div class="panel recent-panel">
			<h3 class="panel-title">Recent Orders</h3>
			<div v-if="recentOrders.length" class="recent-list">
				<div
					v-for="order in recentOrders"
					:key="order.name"
					class="recent-row"
					@click="$router.push(`/orders/${encodeURIComponent(order.name)}`)"
				>
					<div class="recent-main">
						<span class="recent-name">{{ order.name }}</span>
						<span class="recent-customer">{{ order.customer || '\u2014' }}</span>
					</div>
					<div class="recent-meta">
						<span class="recent-date">{{ order.order_date || '' }}</span>
						<span
							class="recent-badge"
							:class="badgeClass(order.docstatus)"
						>{{ badgeLabel(order.docstatus) }}</span>
					</div>
				</div>
			</div>
			<div v-else class="panel-empty">
				<AppIcon name="inbox" :size="24" style="opacity: 0.4" />
				<span>No orders yet</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import { callMethod } from "@/api/client"
import AppIcon from "@/components/shared/AppIcon.vue"

const loading = ref(false)
const data = ref({})
const recentOrders = ref([])

async function load() {
	loading.value = true
	try {
		const result = await callMethod("albion.api.get_dashboard_stats")
		data.value = result || {}
		recentOrders.value = result.recent_orders || []
	} catch (e) {
		console.error("Dashboard load failed:", e)
	} finally {
		loading.value = false
	}
}

onMounted(load)

const statCards = computed(() => {
	const d = data.value
	return [
		{
			label: "ACTIVE ORDERS",
			value: d.active_orders ?? 0,
			icon: "file-edit",
			color: "#10b981",
			lightColor: "rgba(16, 185, 129, 0.06)",
			route: "/orders",
		},
		{
			label: "ITEMS",
			value: d.total_items ?? 0,
			icon: "box",
			color: "#2563eb",
			lightColor: "rgba(37, 99, 235, 0.06)",
			route: "/items",
		},
		{
			label: "MACHINES",
			value: d.total_machines ?? 0,
			icon: "settings",
			color: "#7c3aed",
			lightColor: "rgba(124, 58, 237, 0.06)",
			route: "/machines",
		},
		{
			label: "CUSTOMERS",
			value: d.total_customers ?? 0,
			icon: "users",
			color: "#f59e0b",
			lightColor: "rgba(245, 158, 11, 0.06)",
			route: "/customers",
		},
	]
})

function badgeClass(ds) {
	if (ds === 1) return "badge-blue"
	if (ds === 2) return "badge-red"
	return "badge-grey"
}

function badgeLabel(ds) {
	if (ds === 1) return "Submitted"
	if (ds === 2) return "Cancelled"
	return "Draft"
}
</script>

<style scoped>
.dashboard-page {
	padding: var(--space-lg);
	max-width: 1400px;
}

/* ── Header ────────────────────────────────────────────── */
.dash-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: var(--space-lg);
}

.dash-title {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--color-primary);
	margin: 0;
	letter-spacing: -0.02em;
}

.dash-subtitle {
	margin: 2px 0 0;
	font-size: 0.8125rem;
	color: var(--color-text-muted);
}

.refresh-btn {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
	width: 36px;
	height: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	color: var(--color-text-secondary);
	transition: all var(--transition-fast);
}

.refresh-btn:hover {
	background: var(--color-surface-hover);
	color: var(--color-text);
	border-color: var(--color-border-strong);
}

.refresh-btn.spinning svg {
	animation: spin 0.8s linear infinite;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}

/* ── Stat Grid ─────────────────────────────────────────── */
.stat-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: var(--space-md);
	margin-bottom: var(--space-lg);
}

.stat-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	overflow: hidden;
	cursor: pointer;
	transition: all var(--transition-fast);
	position: relative;
}

.stat-card::after {
	content: "";
	position: absolute;
	inset: 0;
	background: linear-gradient(
		135deg,
		var(--card-accent-light) 0%,
		transparent 60%
	);
	pointer-events: none;
}

.stat-card:hover {
	box-shadow: var(--shadow-md);
	transform: translateY(-2px);
}

.card-top-bar {
	height: 3px;
	background: linear-gradient(
		90deg,
		var(--card-accent) 0%,
		color-mix(in srgb, var(--card-accent) 30%, transparent) 100%
	);
}

.card-content {
	padding: var(--space-md) var(--space-lg) var(--space-lg);
	position: relative;
	z-index: 1;
}

.card-icon {
	width: 40px;
	height: 40px;
	border-radius: var(--radius-md);
	background: color-mix(in srgb, var(--card-accent) 12%, white);
	color: var(--card-accent);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: var(--space-md);
}

.card-number {
	font-size: 2rem;
	font-weight: 700;
	color: var(--color-text);
	line-height: 1;
	margin-bottom: 4px;
}

.card-label {
	font-size: 0.6875rem;
	color: var(--color-text-muted);
	text-transform: uppercase;
	letter-spacing: 0.8px;
	font-weight: 600;
	margin-bottom: var(--space-sm);
}


/* ── Recent Orders Panel ───────────────────────────────── */
.panel {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	padding: var(--space-lg);
}

.panel-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--color-text);
	margin: 0 0 var(--space-md);
}

.recent-list {
	display: flex;
	flex-direction: column;
}

.recent-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 0;
	border-bottom: 1px solid var(--color-bg);
	cursor: pointer;
	transition: background var(--transition-fast);
	margin: 0 calc(-1 * var(--space-lg));
	padding-left: var(--space-lg);
	padding-right: var(--space-lg);
}

.recent-row:last-child {
	border-bottom: none;
}

.recent-row:hover {
	background: var(--color-surface-hover);
}

.recent-main {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.recent-name {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--color-primary);
}

.recent-customer {
	font-size: 0.75rem;
	color: var(--color-text-muted);
}

.recent-meta {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	flex-shrink: 0;
}

.recent-date {
	font-size: 0.75rem;
	color: var(--color-text-muted);
}

.recent-badge {
	font-size: 10px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 10px;
	text-transform: uppercase;
	letter-spacing: 0.3px;
}

.badge-grey {
	background: #f1f5f9;
	color: #64748b;
}

.badge-blue {
	background: rgba(37, 99, 235, 0.1);
	color: #2563eb;
}

.badge-red {
	background: rgba(220, 38, 38, 0.08);
	color: #dc2626;
}

.panel-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-sm);
	padding: var(--space-xl) 0;
	color: var(--color-text-muted);
	font-size: 0.8125rem;
}

/* ── Responsive ────────────────────────────────────────── */
@media (max-width: 900px) {
	.stat-grid {
		grid-template-columns: repeat(2, 1fr);
	}
}
</style>
