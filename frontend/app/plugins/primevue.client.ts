import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'

/**
 * PrimeVue global services.
 * Nuxt module handles the component/theme wiring; services are plain Vue plugins.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ToastService)
  nuxtApp.vueApp.use(ConfirmationService)
})