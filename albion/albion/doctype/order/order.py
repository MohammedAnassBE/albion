# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Order(Document):
	def validate(self):
		self.validate_styles()
		self.total_quantity = sum((d.quantity or 0) for d in self.order_details or [])

	def before_submit(self):
		self.validate_order_details()
		self.validate_rate_and_delivery_date()
		self.populate_order_processes()
		self.status = "Open"

	def populate_order_processes(self):
		self.order_processes = []
		for row in self.styles:
			style_doc = frappe.get_doc("Style", row.style)
			for proc in style_doc.processes or []:
				self.append("order_processes", {
					"style": row.style,
					"process_name": proc.process_name,
					"minutes": proc.minutes,
				})

	def before_cancel(self):
		if self.status == "Closed":
			frappe.throw("Cannot cancel a Closed Order. Please reopen it first.")
		self.validate_no_machine_operations()

	def validate_no_machine_operations(self):
		operations = frappe.get_all(
			"Machine Operation",
			filters={"order": self.name},
			fields=["name", "machine", "process_name", "operation_date"],
			limit=5,
		)
		if operations:
			op_list = ", ".join([op.name for op in operations])
			frappe.throw(
				f"Cannot cancel this Order because it has Machine Operation allocations: <b>{op_list}</b>."
				" Please remove the allocations from Capacity Planning first."
			)

	def validate_styles(self):
		if not self.styles:
			frappe.throw("Please add at least one Style before saving.")

	def validate_order_details(self):
		styles_in_details = set()
		for d in self.order_details or []:
			if d.quantity and d.quantity > 0:
				styles_in_details.add(d.style)

		for row in self.styles:
			if row.style not in styles_in_details:
				frappe.throw(
					f"Please enter colour and size wise quantities for Style <b>{row.style}</b> in the Order Matrix."
				)

	def validate_rate_and_delivery_date(self):
		missing_rate = []
		missing_date = []
		seen = set()
		for d in self.order_details or []:
			if not d.quantity or d.quantity <= 0:
				continue
			key = (d.style, d.colour)
			if key in seen:
				continue
			seen.add(key)
			if not d.rate:
				missing_rate.append(f"{d.style} – {d.colour}")
			if not d.delivery_date:
				missing_date.append(f"{d.style} – {d.colour}")

		msgs = []
		if missing_rate:
			msgs.append("Rate missing for: " + ", ".join(missing_rate))
		if missing_date:
			msgs.append("Delivery Date missing for: " + ", ".join(missing_date))
		if msgs:
			frappe.throw(". ".join(msgs), title="Order Matrix Incomplete")


@frappe.whitelist()
def close_order(order_name):
    doc = frappe.get_doc("Order", order_name)
    if doc.docstatus != 1:
        frappe.throw("Only submitted Orders can be closed.")
    if doc.status == "Closed":
        frappe.throw("Order is already closed.")
    doc.status = "Closed"
    doc.save()
    return doc.status


@frappe.whitelist()
def reopen_order(order_name):
    doc = frappe.get_doc("Order", order_name)
    if doc.docstatus != 1:
        frappe.throw("Only submitted Orders can be reopened.")
    if doc.status != "Closed":
        frappe.throw("Order is not closed.")
    doc.status = "Open"
    doc.save()
    return doc.status


@frappe.whitelist()
def get_order_completion(order):
    """Aggregated completed qty from Order Tracking, grouped by style+colour+size."""
    rows = frappe.get_all(
        "Order Tracking",
        filters={"order": order},
        fields=["style", "colour", "size", "sum(quantity) as completed_qty"],
        group_by="style, colour, size",
    )
    result = {}
    for r in rows:
        result.setdefault(r.style, {}).setdefault(r.colour or "", {})[r.size or ""] = r.completed_qty
    return result


@frappe.whitelist()
def get_style_details(style_code):
    """Fetch colours and sizes from Style master"""
    if not style_code:
        return {}

    style = frappe.get_doc("Style", style_code)

    colours = []
    sizes = []

    if style.colours:
        colours = [{"colour": c.colour, "colour_no": c.colour_no or "", "yarn_name": c.yarn_name or ""} for c in style.colours]

    if style.sizes:
        sizes = [{"size": s.size} for s in style.sizes]

    return {
        "colours": colours,
        "sizes": sizes
    }