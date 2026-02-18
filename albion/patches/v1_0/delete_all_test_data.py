import frappe

def execute():
    """Delete all test data from all Albion DocTypes."""

    # 0. Albion Import (submittable — cancel first, then delete)
    for name in frappe.get_all("Albion Import", pluck="name"):
        doc = frappe.get_doc("Albion Import", name)
        if doc.docstatus == 1:
            doc.cancel()
        frappe.delete_doc("Albion Import", name, force=True)

    # 1. Machine Operation (links to Order, Machine, Item)
    for name in frappe.get_all("Machine Operation", pluck="name"):
        frappe.delete_doc("Machine Operation", name, force=True)

    # 2. Order (submittable — cancel first, then delete)
    for name in frappe.get_all("Order", pluck="name"):
        doc = frappe.get_doc("Order", name)
        if doc.docstatus == 1:
            doc.cancel()
        frappe.delete_doc("Order", name, force=True)

    # 3. Shift Allocation (links to Shift)
    for name in frappe.get_all("Shift Allocation", pluck="name"):
        frappe.delete_doc("Shift Allocation", name, force=True)

    # 4. Machine (links to Machine GG)
    for name in frappe.get_all("Machine", pluck="name"):
        frappe.delete_doc("Machine", name, force=True)

    # 5. Item (links to Machine GG, Process, Colour, Size)
    for name in frappe.get_all("Item", pluck="name"):
        frappe.delete_doc("Item", name, force=True)

    # 6. Machine GG
    for name in frappe.get_all("Machine GG", pluck="name"):
        frappe.delete_doc("Machine GG", name, force=True)

    # 7. Customer
    for name in frappe.get_all("Customer", pluck="name"):
        frappe.delete_doc("Customer", name, force=True)

    # 8. Shift
    for name in frappe.get_all("Shift", pluck="name"):
        frappe.delete_doc("Shift", name, force=True)

    # 9. Process
    for name in frappe.get_all("Process", pluck="name"):
        frappe.delete_doc("Process", name, force=True)

    # 10. Colour
    for name in frappe.get_all("Colour", pluck="name"):
        frappe.delete_doc("Colour", name, force=True)

    # 11. Size
    for name in frappe.get_all("Size", pluck="name"):
        frappe.delete_doc("Size", name, force=True)

    # 12. Size Range (has child Size Range Detail)
    for name in frappe.get_all("Size Range", pluck="name"):
        frappe.delete_doc("Size Range", name, force=True)

    frappe.db.commit()
