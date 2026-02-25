import { inject } from 'vue'

export function useAppToast() {
  const toast = inject('toast')
  if (!toast) {
    console.warn('useAppToast: no toast provider found. Ensure BaseToast is in App.vue.')
    return {
      success() {},
      error() {},
      warn() {},
      info() {},
    }
  }
  return toast
}
