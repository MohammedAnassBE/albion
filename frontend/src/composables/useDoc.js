import { ref, readonly } from 'vue'
import { getDoc, createDoc, updateDoc, deleteDoc, submitDoc, cancelDoc } from '@/api/client'

export function useDoc(doctype) {
  const doc = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref(null)

  async function load(name) {
    loading.value = true
    error.value = null
    try {
      doc.value = await getDoc(doctype, name)
    } catch (e) {
      error.value = e.message || 'Failed to load'
    } finally {
      loading.value = false
    }
  }

  async function save(data, name = null) {
    saving.value = true
    error.value = null
    try {
      if (name || doc.value?.name) {
        const result = await updateDoc(doctype, name || doc.value.name, data)
        doc.value = result
        return result
      } else {
        const result = await createDoc(doctype, data)
        doc.value = result
        return result
      }
    } catch (e) {
      error.value = e.message || 'Failed to save'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function remove(name = null) {
    saving.value = true
    error.value = null
    try {
      await deleteDoc(doctype, name || doc.value?.name)
      doc.value = null
    } catch (e) {
      error.value = e.message || 'Failed to delete'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function submit(name = null) {
    saving.value = true
    error.value = null
    try {
      const result = await submitDoc(doctype, name || doc.value?.name)
      doc.value = result
      return result
    } catch (e) {
      error.value = e.message || 'Failed to submit'
      throw e
    } finally {
      saving.value = false
    }
  }

  async function cancel(name = null) {
    saving.value = true
    error.value = null
    try {
      const result = await cancelDoc(doctype, name || doc.value?.name)
      doc.value = result
      return result
    } catch (e) {
      error.value = e.message || 'Failed to cancel'
      throw e
    } finally {
      saving.value = false
    }
  }

  function reset() {
    doc.value = null
    error.value = null
  }

  return {
    doc,
    loading: readonly(loading),
    saving: readonly(saving),
    error,
    load,
    save,
    remove,
    submit,
    cancel,
    reset
  }
}
