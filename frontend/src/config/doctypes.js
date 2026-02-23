/**
 * Static registry of all 14 Albion main DocTypes.
 * Used for sidebar rendering and DocType resolution (no DB fetch needed).
 */

const DOCTYPES = [
  // ── Production ──
  { doctype: 'Machine', route: 'machines', label: 'Machines', icon: 'settings', group: 'Production', sortOrder: 1, isSubmittable: false, isSingle: false },
  { doctype: 'Machine GG', route: 'machine-gg', label: 'Machine GG', icon: 'grid', group: 'Production', sortOrder: 2, isSubmittable: false, isSingle: false },
  { doctype: 'Machine Operation', route: 'machine-operations', label: 'Machine Operations', icon: 'sliders', group: 'Production', sortOrder: 3, isSubmittable: false, isSingle: false, hideSidebar: true },
  { doctype: 'Process', route: 'processes', label: 'Processes', icon: 'network', group: 'Production', sortOrder: 4, isSubmittable: false, isSingle: false },
  { doctype: 'Shift', route: 'shifts', label: 'Shifts', icon: 'clock', group: 'Production', sortOrder: 5, isSubmittable: false, isSingle: false },
  { doctype: 'Shift Allocation', route: 'shift-allocations', label: 'Shift Allocations', icon: 'calendar', group: 'Production', sortOrder: 6, isSubmittable: false, isSingle: false },

  // ── Masters ──
  { doctype: 'Item', route: 'items', label: 'Items', icon: 'box', group: 'Masters', sortOrder: 10, isSubmittable: false, isSingle: false },
  { doctype: 'Colour', route: 'colours', label: 'Colours', icon: 'palette', group: 'Masters', sortOrder: 11, isSubmittable: false, isSingle: false },
  { doctype: 'Size', route: 'sizes', label: 'Sizes', icon: 'expand', group: 'Masters', sortOrder: 12, isSubmittable: false, isSingle: false },
  { doctype: 'Size Range', route: 'size-ranges', label: 'Size Ranges', icon: 'list', group: 'Masters', sortOrder: 13, isSubmittable: false, isSingle: false },
  { doctype: 'Customer', route: 'customers', label: 'Customers', icon: 'users', group: 'Masters', sortOrder: 14, isSubmittable: false, isSingle: false },

  // ── Orders ──
  { doctype: 'Order', route: 'orders', label: 'Orders', icon: 'shopping-cart', group: 'Orders', sortOrder: 20, isSubmittable: true, isSingle: false },
  { doctype: 'Albion Import', route: 'albion-imports', label: 'Albion Import', icon: 'upload', group: 'Orders', sortOrder: 21, isSubmittable: true, isSingle: false, hideSidebar: true },

  // ── Admin ──
  { doctype: 'User', route: 'users', label: 'Users', icon: 'user', group: 'Admin', sortOrder: 25, isSubmittable: false, isSingle: false },

  // ── System ──
  { doctype: 'Albion Settings', route: 'settings', label: 'Settings', icon: 'wrench', group: 'System', sortOrder: 30, isSubmittable: false, isSingle: true, hideSidebar: true },
]

const GROUP_ORDER = ['Production', 'Masters', 'Orders', 'Admin', 'System']

export function getRegistryByRoute(slug) {
  return DOCTYPES.find((d) => d.route === slug) || null
}

export function getRegistryByDoctype(name) {
  return DOCTYPES.find((d) => d.doctype === name) || null
}

export function getSidebarGroups() {
  return GROUP_ORDER.map((group) => ({
    group,
    items: DOCTYPES.filter((d) => d.group === group && !d.hideSidebar).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0)
}

export { DOCTYPES }
