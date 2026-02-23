/**
 * Filter operator logic for Frappe-style advanced filters.
 * Pure JS — zero Vue dependencies.
 */

export const NON_FILTERABLE_FIELDTYPES = new Set([
  'Table',
  'HTML',
  'Section Break',
  'Column Break',
  'Tab Break',
  'Heading',
  'Attach',
  'Attach Image',
  'Text Editor',
  'Code',
  'Geolocation',
  'Signature',
])

const OPERATORS_BY_GROUP = {
  data:     ['=', '!=', 'like', 'not like', 'is'],
  link:     ['=', '!=', 'like', 'is'],
  date:     ['=', '!=', '>', '<', '>=', '<=', 'Between', 'is'],
  numeric:  ['=', '!=', '>', '<', '>=', '<=', 'is'],
  check:    ['='],
  select:   ['=', '!=', 'is'],
}

const FIELDTYPE_GROUP = {
  Link:      'link',
  Date:      'date',
  Datetime:  'date',
  Int:       'numeric',
  Float:     'numeric',
  Currency:  'numeric',
  Percent:   'numeric',
  Check:     'check',
  Select:    'select',
}

export function getOperatorsForFieldtype(fieldtype) {
  const group = FIELDTYPE_GROUP[fieldtype] || 'data'
  return OPERATORS_BY_GROUP[group]
}

/**
 * Convert UI filter state into the format useDocList.setFilter() expects.
 *
 * @param {string} operator
 * @param {*} rawValue
 * @param {string} fieldtype
 * @returns {*} scalar or [operator, value] tuple
 */
export function serializeFilterValue(operator, rawValue, fieldtype) {
  if (operator === 'is') {
    return ['is', rawValue] // 'set' or 'not set'
  }

  if (operator === 'Between') {
    const pair = Array.isArray(rawValue) ? rawValue : ['', '']
    return ['Between', [pair[0], pair[1]]]
  }

  if (operator === 'like' || operator === 'not like') {
    let v = String(rawValue || '')
    if (v && !v.includes('%')) v = `%${v}%`
    return [operator, v]
  }

  if (operator === '=') {
    if (fieldtype === 'Check') {
      return rawValue === 'Yes' || rawValue === 1 || rawValue === '1' ? 1 : 0
    }
    return rawValue
  }

  // Other comparison operators: !=, >, <, >=, <=
  return [operator, rawValue]
}
