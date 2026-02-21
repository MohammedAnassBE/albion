/**
 * Static registry of all 14 Albion main DocTypes.
 * Used for sidebar rendering and DocType resolution (no DB fetch needed).
 */

const DOCTYPES = [
  // ── Production ──
  { doctype: 'Machine', route: 'machines', label: 'Machines', icon: 'pi pi-cog', group: 'Production', sortOrder: 1, isSubmittable: false, isSingle: false },
  { doctype: 'Machine GG', route: 'machine-gg', label: 'Machine GG', icon: 'pi pi-th-large', group: 'Production', sortOrder: 2, isSubmittable: false, isSingle: false },
  { doctype: 'Machine Operation', route: 'machine-operations', label: 'Machine Operations', icon: 'pi pi-sliders-h', group: 'Production', sortOrder: 3, isSubmittable: false, isSingle: false },
  { doctype: 'Process', route: 'processes', label: 'Processes', icon: 'pi pi-sitemap', group: 'Production', sortOrder: 4, isSubmittable: false, isSingle: false },
  { doctype: 'Shift', route: 'shifts', label: 'Shifts', icon: 'pi pi-clock', group: 'Production', sortOrder: 5, isSubmittable: false, isSingle: false },
  { doctype: 'Shift Allocation', route: 'shift-allocations', label: 'Shift Allocations', icon: 'pi pi-calendar', group: 'Production', sortOrder: 6, isSubmittable: false, isSingle: false },

  // ── Masters ──
  { doctype: 'Item', route: 'items', label: 'Items', icon: 'pi pi-box', group: 'Masters', sortOrder: 10, isSubmittable: false, isSingle: false },
  { doctype: 'Colour', route: 'colours', label: 'Colours', icon: 'pi pi-palette', group: 'Masters', sortOrder: 11, isSubmittable: false, isSingle: false },
  { doctype: 'Size', route: 'sizes', label: 'Sizes', icon: 'pi pi-arrows-alt', group: 'Masters', sortOrder: 12, isSubmittable: false, isSingle: false },
  { doctype: 'Size Range', route: 'size-ranges', label: 'Size Ranges', icon: 'pi pi-list', group: 'Masters', sortOrder: 13, isSubmittable: false, isSingle: false },
  { doctype: 'Customer', route: 'customers', label: 'Customers', icon: 'pi pi-users', group: 'Masters', sortOrder: 14, isSubmittable: false, isSingle: false },

  // ── Orders ──
  { doctype: 'Order', route: 'orders', label: 'Orders', icon: 'pi pi-shopping-cart', group: 'Orders', sortOrder: 20, isSubmittable: true, isSingle: false },
  { doctype: 'Albion Import', route: 'albion-imports', label: 'Albion Import', icon: 'pi pi-upload', group: 'Orders', sortOrder: 21, isSubmittable: true, isSingle: false },

  // ── System ──
  { doctype: 'Albion Settings', route: 'settings', label: 'Settings', icon: 'pi pi-wrench', group: 'System', sortOrder: 30, isSubmittable: false, isSingle: true },
]

const GROUP_ORDER = ['Production', 'Masters', 'Orders', 'System']

export function getRegistryByRoute(slug) {
  return DOCTYPES.find((d) => d.route === slug) || null
}

export function getRegistryByDoctype(name) {
  return DOCTYPES.find((d) => d.doctype === name) || null
}

export function getSidebarGroups() {
  return GROUP_ORDER.map((group) => ({
    group,
    items: DOCTYPES.filter((d) => d.group === group).sort((a, b) => a.sortOrder - b.sortOrder),
  }))
}

export { DOCTYPES }
