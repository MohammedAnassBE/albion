# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import random

import frappe
from frappe.model.document import Document
from frappe.utils import cint, getdate
import openpyxl


# Size mappings: SizeType → list of 12 size names (columns J-U)
SIZE_MAPS = {
	"X": ["2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24"],
	"Y": ["32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54"],
	"Z": ["OOS", "OS", "XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"],
}


class AlbionImport(Document):
	def on_submit(self):
		try:
			self.run_import()
		except Exception:
			frappe.db.rollback()
			self.db_set("status", "Error", update_modified=False)
			self.db_set("import_log", frappe.get_traceback(), update_modified=False)
			raise

	def run_import(self):
		file_url = self.import_file
		# Resolve file path from URL using Frappe's file handling
		if file_url.startswith("/private/files/"):
			file_path = frappe.get_site_path("private", "files", file_url.split("/private/files/", 1)[1])
		elif file_url.startswith("/files/"):
			file_path = frappe.get_site_path("public", "files", file_url.split("/files/", 1)[1])
		else:
			frappe.throw(f"Unsupported file path: {file_url}")

		import os
		if not os.path.exists(file_path):
			frappe.throw(f"File not found: {file_path}")

		wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
		ws = wb.active

		rows = list(ws.iter_rows(min_row=1, values_only=True))
		wb.close()

		if len(rows) < 5:
			frappe.throw("Excel file must have at least 5 rows (3 header + 1 column header + data)")

		# Parse size mappings from rows 1-3
		size_maps = self.parse_size_maps(rows[0:3])

		# Parse data rows (row 5 onwards, index 4+)
		data = self.parse_data_rows(rows[4:], size_maps)

		# Create masters and orders
		counts = self.create_all(data, size_maps)

		# Update status
		log_lines = []
		for doctype, stats in counts.items():
			log_lines.append(f"{doctype}: {stats['created']} created, {stats['existing']} existing")
		log_text = "\n".join(log_lines)

		self.db_set("status", "Completed", update_modified=False)
		self.db_set("import_log", log_text, update_modified=False)

	def parse_size_maps(self, header_rows):
		"""Parse rows 1-3 to build size mappings.
		Each row has SizeType in col I (index 8) and sizes in cols J-U (index 9-20).
		"""
		size_maps = {}
		for row in header_rows:
			if not row or len(row) < 9:
				continue
			size_type = str(row[8]).strip().upper() if row[8] else None
			if size_type and size_type in ("X", "Y", "Z"):
				sizes = []
				for col_idx in range(9, min(21, len(row))):
					val = row[col_idx]
					sizes.append(str(val).strip() if val is not None else "")
				# Pad to 12 if needed
				while len(sizes) < 12:
					sizes.append("")
				size_maps[size_type] = sizes

		# Fallback to hardcoded if Excel headers missing
		for key in ("X", "Y", "Z"):
			if key not in size_maps:
				size_maps[key] = SIZE_MAPS[key]

		return size_maps

	def parse_data_rows(self, data_rows, size_maps):
		"""Parse data rows into nested structure grouped by purchase_order."""
		orders = {}  # purchase_order -> order data

		for row_idx, row in enumerate(data_rows):
			if not row or len(row) < 9:
				continue

			# Skip empty rows
			order_date = row[0]
			client = str(row[1]).strip() if row[1] else None
			purchase_order = str(row[2]).strip() if row[2] else None
			item_code = str(row[3]).strip() if row[3] else None
			item_name = str(row[4]).strip() if row[4] else None
			machine = str(row[5]).strip() if row[5] else None
			machine_frame = str(row[6]).strip() if row[6] else None
			colour = str(row[7]).strip() if row[7] else None
			size_type = str(row[8]).strip().upper() if row[8] else None

			if not purchase_order or not item_code:
				continue

			# Parse delivery date (col W, index 22)
			delivery_date = row[22] if len(row) > 22 else None

			# Get size names for this row's size type
			sizes = size_maps.get(size_type, SIZE_MAPS.get("X", []))

			# Parse quantities from cols J-U (index 9-20)
			qty_by_size = {}
			for i in range(12):
				col_idx = 9 + i
				if col_idx < len(row) and row[col_idx]:
					qty = cint(row[col_idx])
					if qty > 0 and i < len(sizes) and sizes[i]:
						qty_by_size[sizes[i]] = qty

			if not qty_by_size:
				continue

			# Build nested structure
			if purchase_order not in orders:
				orders[purchase_order] = {
					"client": client,
					"order_date": order_date,
					"delivery_date": delivery_date,
					"items": {}
				}

			order = orders[purchase_order]
			# Update delivery_date if this row has one
			if delivery_date and not order.get("delivery_date"):
				order["delivery_date"] = delivery_date

			if item_code not in order["items"]:
				order["items"][item_code] = {
					"item_name": item_name,
					"machine": machine,
					"machine_frame": machine_frame,
					"size_type": size_type,
					"colours": {}
				}

			item_data = order["items"][item_code]
			if colour and colour not in item_data["colours"]:
				item_data["colours"][colour] = {}

			if colour:
				for size_name, qty in qty_by_size.items():
					item_data["colours"][colour][size_name] = qty

		return orders

	def create_all(self, data, size_maps):
		"""Create all masters and orders from parsed data."""
		counts = {
			"Client": {"created": 0, "existing": 0},
			"Machine Frame": {"created": 0, "existing": 0},
			"Machine": {"created": 0, "existing": 0},
			"Process": {"created": 0, "existing": 0},
			"Colour": {"created": 0, "existing": 0},
			"Size": {"created": 0, "existing": 0},
			"Size Range": {"created": 0, "existing": 0},
			"Style": {"created": 0, "existing": 0},
			"Order": {"created": 0, "existing": 0},
		}

		# Collect all unique masters across all orders
		all_clients = set()
		all_machine_frames = set()
		all_machines = {}  # machine_id -> {machine_name, machine_frame}
		all_colours = set()
		all_sizes = set()
		# style_code -> {style_name, machine_frame, colours: {colour: {size: qty}}}
		all_styles = {}

		for po, order_data in data.items():
			if order_data.get("client"):
				all_clients.add(order_data["client"])

			for item_code, item_data in order_data["items"].items():
				machine_frame = item_data.get("machine_frame")
				machine_name = item_data.get("machine")

				# Machine Frame — always create, including "-" as placeholder
				if machine_frame:
					frame_value = machine_frame.upper() if machine_frame != "-" else "-"
					all_machine_frames.add(frame_value)

					# Machine — skip when machine name is "-"
					if machine_name and machine_name != "-" and machine_frame != "-":
						machine_id = f"{machine_name}-{frame_value}"
						if machine_id not in all_machines:
							all_machines[machine_id] = {
								"machine_name": machine_name,
								"machine_frame": frame_value
							}

				# Collect style info
				if item_code not in all_styles:
					all_styles[item_code] = {
						"style_name": item_data.get("item_name"),
						"machine_frame": machine_frame.upper() if machine_frame and machine_frame != "-" else "-",
						"size_type": item_data.get("size_type"),
						"colours": {},
						"sizes": set()
					}

				for colour, size_qty in item_data.get("colours", {}).items():
					all_colours.add(colour)
					if colour not in all_styles[item_code]["colours"]:
						all_styles[item_code]["colours"][colour] = {}
					all_styles[item_code]["colours"][colour].update(size_qty)
					for size_name in size_qty:
						all_sizes.add(str(size_name))
						all_styles[item_code]["sizes"].add(str(size_name))

		# Step 2a: Create Clients
		for client_name in sorted(all_clients):
			self.get_or_create("Client", "client_name", client_name,
				{"client_name": client_name}, counts)

		# Step 2b: Create Machine Frames
		for frame_name in sorted(all_machine_frames):
			self.get_or_create("Machine Frame", "machine_frame_name", frame_name,
				{"machine_frame_name": frame_name}, counts)

		# Step 2c: Create Machines
		for machine_id, mdata in sorted(all_machines.items()):
			self.get_or_create("Machine", "machine_id", machine_id, {
				"machine_id": machine_id,
				"machine_name": mdata["machine_name"],
				"machine_frame": mdata["machine_frame"]
			}, counts)

		# Step 2d: Create Colours
		for colour_name in sorted(all_colours):
			self.get_or_create("Colour", "colour_name", colour_name,
				{"colour_name": colour_name}, counts)

		# Step 2e: Create Sizes
		for size_value in sorted(all_sizes):
			self.get_or_create("Size", "size_value", size_value,
				{"size_value": size_value}, counts)

		# Create "Knitting" process master
		self.get_or_create("Process", "process_name", "Knitting",
			{"process_name": "Knitting"}, counts)

		# Step 2f: Create Size Ranges and Styles
		for item_code, item_info in sorted(all_styles.items()):
			# Order sizes by their position in the size map (Excel column order)
			st = item_info.get("size_type", "X")
			size_order = size_maps.get(st, SIZE_MAPS.get(st, []))
			order_map = {s: i for i, s in enumerate(size_order)}
			sizes_list = sorted(item_info["sizes"], key=lambda s: order_map.get(s, 999))
			sr_name = f"SR-{item_code}"

			# Create or update Size Range
			if frappe.db.exists("Size Range", sr_name):
				counts["Size Range"]["existing"] += 1
				# Update sizes if needed
				sr_doc = frappe.get_doc("Size Range", sr_name)
				existing_sizes = {row.size for row in sr_doc.sizes}
				changed = False
				for s in sizes_list:
					if s not in existing_sizes:
						sr_doc.append("sizes", {"size": s})
						changed = True
				if changed:
					sr_doc.save(ignore_permissions=True)
			else:
				sr_doc = frappe.new_doc("Size Range")
				sr_doc.size_range_name = sr_name
				for s in sizes_list:
					sr_doc.append("sizes", {"size": s})
				sr_doc.insert(ignore_permissions=True)
				counts["Size Range"]["created"] += 1

			# Create or update Style
			colours_list = sorted(item_info["colours"].keys())
			machine_frame = item_info.get("machine_frame")

			if frappe.db.exists("Style", item_code):
				counts["Style"]["existing"] += 1
				style_doc = frappe.get_doc("Style", item_code)
				# Update colours if new ones found
				existing_colours = {row.colour for row in style_doc.colours}
				changed = False
				for c in colours_list:
					if c not in existing_colours:
						style_doc.append("colours", {"colour": c})
						changed = True
				if changed:
					style_doc.save(ignore_permissions=True)
			else:
				style_doc = frappe.new_doc("Style")
				style_doc.style_code = item_code
				style_doc.style_name = item_info.get("style_name") or item_code
				style_doc.machine_frame = machine_frame or "-"
				style_doc.size_range = sr_name
				for c in colours_list:
					style_doc.append("colours", {"colour": c})
				style_doc.append("processes", {
					"process_name": "Knitting",
					"minutes": random.randint(5, 14)
				})
				# sizes will be populated via validate -> fetch_sizes_from_range
				style_doc.insert(ignore_permissions=True)
				counts["Style"]["created"] += 1

		# Step 3: Create Orders
		for po, order_data in data.items():
			order_doc = frappe.new_doc("Order")
			order_doc.client = order_data.get("client")
			order_doc.purchase_order = po

			# Parse dates
			order_date = order_data.get("order_date")
			if order_date:
				order_doc.order_date = getdate(order_date)
			else:
				order_doc.order_date = getdate(frappe.utils.today())

			delivery_date = order_data.get("delivery_date")
			if delivery_date:
				order_doc.delivery_date = getdate(delivery_date)

			# Add styles and order details
			added_styles = set()
			for item_code, item_data in order_data["items"].items():
				if item_code not in added_styles:
					order_doc.append("styles", {"style": item_code})
					added_styles.add(item_code)

				for colour, size_qty in item_data.get("colours", {}).items():
					for size_name, qty in size_qty.items():
						if qty and qty > 0:
							order_doc.append("order_details", {
								"style": item_code,
								"colour": colour,
								"size": str(size_name),
								"quantity": qty
							})

			order_doc.insert(ignore_permissions=True)
			order_doc.submit()
			counts["Order"]["created"] += 1

		return counts

	def get_or_create(self, doctype, field, value, fields_dict, counts):
		"""Get existing document or create new one."""
		if frappe.db.exists(doctype, {field: value}):
			counts[doctype]["existing"] += 1
			return frappe.db.get_value(doctype, {field: value}, "name")
		else:
			doc = frappe.new_doc(doctype)
			for k, v in fields_dict.items():
				setattr(doc, k, v)
			doc.insert(ignore_permissions=True)
			counts[doctype]["created"] += 1
			return doc.name
