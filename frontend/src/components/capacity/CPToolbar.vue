<template>
  <div class="cp-toolbar">
    <div class="toolbar-filters" v-show="!store.isZoomedOut.value">
      <div class="filter-field">
        <label class="filter-label">Customer</label>
        <AutoComplete
          v-model="store.selectedCustomer.value"
          :suggestions="customerSuggestions"
          @complete="searchCustomers"
          @item-select="onCustomerSelect"
          @clear="onCustomerClear"
          optionLabel="value"
          placeholder="All customers"
          fluid
          class="filter-autocomplete"
        />
      </div>
      <div class="filter-field">
        <label class="filter-label">Order</label>
        <AutoComplete
          v-model="store.selectedOrderLabel.value"
          :suggestions="orderSuggestions"
          @complete="searchOrders"
          @item-select="onOrderSelect"
          @clear="onOrderClear"
          optionLabel="value"
          placeholder="Select order"
          fluid
          class="filter-autocomplete"
        />
      </div>
      <div class="filter-field">
        <label class="filter-label">Process</label>
        <Select
          v-model="store.selectedProcess.value"
          :options="store.availableProcesses.value"
          optionLabel="name"
          optionValue="name"
          placeholder="Select process"
          @change="store.onProcessChange()"
          fluid
          class="filter-select"
        />
      </div>
      <div class="filter-field">
        <label class="filter-label">View Type</label>
        <Select
          v-model="store.viewType.value"
          :options="viewTypes"
          optionLabel="label"
          optionValue="value"
          fluid
          class="filter-select"
        />
      </div>
      <div class="filter-field">
        <label class="filter-label">Machine GG</label>
        <AutoComplete
          v-model="store.selectedMachineGG.value"
          :suggestions="machineGGSuggestions"
          @complete="searchMachineGG"
          @item-select="(e) => store.selectedMachineGG.value = e.value.value"
          @clear="store.selectedMachineGG.value = ''"
          optionLabel="value"
          placeholder="All gauges"
          fluid
          class="filter-autocomplete"
        />
      </div>
    </div>
    <div class="toolbar-actions">
      <label v-if="store.applyZoom.value" class="zoom-toggle">
        <span>Compact</span>
        <ToggleSwitch v-model="store.isZoomedOut.value" />
      </label>
      <Button
        v-show="!store.isZoomedOut.value"
        label="Undo"
        icon="pi pi-undo"
        severity="secondary"
        text
        size="small"
        :disabled="store.actionHistory.value.length === 0"
        @click="store.undoLastAction()"
      />
      <Button
        v-show="!store.isZoomedOut.value"
        label="Redo"
        icon="pi pi-replay"
        severity="secondary"
        text
        size="small"
        :disabled="store.redoHistory.value.length === 0"
        @click="store.redoLastAction()"
      />
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        @click="store.refreshCalendar()"
      />
      <Button
        v-show="!store.isZoomedOut.value"
        label="Shifts"
        icon="pi pi-clock"
        severity="secondary"
        size="small"
        @click="store.openBulkShiftModal()"
      />
      <Button
        v-show="!store.isZoomedOut.value"
        label="Save"
        icon="pi pi-check"
        size="small"
        :loading="store.isSaving.value"
        @click="store.saveAllocations()"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { AutoComplete, Select, Button, ToggleSwitch } from 'primevue'
import { useCapacityStore } from '@/composables/useCapacityPlanning'
import { callMethod } from '@/api/client'

const store = useCapacityStore()

const viewTypes = [
  { label: 'Item Wise', value: 'item_wise' },
  { label: 'Colour Wise', value: 'colour_wise' },
  { label: 'Size Wise', value: 'size_wise' },
]

const customerSuggestions = ref([])
const orderSuggestions = ref([])
const machineGGSuggestions = ref([])

async function searchCustomers(event) {
  try {
    const res = await callMethod('frappe.client.get_list', {
      doctype: 'Customer',
      filters: [['name', 'like', `%${event.query}%`]],
      fields: ['name'],
      limit_page_length: 20,
    })
    customerSuggestions.value = (res || []).map(r => ({ value: r.name }))
  } catch { customerSuggestions.value = [] }
}

async function searchOrders(event) {
  try {
    const filters = [['name', 'like', `%${event.query}%`]]
    if (store.selectedCustomer.value) filters.push(['customer', '=', store.selectedCustomer.value])
    const res = await callMethod('frappe.client.get_list', {
      doctype: 'Order',
      filters,
      fields: ['name'],
      limit_page_length: 20,
    })
    orderSuggestions.value = (res || []).map(r => ({ value: r.name }))
  } catch { orderSuggestions.value = [] }
}

async function searchMachineGG(event) {
  try {
    const res = await callMethod('frappe.client.get_list', {
      doctype: 'Machine GG',
      filters: [['name', 'like', `%${event.query}%`]],
      fields: ['name'],
      limit_page_length: 20,
    })
    machineGGSuggestions.value = (res || []).map(r => ({ value: r.name }))
  } catch { machineGGSuggestions.value = [] }
}

function onCustomerSelect(e) {
  store.selectedCustomer.value = e.value.value
  store.selectedOrderLabel.value = ''
  store.selectedOrder.value = ''
  store.orderData.value = null
}

function onCustomerClear() {
  store.selectedCustomer.value = ''
}

function onOrderSelect(e) {
  store.selectedOrder.value = e.value.value
  store.selectedOrderLabel.value = e.value.value
  store.onOrderChange()
}

function onOrderClear() {
  store.selectedOrder.value = ''
  store.selectedOrderLabel.value = ''
  store.orderData.value = null
}
</script>

<style scoped>
.cp-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 10px 16px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.toolbar-filters {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.filter-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.filter-autocomplete,
.filter-select {
  min-width: 140px;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.zoom-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-color-secondary);
  cursor: pointer;
}
</style>
