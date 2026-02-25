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

		<!-- Report Cards -->
		<div class="stat-grid">
			<div
				v-for="card in reportCards"
				:key="card.label"
				class="stat-card"
				:style="{
					'--card-accent': card.color,
					'--card-accent-light': card.lightColor,
				}"
				@click="$router.push(card.route)"
			>
				<div class="card-top-bar" />
				<div class="card-content">
					<div class="card-icon">
						<AppIcon :name="card.icon" :size="16" />
					</div>
					<div class="card-label">{{ card.label }}</div>
					<div v-if="card.value !== undefined" class="card-value">{{ card.value }}<span class="card-unit">{{ card.unit }}</span></div>
					<div class="card-desc">{{ card.desc }}</div>
				</div>
			</div>
		</div>

		<!-- Underutilized Machines -->
		<div class="panel">
			<h3 class="panel-title">Underutilized Machines</h3>
			<div v-if="machineUtilisation.length" class="machine-list">
				<div
					v-for="m in machineUtilisation"
					:key="m.machine_id"
					class="machine-row"
					@click="$router.push('/machine-availability')"
				>
					<div class="machine-info">
						<span class="machine-id">{{ m.machine_id }}</span>
						<span v-if="m.machine_frame" class="machine-frame">{{ m.machine_frame }}</span>
					</div>
					<div class="machine-stats">
						<div class="util-bar-wrap">
							<div class="util-bar" :class="utilClass(m.pct)" :style="{ width: Math.min(m.pct, 100) + '%' }" />
						</div>
						<span class="util-pct" :class="utilClass(m.pct)">{{ m.pct }}%</span>
						<span class="machine-avail">{{ m.available }} min free</span>
					</div>
				</div>
			</div>
			<div v-else class="panel-empty">
				<AppIcon name="inbox" :size="24" style="opacity: 0.4" />
				<span>No machines found</span>
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
const machineUtilisation = ref([])

async function load() {
	loading.value = true
	try {
		const result = await callMethod("albion.api.get_dashboard_stats")
		data.value = result || {}
		machineUtilisation.value = result.machine_utilisation || []
	} catch (e) {
		console.error("Dashboard load failed:", e)
	} finally {
		loading.value = false
	}
}

onMounted(load)

const reportCards = computed(() => [
	{
		label: "PRODUCTION REPORT",
		desc: "pcs last 7 days",
		value: data.value.production_qty ?? "—",
		unit: "",
		icon: "bar-chart",
		color: "#10b981",
		lightColor: "rgba(16, 185, 129, 0.06)",
		route: "/production-report",
	},
	{
		label: "MACHINE AVAILABILITY",
		desc: "avg utilisation last 7 days",
		value: data.value.avg_utilisation !== undefined ? data.value.avg_utilisation + "%" : "—",
		unit: "",
		icon: "calendar",
		color: "#2563eb",
		lightColor: "rgba(37, 99, 235, 0.06)",
		route: "/machine-availability",
	},
])

function utilClass(pct) {
	if (pct < 40) return "util-low"
	if (pct < 75) return "util-mid"
	return "util-high"
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
	grid-template-columns: repeat(2, 1fr);
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

.card-label {
	font-size: 0.8125rem;
	color: var(--color-text);
	text-transform: uppercase;
	letter-spacing: 0.8px;
	font-weight: 700;
	margin-bottom: 4px;
}

.card-value {
	font-size: 1.75rem;
	font-weight: 800;
	color: var(--card-accent);
	letter-spacing: -0.03em;
	line-height: 1.1;
	margin-bottom: 2px;
}

.card-unit {
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--color-text-muted);
	margin-left: 4px;
}

.card-desc {
	font-size: 0.75rem;
	color: var(--color-text-muted);
	line-height: 1.4;
}

/* ── Underutilized Machines Panel ──────────────────────── */
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

.machine-list {
	display: flex;
	flex-direction: column;
}

.machine-row {
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

.machine-row:last-child {
	border-bottom: none;
}

.machine-row:hover {
	background: var(--color-surface-hover);
}

.machine-info {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	min-width: 0;
}

.machine-id {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--color-primary);
}

.machine-frame {
	font-size: 10px;
	font-weight: 600;
	padding: 2px 8px;
	border-radius: 10px;
	text-transform: uppercase;
	letter-spacing: 0.3px;
	background: rgba(37, 99, 235, 0.1);
	color: #2563eb;
}

.machine-stats {
	display: flex;
	align-items: center;
	gap: var(--space-sm);
	flex-shrink: 0;
}

.util-bar-wrap {
	width: 80px;
	height: 6px;
	background: var(--color-bg);
	border-radius: 3px;
	overflow: hidden;
}

.util-bar {
	height: 100%;
	border-radius: 3px;
	transition: width 0.3s ease;
}

.util-bar.util-low {
	background: #ef4444;
}

.util-bar.util-mid {
	background: #f59e0b;
}

.util-bar.util-high {
	background: #10b981;
}

.util-pct {
	font-size: 0.75rem;
	font-weight: 700;
	min-width: 40px;
	text-align: right;
}

.util-pct.util-low {
	color: #ef4444;
}

.util-pct.util-mid {
	color: #f59e0b;
}

.util-pct.util-high {
	color: #10b981;
}

.machine-avail {
	font-size: 0.6875rem;
	color: var(--color-text-muted);
	min-width: 70px;
	text-align: right;
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
		grid-template-columns: repeat(1, 1fr);
	}

	.util-bar-wrap {
		width: 50px;
	}
}
</style>
