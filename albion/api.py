import frappe


@frappe.whitelist()
def get_dashboard_stats():
	"""Return summary counts for the frontend dashboard."""

	# ── Active Orders (docstatus = 1) ──
	active_orders = frappe.db.count("Order", {"docstatus": 1})

	# ── Items ──
	total_items = frappe.db.count("Item")

	# ── Machines ──
	total_machines = frappe.db.count("Machine")

	# ── Customers ──
	total_customers = frappe.db.count("Customer")

	# ── Recent orders ──
	recent_orders = frappe.get_all(
		"Order",
		fields=["name", "customer", "order_date", "docstatus"],
		order_by="creation desc",
		limit_page_length=8,
	)

	return {
		"active_orders": active_orders,
		"total_items": total_items,
		"total_machines": total_machines,
		"total_customers": total_customers,
		"recent_orders": recent_orders,
	}
