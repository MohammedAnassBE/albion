/**
 * Order-specific API helpers.
 * Order is a submittable DocType with child tables (Order Style, Order Detail, Order Item Detail).
 */

import { getList, getDoc, createDoc, updateDoc, submitDoc, cancelDoc, callMethod } from './client'

/**
 * Fetch a paginated, sorted list of Orders.
 * Caller can override any default param via the spread.
 */
export function getOrders(params = {}) {
  return getList('Order', {
    fields: ['name', 'client', 'purchase_order', 'order_date', 'delivery_date', 'docstatus'],
    order_by: 'creation desc',
    ...params,
  })
}

export function getOrder(name) {
  return getDoc('Order', name)
}

export function createOrder(data) {
  return createDoc('Order', data)
}

export function updateOrder(name, data) {
  return updateDoc('Order', name, data)
}

export function submitOrder(name) {
  return submitDoc('Order', name)
}

export function cancelOrder(name) {
  return cancelDoc('Order', name)
}

/**
 * Fetch colour/size/process details for a Style, used when populating the Order matrix.
 * Calls the whitelisted method in albion.albion.doctype.order.order.
 */
export function getStyleDetails(styleCode) {
  return callMethod('albion.albion.doctype.order.order.get_style_details', { style_code: styleCode })
}
