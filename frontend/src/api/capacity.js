/**
 * Capacity Planning API layer.
 * Wraps every whitelisted method exposed by capacity_planning.py.
 */

import { callMethod } from './client'

const BASE = 'albion.albion.page.capacity_planning.capacity_planning'

// ---------------------------------------------------------------------------
// Order & allocation queries
// ---------------------------------------------------------------------------

export function getOrderData(orderName) {
  return callMethod(`${BASE}.get_order_data`, { order_name: orderName })
}

export function getExistingAllocations(order, process) {
  return callMethod(`${BASE}.get_existing_allocations`, { order, process })
}

export function getAllAllocations(startDate, endDate) {
  return callMethod(`${BASE}.get_all_allocations`, { start_date: startDate, end_date: endDate })
}

export function saveAllocations(allocations, startDate = null, endDate = null) {
  return callMethod(`${BASE}.save_allocations`, {
    allocations: typeof allocations === 'string' ? allocations : JSON.stringify(allocations),
    start_date: startDate,
    end_date: endDate,
  })
}

export function deleteAllocation(allocationName) {
  return callMethod(`${BASE}.delete_allocation`, { allocation_name: allocationName })
}

// ---------------------------------------------------------------------------
// Shift management
// ---------------------------------------------------------------------------

export function getShiftAllocations(startDate, endDate) {
  return callMethod(`${BASE}.get_shift_allocations`, { start_date: startDate, end_date: endDate })
}

export function getAllShifts() {
  return callMethod(`${BASE}.get_all_shifts`)
}

export function updateDateShift(date, shifts, machine = null) {
  return callMethod(`${BASE}.update_date_shift`, {
    date,
    shifts: JSON.stringify(shifts),
    machine,
  })
}

// ---------------------------------------------------------------------------
// Shift alterations (overtime / under-time)
// ---------------------------------------------------------------------------

export function addShiftAlteration(date, alterationType, minutes, machine = null, reason = null) {
  return callMethod(`${BASE}.add_shift_alteration`, {
    date,
    alteration_type: alterationType,
    minutes,
    machine,
    reason,
  })
}

export function updateShiftAlteration(alterationName, alterationType, minutes, reason = null) {
  return callMethod(`${BASE}.update_shift_alteration`, {
    alteration_name: alterationName,
    alteration_type: alterationType,
    minutes,
    reason,
  })
}

export function deleteShiftAlteration(alterationName, parentCalendar) {
  return callMethod(`${BASE}.delete_shift_alteration`, {
    alteration_name: alterationName,
    parent_calendar: parentCalendar,
  })
}

// ---------------------------------------------------------------------------
// Master data lookups
// ---------------------------------------------------------------------------

export function getMachines() {
  return callMethod(`${BASE}.get_machines`)
}

export function getProcesses() {
  return callMethod(`${BASE}.get_processes`)
}

export function getCapOrders() {
  return callMethod(`${BASE}.get_orders`)
}

export function getOrderTrackingSummary() {
  return callMethod(`${BASE}.get_order_tracking_summary`)
}
