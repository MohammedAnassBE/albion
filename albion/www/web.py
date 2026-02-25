import json
import os
import glob

import frappe

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/web"
		raise frappe.Redirect

	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()
	context.csrf_token = csrf_token
	context.boot = get_boot()
	context.no_header = 1
	context.no_sidebar = 1
	context.no_navbar = 1

	# Resolve hashed frontend asset filenames
	js_file, css_file = _resolve_frontend_assets()
	context.frontend_js = js_file
	context.frontend_css = css_file


def _resolve_frontend_assets():
	assets_dir = os.path.join(
		os.path.dirname(__file__), "..", "public", "frontend", "assets"
	)
	assets_dir = os.path.realpath(assets_dir)

	js_file = "/assets/albion/frontend/assets/index.js"
	css_file = ""

	# Find hashed entry JS
	js_matches = glob.glob(os.path.join(assets_dir, "index-*.js"))
	if js_matches:
		js_file = "/assets/albion/frontend/assets/" + os.path.basename(js_matches[0])

	# Find hashed entry CSS
	css_matches = glob.glob(os.path.join(assets_dir, "index-*.css"))
	if css_matches:
		css_file = "/assets/albion/frontend/assets/" + os.path.basename(css_matches[0])

	return js_file, css_file


def get_boot():
	return {
		"site_name": frappe.local.site,
		"user": json.loads(frappe.as_json(frappe.get_user().load_user())),
	}


@frappe.whitelist()
def get_context_for_dev():
	context = frappe._dict()
	get_context(context)
	return context.boot
