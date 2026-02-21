import frappe
from frappe.utils import today, add_months, add_days, getdate, get_first_day_of_week


@frappe.whitelist()
def get_dashboard_stats():
	"""Return summary counts and trend data for the frontend dashboard."""
	now = getdate(today())

	# ── Active Orders (docstatus = 1) ──
	active_orders = frappe.db.count("Order", {"docstatus": 1})

	# Orders created this month vs last month
	month_start = now.replace(day=1)
	last_month_start = getdate(add_months(month_start, -1))
	orders_this_month = frappe.db.count(
		"Order", {"creation": [">=", month_start]}
	)
	orders_last_month = frappe.db.count(
		"Order",
		[
			["creation", ">=", last_month_start],
			["creation", "<", month_start],
		],
	)
	if orders_last_month:
		order_pct = round(((orders_this_month - orders_last_month) / orders_last_month) * 100)
	else:
		order_pct = 100 if orders_this_month else 0

	# ── Items ──
	total_items = frappe.db.count("Item")
	month_start_str = str(month_start)
	new_items = frappe.db.count("Item", {"creation": [">=", month_start_str]})

	# ── Machines ──
	total_machines = frappe.db.count("Machine")

	# ── This week's allocations (Machine Operation) ──
	week_start = get_first_day_of_week(now)
	week_end = add_days(week_start, 6)
	last_week_start = add_days(week_start, -7)
	last_week_end = add_days(week_start, -1)

	allocs_this_week = frappe.db.count(
		"Machine Operation",
		[
			["day", ">=", str(week_start)],
			["day", "<=", str(week_end)],
		],
	) if frappe.db.has_column("Machine Operation", "day") else frappe.db.count("Machine Operation")

	allocs_last_week = 0
	if frappe.db.has_column("Machine Operation", "day"):
		allocs_last_week = frappe.db.count(
			"Machine Operation",
			[
				["day", ">=", str(last_week_start)],
				["day", "<=", str(last_week_end)],
			],
		)

	if allocs_last_week:
		alloc_pct = round(((allocs_this_week - allocs_last_week) / allocs_last_week) * 100)
	else:
		alloc_pct = 0

	# ── Recent orders ──
	recent_orders = frappe.get_all(
		"Order",
		fields=["name", "customer", "order_date", "docstatus"],
		order_by="creation desc",
		limit_page_length=8,
	)

	return {
		"active_orders": active_orders,
		"order_pct": order_pct,
		"orders_this_month": orders_this_month,
		"total_items": total_items,
		"new_items": new_items,
		"total_machines": total_machines,
		"allocs_this_week": allocs_this_week,
		"alloc_pct": alloc_pct,
		"recent_orders": recent_orders,
	}
