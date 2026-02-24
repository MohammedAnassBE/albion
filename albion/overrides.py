import frappe


def override_home_page():
	if (
		frappe.local.response.get("message") == "Logged In"
		and frappe.session.user != "Guest"
	):
		frappe.local.response["home_page"] = "/web"
