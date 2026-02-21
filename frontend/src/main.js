import { createApp } from "vue"
import PrimeVue from "primevue/config"
import Aura from "@primevue/themes/aura"
import ToastService from "primevue/toastservice"
import ConfirmationService from "primevue/confirmationservice"
import router from "./router"
import App from "./App.vue"

import "primeicons/primeicons.css"
import "./assets/styles/global.css"
import "./assets/styles/primevue-overrides.css"

const app = createApp(App)
app.use(router)
app.use(PrimeVue, {
	theme: {
		preset: Aura,
		options: {
			darkModeSelector: false,
		},
	},
})
app.use(ToastService)
app.use(ConfirmationService)
app.mount("#app")
