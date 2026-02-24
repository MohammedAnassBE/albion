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

	def before_cancel(self):
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