/**
 * Capacity Planning store — provide/inject factory.
 *
 * Usage:
 *   // Parent page
 *   const store = createCapacityStore()
 *   provide(CAPACITY_KEY, store)
 *
 *   // Any child component
 *   const store = useCapacityStore()
 */

import { ref, computed, inject } from 'vue'
import { useAppToast } from './useToast'
import {
  getOrderData as apiGetOrderData,
  getAllAllocations,
  saveAllocations as apiSaveAllocations,
  getShiftAllocations as apiGetShiftAllocations,
  getAllShifts as apiGetAllShifts,
  getMachines as apiGetMachines,
  getProcesses as apiGetProcesses,
  getCapOrders,
  addShiftAlteration as apiAddShiftAlteration,
  updateShiftAlteration as apiUpdateShiftAlteration,
  deleteShiftAlteration as apiDeleteShiftAlteration,
  updateDateShift as apiUpdateDateShift,
} from '@/api/capacity'

// ─── Symbol key ───────────────────────────────────────────────────────────────
export const CAPACITY_KEY = Symbol('capacity')

export function useCapacityStore() {
  return inject(CAPACITY_KEY)
}

// ─── Layout constants ─────────────────────────────────────────────────────────
export const COL_WIDTH = 120
export const COL_WIDTH_ZOOM = 48
export const MACHINE_COL_WIDTH = 180
export const BAR_HEIGHT = 68
export const BAR_HEIGHT_ZOOM = 22
export const BAR_GAP = 4
export const BAR_TOP_OFFSET = 22

// ─── Temp-key counter (monotonic) ─────────────────────────────────────────────
let _tkCtr = 0
function tempKey() { return `tmp-${++_tkCtr}` }

// ─── Color pairs for gantt bars ──────────────────────────────────────────────
const _colorPairs = [
  { border: '#2563eb', bg: '#bfdbfe' },
  { border: '#dc2626', bg: '#fecaca' },
  { border: '#059669', bg: '#a7f3d0' },
  { border: '#d97706', bg: '#fde68a' },
  { border: '#7c3aed', bg: '#ddd6fe' },
  { border: '#0891b2', bg: '#a5f3fc' },
  { border: '#db2777', bg: '#fbcfe8' },
  { border: '#4f46e5', bg: '#c7d2fe' },
  { border: '#ca8a04', bg: '#fef08a' },
  { border: '#0d9488', bg: '#99f6e4' },
]
const _colorMap = new Map()

function getAllocationColor(group) {
  const key = `${group.order || ''}-${group.item || ''}-${group.process || ''}`
  if (!_colorMap.has(key)) _colorMap.set(key, _colorMap.size % _colorPairs.length)
  return _colorPairs[_colorMap.get(key)]
}

// ═════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═════════════════════════════════════════════════════════════════════════════
export function createCapacityStore() {
  const toast = useAppToast()

  // ─── Master data ────────────────────────────────────────────────────────────
  const processes    = ref([])
  const machines     = ref([])
  const orders       = ref([])
  const allShifts    = ref([])

  // ─── Filters ────────────────────────────────────────────────────────────────
  const selectedCustomer    = ref('')
  const selectedOrder       = ref('')
  const selectedOrderLabel  = ref('')   // for AutoComplete display value
  const selectedProcess     = ref('')
  const selectedMachineGG   = ref('')
  const viewType            = ref('all')

  // ─── Calendar range ──────────────────────────────────────────────────────────
  const startDate = ref('')
  const endDate   = ref('')

  // ─── Order data ──────────────────────────────────────────────────────────────
  const orderData    = ref(null)
  const itemMachineGG = ref('')

  // ─── Shift / allocation data ─────────────────────────────────────────────────
  const shiftAllocations  = ref({})   // { [date]: { '*': {...}, [machineId]: {...} } }
  const defaultAllocation = ref(null) // default Shift Allocation record
  const allocations       = ref([])   // flat array of Machine Operation docs

  // ─── Undo / Redo ─────────────────────────────────────────────────────────────
  const actionHistory = ref([])
  const redoHistory   = ref([])

  // ─── UI state ────────────────────────────────────────────────────────────────
  const validationErrors  = ref([])
  const isSaving          = ref(false)
  const workloadCollapsed = ref(false)
  const isZoomedOut       = ref(false)
  const applyZoom         = ref(false)

  // ─── DnD state ───────────────────────────────────────────────────────────────
  const draggingItem     = ref(null)
  const droppedAllocKeys = ref(new Set())
  const deletedBlocks    = ref([])
  const selectedGroup    = ref(null)
  const splitMarkers     = ref([])

  // ─── Calendar DOM reference (for scroll sync) ─────────────────────────────────
  const calendarWrapper = ref(null)

  // ─── Context menu ────────────────────────────────────────────────────────────
  const contextMenu = ref({ visible: false, x: 0, y: 0, group: null, alloc: null })

  // ─── Tooltip ─────────────────────────────────────────────────────────────────
  const tooltip = ref({ visible: false, x: 0, y: 0, data: null })

  // ─── Drop modal ──────────────────────────────────────────────────────────────
  const showDropModal  = ref(false)
  const pendingDrop    = ref(null)
  const dropQuantity   = ref(0)

  // ─── Shift-confirm modal ─────────────────────────────────────────────────────
  const showShiftModal = ref(false)
  const shiftModalData = ref({ group: null, allocs: [], newDates: [] })

  // ─── Backfill modal ──────────────────────────────────────────────────────────
  const showBackfillModal  = ref(false)
  const backfillModalData  = ref({ group: null, machine: '', date: '', quantity: 0 })

  // ─── Edit-group modal ────────────────────────────────────────────────────────
  const showEditGroupModal  = ref(false)
  const editGroupTarget     = ref(null)
  const editGroupQuantity   = ref(0)

  // ─── Split-group modal ───────────────────────────────────────────────────────
  const showSplitGroupModal = ref(false)
  const splitGroupTarget    = ref(null)
  const splitGroupDate      = ref('')

  // ─── Shift-by-days modal ─────────────────────────────────────────────────────
  const showShiftByDaysModal = ref(false)
  const shiftByDaysTarget    = ref(null)
  const shiftByDaysCount     = ref(1)
  const shiftByDaysPreview   = ref([])

  // ─── Action-choice modal ─────────────────────────────────────────────────────
  const showActionChoice    = ref(false)
  const actionChoiceContext = ref({ date: '', machine: '' })

  // ─── Shift-update modal ──────────────────────────────────────────────────────
  const showShiftUpdateModal = ref(false)
  const shiftUpdateForm      = ref({ date: '', machine: '', shifts: [] })
  const shiftUpdateSaving    = ref(false)

  // ─── Alteration modal ────────────────────────────────────────────────────────
  const showAlterationModal = ref(false)
  const alterationForm      = ref({ date: '', machine: '', alteration_type: 'Add', minutes: 60, reason: '' })
  const alterationSaving    = ref(false)

  // ─── Edit-alterations modal ──────────────────────────────────────────────────
  const showEditAlterationsModal  = ref(false)
  const editAlterationsContext    = ref({ date: '', machine_id: '' })
  const editAlterationsList       = ref([])
  const editAlterationsSaving     = ref(false)

  // ─── Bulk-shift modal ────────────────────────────────────────────────────────
  const showBulkShiftModal = ref(false)
  const bulkShiftSaving    = ref(false)
  const bulkShiftDate      = ref('')
  const bulkShiftMachines  = ref([])

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════════════

  const dateRange = computed(() => {
    if (!startDate.value || !endDate.value) return []
    const dates = []
    const cur = new Date(startDate.value + 'T00:00:00')
    const end = new Date(endDate.value + 'T00:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  })

  const filteredMachines = computed(() => {
    if (!selectedMachineGG.value) return machines.value
    return machines.value.filter(m => m.machine_gg === selectedMachineGG.value)
  })

  const availableProcesses = computed(() => {
    if (!orderData.value) return processes.value
    const procs = orderData.value.order_processes || []
    return procs.map(p => ({ name: p.process, label: p.process }))
  })

  const workloadItems = computed(() => {
    if (!orderData.value) return []
    return orderData.value.order_items || []
  })

  const ganttGridStyle = computed(() => {
    const colW = applyZoom.value ? COL_WIDTH_ZOOM : COL_WIDTH
    return {
      gridTemplateColumns: `${MACHINE_COL_WIDTH}px repeat(${dateRange.value.length}, ${colW}px)`,
    }
  })

  // Group allocations: machine+order+process+colour+size → group object
  const groupedAllocations = computed(() => {
    const groups = {}
    for (const alloc of allocations.value) {
      const key = `${alloc.machine}||${alloc.order}||${alloc.process}||${alloc.colour || ''}||${alloc.size || ''}`
      if (!groups[key]) {
        groups[key] = {
          key,
          group_id:       `grp-${key}`,
          machine:        alloc.machine,
          order:          alloc.order,
          process:        alloc.process,
          colour:         alloc.colour || '',
          size:           alloc.size   || '',
          item:           alloc.item   || '',
          total_quantity: 0,
          total_minutes:  0,
          allocs:         [],
        }
      }
      groups[key].allocs.push(alloc)
      groups[key].total_quantity += (alloc.quantity || 0)
      groups[key].total_minutes  += (alloc.minutes  || 0)
    }
    for (const g of Object.values(groups)) {
      g.allocs.sort((a, b) => a.date.localeCompare(b.date))
    }
    return groups
  })

  // Assign vertical lanes so bars don't overlap on the same machine row
  const groupedAllocationsWithLanes = computed(() => {
    const result = {}
    // Copy group objects (shallow)
    for (const [k, g] of Object.entries(groupedAllocations.value)) {
      result[k] = { ...g }
    }
    // Per machine: assign lanes by order of first alloc date
    const byMachine = {}
    for (const g of Object.values(result)) {
      if (!byMachine[g.machine]) byMachine[g.machine] = []
      byMachine[g.machine].push(g)
    }
    for (const list of Object.values(byMachine)) {
      list.sort((a, b) => (a.allocs[0]?.date || '').localeCompare(b.allocs[0]?.date || ''))
      list.forEach((g, i) => { g.lane = i })
    }
    return result
  })

  const selectedShiftsTotalMinutes = computed(() =>
    allShifts.value
      .filter(s => shiftUpdateForm.value.shifts.includes(s.name))
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadInitialData() {
    // Default date range: 7 days back → 60 days ahead
    const today = new Date()
    const s = new Date(today); s.setDate(s.getDate() - 7)
    const e = new Date(today); e.setDate(e.getDate() + 60)
    startDate.value = s.toISOString().slice(0, 10)
    endDate.value   = e.toISOString().slice(0, 10)

    await Promise.all([
      loadMachines(),
      loadProcesses(),
      loadOrders(),
      loadAllShifts(),
      loadShiftAllocations(),
      loadAllAllocations(),
    ])
  }

  async function loadMachines() {
    try { machines.value = (await apiGetMachines()) || [] }
    catch (e) { toast.error('Failed to load machines', e.message) }
  }

  async function loadProcesses() {
    try { processes.value = (await apiGetProcesses()) || [] }
    catch (e) { toast.error('Failed to load processes', e.message) }
  }

  async function loadOrders() {
    try { orders.value = (await getCapOrders()) || [] }
    catch { /* non-critical */ }
  }

  async function loadAllShifts() {
    try { allShifts.value = (await apiGetAllShifts()) || [] }
    catch (e) { toast.error('Failed to load shifts', e.message) }
  }

  async function loadShiftAllocations() {
    try {
      const data = await apiGetShiftAllocations(startDate.value, endDate.value)
      shiftAllocations.value  = data.date_shifts        || {}
      defaultAllocation.value = data.default_allocation || null
    } catch (e) { toast.error('Failed to load shift allocations', e.message) }
  }

  async function loadAllAllocations() {
    try {
      const raw = (await getAllAllocations(startDate.value, endDate.value)) || []
      allocations.value = raw.map(a => ({
        ...a,
        machine: a.machine_id,
        date:    a.operation_date,
        minutes: a.allocated_minutes,
      }))
    }
    catch (e) { toast.error('Failed to load allocations', e.message) }
  }

  async function refreshCalendar() {
    await Promise.all([loadShiftAllocations(), loadAllAllocations()])
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  async function onOrderChange(orderName) {
    selectedOrder.value  = orderName
    orderData.value      = null
    selectedProcess.value = ''
    if (!orderName) return
    try {
      const data = await apiGetOrderData(orderName)
      orderData.value    = data
      itemMachineGG.value = data.machine_gg || ''
      if (data.order_processes?.length === 1) {
        selectedProcess.value = data.order_processes[0].process
      }
    } catch (e) { toast.error('Failed to load order data', e.message) }
  }

  function onProcessChange(proc) { selectedProcess.value = proc }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  async function saveAllocations() {
    isSaving.value = true
    try {
      await apiSaveAllocations(allocations.value, startDate.value, endDate.value)
      await loadAllAllocations()
      actionHistory.value = []
      redoHistory.value   = []
      deletedBlocks.value = []
      toast.success('Saved', 'Allocations saved successfully')
    } catch (e) { toast.error('Save failed', e.message) }
    finally { isSaving.value = false }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ═══════════════════════════════════════════════════════════════════════════

  function pushHistory(action) {
    actionHistory.value.push(action)
    redoHistory.value = []
  }

  function _matchTempKey(a, list) {
    return list.some(o =>
      (a._tempKey && a._tempKey === o._tempKey) ||
      (a.name     && a.name     === o.name)
    )
  }

  function undoLastAction() {
    if (!actionHistory.value.length) return
    const action = actionHistory.value.pop()
    _applyUndo(action)
    redoHistory.value.push(action)
  }

  function redoLastAction() {
    if (!redoHistory.value.length) return
    const action = redoHistory.value.pop()
    _applyRedo(action)
    actionHistory.value.push(action)
  }

  function _applyUndo(action) {
    switch (action.type) {
      case 'DROP':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.added))
        if (action.removedFromDeleted) deletedBlocks.value.push(...action.removedFromDeleted)
        break
      case 'DELETE':
        allocations.value.push(...action.deleted)
        deletedBlocks.value = deletedBlocks.value.filter(b => !_matchTempKey(b, action.deleted))
        break
      case 'MOVE':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.newAllocs))
        allocations.value.push(...action.oldAllocs)
        break
      case 'EDIT_QUANTITY':
      case 'SPLIT':
      case 'SHIFT_DAYS':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.newAllocs))
        allocations.value.push(...action.oldAllocs)
        break
    }
  }

  function _applyRedo(action) {
    switch (action.type) {
      case 'DROP':
        allocations.value.push(...action.added)
        break
      case 'DELETE':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.deleted))
        deletedBlocks.value.push(...action.deleted)
        break
      case 'MOVE':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.oldAllocs))
        allocations.value.push(...action.newAllocs)
        break
      case 'EDIT_QUANTITY':
      case 'SPLIT':
      case 'SHIFT_DAYS':
        allocations.value = allocations.value.filter(a => !_matchTempKey(a, action.oldAllocs))
        allocations.value.push(...action.newAllocs)
        break
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATE / SHIFT HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }

  function formatDayName(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
  }

  function fmtDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const _todayStr = () => new Date().toISOString().slice(0, 10)
  function isToday(dateStr)    { return dateStr === _todayStr() }
  function isPastDate(dateStr) { return dateStr  <  _todayStr() }

  function isOffDay(dateStr, machineId) {
    const dayInfo = shiftAllocations.value[dateStr]
    if (dayInfo) {
      const entry = (machineId && dayInfo[machineId]) ? dayInfo[machineId] : dayInfo['*']
      if (entry) return !!entry.is_off_day
    }
    if (!defaultAllocation.value) return false
    const d = new Date(dateStr + 'T00:00:00')
    const names = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    return !defaultAllocation.value[names[d.getDay()]]
  }

  function hasMachineSpecificShift(dateStr, machineId) {
    return !!(shiftAllocations.value[dateStr]?.[machineId])
  }

  function getShiftForDate(dateStr, machineId) {
    const dayInfo = shiftAllocations.value[dateStr]
    if (!dayInfo) return defaultAllocation.value
    if (machineId && dayInfo[machineId]) return dayInfo[machineId]
    return dayInfo['*'] || defaultAllocation.value
  }

  function getShiftNamesForDate(dateStr, machineId) {
    const shift = getShiftForDate(dateStr, machineId)
    if (!shift) return ''
    if (Array.isArray(shift.shifts)) return shift.shifts.map(s => s.shift_name || s).join(', ')
    return shift.shift_name || ''
  }

  function getDayAlterationDelta(dateStr, machineId) {
    const shift = getShiftForDate(dateStr, machineId)
    if (!shift?.alterations || !shift.alterations.length) return null
    const delta = shift.alterations.reduce((sum, a) =>
      sum + (a.alteration_type === 'Add' ? a.minutes : -a.minutes), 0)
    if (delta === 0) return null
    return { delta, label: delta > 0 ? `+${delta}m` : `${delta}m`, cls: delta > 0 ? 'badge-add' : 'badge-reduce' }
  }

  function getEffectiveMinutes(dateStr, machineId) {
    const shift = getShiftForDate(dateStr, machineId)
    if (!shift) return 0
    const alt = getDayAlterationDelta(dateStr, machineId)
    return Math.max(0, (shift.total_minutes || 0) + (alt ? alt.delta : 0))
  }

  function getUsedMinutes(dateStr, machineId) {
    return allocations.value
      .filter(a => a.date === dateStr && a.machine === machineId)
      .reduce((sum, a) => sum + (a.minutes || 0), 0)
  }

  function getCapacityPercentage(dateStr, machineId) {
    const eff = getEffectiveMinutes(dateStr, machineId)
    if (!eff) return 0
    return Math.min(100, Math.round((getUsedMinutes(dateStr, machineId) / eff) * 100))
  }

  function getCapacityBarClass(dateStr, machineId) {
    const pct = getCapacityPercentage(dateStr, machineId)
    if (pct >= 95) return 'bar-ok'
    if (pct >= 40) return 'bar-warning'
    return 'bar-low'
  }

  function getCellAlterationBadge(dateStr, machineId) {
    const alt = getDayAlterationDelta(dateStr, machineId)
    if (!alt) return null
    return { delta: alt.delta, label: alt.label, cls: alt.cls }
  }

  function getDateHeaderClass(dateStr) {
    const cls = []
    if (isToday(dateStr))         cls.push('today-date')
    else if (isPastDate(dateStr)) cls.push('past-date')
    if (isOffDay(dateStr))        cls.push('weekly-off')
    return cls.join(' ')
  }

  function getCellClass(dateStr, machineId) {
    const used  = getUsedMinutes(dateStr, machineId)
    const total = getEffectiveMinutes(dateStr, machineId)
    const cls   = []

    if (used > total && total > 0)       cls.push('cell-conflict')
    else if (used >= total && total > 0)  cls.push('cell-full')
    else if (used > 0)                    cls.push('cell-allocated')
    else                                  cls.push('cell-available')

    if (isToday(dateStr))                 cls.push('cell-today')
    else if (isPastDate(dateStr))         cls.push('cell-past')

    if (isOffDay(dateStr, machineId))     cls.push('cell-offday')

    const badge = getCellAlterationBadge(dateStr, machineId)
    if (badge) cls.push(badge.cls === 'badge-add' ? 'cell-altered-add' : 'cell-altered-reduce')

    return cls.join(' ')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BAR / GROUP HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function getGroupsForMachine(machineId) {
    return Object.values(groupedAllocationsWithLanes.value).filter(g => g.machine === machineId)
  }

  function getAllocatedQuantity(order, process, colour, size) {
    return allocations.value
      .filter(a =>
        a.order === order && a.process === process &&
        (!colour || a.colour === colour) &&
        (!size   || a.size   === size)
      )
      .reduce((sum, a) => sum + (a.quantity || 0), 0)
  }

  function getAllocationStatus(item) {
    const allocated = getAllocatedQuantity(
      selectedOrder.value, selectedProcess.value, item.colour, item.size,
    )
    const total = item.quantity || 0
    if (allocated >= total) return 'complete'
    if (allocated > 0)      return 'partial'
    return 'none'
  }

  function isValidForProcess(item) {
    if (!selectedProcess.value || !item.process_minutes) return true
    return item.process_minutes.some(p => p.process === selectedProcess.value && p.minutes > 0)
  }

  function isMachineCompatible(machineId) {
    if (!itemMachineGG.value) return true
    const m = machines.value.find(x => x.name === machineId)
    return !m || m.machine_gg === itemMachineGG.value
  }

  function _getMinutesPerUnit(item) {
    if (!selectedProcess.value || !item?.process_minutes) return 0
    const p = item.process_minutes.find(x => x.process === selectedProcess.value)
    return p ? (p.minutes || 0) : 0
  }

  function getBarStyle(group) {
    const colW = applyZoom.value ? COL_WIDTH_ZOOM : COL_WIDTH
    const barH = applyZoom.value ? BAR_HEIGHT_ZOOM : BAR_HEIGHT
    const lane = group.lane || 0
    if (!group.allocs.length) return { display: 'none' }

    const startIdx = dateRange.value.indexOf(group.allocs[0].date)
    if (startIdx < 0) return { display: 'none' }

    // Find contiguous span from start date
    let span = 1
    for (let i = startIdx + 1; i < dateRange.value.length; i++) {
      if (group.allocs.some(a => a.date === dateRange.value[i])) span++
      else break
    }

    const colors = getAllocationColor(group)
    return {
      position: 'absolute',
      left:   `${startIdx * colW + 2}px`,
      top:    `${BAR_TOP_OFFSET + lane * (barH + BAR_GAP)}px`,
      width:  `${span * colW - 4}px`,
      height: `${barH}px`,
      backgroundColor: colors.bg,
      borderLeft: `4px solid ${colors.border}`,
    }
  }

  function getBarLayerHeight(machineId) {
    const groups = getGroupsForMachine(machineId)
    const barH   = applyZoom.value ? BAR_HEIGHT_ZOOM : BAR_HEIGHT
    if (!groups.length) return barH + BAR_TOP_OFFSET
    const maxLane = Math.max(...groups.map(g => g.lane || 0))
    return BAR_TOP_OFFSET + (maxLane + 1) * (barH + BAR_GAP)
  }

  function isJustDropped(alloc) {
    return droppedAllocKeys.value.has(alloc._tempKey || alloc.name)
  }

  function onSnapAnimationEnd(alloc) {
    droppedAllocKeys.value.delete(alloc._tempKey || alloc.name)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR DOM / SCROLL
  // ═══════════════════════════════════════════════════════════════════════════

  function setCalendarWrapper(el) { calendarWrapper.value = el }
  function onWrapperDragOver(e)   { e.preventDefault() }
  function onCalendarScroll()     { tooltip.value.visible = false }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT MENU / TOOLTIP / GROUP SELECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function onBarContextMenu(e, group) {
    e.preventDefault()
    contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, group, alloc: group.allocs[0] }
    selectedGroup.value = group.key
  }

  function closeContextMenu() { contextMenu.value = { ...contextMenu.value, visible: false } }

  function showTooltip(e, group) {
    tooltip.value = { visible: true, x: e.clientX + 14, y: e.clientY + 14, data: group }
  }
  function hideTooltip() { tooltip.value = { ...tooltip.value, visible: false } }

  function selectGroup(key) {
    selectedGroup.value = selectedGroup.value === key ? null : key
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG AND DROP — WORKLOAD PANEL
  // ═══════════════════════════════════════════════════════════════════════════

  function onDragStart(e, item) {
    draggingItem.value = { ...item, _type: 'workload' }
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', 'workload')
  }

  function onDragEnd() { draggingItem.value = null }

  function onWorkloadDragOver(e) {
    if (draggingItem.value?._type === 'bar') {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  function onWorkloadDrop(e) {
    if (draggingItem.value?._type === 'bar') {
      e.preventDefault()
      _deleteGroupByKey(draggingItem.value.groupKey)
      draggingItem.value = null
    }
  }

  function onDeletedBlockDragStart(e, block) {
    draggingItem.value = { ...block, _type: 'deleted' }
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', 'deleted')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG AND DROP — GANTT GRID
  // ═══════════════════════════════════════════════════════════════════════════

  function onCellDragOver(e) {
    if (draggingItem.value) {
      e.preventDefault()
      e.dataTransfer.dropEffect = draggingItem.value._type === 'bar' ? 'move' : 'copy'
    }
  }

  function onDrop(e, machineId, dateStr) {
    e.preventDefault()
    const item = draggingItem.value
    if (!item) return
    draggingItem.value = null
    if (item._type === 'bar') {
      _handleBarMove(item, machineId, dateStr)
    } else {
      _openDropModal(item, machineId, dateStr)
    }
  }

  function onBarDrop(e, machineId, dateStr) { onDrop(e, machineId, dateStr) }

  function onGroupDragStart(e, group) {
    draggingItem.value = {
      _type: 'bar', groupKey: group.key,
      order: group.order, process: group.process,
      colour: group.colour, size: group.size, machine: group.machine,
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'bar')
  }

  function _handleBarMove(item, newMachine, newDate) {
    const group = groupedAllocations.value[item.groupKey]
    if (!group) return
    moveGroup(group, newMachine, newDate)
  }

  function _openDropModal(item, machineId, dateStr) {
    const effMin  = getEffectiveMinutes(dateStr, machineId)
    const usedMin = getUsedMinutes(dateStr, machineId)
    const avail   = Math.max(0, effMin - usedMin)
    const mpu     = _getMinutesPerUnit(item)

    pendingDrop.value  = {
      item, machine: machineId, date: dateStr,
      availableMinutes: avail, minutesPerUnit: mpu,
      order:   selectedOrder.value,
      process: selectedProcess.value,
    }
    dropQuantity.value  = mpu && avail ? Math.floor(avail / mpu) : 1
    showDropModal.value = true
  }

  // ─── Spread quantity across available dates ──────────────────────────────────
  function _spreadAllocations({ machine, startDate: sd, order, process, colour, size, quantity, minutesPerUnit }) {
    const result  = []
    let remaining = quantity
    const dates   = dateRange.value.filter(d => d >= sd)

    for (const d of dates) {
      if (remaining <= 0) break
      if (isOffDay(d, machine)) continue

      const effMin    = getEffectiveMinutes(d, machine)
      const pendingMin = result.filter(a => a.date === d).reduce((s, a) => s + a.minutes, 0)
      const usedMin   = getUsedMinutes(d, machine) + pendingMin
      const avail     = Math.max(0, effMin - usedMin)

      const canPlace  = (minutesPerUnit > 0 && avail > 0) ? Math.floor(avail / minutesPerUnit) : remaining
      const place     = Math.min(remaining, canPlace)
      if (place <= 0) continue

      result.push({
        _tempKey: tempKey(),
        name: '', isNew: true,
        machine, date: d, order, process,
        colour: colour || '', size: size || '',
        quantity: place,
        minutes:  place * (minutesPerUnit || 0),
      })
      remaining -= place
    }
    return result
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DROP MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function closeDropModal() {
    showDropModal.value = false
    pendingDrop.value   = null
    dropQuantity.value  = 0
  }

  function confirmDrop() {
    if (!pendingDrop.value || !dropQuantity.value) { closeDropModal(); return }
    const { item, machine, date, minutesPerUnit, order, process } = pendingDrop.value
    const newAllocs = _spreadAllocations({
      machine, startDate: date, order, process,
      colour: item.colour, size: item.size,
      quantity: dropQuantity.value, minutesPerUnit,
    })
    const removedFromDeleted = item._type === 'deleted'
      ? deletedBlocks.value.filter(b => b._tempKey === item._tempKey)
      : []

    for (const a of newAllocs) {
      allocations.value.push(a)
      droppedAllocKeys.value.add(a._tempKey)
    }

    if (item._type === 'deleted') {
      _removeMatchingDeletedBlocks(order || null, process || null, item.colour, item.size)
    }

    pushHistory({ type: 'DROP', added: [...newAllocs], removedFromDeleted })

    // Clear snap-animation markers after animation completes
    setTimeout(() => {
      for (const a of newAllocs) droppedAllocKeys.value.delete(a._tempKey)
    }, 700)

    closeDropModal()
  }

  function _removeMatchingDeletedBlocks(order, process, colour, size) {
    const norm = v => (v == null || v === '') ? null : v
    const o = norm(order   || selectedOrder.value)
    const p = norm(process || selectedProcess.value)
    deletedBlocks.value = deletedBlocks.value.filter(b =>
      !(norm(b.order) === o && norm(b.process) === p &&
        norm(b.colour) === norm(colour) && norm(b.size) === norm(size))
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function moveGroup(group, newMachine, newDate) {
    const oldAllocs  = group.allocs.map(a => ({ ...a }))
    const totalQty   = oldAllocs.reduce((s, a) => s + (a.quantity || 0), 0)
    const firstAlloc = oldAllocs[0]
    const mpu        = firstAlloc ? (firstAlloc.minutes || 0) / (firstAlloc.quantity || 1) : 0

    const newAllocs = _spreadAllocations({
      machine: newMachine, startDate: newDate,
      order: group.order, process: group.process,
      colour: group.colour, size: group.size,
      quantity: totalQty, minutesPerUnit: mpu,
    })

    if (!newAllocs.length) {
      toast.warn('Cannot move', 'No available capacity on destination')
      return
    }

    allocations.value = allocations.value.filter(a => !_matchTempKey(a, oldAllocs))
    allocations.value.push(...newAllocs)
    pushHistory({ type: 'MOVE', oldAllocs, newAllocs })
    closeContextMenu()
  }

  function deleteGroup(groupKey) {
    _deleteGroupByKey(groupKey || selectedGroup.value)
    closeContextMenu()
  }

  function _deleteGroupByKey(groupKey) {
    const group = groupedAllocations.value[groupKey]
    if (!group) return
    const deleted = group.allocs.map(a => ({ ...a }))

    allocations.value = allocations.value.filter(a => !_matchTempKey(a, deleted))

    // Push to deleted blocks panel (deduplicate by order+process+colour+size)
    const blockKey = `${group.order}||${group.process}||${group.colour}||${group.size}`
    if (!deletedBlocks.value.find(b => b._blockKey === blockKey)) {
      deletedBlocks.value.push({
        _blockKey: blockKey,
        _tempKey:  tempKey(),
        order:     group.order,
        process:   group.process,
        colour:    group.colour,
        size:      group.size,
        quantity:  deleted.reduce((s, a) => s + (a.quantity || 0), 0),
        machine:   group.machine,
      })
    }

    pushHistory({ type: 'DELETE', deleted })
    selectedGroup.value = null
  }

  function clearDeletedBlocks()       { deletedBlocks.value = [] }
  function removeDeletedBlock(idx)    { deletedBlocks.value.splice(idx, 1) }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT GROUP MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openEditGroupModal(group) {
    editGroupTarget.value   = group
    editGroupQuantity.value = group.allocs.reduce((s, a) => s + (a.quantity || 0), 0)
    showEditGroupModal.value = true
    closeContextMenu()
  }

  function closeEditGroupModal() {
    showEditGroupModal.value = false
    editGroupTarget.value    = null
  }

  function confirmEditGroup() {
    const group = editGroupTarget.value
    if (!group || !editGroupQuantity.value) return
    const oldAllocs = group.allocs.map(a => ({ ...a }))
    const firstAlloc = oldAllocs[0]
    const mpu = firstAlloc ? (firstAlloc.minutes || 0) / (firstAlloc.quantity || 1) : 0

    allocations.value = allocations.value.filter(a => !_matchTempKey(a, oldAllocs))

    const newAllocs = _spreadAllocations({
      machine: group.machine, startDate: oldAllocs[0]?.date,
      order: group.order, process: group.process,
      colour: group.colour, size: group.size,
      quantity: editGroupQuantity.value, minutesPerUnit: mpu,
    })
    allocations.value.push(...newAllocs)
    pushHistory({ type: 'EDIT_QUANTITY', oldAllocs, newAllocs })
    closeEditGroupModal()
    toast.success('Updated', 'Group quantity updated')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPLIT GROUP MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openSplitGroupModal(group) {
    splitGroupTarget.value    = group
    splitGroupDate.value      = group.allocs[1]?.date || ''
    showSplitGroupModal.value = true
    closeContextMenu()
  }

  function closeSplitGroupModal() {
    showSplitGroupModal.value = false
    splitGroupTarget.value    = null
    splitGroupDate.value      = ''
  }

  function confirmSplitGroup() {
    const group = splitGroupTarget.value
    if (!group || !splitGroupDate.value) return
    const idx = group.allocs.findIndex(a => a.date >= splitGroupDate.value)
    if (idx <= 0) { toast.warn('Invalid split point'); return }

    const oldAllocs  = group.allocs.map(a => ({ ...a }))
    const tailOld    = oldAllocs.slice(idx)
    const tailNew    = tailOld.map(a => ({ ...a, _tempKey: tempKey(), name: '' }))

    allocations.value = allocations.value.filter(a => !_matchTempKey(a, tailOld))
    allocations.value.push(...tailNew)
    pushHistory({ type: 'SPLIT', oldAllocs, newAllocs: tailNew })
    closeSplitGroupModal()
    toast.success('Split', 'Group split successfully')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFT BY DAYS MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openShiftGroupByDaysModal(group) {
    shiftByDaysTarget.value    = group || contextMenu.value.group
    shiftByDaysCount.value     = 1
    showShiftByDaysModal.value = true
    computeShiftByDaysPreview()
    closeContextMenu()
  }

  function closeShiftByDaysModal() {
    showShiftByDaysModal.value = false
    shiftByDaysTarget.value    = null
    shiftByDaysCount.value     = 1
    shiftByDaysPreview.value   = []
  }

  function computeShiftByDaysPreview() {
    const group = shiftByDaysTarget.value
    if (!group) return
    shiftByDaysPreview.value = group.allocs.map(a => ({
      oldDate:  a.date,
      newDate:  _addWorkingDays(a.date, shiftByDaysCount.value, group.machine),
      quantity: a.quantity,
    }))
  }

  function confirmShiftByDays() {
    const group = shiftByDaysTarget.value
    if (!group) return
    const oldAllocs = group.allocs.map(a => ({ ...a }))
    const newAllocs = shiftByDaysPreview.value
      .map((p, i) => ({ ...oldAllocs[i], date: p.newDate, _tempKey: tempKey(), name: '' }))
      .filter(a => a.date)

    allocations.value = allocations.value.filter(a => !_matchTempKey(a, oldAllocs))
    allocations.value.push(...newAllocs)
    pushHistory({ type: 'SHIFT_DAYS', oldAllocs, newAllocs })
    closeShiftByDaysModal()
    toast.success('Shifted', `Group shifted by ${shiftByDaysCount.value} working day(s)`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFT CONFIRM MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function confirmShift()  { closeShiftModal() }
  function closeShiftModal() {
    showShiftModal.value = false
    shiftModalData.value = { group: null, allocs: [], newDates: [] }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKFILL MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function confirmBackfill()  { _doDelete(); closeBackfillModal() }
  function declineBackfill()  { _doDelete(); closeBackfillModal() }
  function cancelDeleteGroup() { closeBackfillModal() }

  function _doDelete() {
    const { group } = backfillModalData.value
    if (group) _deleteGroupByKey(group.key)
  }

  function closeBackfillModal() {
    showBackfillModal.value = false
    backfillModalData.value = { group: null, machine: '', date: '', quantity: 0 }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION CHOICE MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openActionChoice(date, machineId) {
    actionChoiceContext.value = { date, machine: machineId || '' }
    showActionChoice.value    = true
  }

  function closeActionChoice() {
    showActionChoice.value    = false
    actionChoiceContext.value = { date: '', machine: '' }
  }

  function chooseUpdateShift() {
    const { date, machine } = actionChoiceContext.value
    closeActionChoice()
    _openShiftUpdateModal(date, machine)
  }

  function chooseUpdateTime() {
    const { date, machine } = actionChoiceContext.value
    closeActionChoice()
    openAlterationDialog(date, machine)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFT UPDATE MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function _openShiftUpdateModal(date, machineId) {
    const shift  = getShiftForDate(date, machineId)
    const shifts = shift?.shifts?.map(s => s.name || s) || (shift?.name ? [shift.name] : [])
    shiftUpdateForm.value      = { date, machine: machineId || '', shifts }
    showShiftUpdateModal.value = true
  }

  function closeShiftUpdateModal() {
    showShiftUpdateModal.value = false
    shiftUpdateForm.value      = { date: '', machine: '', shifts: [] }
  }

  async function confirmShiftUpdate() {
    shiftUpdateSaving.value = true
    try {
      await apiUpdateDateShift(
        shiftUpdateForm.value.date,
        shiftUpdateForm.value.shifts,
        shiftUpdateForm.value.machine || null,
      )
      await loadShiftAllocations()
      toast.success('Shift updated')
      closeShiftUpdateModal()
    } catch (e) { toast.error('Failed to update shift', e.message) }
    finally { shiftUpdateSaving.value = false }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ALTERATION MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openAlterationDialog(date, machineId) {
    alterationForm.value      = { date, machine: machineId || '', alteration_type: 'Add', minutes: 60, reason: '' }
    showAlterationModal.value = true
  }

  function closeAlterationModal() { showAlterationModal.value = false }

  async function confirmAlteration() {
    if (!alterationForm.value.minutes) { toast.warn('Enter minutes'); return }
    alterationSaving.value = true
    try {
      await apiAddShiftAlteration(
        alterationForm.value.date,
        alterationForm.value.alteration_type,
        alterationForm.value.minutes,
        alterationForm.value.machine || null,
        alterationForm.value.reason  || null,
      )
      await loadShiftAllocations()
      toast.success('Alteration added')
      closeAlterationModal()
    } catch (e) { toast.error('Failed to add alteration', e.message) }
    finally { alterationSaving.value = false }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT ALTERATIONS MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openEditAlterationsModal(date, machineId) {
    editAlterationsContext.value = { date, machine_id: machineId || '' }
    const shift = getShiftForDate(date, machineId)
    editAlterationsList.value   = (shift?.alterations || []).map(a => ({ ...a }))
    showEditAlterationsModal.value = true
  }

  function closeEditAlterationsModal() {
    showEditAlterationsModal.value = false
    editAlterationsList.value      = []
    editAlterationsContext.value   = { date: '', machine_id: '' }
  }

  function addNewFromEditModal() {
    editAlterationsList.value.push({ name: '', alteration_type: 'Add', minutes: 60, reason: '' })
  }

  async function saveAlteration(idx) {
    const alt = editAlterationsList.value[idx]
    if (!alt) return
    editAlterationsSaving.value = true
    const { date, machine_id } = editAlterationsContext.value
    try {
      if (alt.name) {
        await apiUpdateShiftAlteration(alt.name, alt.alteration_type, alt.minutes, alt.reason)
      } else {
        await apiAddShiftAlteration(date, alt.alteration_type, alt.minutes, machine_id || null, alt.reason || null)
      }
      await loadShiftAllocations()
      openEditAlterationsModal(date, machine_id)
      toast.success('Saved')
    } catch (e) { toast.error('Failed to save alteration', e.message) }
    finally { editAlterationsSaving.value = false }
  }

  async function deleteAlteration(idx) {
    const alt = editAlterationsList.value[idx]
    if (!alt) return
    if (!alt.name) { editAlterationsList.value.splice(idx, 1); return }
    editAlterationsSaving.value = true
    const { date, machine_id } = editAlterationsContext.value
    try {
      await apiDeleteShiftAlteration(alt.name, alt.parent)
      await loadShiftAllocations()
      openEditAlterationsModal(date, machine_id)
      toast.success('Deleted')
    } catch (e) { toast.error('Failed to delete alteration', e.message) }
    finally { editAlterationsSaving.value = false }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BULK SHIFT MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function openBulkShiftModal() {
    bulkShiftDate.value      = ''
    bulkShiftMachines.value  = []
    showBulkShiftModal.value = true
  }

  function closeBulkShiftModal() {
    showBulkShiftModal.value = false
    bulkShiftDate.value      = ''
    bulkShiftMachines.value  = []
  }

  async function loadBulkShiftMachines(dateStr) {
    bulkShiftMachines.value = machines.value.map(m => ({
      machine_id:         m.name,
      machine_name:       m.machine_name || m.name,
      shift_name:         getShiftNamesForDate(dateStr, m.name),
      total_minutes:      getEffectiveMinutes(dateStr, m.name),
      allocated_minutes:  getUsedMinutes(dateStr, m.name),
      alteration_type:    'Add',
      update_minutes:     0,
    }))
  }

  async function applyBulkShiftUpdates() {
    const rows = bulkShiftMachines.value.filter(r => r.update_minutes > 0)
    if (!rows.length) return
    bulkShiftSaving.value = true
    try {
      await Promise.all(rows.map(r =>
        apiAddShiftAlteration(bulkShiftDate.value, r.alteration_type, r.update_minutes, r.machine_id, null)
      ))
      await loadShiftAllocations()
      toast.success('Bulk updates applied')
      closeBulkShiftModal()
    } catch (e) { toast.error('Failed to apply bulk updates', e.message) }
    finally { bulkShiftSaving.value = false }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  function _addWorkingDays(dateStr, days, machineId) {
    const d   = new Date(dateStr + 'T00:00:00')
    let rem   = Math.abs(days)
    const dir = days >= 0 ? 1 : -1
    while (rem > 0) {
      d.setDate(d.getDate() + dir)
      if (!isOffDay(d.toISOString().slice(0, 10), machineId)) rem--
    }
    return d.toISOString().slice(0, 10)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN STORE OBJECT
  // ═══════════════════════════════════════════════════════════════════════════

  return {
    // ── State refs ──────────────────────────────────────────────────────────
    processes, machines, orders, allShifts,
    selectedCustomer, selectedOrder, selectedOrderLabel,
    selectedProcess, selectedMachineGG, viewType,
    startDate, endDate,
    orderData, itemMachineGG,
    shiftAllocations, defaultAllocation, allocations,
    actionHistory, redoHistory,
    validationErrors, isSaving,
    workloadCollapsed, isZoomedOut, applyZoom,
    draggingItem, droppedAllocKeys, deletedBlocks,
    selectedGroup, splitMarkers,
    contextMenu, tooltip,
    // ── Modal state ─────────────────────────────────────────────────────────
    showDropModal, pendingDrop, dropQuantity,
    showShiftModal, shiftModalData,
    showBackfillModal, backfillModalData,
    showEditGroupModal, editGroupQuantity,
    showSplitGroupModal, splitGroupDate,
    showShiftByDaysModal, shiftByDaysCount, shiftByDaysPreview,
    showActionChoice, actionChoiceContext,
    showShiftUpdateModal, shiftUpdateForm, shiftUpdateSaving,
    showAlterationModal, alterationForm, alterationSaving,
    showEditAlterationsModal, editAlterationsContext, editAlterationsList, editAlterationsSaving,
    showBulkShiftModal, bulkShiftSaving, bulkShiftDate, bulkShiftMachines,
    // ── Computed ────────────────────────────────────────────────────────────
    dateRange, filteredMachines, availableProcesses,
    workloadItems, ganttGridStyle,
    groupedAllocations, groupedAllocationsWithLanes,
    selectedShiftsTotalMinutes,
    // ── Init ────────────────────────────────────────────────────────────────
    loadInitialData, refreshCalendar,
    // ── Order ───────────────────────────────────────────────────────────────
    onOrderChange, onProcessChange,
    // ── Save ────────────────────────────────────────────────────────────────
    saveAllocations,
    // ── Undo / Redo ─────────────────────────────────────────────────────────
    undoLastAction, redoLastAction,
    // ── Calendar DOM ────────────────────────────────────────────────────────
    setCalendarWrapper, onWrapperDragOver, onCalendarScroll,
    // ── DnD ─────────────────────────────────────────────────────────────────
    onDragStart, onDragEnd,
    onWorkloadDragOver, onWorkloadDrop,
    onDeletedBlockDragStart,
    onCellDragOver, onDrop, onBarDrop, onGroupDragStart,
    // ── Context menu / Tooltip ──────────────────────────────────────────────
    onBarContextMenu, closeContextMenu,
    showTooltip, hideTooltip, onSnapAnimationEnd, isJustDropped,
    selectGroup,
    // ── Group ops ───────────────────────────────────────────────────────────
    moveGroup, deleteGroup,
    clearDeletedBlocks, removeDeletedBlock,
    // ── Drop modal ──────────────────────────────────────────────────────────
    closeDropModal, confirmDrop,
    // ── Shift confirm modal ─────────────────────────────────────────────────
    confirmShift, closeShiftModal,
    // ── Backfill modal ──────────────────────────────────────────────────────
    confirmBackfill, declineBackfill, cancelDeleteGroup, closeBackfillModal,
    // ── Edit group modal ────────────────────────────────────────────────────
    openEditGroupModal, closeEditGroupModal, confirmEditGroup,
    // ── Split group modal ───────────────────────────────────────────────────
    openSplitGroupModal, closeSplitGroupModal, confirmSplitGroup,
    // ── Shift by days modal ─────────────────────────────────────────────────
    openShiftGroupByDaysModal, closeShiftByDaysModal, computeShiftByDaysPreview, confirmShiftByDays,
    // ── Action choice modal ─────────────────────────────────────────────────
    openActionChoice, closeActionChoice, chooseUpdateShift, chooseUpdateTime,
    // ── Shift update modal ──────────────────────────────────────────────────
    closeShiftUpdateModal, confirmShiftUpdate,
    // ── Alteration modal ────────────────────────────────────────────────────
    openAlterationDialog, closeAlterationModal, confirmAlteration,
    // ── Edit alterations modal ──────────────────────────────────────────────
    openEditAlterationsModal, closeEditAlterationsModal,
    saveAlteration, deleteAlteration, addNewFromEditModal,
    // ── Bulk shift modal ────────────────────────────────────────────────────
    openBulkShiftModal, closeBulkShiftModal, loadBulkShiftMachines, applyBulkShiftUpdates,
    // ── Date / shift helpers ────────────────────────────────────────────────
    formatDate, formatDayName, fmtDate,
    isToday, isPastDate, isOffDay,
    hasMachineSpecificShift, getShiftForDate, getShiftNamesForDate,
    getEffectiveMinutes, getDayAlterationDelta, getCellAlterationBadge,
    getUsedMinutes, getCapacityPercentage, getCapacityBarClass,
    getDateHeaderClass, getCellClass,
    // ── Bar / group helpers ─────────────────────────────────────────────────
    getAllocationColor,
    getGroupsForMachine, getAllocatedQuantity, getAllocationStatus,
    isValidForProcess, isMachineCompatible,
    getBarStyle, getBarLayerHeight,
  }
}
