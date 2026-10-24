<script setup lang="ts">
import type { Settings } from '../types/api'

const route = useRoute()

/**
 * Fetch the settings during SSR so the sidebar's user card shows the real
 * display name on the first paint instead of the fallback ("Consultant").
 *
 * GAP-007: the settings page shares this key, so Nuxt dedupes the request and
 * both share one result.
 */
const { data: ssrSettings } = await useAsyncData<Settings | null>(
  'bf:settings:ssr',
  () => useApi().get<Settings>('/settings', { silent: true }).catch(() => null),
  { default: () => null },
)

// `watch` on the SSR result only — a `watchEffect` calling `useSettings()` would
// also track the shared useState and overwrite every later change with this copy.
const settingsStore = useSettings()
watch(ssrSettings, (next) => {
  if (next) {
    settingsStore.set(next)
  }
}, { immediate: true })

/**
 * Fetch the current week during SSR (GAP-009).
 *
 * The sidebar's ActiveWeekCard used to render before the week was fetched, so
 * the server said "No active week" while the client said "Week 43 Active" —
 * a hydration mismatch on `/` and `/invoices`. Fetching here means both render
 * the same markup. The shared `bf:week:current` key is also what
 * `useCurrentWeekAsync` uses, so Nuxt dedupes the request.
 */
const { data: ssrWeek } = await useCurrentWeekAsync()

// Same reason as above: track only the SSR result, so navigating weeks,
// closing a week or saving a record is not reverted to the SSR copy.
const weeksStore = useWeeks()
watch(ssrWeek, (next) => {
  if (next) {
    weeksStore.set(next)
  }
}, { immediate: true })

/** < lg the sidebar becomes an off-canvas drawer; lg+ it is a permanent column. */
const drawerOpen = ref(false)
const isDesktop = ref(true)

function syncViewport(): void {
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  if (isDesktop.value) {
    drawerOpen.value = false
  }
}

onMounted(() => {
  syncViewport()
  window.matchMedia('(min-width: 1024px)').addEventListener('change', syncViewport)
})

onBeforeUnmount(() => {
  window.matchMedia('(min-width: 1024px)').removeEventListener('change', syncViewport)
})

// The theme is decided before paint by the head script; adopt it on hydration.
onMounted(() => {
  useTheme().syncFromDom()
})

watch(() => route.fullPath, () => {
  drawerOpen.value = false
})

watch(drawerOpen, (open) => {
  if (!import.meta.client) {
    return
  }
  document.documentElement.classList.toggle('overflow-hidden', open && !isDesktop.value)
})
</script>

<template>
  <div class="flex min-h-screen bg-background text-on-surface">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary"
    >
      Skip to main content
    </a>

    <!-- Desktop sidebar -->
    <aside
      class="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low lg:flex"
      data-testid="sidebar"
    >
      <AppSidebar />
    </aside>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <div
        v-if="drawerOpen && !isDesktop"
        class="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/60"
          aria-label="Close navigation"
          data-testid="drawer-scrim"
          @click="drawerOpen = false"
        />
        <div
          class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-outline-variant bg-surface-container-low"
        >
          <div class="flex justify-end p-3">
            <button
              type="button"
              class="inline-flex size-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Close navigation"
              data-testid="close-drawer"
              @click="drawerOpen = false"
            >
              <i class="pi pi-times text-base" aria-hidden="true" />
            </button>
          </div>
          <AppSidebar class="min-h-0 flex-1" @navigate="drawerOpen = false" />
        </div>
      </div>
    </Teleport>

    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader @open-nav="drawerOpen = true" />
      <main id="main-content" class="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
        <slot />
      </main>
    </div>
  </div>
</template>