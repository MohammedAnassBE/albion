import json

import frappe
from frappe.model.document import Document


SKIP_FIELDTYPES = {
	"Section Break",
	"Column Break",
	"Tab Break",
	"HTML",
	"Fold",
	"Heading",
	"HTML Editor",
	"Long Text",
	"Small Text",
	"Text",
	"Table",
	"Text Editor",
}

SKIP_FIELDNAMES = {"amended_from"}


class UserListview(Document):
	def validate(self):
		if frappe.session.user != "Administrator" and self.user != frappe.session.user:
			frappe.throw("You can only configure your own listview preferences.")
		self.populate_fields_from_doctype()

	def populate_fields_from_doctype(self):
		# Build lookup of existing user-editable checkbox states
		existing = {}
		for row in self.fields:
			existing[row.fieldname] = row.enabled

		meta = frappe.get_meta(self.doctype_name)

		# Clear and re-populate
		self.fields = []
		for df in meta.fields:
			if df.fieldtype in SKIP_FIELDTYPES:
				continue
			if df.fieldname in SKIP_FIELDNAMES:
				continue

			prev = existing.get(df.fieldname)
			self.append("fields", {
				"fieldname": df.fieldname,
				"fieldtype": df.fieldtype,
				"label": df.label or df.fieldname,
				"enabled": prev if prev is not None else (1 if df.in_list_view else 0),
			})


@frappe.whitelist()
def get_user_listview(doctype_name):
	"""Returns current user's field list with enabled flags, or None if no config exists."""
	user = frappe.session.user
	name = frappe.db.get_value(
		"User Listview",
		{"user": user, "doctype_name": doctype_name},
		"name",
	)
	if not name:
		return None

	fields = frappe.get_all(
		"User Listview Field",
		filters={"parent": name},
		fields=["fieldname", "fieldtype", "label", "enabled"],
		order_by="idx asc",
	)
	return fields


@frappe.whitelist()
def save_user_listview(doctype_name, enabled_fields):
	"""Creates or updates User Listview for current user.
	enabled_fields is a JSON list of fieldnames to enable."""
	if isinstance(enabled_fields, str):
		enabled_fields = json.loads(enabled_fields)

	user = frappe.session.user
	enabled_set = set(enabled_fields)

	name = frappe.db.get_value(
		"User Listview",
		{"user": user, "doctype_name": doctype_name},
		"name",
	)

	if name:
		doc = frappe.get_doc("User Listview", name)
		for row in doc.fields:
			row.enabled = 1 if row.fieldname in enabled_set else 0
		doc.save(ignore_permissions=True)
	else:
		doc = frappe.new_doc("User Listview")
		doc.user = user
		doc.doctype_name = doctype_name
		# populate_fields_from_doctype runs on validate, so we just set enabled after
		doc.insert(ignore_permissions=True)
		# Now update enabled flags
		for row in doc.fields:
			row.enabled = 1 if row.fieldname in enabled_set else 0
		doc.save(ignore_permissions=True)

	frappe.db.commit()
	return "ok"
