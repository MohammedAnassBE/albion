/**
 * Generic fetch wrapper for Frappe REST API.
 * Handles CSRF tokens, error responses, and provides typed helpers
 * for all standard Frappe resource and method endpoints.
 */

function getCsrfToken() {
  return window.csrf_token || window.frappe?.csrf_token || ''
}

function buildQueryString(params) {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'object') {
      qs.append(key, JSON.stringify(value))
    } else {
      qs.append(key, String(value))
    }
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

async function request(url, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Frappe-CSRF-Token': getCsrfToken(),
    ...options.headers,
  }

  const config = {
    credentials: 'include',
    ...options,
    headers,
  }

  const response = await fetch(url, config)

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Session expired. Redirecting to login.')
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body._server_messages || body.message || 'Permission denied')
  }

  if (response.status === 404) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || 'Not found')
  }

  if (response.status === 409) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || 'Conflict: document has been modified')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const serverMessages = body._server_messages
      ? JSON.parse(body._server_messages).map((m) => {
          try { return JSON.parse(m).message || m } catch { return m }
        }).join('\n')
      : null
    throw new Error(serverMessages || body.message || `Request failed with status ${response.status}`)
  }

  // 204 No Content
  if (response.status === 204) return null

  const json = await response.json()

  // Frappe wraps errors in exc/exception keys
  if (json.exc) {
    const parsed = JSON.parse(json.exc)
    const errorMsg = Array.isArray(parsed) ? parsed.filter(Boolean).join('\n') : String(parsed)
    throw new Error(errorMsg || 'Server error')
  }

  return json
}

// ---------------------------------------------------------------------------
// Frappe Resource API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a list of documents.
 * @returns {{ data: object[], total_count: number }}
 */
export async function getList(doctype, { fields, filters, order_by, limit_start, limit_page_length } = {}) {
  const params = {}
  if (fields) params.fields = fields
  if (filters) params.filters = filters
  if (order_by) params.order_by = order_by
  if (limit_start !== undefined) params.limit_start = limit_start
  if (limit_page_length !== undefined) params.limit_page_length = limit_page_length

  const qs = buildQueryString(params)
  const json = await request(`/api/resource/${encodeURIComponent(doctype)}${qs}`, { method: 'GET' })
  return { data: json.data || [], total_count: json.total_count }
}

/**
 * Fetch a single document by name.
 */
export async function getDoc(doctype, name) {
  const json = await request(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: 'GET' },
  )
  return json.data
}

/**
 * Create a new document.
 */
export async function createDoc(doctype, data) {
  const json = await request(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return json.data
}

/**
 * Update an existing document.
 */
export async function updateDoc(doctype, name, data) {
  const json = await request(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  )
  return json.data
}

/**
 * Delete a document.
 */
export async function deleteDoc(doctype, name) {
  await request(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  )
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Whitelisted method calls
// ---------------------------------------------------------------------------

/**
 * Call a whitelisted @frappe.whitelist() method.
 * @param {string} method  Dotted path, e.g. "albion.albion.doctype.order.order.get_item_details"
 * @param {object} args    Keyword arguments passed as JSON body
 */
export async function callMethod(method, args = {}) {
  const json = await request(`/api/method/${method}`, {
    method: 'POST',
    body: JSON.stringify(args),
  })
  return json.message
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Get the count of documents matching filters.
 */
export async function getCount(doctype, filters = {}) {
  const result = await callMethod('frappe.client.get_count', { doctype, filters })
  return result
}

/**
 * Search for link-field values (type-ahead / autocomplete).
 */
export async function searchLink(doctype, txt, filters = {}) {
  const result = await callMethod('frappe.client.get_list', {
    doctype,
    filters: { ...filters, name: ['like', `%${txt}%`] },
    fields: ['name'],
    limit_page_length: 20,
  })
  return result
}

// ---------------------------------------------------------------------------
// Workflow helpers for submittable DocTypes
// ---------------------------------------------------------------------------

/**
 * Submit a document (set docstatus = 1).
 */
export async function submitDoc(doctype, name) {
  const json = await request(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: 'PUT', body: JSON.stringify({ docstatus: 1 }) },
  )
  return json.data
}

/**
 * Cancel a submitted document (set docstatus = 2).
 */
export async function cancelDoc(doctype, name) {
  const json = await request(
    `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
    { method: 'PUT', body: JSON.stringify({ docstatus: 2 }) },
  )
  return json.data
}

/**
 * Amend a cancelled document (creates a new amended version).
 */
export async function amendDoc(doctype, name) {
  return callMethod('frappe.client.amend', { doctype, name })
}
