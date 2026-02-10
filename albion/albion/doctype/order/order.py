# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Order(Document):
    pass


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