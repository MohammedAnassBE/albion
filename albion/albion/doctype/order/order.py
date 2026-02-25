# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Order(Document):
	def validate(self):
		self.validate_items()
		self.total_quantity = sum((d.quantity or 0) for d in self.order_details or [])

	def before_submit(self):
		self.validate_order_details()
		self.validate_rate_and_delivery_date()
		self.populate_order_processes()
		self.status = "Open"

	def populate_order_processes(self):
		self.order_processes = []
		for row in self.items:
			item_doc = frappe.get_doc("Item", row.item)
			for proc in item_doc.processes or []:
				self.append("order_processes", {
					"item": row.item,
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

	def validate_items(self):
		if not self.items:
			frappe.throw("Please add at least one Item before saving.")

	def validate_order_details(self):
		items_in_details = set()
		for d in self.order_details or []:
			if d.quantity and d.quantity > 0:
				items_in_details.add(d.item)

		for row in self.items:
			if row.item not in items_in_details:
				frappe.throw(
					f"Please enter colour and size wise quantities for Item <b>{row.item}</b> in the Order Matrix."
				)

	def validate_rate_and_delivery_date(self):
		missing_rate = []
		missing_date = []
		seen = set()
		for d in self.order_details or []:
			if not d.quantity or d.quantity <= 0:
				continue
			key = (d.item, d.colour)
			if key in seen:
				continue
			seen.add(key)
			if not d.rate:
				missing_rate.append(f"{d.item} – {d.colour}")
			if not d.delivery_date:
				missing_date.append(f"{d.item} – {d.colour}")

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
    """Aggregated completed qty from Order Tracking, grouped by item+colour+size."""
    rows = frappe.get_all(
        "Order Tracking",
        filters={"order": order},
        fields=["item", "colour", "size", "sum(quantity) as completed_qty"],
        group_by="item, colour, size",
    )
    result = {}
    for r in rows:
        result.setdefault(r.item, {}).setdefault(r.colour or "", {})[r.size or ""] = r.completed_qty
    return result


@frappe.whitelist()
def get_item_details(item_code):
    """Fetch colours and sizes from Item master"""
    if not item_code:
        return {}
    
    item = frappe.get_doc("Item", item_code)
    
    colours = []
    sizes = []
    
    if item.colours:
        colours = [{"colour": c.colour} for c in item.colours]
    
    if item.sizes:
        sizes = [{"size": s.size} for s in item.sizes]
    
    return {
        "colours": colours,
        "sizes": sizes
    }