# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Order(Document):
	def validate(self):
		self.validate_items()

	def before_submit(self):
		self.validate_order_details()

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