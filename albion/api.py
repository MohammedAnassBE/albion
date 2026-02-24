import frappe
from datetime import date, timedelta


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

	# ── Weekly stats (Mon–Sun) ──
	today = date.today()
	week_start = today - timedelta(days=today.weekday())
	week_end = week_start + timedelta(days=6)

	production_qty = frappe.db.sql("""
		SELECT COALESCE(SUM(quantity), 0)
		FROM `tabMachine Operation`
		WHERE operation_date BETWEEN %s AND %s
	""", (week_start, week_end))[0][0]

	# Average utilisation %
	from albion.albion.api.reports import get_machine_availability
	try:
		avail_data = get_machine_availability(str(week_start), str(week_end))
		total_cap = total_used = 0
		for mid, dates in avail_data["availability"].items():
			for d, v in dates.items():
				total_cap += v["capacity"]
				total_used += v["used"]
		avg_utilisation = round(total_used / total_cap * 100, 1) if total_cap > 0 else 0
	except Exception:
		avg_utilisation = 0

	return {
		"active_orders": active_orders,
		"total_items": total_items,
		"total_machines": total_machines,
		"total_customers": total_customers,
		"recent_orders": recent_orders,
		"production_qty": production_qty,
		"avg_utilisation": avg_utilisation,
	}
