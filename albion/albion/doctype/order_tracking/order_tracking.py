# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class OrderTracking(Document):
	def before_validate(self):
		mo_list = frappe.get_all("Machine Operation", filters={
			"order": self.order
		}, pluck="name")
		if not mo_list:
			frappe.throw("Order not allocated in Capacity Planning")
		self.user = frappe.session.user
