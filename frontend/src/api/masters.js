/**
 * Generic CRUD wrappers for simple master DocTypes
 * (Machine, Machine Frame, Item, Process, Shift, Colour, Size, Size Range, Client, etc.)
 *
 * These thin pass-throughs keep view/composable code declarative while
 * centralising the import surface to a single module.
 */

import { getList, getDoc, createDoc, updateDoc, deleteDoc, getCount } from './client'

export function getMasterList(doctype, params = {}) {
  return getList(doctype, params)
}

export function getMasterDoc(doctype, name) {
  return getDoc(doctype, name)
}

export function createMaster(doctype, data) {
  return createDoc(doctype, data)
}

export function updateMaster(doctype, name, data) {
  return updateDoc(doctype, name, data)
}

export function deleteMaster(doctype, name) {
  return deleteDoc(doctype, name)
}

export function getMasterCount(doctype, filters = {}) {
  return getCount(doctype, filters)
}
