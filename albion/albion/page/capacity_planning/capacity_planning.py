# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from datetime import datetime, timedelta


@frappe.whitelist()
def get_order_data(order_name):
    """Fetch order data with item details including process minutes"""
    order = frappe.get_doc("Order", order_name)

    # Get order details
    order_details = []
    if order.order_details:
        for detail in order.order_details:
            order_details.append({
                "item": detail.item,
                "colour": detail.colour,
                "size": detail.size,
                "quantity": detail.quantity
            })

    # Get items with their process details
    items = []
    if order.items:
        for item in order.items:
            item_doc = frappe.get_doc("Item", item.item)
            processes = []
            if item_doc.processes:
                for proc in item_doc.processes:
                    processes.append({
                        "process_name": proc.process_name,
                        "minutes": proc.minutes
                    })

            items.append({
                "item": item.item,
                "item_name": item_doc.item_name,
                "item_doc": {
                    "item_code": item_doc.item_code,
                    "item_name": item_doc.item_name,
                    "processes": processes
                }
            })

    return {
        "name": order.name,
        "order_date": order.order_date,
        "delivery_date": order.delivery_date,
        "docstatus": order.docstatus,
        "items": items,
        "order_details": order_details
    }


@frappe.whitelist()
def get_shift_calendars(start_date, end_date):
    """Get shift calendars for date range and default shift"""
    calendars = frappe.get_all(
        "Shift Calendar",
        filters={
            "start_date": ["<=", end_date],
            "end_date": [">=", start_date]
        },
        fields=["name", "start_date", "end_date", "shift"]
    )

    # Get full shift details
    for cal in calendars:
        shift = frappe.get_doc("Shift", cal.shift)
        cal.shift = {
            "name": shift.name,
            "shift_name": shift.shift_name,
            "start_time": str(shift.start_time) if shift.start_time else None,
            "end_time": str(shift.end_time) if shift.end_time else None,
            "duration_minutes": shift.duration_minutes or 480
        }

    # Get default shift from settings
    default_shift = None
    settings = frappe.get_doc("Albion Settings")
    if settings.default_shift:
        shift = frappe.get_doc("Shift", settings.default_shift)
        default_shift = {
            "name": shift.name,
            "shift_name": shift.shift_name,
            "start_time": str(shift.start_time) if shift.start_time else None,
            "end_time": str(shift.end_time) if shift.end_time else None,
            "duration_minutes": shift.duration_minutes or 480
        }

    return {
        "calendars": calendars,
        "default_shift": default_shift
    }


@frappe.whitelist()
def get_existing_allocations(order, process):
    """Get existing machine allocations for order and process"""
    logs = frappe.get_all(
        "Machine Operation",
        filters={
            "order": order,
            "process_name": process
        },
        fields=[
            "name", "machine", "operation_date", "shift",
            "item", "colour", "size", "quantity", "allocated_minutes"
        ],
        order_by="creation"
    )

    allocations = []
    for log in logs:
        machine = frappe.get_doc("Machine", log.machine)
        allocations.append({
            "name": log.name,
            "machine_id": machine.machine_id,
            "operation_date": str(log.operation_date),
            "shift": log.shift,
            "order": log.order,
            "item": log.item,
            "process": process,
            "colour": log.colour,
            "size": log.size,
            "quantity": log.quantity,
            "allocated_minutes": log.allocated_minutes
        })

    return allocations


@frappe.whitelist()
def get_all_allocations(start_date, end_date):
    """Get all machine allocations for date range"""
    logs = frappe.get_all(
        "Machine Operation",
        filters={
            "operation_date": ["between", [start_date, end_date]]
        },
        fields=[
            "name", "machine", "operation_date", "shift", "process_name",
            "item", "colour", "size", "quantity", "allocated_minutes", "order"
        ]
    )

    allocations = []
    for log in logs:
        machine = frappe.get_doc("Machine", log.machine)
        allocations.append({
            "name": log.name,
            "machine_id": machine.machine_id,
            "operation_date": str(log.operation_date),
            "shift": log.shift,
            "order": log.order,
            "item": log.item,
            "process": log.process_name,
            "colour": log.colour,
            "size": log.size,
            "quantity": log.quantity,
            "allocated_minutes": log.allocated_minutes
        })

    return allocations


@frappe.whitelist()
def save_allocations(allocations):
    """Save capacity allocations to Machine Operation"""
    if isinstance(allocations, str):
        import json
        allocations = json.loads(allocations)

    saved = []
    errors = []

    for alloc in allocations:
        try:
            # Find machine by machine_id
            machine = frappe.get_all(
                "Machine",
                filters={"machine_id": alloc.get("machine_id")},
                fields=["name"],
                limit=1
            )

            if not machine:
                errors.append(f"Machine not found: {alloc.get('machine_id')}")
                continue

            machine_name = machine[0].name

            # Check if this is an existing record by name
            existing_name = alloc.get("name")
            if existing_name and frappe.db.exists("Machine Operation", existing_name):
                # Update existing record
                log = frappe.get_doc("Machine Operation", existing_name)
                log.machine = machine_name
                log.order = alloc.get("order")
                log.item = alloc.get("item")
                log.process_name = alloc.get("process")
                log.colour = alloc.get("colour")
                log.size = alloc.get("size")
                log.quantity = alloc.get("quantity")
                log.operation_date = alloc.get("operation_date")
                log.shift = alloc.get("shift")
                log.allocated_minutes = alloc.get("allocated_minutes")
                log.operator = frappe.session.user
                log.save(ignore_permissions=True)
                saved.append(log.name)
            else:
                # Check for existing record by unique key to prevent duplicates
                existing = frappe.db.get_value(
                    "Machine Operation",
                    {
                        "machine": machine_name,
                        "order": alloc.get("order"),
                        "item": alloc.get("item"),
                        "process_name": alloc.get("process"),
                        "colour": alloc.get("colour"),
                        "size": alloc.get("size"),
                        "operation_date": alloc.get("operation_date"),
                    },
                    "name",
                )

                if existing:
                    # Update existing record instead of creating a duplicate
                    log = frappe.get_doc("Machine Operation", existing)
                    log.machine = machine_name
                    log.order = alloc.get("order")
                    log.item = alloc.get("item")
                    log.process_name = alloc.get("process")
                    log.colour = alloc.get("colour")
                    log.size = alloc.get("size")
                    log.quantity = alloc.get("quantity")
                    log.operation_date = alloc.get("operation_date")
                    log.shift = alloc.get("shift")
                    log.allocated_minutes = alloc.get("allocated_minutes")
                    log.operator = frappe.session.user
                    log.save(ignore_permissions=True)
                    saved.append(log.name)
                else:
                    # Create new Machine Operation
                    log = frappe.new_doc("Machine Operation")
                    log.machine = machine_name
                    log.order = alloc.get("order")
                    log.item = alloc.get("item")
                    log.process_name = alloc.get("process")
                    log.colour = alloc.get("colour")
                    log.size = alloc.get("size")
                    log.quantity = alloc.get("quantity")
                    log.operation_date = alloc.get("operation_date")
                    log.shift = alloc.get("shift")
                    log.allocated_minutes = alloc.get("allocated_minutes")
                    log.operator = frappe.session.user
                    log.insert(ignore_permissions=True)
                    saved.append(log.name)

        except Exception as e:
            errors.append(str(e))

    if errors:
        frappe.log_error(title="Capacity Planning Save Errors", message="\n".join(errors))
        frappe.throw(_("Some allocations failed to save. Check error log."))

    return saved


@frappe.whitelist()
def delete_allocation(allocation_name):
    """Delete a machine operation allocation"""
    try:
        # Find and delete the Machine Operation record
        # allocation_name could be the actual name or format like "existing-0"
        # We need to find by matching fields since we don't store the actual name in frontend
        
        # Get all matching records for the date range and delete the specific one
        # Since we don't have the exact name, we'll delete based on matching criteria
        
        # Actually, let's look up by actual name if it exists
        if frappe.db.exists("Machine Operation", allocation_name):
            frappe.delete_doc("Machine Operation", allocation_name, ignore_permissions=True)
            return {"success": True, "message": "Allocation deleted"}
        
        return {"success": False, "message": "Allocation not found"}
    except Exception as e:
        frappe.log_error(title="Delete Allocation Error", message=str(e))
        return {"success": False, "message": str(e)}


@frappe.whitelist()
def get_machines():
    """Get all active machines"""
    machines = frappe.get_all(
        "Machine",
        fields=["machine_id", "machine_name"],
        order_by="machine_id"
    )
    return machines


@frappe.whitelist()
def get_processes():
    """Get all processes"""
    processes = frappe.get_all(
        "Process",
        fields=["name", "process_name"],
        order_by="process_name"
    )
    return processes


@frappe.whitelist()
def get_orders():
    """Get submitted orders"""
    orders = frappe.get_all(
        "Order",
        filters={"docstatus": 1},
        fields=["name", "order_date", "delivery_date", "docstatus"],
        order_by="creation desc"
    )
    return orders
