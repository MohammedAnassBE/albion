# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate


class ShiftAllocation(Document):
    def validate(self):
        self.validate_dates()
        self.validate_is_default_unique()
        self.validate_alteration_dates()
        self.calculate_total_duration()

    def validate_dates(self):
        if self.end_date and self.start_date and getdate(self.end_date) < getdate(self.start_date):
            frappe.throw(_("End Date must be on or after Start Date"))

    def validate_is_default_unique(self):
        if self.is_default:
            existing = frappe.db.get_value(
                "Shift Allocation",
                {"is_default": 1, "name": ["!=", self.name]},
                "name"
            )
            if existing:
                frappe.throw(
                    _("Shift Allocation {0} is already set as default. Only one default calendar is allowed.").format(existing)
                )

    def validate_alteration_dates(self):
        start = getdate(self.start_date)
        end = getdate(self.end_date)
        for row in self.alterations or []:
            if row.date:
                alt_date = getdate(row.date)
                if alt_date < start or alt_date > end:
                    frappe.throw(
                        _("Alteration date {0} in row {1} must be within the calendar range ({2} to {3})").format(
                            row.date, row.idx, self.start_date, self.end_date
                        )
                    )

    def calculate_total_duration(self):
        total = 0
        for row in self.shifts or []:
            total += row.duration_minutes or 0
        self.total_duration_minutes = total
