import frappe
from frappe import _
from datetime import date, timedelta

from albion.albion.page.capacity_planning.capacity_planning import (
    _get_best_calendar_for_date,
    _get_calendar_data,
)


@frappe.whitelist()
def get_production_report(start_date, end_date, machine=None, item=None, process=None, order=None, group_by=None):
    """Aggregated production data from Machine Operation for a date range.

    Groups by machine, order, item, process, colour, size and returns
    SUM(quantity) and SUM(allocated_minutes).

    Optional group_by: "item" or "machine" for coarser aggregation.
    """
    conditions = ["mo.operation_date BETWEEN %(start_date)s AND %(end_date)s"]
    params = {"start_date": start_date, "end_date": end_date}

    if machine:
        conditions.append("mo.machine = %(machine)s")
        params["machine"] = machine
    if item:
        conditions.append("mo.item = %(item)s")
        params["item"] = item
    if process:
        conditions.append("mo.process_name = %(process)s")
        params["process"] = process
    if order:
        conditions.append("mo.`order` = %(order)s")
        params["order"] = order

    where = " AND ".join(conditions)

    if group_by == "item":
        rows = frappe.db.sql(
            f"""
            SELECT
                mo.item,
                SUM(mo.quantity) AS total_quantity
            FROM `tabMachine Operation` mo
            JOIN `tabMachine` m ON m.name = mo.machine
            WHERE {where}
            GROUP BY mo.item
            ORDER BY mo.item
            """,
            params,
            as_dict=True,
        )
    elif group_by == "machine":
        rows = frappe.db.sql(
            f"""
            SELECT
                m.machine_id,
                m.machine_name,
                SUM(mo.quantity) AS total_quantity
            FROM `tabMachine Operation` mo
            JOIN `tabMachine` m ON m.name = mo.machine
            WHERE {where}
            GROUP BY m.machine_id, m.machine_name
            ORDER BY m.machine_id
            """,
            params,
            as_dict=True,
        )
    else:
        rows = frappe.db.sql(
            f"""
            SELECT
                m.machine_id,
                m.machine_name,
                mo.`order`,
                mo.item,
                mo.process_name,
                mo.colour,
                mo.size,
                SUM(mo.quantity) AS total_quantity,
                SUM(mo.allocated_minutes) AS total_minutes
            FROM `tabMachine Operation` mo
            JOIN `tabMachine` m ON m.name = mo.machine
            WHERE {where}
            GROUP BY m.machine_id, m.machine_name, mo.`order`, mo.item,
                     mo.process_name, mo.colour, mo.size
            ORDER BY m.machine_id, mo.`order`, mo.item
            """,
            params,
            as_dict=True,
        )

    return rows


@frappe.whitelist()
def get_machine_availability(start_date, end_date):
    """Per-machine, per-date capacity vs used minutes.

    Returns:
        {
            machines: [{machine_id, machine_name}],
            dates: [str],
            availability: { machine_id: { date_str: {capacity, used, available} } }
        }
    """
    machines = frappe.get_all(
        "Machine",
        fields=["name", "machine_id", "machine_name"],
        order_by="machine_id",
    )

    # Build date list
    d = _parse_date(start_date)
    end = _parse_date(end_date)
    dates = []
    while d <= end:
        dates.append(str(d))
        d += timedelta(days=1)

    # Pre-fetch used minutes: machine × date
    used_map = {}
    if dates:
        rows = frappe.db.sql(
            """
            SELECT machine, operation_date, SUM(allocated_minutes) AS used
            FROM `tabMachine Operation`
            WHERE operation_date BETWEEN %(start)s AND %(end)s
            GROUP BY machine, operation_date
            """,
            {"start": start_date, "end": end_date},
            as_dict=True,
        )
        for r in rows:
            used_map.setdefault(r.machine, {})[str(r.operation_date)] = r.used or 0

    # Build availability grid
    availability = {}
    for m in machines:
        mid = m.machine_id
        availability[mid] = {}
        for date_str in dates:
            capacity = _get_date_capacity(date_str, m.name)
            used = used_map.get(m.name, {}).get(date_str, 0)
            # Off day with actual allocations → get real capacity
            if capacity == 0 and used > 0:
                capacity = _get_date_capacity(date_str, m.name, skip_weekday_check=True)
            availability[mid][date_str] = {
                "capacity": capacity,
                "used": used,
                "available": max(0, capacity - used),
            }

    return {
        "machines": [{"machine_id": m.machine_id, "machine_name": m.machine_name} for m in machines],
        "dates": dates,
        "availability": availability,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _parse_date(val):
    if isinstance(val, date):
        return val
    return date.fromisoformat(str(val))


def _get_date_capacity(date_str, machine_name, skip_weekday_check=False):
    """Resolve the effective capacity in minutes for a machine on a given date."""
    cal_name, _source = _get_best_calendar_for_date(date_str, machine_name)
    if not cal_name:
        return 0

    cal = _get_calendar_data(cal_name)

    # Check if it's a working day (unless explicitly skipped)
    if not skip_weekday_check:
        d = _parse_date(date_str)
        day_flag = DAY_NAMES[d.weekday()]
        if not cal.get(day_flag):
            return 0  # off day

    base = cal.get("total_duration_minutes") or 0

    # Apply alterations for this date + machine
    for alt in cal.get("alterations") or []:
        if alt["date"] != date_str:
            continue
        # Machine-specific alteration
        if alt.get("machine") and alt["machine"] != machine_name:
            continue
        if alt["alteration_type"] == "Overtime":
            base += alt.get("minutes") or 0
        elif alt["alteration_type"] == "Undertime":
            base -= alt.get("minutes") or 0

    return max(0, base)
