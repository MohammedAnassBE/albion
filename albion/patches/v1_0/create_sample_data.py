import random
import frappe
from frappe.utils import today, add_days


def execute():
	"""Create sample/test data for Albion app development."""

	# --- Prerequisite: Colours (7) ---
	for colour in ["Red", "Blue", "Green", "Black", "White", "Navy", "Grey"]:
		if not frappe.db.exists("Colour", colour):
			frappe.get_doc({"doctype": "Colour", "colour_name": colour}).insert()

	# --- Prerequisite: Sizes (6) ---
	for size in ["S", "M", "L", "XL", "XXL", "3XL"]:
		if not frappe.db.exists("Size", size):
			frappe.get_doc({"doctype": "Size", "size_value": size}).insert()

	# --- Prerequisite: Size Ranges (2) ---
	size_ranges = {
		"S-XL": ["S", "M", "L", "XL"],
		"S-3XL": ["S", "M", "L", "XL", "XXL", "3XL"],
	}
	for sr_name, sizes in size_ranges.items():
		if not frappe.db.exists("Size Range", sr_name):
			frappe.get_doc({
				"doctype": "Size Range",
				"size_range_name": sr_name,
				"sizes": [{"size": s} for s in sizes],
			}).insert()

	# --- Prerequisite: Process (1) ---
	if not frappe.db.exists("Process", "Knitting"):
		frappe.get_doc({"doctype": "Process", "process_name": "Knitting"}).insert()

	# --- Clients (4) ---
	clients = ["Alpha Textiles", "Beta Garments", "Gamma Knitwear", "Delta Fashions"]
	for name in clients:
		if not frappe.db.exists("Client", {"client_name": name}):
			frappe.get_doc({"doctype": "Client", "client_name": name}).insert()

	# --- Machine Frame ---
	machine_frames = ["7GG", "12GG", "14GG"]
	for gg in machine_frames:
		if not frappe.db.exists("Machine Frame", gg):
			frappe.get_doc({"doctype": "Machine Frame", "machine_frame_name": gg}).insert()

	# --- Machines (10 distributed across 3 GGs) ---
	machines = [
		("M-001", "Flat Knit A", "7GG"),
		("M-002", "Flat Knit B", "7GG"),
		("M-003", "Flat Knit C", "7GG"),
		("M-004", "Circular A", "12GG"),
		("M-005", "Circular B", "12GG"),
		("M-006", "Circular C", "12GG"),
		("M-007", "Circular D", "12GG"),
		("M-008", "Fine Gauge A", "14GG"),
		("M-009", "Fine Gauge B", "14GG"),
		("M-010", "Fine Gauge C", "14GG"),
	]
	for machine_id, machine_name, gg in machines:
		if not frappe.db.exists("Machine", machine_id):
			frappe.get_doc({
				"doctype": "Machine",
				"machine_id": machine_id,
				"machine_name": machine_name,
				"machine_frame": gg,
			}).insert()

	# --- Styles (10) ---
	# Use existing colours, sizes, size ranges
	all_colours = frappe.get_all("Colour", pluck="name")
	all_sizes = frappe.get_all("Size", pluck="name")
	all_size_ranges = frappe.get_all("Size Range", pluck="name")

	styles_data = [
		("ITM-001", "V-Neck Pullover", "7GG"),
		("ITM-002", "Crew Neck Sweater", "7GG"),
		("ITM-003", "Cable Knit Cardigan", "12GG"),
		("ITM-004", "Turtleneck Top", "12GG"),
		("ITM-005", "Ribbed Vest", "14GG"),
		("ITM-006", "Polo Shirt", "14GG"),
		("ITM-007", "Henley Shirt", "7GG"),
		("ITM-008", "Zip-Up Hoodie", "12GG"),
		("ITM-009", "Quarter Zip Pullover", "14GG"),
		("ITM-010", "Sleeveless Tank", "7GG"),
	]

	created_styles = []
	for style_code, style_name, gg in styles_data:
		if frappe.db.exists("Style", style_code):
			created_styles.append(style_code)
			continue

		# Pick 2-4 random colours and 3-5 random sizes for each style
		style_colours = random.sample(all_colours, min(random.randint(2, 4), len(all_colours)))
		style_sizes = random.sample(all_sizes, min(random.randint(3, 5), len(all_sizes)))
		size_range = random.choice(all_size_ranges) if all_size_ranges else None

		doc = frappe.get_doc({
			"doctype": "Style",
			"style_code": style_code,
			"style_name": style_name,
			"machine_frame": gg,
			"size_range": size_range,
			"colours": [{"colour": c} for c in style_colours],
			"processes": [{"process_name": "Knitting", "minutes": random.choice([3, 4, 5, 6, 8, 10])}],
		})
		doc.insert()
		created_styles.append(style_code)

	# --- Orders (15) ---
	all_clients = frappe.get_all("Client", pluck="name")
	if not all_clients:
		frappe.throw("No clients found. Please create clients first.")

	base_date = today()

	for i in range(1, 16):
		# Check by naming pattern - orders are auto-named so check by count
		# Use a deterministic approach: check if we already have enough orders
		order_count = frappe.db.count("Order")
		if order_count >= 15:
			break

		client = random.choice(all_clients)
		order_date = add_days(base_date, -random.randint(0, 30))
		delivery_date = add_days(order_date, random.randint(14, 45))

		# Pick 1-3 random styles for this order
		num_styles = random.randint(1, 3)
		order_styles_list = random.sample(created_styles, min(num_styles, len(created_styles)))

		# Build order_details: for each style, get its colours and sizes, generate quantities
		order_details = []
		for style_code in order_styles_list:
			style_doc = frappe.get_doc("Style", style_code)
			style_colours = [row.colour for row in style_doc.colours]
			style_sizes = [row.size for row in style_doc.sizes]

			# Pick a subset of colours and sizes for this order
			pick_colours = random.sample(style_colours, min(random.randint(1, 3), len(style_colours)))
			pick_sizes = random.sample(style_sizes, min(random.randint(2, 4), len(style_sizes)))

			for colour in pick_colours:
				for size in pick_sizes:
					order_details.append({
						"style": style_code,
						"colour": colour,
						"size": size,
						"quantity": random.randint(10, 200),
					})

		order_doc = frappe.get_doc({
			"doctype": "Order",
			"client": client,
			"order_date": order_date,
			"delivery_date": delivery_date,
			"styles": [{"style": ic} for ic in order_styles_list],
			"order_details": order_details,
		})
		order_doc.insert()
		order_doc.submit()

	frappe.db.commit()
