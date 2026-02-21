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
}

SKIP_FIELDNAMES = {"amended_from"}


class AlbionFrontendDoctype(Document):
	def validate(self):
		self.populate_fields_from_doctype()
		meta = frappe.get_meta(self.doctype_name)
		self.is_submittable = 1 if meta.is_submittable else 0

	def populate_fields_from_doctype(self):
		# Build lookup of existing user-editable checkbox states
		existing = {}
		for row in self.fields:
			existing[row.fieldname] = {
				"show_in_list": row.show_in_list,
				"show_in_form": row.show_in_form,
			}

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
				"options": df.options or "",
				"reqd": 1 if df.reqd else 0,
				"read_only": 1 if df.read_only else 0,
				"hidden": 1 if df.hidden else 0,
				"show_in_list": prev["show_in_list"] if prev else (1 if df.in_list_view else 0),
				"show_in_form": prev["show_in_form"] if prev else 1,
			})


@frappe.whitelist()
def get_frontend_config():
	"""Returns all frontend doctype config records with their field arrays."""
	configs = frappe.get_all(
		"Albion Frontend Doctype",
		fields=["name", "doctype_name", "label", "icon", "route_path", "sort_order", "is_submittable"],
		order_by="sort_order asc, label asc",
	)

	for cfg in configs:
		cfg["fields"] = frappe.get_all(
			"Albion Frontend Doctype Field",
			filters={"parent": cfg["name"]},
			fields=[
				"fieldname", "fieldtype", "label", "options",
				"reqd", "read_only", "hidden",
				"show_in_list", "show_in_form",
			],
			order_by="idx asc",
		)

	return configs


@frappe.whitelist()
def get_doctype_meta(doctype):
	"""Returns field definitions and flags for a DocType using frappe.get_meta().
	Used as a fallback when no Albion Frontend Doctype config exists."""
	meta = frappe.get_meta(doctype)
	fields = []
	for df in meta.fields:
		if df.fieldtype in SKIP_FIELDTYPES:
			continue
		if df.fieldname in SKIP_FIELDNAMES:
			continue
		fields.append({
			"fieldname": df.fieldname,
			"fieldtype": df.fieldtype,
			"label": df.label or df.fieldname,
			"options": df.options or "",
			"reqd": 1 if df.reqd else 0,
			"read_only": 1 if df.read_only else 0,
			"hidden": 1 if df.hidden else 0,
			"show_in_list": 1 if df.in_list_view else 0,
			"show_in_form": 1,
		})
	return {
		"fields": fields,
		"is_submittable": 1 if meta.is_submittable else 0,
		"issingle": 1 if meta.issingle else 0,
	}


@frappe.whitelist()
def get_child_table_meta(doctype):
	"""Returns field definitions for a child table doctype."""
	meta = frappe.get_meta(doctype)
	fields = []
	for df in meta.fields:
		if df.fieldtype in SKIP_FIELDTYPES:
			continue
		if df.fieldname in SKIP_FIELDNAMES:
			continue
		fields.append({
			"fieldname": df.fieldname,
			"fieldtype": df.fieldtype,
			"label": df.label or df.fieldname,
			"options": df.options or "",
			"reqd": 1 if df.reqd else 0,
			"read_only": 1 if df.read_only else 0,
			"hidden": 1 if df.hidden else 0,
			"in_list_view": 1 if df.in_list_view else 0,
		})
	return fields
