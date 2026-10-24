import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import AppPreset from './app/theme/preset'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  devtools: { enabled: false },

  modules: [
    '@primevue/nuxt-module',
    '@nuxt/fonts',
    '@vueuse/nuxt',
  ],

  css: [
    'primeicons/primeicons.css',
    '~/assets/css/main.css',
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  primevue: {
    options: {
      ripple: false,
      inputVariant: 'filled',
      theme: {
        preset: AppPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: false,
        },
      },
    },
    autoImport: true,
    components: {
      include: ['Button', 'InputText', 'Select', 'Dialog', 'ConfirmDialog', 'Toast', 'DataTable', 'Column', 'Tag', 'ProgressBar', 'Textarea', 'InputNumber', 'DatePicker', 'ToggleSwitch', 'Tooltip', 'Avatar', 'IconField', 'InputIcon', 'Message', 'Checkbox', 'Drawer', 'ColumnGroup', 'Row', 'SelectButton'],
      // GAP-002: `@primevue/forms` (a transitive dependency of the Nuxt module)
      // registers PrimeVue's `FormField`, which shadowed the app's own form
      // wrapper and stripped every label and inline error. The app does not use
      // PrimeVue's forms API, so it is excluded outright.
      exclude: ['FormField'],
    },
  },

  fonts: {
    defaults: {
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
    },
    families: [
      { name: 'Geist', provider: 'google' },
      { name: 'Geist Mono', provider: 'google' },
    ],
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:4400/api',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'BillFlow',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'BillFlow — freelance time tracking and invoicing' },
      ],
      // Runs before first paint so the persisted theme never flashes (R14).
      script: [
        {
          key: 'theme-boot',
          innerHTML: `(function(){try{var t=localStorage.getItem('billflow:theme');if(t!=='light'){document.documentElement.classList.add('app-dark');}}catch(e){document.documentElement.classList.add('app-dark');}})();`,
          tagPosition: 'head',
        },
      ],
    },
  },

  imports: {
    dirs: ['app/composables/**', 'app/utils/**'],
  },

  components: [
    // Feature folders (`components/layout`, `components/clients`, …) are for
    // organisation only — component names stay flat and readable in templates.
    { path: '~/components', pathPrefix: false },
  ],

  alias: {
    '~': fileURLToPath(new URL('./app', import.meta.url)),
  },

  typescript: {
    typeCheck: false,
    strict: true,
  },
})