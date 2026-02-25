# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class OrderTracking(Document):
	def before_validate(self):
		order_status = frappe.db.get_value("Order", self.order, "status")
		if order_status == "Closed":
			frappe.throw("Cannot create Order Tracking for a Closed Order. Please reopen the Order first.")
		mo_list = frappe.get_all("Machine Operation", filters={
			"order": self.order
		}, pluck="name")
		if not mo_list:
			frappe.throw("Order not allocated in Capacity Planning")
		self.user = frappe.session.user
