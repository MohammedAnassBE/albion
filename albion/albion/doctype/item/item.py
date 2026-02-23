# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Item(Document):
    def validate(self):
        self.validate_process_minutes()
        if self.size_range:
            self.fetch_sizes_from_range()

    def validate_process_minutes(self):
        for row in self.processes or []:
            if not row.minutes:
                frappe.throw(f"Row {row.idx}: Minutes cannot be 0 for Process <b>{row.process_name}</b>.")

    def fetch_sizes_from_range(self):
        if self.size_range:
            size_range_doc = frappe.get_doc("Size Range", self.size_range)
            self.sizes = []
            for size_row in size_range_doc.sizes:
                self.append("sizes", {
                    "size": size_row.size
                })
