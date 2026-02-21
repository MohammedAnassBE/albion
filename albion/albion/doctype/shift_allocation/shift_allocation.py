# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, get_time


class ShiftAllocation(Document):
    def validate(self):
        self.validate_dates()
        self.validate_is_default_unique()
        self.validate_machine_field()
        self.validate_no_alterations_on_machine_calendar()
        self.validate_machine_overlap()
        self.validate_alteration_dates()
        self.validate_shift_overlaps()
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

    def validate_machine_field(self):
        if self.is_default and self.machine:
            frappe.throw(_("Default calendar cannot have a machine assigned. Remove the machine or uncheck Is Default."))

    def validate_no_alterations_on_machine_calendar(self):
        if self.machine and self.alterations:
            frappe.throw(_("Machine-specific calendars cannot have alterations. Alterations belong on general calendars."))

    def validate_machine_overlap(self):
        if not self.machine or not self.start_date or not self.end_date:
            return
        overlap = frappe.db.get_value(
            "Shift Allocation",
            {
                "machine": self.machine,
                "start_date": ["<=", self.end_date],
                "end_date": [">=", self.start_date],
                "name": ["!=", self.name],
                "is_default": 0
            },
            "name"
        )
        if overlap:
            frappe.throw(
                _("Shift Allocation {0} already covers this machine ({1}) in the same date range.").format(
                    overlap, self.machine
                )
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

    def validate_shift_overlaps(self):
        if not self.shifts or len(self.shifts) < 2:
            return

        shift_times = []
        for row in self.shifts:
            start_time, end_time = frappe.db.get_value(
                "Shift", row.shift, ["start_time", "end_time"]
            )
            shift_times.append({
                "idx": row.idx,
                "shift": row.shift,
                "start": get_time(start_time),
                "end": get_time(end_time),
            })

        for i in range(len(shift_times)):
            for j in range(i + 1, len(shift_times)):
                a = shift_times[i]
                b = shift_times[j]
                if a["start"] < b["end"] and b["start"] < a["end"]:
                    frappe.throw(
                        _("Shift {0} (Row {1}) overlaps with Shift {2} (Row {3})").format(
                            a["shift"], a["idx"], b["shift"], b["idx"]
                        )
                    )

    def calculate_total_duration(self):
        total = 0
        for row in self.shifts or []:
            total += row.duration_minutes or 0
        self.total_duration_minutes = total
