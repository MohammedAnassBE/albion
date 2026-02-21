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

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const params = {
        fields,
        filters: { ...filters },
        order_by: orderBy,
        limit_start: (page.value - 1) * pageSize,
        limit_page_length: pageSize
      }
      const listResult = await getList(doctype, params)
      data.value = listResult.data || []
      totalCount.value = listResult.total_count ?? 0
      // Count separately — don't let it break data fetch
      try {
        totalCount.value = await getCount(doctype, { ...filters })
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

  function setPage(p) {
    page.value = p
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
    fetch,
    setFilter,
    setPage,
    refresh
  }
}
