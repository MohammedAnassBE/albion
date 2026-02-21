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
			// Capacity Planning — explicit route before catch-all
			{
				path: "capacity-planning",
				name: "CapacityPlanning",
				component: () => import("@/views/capacity/CapacityPlanningPage.vue"),
			},
			// Settings — single doctype, loads form directly
			{
				path: "settings",
				name: "Settings",
				component: () => import("@/views/dynamic/DynamicFormPage.vue"),
				props: { docRoute: "settings", id: "Albion Settings" },
			},
			// Dynamic routes
			{
				path: ":docRoute",
				name: "DynamicList",
				component: () => import("@/views/dynamic/DynamicListPage.vue"),
				props: true,
			},
			{
				path: ":docRoute/new",
				name: "DynamicFormNew",
				component: () => import("@/views/dynamic/DynamicFormPage.vue"),
				props: true,
			},
			{
				path: ":docRoute/:id",
				name: "DynamicForm",
				component: () => import("@/views/dynamic/DynamicFormPage.vue"),
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
