import frappe
from datetime import date, timedelta


@frappe.whitelist()
def get_dashboard_stats():
	"""Return summary counts for the frontend dashboard."""

	# ── Active Orders (docstatus = 1) ──
	active_orders = frappe.db.count("Order", {"docstatus": 1})

	# ── Styles ──
	total_styles = frappe.db.count("Style")

	# ── Machines ──
	total_machines = frappe.db.count("Machine")

	# ── Clients ──
	total_clients = frappe.db.count("Client")

	# ── Rolling 7-day range (today - 6 days → today) ──
	today = date.today()
	range_start = today - timedelta(days=6)
	range_end = today

	production_qty = frappe.db.sql("""
		SELECT COALESCE(SUM(quantity), 0)
		FROM `tabMachine Operation`
		WHERE operation_date BETWEEN %s AND %s
	""", (range_start, range_end))[0][0]

	# Machine availability & utilisation
	from albion.albion.api.reports import get_machine_availability
	avg_utilisation = 0
	machine_utilisation = []
	try:
		avail_data = get_machine_availability(str(range_start), str(range_end))

		# Build machine_frame lookup
		frame_map = {}
		for m in frappe.get_all("Machine", fields=["machine_id", "machine_frame"]):
			frame_map[m.machine_id] = m.machine_frame or ""

		total_cap = total_used = 0
		for mid, dates in avail_data["availability"].items():
			cap = sum(v["capacity"] for v in dates.values())
			used = sum(v["used"] for v in dates.values())
			total_cap += cap
			total_used += used
			pct = round(used / cap * 100, 1) if cap > 0 else 0
			machine_utilisation.append({
				"machine_id": mid,
				"machine_frame": frame_map.get(mid, ""),
				"capacity": cap,
				"used": used,
				"available": cap - used,
				"pct": pct,
			})

		machine_utilisation.sort(key=lambda m: m["pct"])
		avg_utilisation = round(total_used / total_cap * 100, 1) if total_cap > 0 else 0
	except Exception:
		avg_utilisation = 0

	return {
		"active_orders": active_orders,
		"total_styles": total_styles,
		"total_machines": total_machines,
		"total_clients": total_clients,
		"machine_utilisation": machine_utilisation,
		"production_qty": production_qty,
		"avg_utilisation": avg_utilisation,
	}
