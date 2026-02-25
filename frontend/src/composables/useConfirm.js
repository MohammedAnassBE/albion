import { ref } from 'vue'

// Module-level shared state — no provide/inject needed
export const confirmState = ref(null)

export function useAppConfirm() {
  return {
    require(opts) {
      confirmState.value = opts
    },
  }
}
