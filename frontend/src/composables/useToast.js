import { useToast as usePrimeToast } from 'primevue/usetoast'

export function useAppToast() {
  const toast = usePrimeToast()

  function success(summary, detail = '') {
    toast.add({ severity: 'success', summary, detail, life: 3000 })
  }

  function error(summary, detail = '') {
    toast.add({ severity: 'error', summary, detail, life: 5000 })
  }

  function warn(summary, detail = '') {
    toast.add({ severity: 'warn', summary, detail, life: 4000 })
  }

  function info(summary, detail = '') {
    toast.add({ severity: 'info', summary, detail, life: 3000 })
  }

  return { success, error, warn, info }
}
