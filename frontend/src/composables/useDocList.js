import { ref, reactive } from 'vue'
import { getList, getCount } from '@/api/client'

export function useDocList(doctype, options = {}) {
  const {
    fields = ['name'],
    defaultFilters = {},
    orderBy = 'creation desc',
    pageSize = 20,
    immediate = true
  } = options

  const data = ref([])
  const totalCount = ref(0)
  const loading = ref(false)
  const error = ref(null)
  const page = ref(1)
  const filters = reactive({ ...defaultFilters })
  const orFilters = ref(null)
  const currentOrderBy = ref(orderBy)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const params = {
        fields,
        filters: { ...filters },
        order_by: currentOrderBy.value,
        limit_start: (page.value - 1) * pageSize,
        limit_page_length: pageSize
      }
      if (orFilters.value) params.or_filters = orFilters.value
      const listResult = await getList(doctype, params)
      data.value = listResult.data || []
      totalCount.value = listResult.total_count ?? 0
      // Count separately — don't let it break data fetch
      try {
        totalCount.value = await getCount(doctype, { ...filters }, orFilters.value)
      } catch (_) { /* pagination degrades gracefully */ }
    } catch (e) {
      error.value = e.message || 'Failed to fetch'
    } finally {
      loading.value = false
    }
  }

  function setFilter(key, value) {
    if (value === null || value === undefined || value === '') {
      delete filters[key]
    } else {
      filters[key] = value
    }
    page.value = 1
  }

  function removeFilter(key) {
    delete filters[key]
    page.value = 1
  }

  function clearFilters(preserveKeys = []) {
    for (const key of Object.keys(filters)) {
      if (!preserveKeys.includes(key)) delete filters[key]
    }
    page.value = 1
  }

  function setOrFilters(val) {
    orFilters.value = val
    page.value = 1
  }

  function clearOrFilters() {
    orFilters.value = null
  }

  function setPage(p) {
    page.value = p
    fetch()
  }

  function setOrderBy(val) {
    currentOrderBy.value = val
    page.value = 1
    fetch()
  }

  function refresh() {
    fetch()
  }

  if (immediate) {
    fetch()
  }

  return {
    data,
    totalCount,
    loading,
    error,
    page,
    pageSize,
    filters,
    orFilters,
    currentOrderBy,
    fetch,
    setFilter,
    removeFilter,
    clearFilters,
    setOrFilters,
    clearOrFilters,
    setPage,
    setOrderBy,
    refresh
  }
}
