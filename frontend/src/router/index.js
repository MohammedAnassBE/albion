import { createRouter, createWebHistory } from "vue-router"

const routes = [
	{
		path: "/",
		component: () => import("@/components/layout/AppLayout.vue"),
		children: [
			{
				path: "",
				redirect: "/dashboard",
			},
			// Dashboard — landing page
			{
				path: "dashboard",
				name: "Dashboard",
				component: () => import("@/views/dashboard/DashboardPage.vue"),
			},
			// Capacity Planning
			{
				path: "capacity-planning",
				name: "CapacityPlanning",
				component: () => import("@/views/capacity/CapacityPlanningPage.vue"),
			},
			// Settings — single doctype
			{
				path: "settings",
				name: "Settings",
				component: () => import("@/views/forms/SettingsForm.vue"),
			},
			// Currency Exchange — single doctype
			{
				path: "currency-exchange",
				name: "CurrencyExchange",
				component: () => import("@/views/forms/CurrencyExchangeForm.vue"),
			},

			// ── Explicit form routes (per-doctype) ──────────────────
			// Machine
			{ path: "machines/new", component: () => import("@/views/forms/MachineForm.vue") },
			{ path: "machines/:id", component: () => import("@/views/forms/MachineForm.vue"), props: true },
			// Machine Frame
			{ path: "machine-frame/new", component: () => import("@/views/forms/MachineFrameForm.vue") },
			{ path: "machine-frame/:id", component: () => import("@/views/forms/MachineFrameForm.vue"), props: true },
			// Process
			{ path: "processes/new", component: () => import("@/views/forms/ProcessForm.vue") },
			{ path: "processes/:id", component: () => import("@/views/forms/ProcessForm.vue"), props: true },
			// Shift
			{ path: "shifts/new", component: () => import("@/views/forms/ShiftForm.vue") },
			{ path: "shifts/:id", component: () => import("@/views/forms/ShiftForm.vue"), props: true },
			// Shift Allocation
			{ path: "shift-allocations/new", component: () => import("@/views/forms/ShiftAllocationForm.vue") },
			{ path: "shift-allocations/:id", component: () => import("@/views/forms/ShiftAllocationForm.vue"), props: true },
			// Style
			{ path: "styles/new", component: () => import("@/views/forms/StyleForm.vue") },
			{ path: "styles/:id", component: () => import("@/views/forms/StyleForm.vue"), props: true },
			// Colour
			{ path: "colours/new", component: () => import("@/views/forms/ColourForm.vue") },
			{ path: "colours/:id", component: () => import("@/views/forms/ColourForm.vue"), props: true },
			// Colour No
			{ path: "colour-nos/new", component: () => import("@/views/forms/ColourNoForm.vue") },
			{ path: "colour-nos/:id", component: () => import("@/views/forms/ColourNoForm.vue"), props: true },
			// Size
			{ path: "sizes/new", component: () => import("@/views/forms/SizeForm.vue") },
			{ path: "sizes/:id", component: () => import("@/views/forms/SizeForm.vue"), props: true },
			// Size Range
			{ path: "size-ranges/new", component: () => import("@/views/forms/SizeRangeForm.vue") },
			{ path: "size-ranges/:id", component: () => import("@/views/forms/SizeRangeForm.vue"), props: true },
			// Knitter
			{ path: "knitters/new", component: () => import("@/views/forms/KnitterForm.vue") },
			{ path: "knitters/:id", component: () => import("@/views/forms/KnitterForm.vue"), props: true },
			// Product Developer
			{ path: "product-developers/new", component: () => import("@/views/forms/ProductDeveloperForm.vue") },
			{ path: "product-developers/:id", component: () => import("@/views/forms/ProductDeveloperForm.vue"), props: true },
			// Client Season
			{ path: "client-seasons/new", component: () => import("@/views/forms/ClientSeasonForm.vue") },
			{ path: "client-seasons/:id", component: () => import("@/views/forms/ClientSeasonForm.vue"), props: true },
			// Client
			{ path: "clients/new", component: () => import("@/views/forms/ClientForm.vue") },
			{ path: "clients/:id", component: () => import("@/views/forms/ClientForm.vue"), props: true },
			// Order
			{ path: "orders/new", component: () => import("@/views/forms/OrderForm.vue") },
			{ path: "orders/:id", component: () => import("@/views/forms/OrderForm.vue"), props: true },
			// Order Tracking — dedicated list
			{ path: "order-tracking", component: () => import("@/views/order-tracking/OrderTrackingListPage.vue") },
			// Order Tracking — form
			{ path: "order-tracking/new", component: () => import("@/views/forms/OrderTrackingForm.vue") },
			{ path: "order-tracking/:id", component: () => import("@/views/forms/OrderTrackingForm.vue"), props: true },
			// User
			{ path: "users", component: () => import("@/views/users/UserListPage.vue") },
			{ path: "users/new", component: () => import("@/views/users/UserForm.vue") },
			{ path: "users/:id", component: () => import("@/views/users/UserForm.vue"), props: true },

			// User Listview
			{ path: "user-listviews/new", component: () => import("@/views/forms/UserListviewForm.vue") },
			{ path: "user-listviews/:id", component: () => import("@/views/forms/UserListviewForm.vue"), props: true },

			// ── Reports ────────────────────────────────────────────
			{ path: "production-report", name: "ProductionReport", component: () => import("@/views/reports/ProductionReportPage.vue") },
			{ path: "machine-availability", name: "MachineAvailability", component: () => import("@/views/reports/MachineAvailabilityPage.vue") },

			// ── Dynamic list (catch-all) ────────────────────────────
			{
				path: ":docRoute",
				name: "DynamicList",
				component: () => import("@/views/dynamic/DynamicListPage.vue"),
				props: true,
			},
		],
	},
]

const router = createRouter({
	history: createWebHistory("/web"),
	routes,
})

// Auth guard
router.beforeEach(async (to) => {
	const boot = window.frappe?.boot
	if (boot && boot.user === "Guest") {
		window.location.href = `/login?redirect-to=${encodeURIComponent("/web" + to.fullPath)}`
		return false
	}
})

export default router
