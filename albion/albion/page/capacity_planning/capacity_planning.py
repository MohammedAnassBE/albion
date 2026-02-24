# Copyright (c) 2026, Essdee and contributors
# For license information, please see license.txt

import frappe
from frappe import _


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
                    "machine_gg": item_doc.machine_gg,
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
def get_shift_allocations(start_date, end_date):
    """Get shift allocations for date range and default allocation"""
    calendar_names = frappe.get_all(
        "Shift Allocation",
        filters={
            "start_date": ["<=", end_date],
            "end_date": [">=", start_date]
        },
        fields=["name"],
        order_by="start_date"
    )

    calendars = []
    for cal in calendar_names:
        calendars.append(_get_calendar_data(cal.name))

    # Get default calendar (always fetched regardless of date range)
    default_calendar = None
    default_name = frappe.db.get_value("Shift Allocation", {"is_default": 1}, "name")
    if default_name:
        # Check if already in list
        existing = next((c for c in calendars if c["name"] == default_name), None)
        if existing:
            default_calendar = existing
        else:
            default_calendar = _get_calendar_data(default_name)

    return {
        "calendars": calendars,
        "default_calendar": default_calendar
    }


def _get_calendar_data(calendar_name):
    """Get full calendar data including shifts and alterations"""
    doc = frappe.get_doc("Shift Allocation", calendar_name)

    shifts = []
    for row in doc.shifts or []:
        shifts.append({
            "shift": row.shift,
            "shift_name": row.shift_name,
            "duration_minutes": row.duration_minutes or 0
        })

    alterations = []
    for row in doc.alterations or []:
        alterations.append({
            "name": row.name,
            "parent": doc.name,
            "date": str(row.date),
            "alteration_type": row.alteration_type,
            "minutes": row.minutes,
            "machine": row.machine,
            "reason": row.reason
        })

    return {
        "name": doc.name,
        "start_date": str(doc.start_date),
        "end_date": str(doc.end_date),
        "is_default": doc.is_default,
        "machine": doc.machine or None,
        "total_duration_minutes": doc.total_duration_minutes or 0,
        "shifts": shifts,
        "alterations": alterations,
        "sunday": doc.sunday,
        "monday": doc.monday,
        "tuesday": doc.tuesday,
        "wednesday": doc.wednesday,
        "thursday": doc.thursday,
        "friday": doc.friday,
        "saturday": doc.saturday,
    }


def _get_best_calendar_for_date(date, machine=None):
    """Find the best Shift Allocation for a date, optionally for a specific machine.
    Priority:
      1. Machine-specific single-day (if machine)
      2. General single-day
      3. Machine-specific range (if machine)
      4. General range
      5. Default
    Returns (calendar_name, source) where source is 'single', 'range', or 'default'.
    """
    if machine:
        # 1. Machine-specific single-day
        machine_single = frappe.db.get_value(
            "Shift Allocation",
            {"start_date": date, "end_date": date, "is_default": 0, "machine": machine},
            "name"
        )
        if machine_single:
            return machine_single, "single"

    # 2. General single-day (no machine)
    general_single = frappe.db.get_value(
        "Shift Allocation",
        {"start_date": date, "end_date": date, "is_default": 0, "machine": ["is", "not set"]},
        "name"
    )
    if general_single:
        return general_single, "single"

    if machine:
        # 3. Machine-specific range
        machine_range = frappe.db.get_value(
            "Shift Allocation",
            {
                "start_date": ["<=", date],
                "end_date": [">=", date],
                "is_default": 0,
                "machine": machine
            },
            "name"
        )
        if machine_range:
            return machine_range, "range"

    # 4. General range (no machine)
    general_range = frappe.db.get_value(
        "Shift Allocation",
        {
            "start_date": ["<=", date],
            "end_date": [">=", date],
            "is_default": 0,
            "machine": ["is", "not set"]
        },
        "name"
    )
    if general_range:
        return general_range, "range"

    # 5. Default calendar
    default_name = frappe.db.get_value("Shift Allocation", {"is_default": 1}, "name")
    if default_name:
        return default_name, "default"

    return None, None


@frappe.whitelist()
def get_all_shifts():
    """Get all Shift records"""
    shifts = frappe.get_all(
        "Shift",
        fields=["name", "shift_name", "start_time", "end_time", "duration_minutes"],
        order_by="shift_name"
    )
    return shifts


@frappe.whitelist()
def update_date_shift(date, shifts, machine=None):
    """Update the shifts for a specific date by creating/updating a single-day calendar.
    shifts: JSON list of Shift record names, e.g. ["Morning Shift", "Evening Shift"]
    machine: optional Machine name for machine-specific calendar
    """
    import json
    if isinstance(shifts, str):
        shifts = json.loads(shifts)

    if not shifts:
        frappe.throw(_("Please select at least one shift"))

    # Normalize empty machine to None
    if not machine:
        machine = None

    cal_name, source = _get_best_calendar_for_date(date, machine)

    # Build shift rows and compute total minutes
    shift_rows = []
    total_minutes = 0
    for shift_name in shifts:
        shift_doc = frappe.get_doc("Shift", shift_name)
        shift_rows.append({
            "shift": shift_name,
            "shift_name": shift_doc.shift_name,
            "duration_minutes": shift_doc.duration_minutes
        })
        total_minutes += (shift_doc.duration_minutes or 0)

    # For old_minutes: resolve from the calendar this machine was previously using
    if machine:
        # What did this machine use before? Its own calendar or the general one?
        old_cal_name, _ = _get_best_calendar_for_date(date, machine)
        old_doc = frappe.get_doc("Shift Allocation", old_cal_name) if old_cal_name else None
        old_minutes = old_doc.total_duration_minutes if old_doc else 0
    else:
        old_minutes = 0  # will be set below per branch

    if source == "single" and cal_name:
        doc = frappe.get_doc("Shift Allocation", cal_name)
        # Only update if this calendar matches the same machine context
        is_same_machine = (doc.machine or None) == machine
        if is_same_machine:
            if not machine:
                old_minutes = doc.total_duration_minutes or 0
            doc.shifts = []
            for row in shift_rows:
                doc.append("shifts", row)
            doc.total_duration_minutes = total_minutes
            doc.save(ignore_permissions=True)
            return {"old_minutes": old_minutes, "new_minutes": doc.total_duration_minutes}

    # Create a new single-day calendar
    # For general calendars, get source from general resolution
    if machine:
        source_doc = None
        # Get the general calendar for working day flags
        gen_cal_name, _ = _get_best_calendar_for_date(date, None)
        if gen_cal_name:
            source_doc = frappe.get_doc("Shift Allocation", gen_cal_name)
    else:
        source_doc = frappe.get_doc("Shift Allocation", cal_name) if cal_name else None
        old_minutes = source_doc.total_duration_minutes if source_doc else 0

    new_cal = frappe.new_doc("Shift Allocation")
    new_cal.start_date = date
    new_cal.end_date = date
    new_cal.is_default = 0
    new_cal.machine = machine

    # Copy working day flags from source
    if source_doc:
        for day in ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"):
            setattr(new_cal, day, getattr(source_doc, day, 0))

    for row in shift_rows:
        new_cal.append("shifts", row)
    new_cal.total_duration_minutes = total_minutes

    # Copy alterations only for general calendars (machine-specific calendars have no alterations)
    if not machine and source_doc and source_doc.alterations:
        for alt in source_doc.alterations:
            if str(alt.date) == str(date):
                new_cal.append("alterations", {
                    "date": alt.date,
                    "alteration_type": alt.alteration_type,
                    "minutes": alt.minutes,
                    "machine": alt.machine,
                    "reason": alt.reason
                })

    new_cal.insert(ignore_permissions=True)
    return {"old_minutes": old_minutes, "new_minutes": new_cal.total_duration_minutes}


@frappe.whitelist()
def add_shift_alteration(date, alteration_type, minutes, machine=None, reason=None):
    """Add a shift alteration to the calendar covering the given date"""
    minutes = int(minutes)

    cal_name, source = _get_best_calendar_for_date(date)

    if cal_name and source in ("single", "range"):
        # Calendar exists — append alteration
        doc = frappe.get_doc("Shift Allocation", cal_name)
        doc.append("alterations", {
            "date": date,
            "alteration_type": alteration_type,
            "minutes": minutes,
            "machine": machine,
            "reason": reason
        })
        doc.save(ignore_permissions=True)
        return {"calendar": doc.name}

    # No range/single calendar — create a single-day calendar from default
    default_name = frappe.db.get_value("Shift Allocation", {"is_default": 1}, "name")
    if not default_name:
        frappe.throw(_("No Shift Allocation covers this date and no default calendar exists"))

    default_doc = frappe.get_doc("Shift Allocation", default_name)
    new_cal = frappe.new_doc("Shift Allocation")
    new_cal.start_date = date
    new_cal.end_date = date
    new_cal.is_default = 0

    for day in ("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"):
        setattr(new_cal, day, getattr(default_doc, day, 0))

    for shift_row in default_doc.shifts:
        new_cal.append("shifts", {
            "shift": shift_row.shift,
            "shift_name": shift_row.shift_name,
            "duration_minutes": shift_row.duration_minutes
        })
    new_cal.total_duration_minutes = default_doc.total_duration_minutes

    new_cal.append("alterations", {
        "date": date,
        "alteration_type": alteration_type,
        "minutes": minutes,
        "machine": machine,
        "reason": reason
    })

    new_cal.insert(ignore_permissions=True)
    return {"calendar": new_cal.name}


@frappe.whitelist()
def update_shift_alteration(alteration_name, alteration_type, minutes, reason=None):
    """Update an existing shift alteration child row"""
    minutes = int(minutes)

    # Find the parent Shift Allocation containing this child row
    parent_name = frappe.db.get_value("Shift Alteration", alteration_name, "parent")
    if not parent_name:
        frappe.throw(_("Shift alteration not found: {0}").format(alteration_name))

    doc = frappe.get_doc("Shift Allocation", parent_name)
    for row in doc.alterations or []:
        if row.name == alteration_name:
            row.alteration_type = alteration_type
            row.minutes = minutes
            row.reason = reason
            break
    else:
        frappe.throw(_("Alteration row not found in calendar"))

    doc.save(ignore_permissions=True)
    return {"calendar": doc.name}


@frappe.whitelist()
def delete_shift_alteration(alteration_name, parent_calendar):
    """Delete a shift alteration child row"""
    doc = frappe.get_doc("Shift Allocation", parent_calendar)
    row_to_remove = None
    for row in doc.alterations or []:
        if row.name == alteration_name:
            row_to_remove = row
            break

    if not row_to_remove:
        frappe.throw(_("Alteration row not found"))

    doc.remove(row_to_remove)
    doc.save(ignore_permissions=True)
    return {"success": True}


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
def save_allocations(allocations, start_date=None, end_date=None):
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

    # Delete orphaned records not in the saved list
    if start_date and end_date:
        all_existing = frappe.get_all(
            "Machine Operation",
            filters={"operation_date": ["between", [start_date, end_date]]},
            fields=["name"]
        )
        for rec in all_existing:
            if rec.name not in saved:
                frappe.delete_doc("Machine Operation", rec.name, ignore_permissions=True)

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
        fields=["machine_id", "machine_name", "machine_gg"],
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
        fields=["name", "order_date", "delivery_date", "docstatus", "customer"],
        order_by="creation desc"
    )
    return orders


@frappe.whitelist()
def get_order_tracking_summary():
    """Get aggregated completed quantities from Order Tracking, grouped by order+item+colour+size"""
    data = frappe.get_all(
        "Order Tracking",
        fields=[
            "order",
            "item",
            "colour",
            "size",
            "sum(quantity) as completed_qty",
        ],
        group_by="`order`, `item`, `colour`, `size`",
    )
    return data
