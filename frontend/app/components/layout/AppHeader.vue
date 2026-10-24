<script setup lang="ts">
import { breadcrumbFor } from '../../utils/nav'

const route = useRoute()
const emit = defineEmits<{ 'open-nav': [] }>()

const crumbs = computed(() => breadcrumbFor(route.path))

/** Header "Add Time" → timesheet, with the quick-add drawer already requested. */
function openQuickAdd(): void {
  if (route.path !== '/') {
    void navigateTo('/')
  }
  useQuickAdd().open(null)
}
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-outline-variant bg-surface/85 px-4 backdrop-blur-xl md:px-6"
  >
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface lg:hidden"
        aria-label="Open navigation"
        data-testid="open-nav"
        @click="emit('open-nav')"
      >
        <i class="pi pi-bars text-base" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb">
        <ol class="flex min-w-0 items-center gap-2 text-xs">
          <li class="flex min-w-0 items-center gap-2">
            <NuxtLink
              to="/"
              class="truncate text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Workspace
            </NuxtLink>
            <span class="text-outline" aria-hidden="true">/</span>
          </li>
          <li class="truncate font-medium text-on-surface" aria-current="page">
            {{ crumbs.at(-1)?.label }}
          </li>
        </ol>
      </nav>
    </div>

    <div class="flex shrink-0 items-center gap-2 md:gap-3">
      <ThemeToggle />

      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-fixed-dim"
        data-testid="add-time-button"
        @click="openQuickAdd()"
      >
        <i class="pi pi-plus text-sm" aria-hidden="true" />
        <span class="hidden sm:inline">Add Time</span>
      </button>
    </div>
  </header>
</template>