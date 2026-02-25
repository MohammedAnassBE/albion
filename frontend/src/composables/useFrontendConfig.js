import { ref } from 'vue'
import { callMethod } from '@/api/client'

// Fieldtypes that should never appear as list columns
const NON_LISTABLE_FIELDTYPES = new Set([
  'Table', 'Text Editor', 'Long Text', 'Small Text', 'Text', 'HTML', 'HTML Editor',
  'Section Break', 'Column Break', 'Tab Break', 'Fold', 'Heading',
])

const configs = ref([])
const loaded = ref(false)
const loading = ref(false)

// Cache for meta-fallback results (keyed by doctype name)
const metaCache = {}

// Cache for per-user listview config (keyed by doctype name)
const userListviewCache = {}

async function fetchConfig() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const result = await callMethod(
      'albion.albion.doctype.albion_frontend_doctype.albion_frontend_doctype.get_frontend_config'
    )
    configs.value = result || []
    loaded.value = true
  } catch (e) {
    console.error('Failed to load frontend config:', e)
  } finally {
    loading.value = false
  }
}

function getConfigByRoute(routePath) {
  return configs.value.find((c) => c.route_path === routePath) || null
}

function getConfigByDoctype(doctypeName) {
  return configs.value.find((c) => c.doctype_name === doctypeName) || null
}

/**
 * Fetch per-user listview field config for a doctype.
 * Returns array of {fieldname, fieldtype, label, enabled} or null.
 */
async function getUserListviewFields(doctypeName) {
  if (doctypeName in userListviewCache) {
    return userListviewCache[doctypeName]
  }
  try {
    const result = await callMethod(
      'albion.albion.doctype.user_listview.user_listview.get_user_listview',
      { doctype_name: doctypeName }
    )
    userListviewCache[doctypeName] = result || null
    return userListviewCache[doctypeName]
  } catch (e) {
    console.error(`Failed to load user listview for ${doctypeName}:`, e)
    userListviewCache[doctypeName] = null
    return null
  }
}

function invalidateUserListviewCache(doctypeName) {
  delete userListviewCache[doctypeName]
}

/**
 * Get field definitions for a DocType.
 * Resolution chain: User Listview (per-user) → Albion Frontend Doctype (system) → Frappe meta (fallback).
 */
async function getFieldsForDoctype(doctypeName) {
  // Get base field data from config or meta
  let baseData = null
  const cfg = getConfigByDoctype(doctypeName)
  if (cfg?.fields?.length) {
    baseData = { fields: cfg.fields, is_submittable: cfg.is_submittable }
  } else if (metaCache[doctypeName]) {
    baseData = metaCache[doctypeName]
  } else {
    try {
      const result = await callMethod(
        'albion.albion.doctype.albion_frontend_doctype.albion_frontend_doctype.get_doctype_meta',
        { doctype: doctypeName }
      )
      const data = {
        fields: result?.fields || [],
        is_submittable: result?.is_submittable || 0,
        issingle: result?.issingle || 0,
      }
      metaCache[doctypeName] = data
      baseData = data
    } catch (e) {
      console.error(`Failed to load meta for ${doctypeName}:`, e)
      return { fields: [], is_submittable: 0 }
    }
  }

  // Filter out non-listable fieldtypes (Table, Text Editor, etc.)
  const filtered = baseData.fields.filter((f) => !NON_LISTABLE_FIELDTYPES.has(f.fieldtype))

  // Overlay per-user listview preferences
  const userFields = await getUserListviewFields(doctypeName)
  if (userFields) {
    const enabledSet = new Set(
      userFields.filter((f) => f.enabled).map((f) => f.fieldname)
    )
    const overlaid = filtered.map((f) => ({
      ...f,
      show_in_list: enabledSet.has(f.fieldname) ? 1 : 0,
    }))
    return { ...baseData, fields: overlaid }
  }

  return { ...baseData, fields: filtered }
}

export function useFrontendConfig() {
  return {
    configs,
    loaded,
    loading,
    fetchConfig,
    getConfigByRoute,
    getConfigByDoctype,
    getFieldsForDoctype,
    getUserListviewFields,
    invalidateUserListviewCache,
  }
}
