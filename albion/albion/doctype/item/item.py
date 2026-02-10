# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Item(Document):
    def validate(self):
        if self.size_range:
            self.fetch_sizes_from_range()

    def fetch_sizes_from_range(self):
        if self.size_range:
            size_range_doc = frappe.get_doc("Size Range", self.size_range)
            self.sizes = []
            for size_row in size_range_doc.sizes:
                self.append("sizes", {
                    "size": size_row.size
                })

@frappe.whitelist()
def get_attribute_values(doctype, txt, searchfield, start, page_len, filters):
    if filters and filters.get('attribute'):
        return frappe.get_all(
            'Attribute Value',
            filters={'attribute': filters['attribute']},
            fields=['name'],
            as_list=True
        )
    return []