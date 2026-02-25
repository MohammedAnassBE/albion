/**
 * Static registry of all 14 Albion main DocTypes.
 * Used for sidebar rendering and DocType resolution (no DB fetch needed).
 */

const DOCTYPES = [
  // ── Dashboard ──
  { route: 'dashboard', label: 'Dashboard', icon: 'grid', group: 'Dashboard', sortOrder: 0, hideSidebar: false },
  { route: 'capacity-planning', label: 'Capacity Planning', icon: 'bar-chart', group: 'Dashboard', sortOrder: 1, hideSidebar: false },

  // ── Production ──
  { doctype: 'Process', route: 'processes', label: 'Processes', icon: 'network', group: 'Production', sortOrder: 1, isSubmittable: false, isSingle: false },
  { doctype: 'Machine', route: 'machines', label: 'Machines', icon: 'settings', group: 'Production', sortOrder: 2, isSubmittable: false, isSingle: false },
  { doctype: 'Machine Frame', route: 'machine-frame', label: 'Machine Frame', icon: 'grid', group: 'Production', sortOrder: 3, isSubmittable: false, isSingle: false },
  { doctype: 'Machine Operation', route: 'machine-operations', label: 'Machine Operations', icon: 'sliders', group: 'Production', sortOrder: 4, isSubmittable: false, isSingle: false, hideSidebar: true },
  { doctype: 'Shift', route: 'shifts', label: 'Shifts', icon: 'clock', group: 'Production', sortOrder: 5, isSubmittable: false, isSingle: false },
  { doctype: 'Shift Allocation', route: 'shift-allocations', label: 'Shift Allocations', icon: 'calendar', group: 'Production', sortOrder: 6, isSubmittable: false, isSingle: false },

  // ── Masters ──
  { doctype: 'Style', route: 'styles', label: 'Styles', icon: 'box', group: 'Masters', sortOrder: 10, isSubmittable: false, isSingle: false },
  { doctype: 'Client', route: 'clients', label: 'Clients', icon: 'users', group: 'Masters', sortOrder: 11, isSubmittable: false, isSingle: false },
  { doctype: 'Colour', route: 'colours', label: 'Colours', icon: 'palette', group: 'Masters', sortOrder: 12, isSubmittable: false, isSingle: false },
  { doctype: 'Size', route: 'sizes', label: 'Sizes', icon: 'expand', group: 'Masters', sortOrder: 13, isSubmittable: false, isSingle: false },
  { doctype: 'Size Range', route: 'size-ranges', label: 'Size Ranges', icon: 'list', group: 'Masters', sortOrder: 14, isSubmittable: false, isSingle: false },
  { doctype: 'Knitter', route: 'knitters', label: 'Knitters', icon: 'user', group: 'Masters', sortOrder: 15, isSubmittable: false, isSingle: false },
  { doctype: 'Product Developer', route: 'product-developers', label: 'Product Developers', icon: 'user-check', group: 'Masters', sortOrder: 16, isSubmittable: false, isSingle: false },
  { doctype: 'Client Season', route: 'client-seasons', label: 'Client Seasons', icon: 'sun', group: 'Masters', sortOrder: 17, isSubmittable: false, isSingle: false },

  // ── Orders ──
  { doctype: 'Order', route: 'orders', label: 'Orders', icon: 'shopping-cart', group: 'Orders', sortOrder: 20, isSubmittable: true, isSingle: false, hasCloseFeature: true },
  { doctype: 'Order Tracking', route: 'order-tracking', label: 'Order Tracking', icon: 'check-circle', group: 'Orders', sortOrder: 21, isSubmittable: false, isSingle: false, dateTabs: 'completion_date' },
  { doctype: 'Albion Import', route: 'albion-imports', label: 'Albion Import', icon: 'upload', group: 'Orders', sortOrder: 22, isSubmittable: true, isSingle: false, hideSidebar: true },

  // ── Reports ──
  { route: 'production-report', label: 'Production Report', icon: 'file-text', group: 'Reports', sortOrder: 15, hideSidebar: true },
  { route: 'machine-availability', label: 'Machine Availability', icon: 'calendar', group: 'Reports', sortOrder: 16, hideSidebar: true },

  // ── Admin ──
  { doctype: 'User', route: 'users', label: 'Users', icon: 'user', group: 'Admin', sortOrder: 25, isSubmittable: false, isSingle: false },
  { doctype: 'User Listview', route: 'user-listviews', label: 'User Listviews', icon: 'columns', group: 'Admin', sortOrder: 26, isSubmittable: false, isSingle: false, hideSidebar: true },

  // ── System ──
  { doctype: 'Albion Settings', route: 'settings', label: 'Settings', icon: 'wrench', group: 'System', sortOrder: 30, isSubmittable: false, isSingle: true, hideSidebar: true },
  { doctype: 'Currency Exchange', route: 'currency-exchange', label: 'Currency Exchange', icon: 'dollar-sign', group: 'System', sortOrder: 31, isSubmittable: false, isSingle: true },
]

const GROUP_ORDER = ['Dashboard', 'Orders', 'Production', 'Masters', 'Reports', 'Admin', 'System']

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
