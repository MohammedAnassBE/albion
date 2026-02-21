import { ref } from 'vue'
import { callMethod } from '@/api/client'

const configs = ref([])
const loaded = ref(false)
const loading = ref(false)

// Cache for meta-fallback results (keyed by doctype name)
const metaCache = {}

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
 * Get field definitions for a DocType.
 * Tries Albion Frontend Doctype config first, falls back to get_doctype_meta API.
 * Results are cached.
 */
async function getFieldsForDoctype(doctypeName) {
  // Try config first
  const cfg = getConfigByDoctype(doctypeName)
  if (cfg?.fields?.length) {
    return { fields: cfg.fields, is_submittable: cfg.is_submittable }
  }

  // Check cache
  if (metaCache[doctypeName]) {
    return metaCache[doctypeName]
  }

  // Fallback to meta API
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
    return data
  } catch (e) {
    console.error(`Failed to load meta for ${doctypeName}:`, e)
    return { fields: [], is_submittable: 0 }
  }
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
  }
}
