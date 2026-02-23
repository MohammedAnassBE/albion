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

			// ── Explicit form routes (per-doctype) ──────────────────
			// Machine
			{ path: "machines/new", component: () => import("@/views/forms/MachineForm.vue") },
			{ path: "machines/:id", component: () => import("@/views/forms/MachineForm.vue"), props: true },
			// Machine GG
			{ path: "machine-gg/new", component: () => import("@/views/forms/MachineGGForm.vue") },
			{ path: "machine-gg/:id", component: () => import("@/views/forms/MachineGGForm.vue"), props: true },
			// Process
			{ path: "processes/new", component: () => import("@/views/forms/ProcessForm.vue") },
			{ path: "processes/:id", component: () => import("@/views/forms/ProcessForm.vue"), props: true },
			// Shift
			{ path: "shifts/new", component: () => import("@/views/forms/ShiftForm.vue") },
			{ path: "shifts/:id", component: () => import("@/views/forms/ShiftForm.vue"), props: true },
			// Shift Allocation
			{ path: "shift-allocations/new", component: () => import("@/views/forms/ShiftAllocationForm.vue") },
			{ path: "shift-allocations/:id", component: () => import("@/views/forms/ShiftAllocationForm.vue"), props: true },
			// Item
			{ path: "items/new", component: () => import("@/views/forms/ItemForm.vue") },
			{ path: "items/:id", component: () => import("@/views/forms/ItemForm.vue"), props: true },
			// Colour
			{ path: "colours/new", component: () => import("@/views/forms/ColourForm.vue") },
			{ path: "colours/:id", component: () => import("@/views/forms/ColourForm.vue"), props: true },
			// Size
			{ path: "sizes/new", component: () => import("@/views/forms/SizeForm.vue") },
			{ path: "sizes/:id", component: () => import("@/views/forms/SizeForm.vue"), props: true },
			// Size Range
			{ path: "size-ranges/new", component: () => import("@/views/forms/SizeRangeForm.vue") },
			{ path: "size-ranges/:id", component: () => import("@/views/forms/SizeRangeForm.vue"), props: true },
			// Customer
			{ path: "customers/new", component: () => import("@/views/forms/CustomerForm.vue") },
			{ path: "customers/:id", component: () => import("@/views/forms/CustomerForm.vue"), props: true },
			// Order
			{ path: "orders/new", component: () => import("@/views/forms/OrderForm.vue") },
			{ path: "orders/:id", component: () => import("@/views/forms/OrderForm.vue"), props: true },
			// User
			{ path: "users", component: () => import("@/views/users/UserListPage.vue") },
			{ path: "users/new", component: () => import("@/views/users/UserForm.vue") },
			{ path: "users/:id", component: () => import("@/views/users/UserForm.vue"), props: true },

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
