/**
 * Reports API layer.
 * Wraps whitelisted methods from albion.albion.api.reports
 */

import { callMethod } from './client'

const BASE = 'albion.albion.api.reports'

export function getProductionReport({ startDate, endDate, machine, style, process, order, groupBy }) {
  return callMethod(`${BASE}.get_production_report`, {
    start_date: startDate,
    end_date: endDate,
    machine: machine || null,
    style: style || null,
    process: process || null,
    order: order || null,
    group_by: groupBy || null,
  })
}

export function getMachineAvailability(startDate, endDate) {
  return callMethod(`${BASE}.get_machine_availability`, {
    start_date: startDate,
    end_date: endDate,
  })
}
