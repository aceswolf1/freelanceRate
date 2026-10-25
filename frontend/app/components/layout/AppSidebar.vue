<script setup lang="ts">
import { NAV_ITEMS, isNavItemActive } from '../../utils/nav'

const route = useRoute()
const path = computed(() => route.path)

/** Lets the mobile drawer close itself after any navigation. */
const emit = defineEmits<{ navigate: [] }>()

function isActive(item: (typeof NAV_ITEMS)[number]): boolean {
  return isNavItemActive(item, path.value)
}
</script>

<template>
  <div class="flex h-full flex-col justify-between overflow-y-auto">
    <div>
      <!-- Brand -->
      <div class="border-b border-outline-variant/80 p-5">
        <NuxtLink to="/" class="flex items-center gap-3" @click="emit('navigate')">
          <span
            class="flex size-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container"
            aria-hidden="true"
          >
            <i class="pi pi-receipt text-xl" />
          </span>
          <span class="flex flex-col">
            <span class="flex items-center gap-1.5 text-base font-bold tracking-tight text-on-surface">
              BillFlow
              <span class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-normal text-primary">v1.0</span>
            </span>
            <span class="text-[11px] leading-none text-on-surface-variant">Freelance Ops System</span>
          </span>
        </NuxtLink>

        <div class="mt-4">
          <ActiveWeekCard />
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        <NuxtLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm transition-colors"
          :class="isActive(item)
            ? 'bg-primary-container/40 font-semibold text-primary ring-1 ring-primary/40'
            : 'font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'"
          :aria-current="isActive(item) ? 'page' : undefined"
          :data-testid="`nav-${item.to === '/' ? 'timesheet' : item.to.slice(1)}`"
          @click="emit('navigate')"
        >
          <i :class="[iconClass(item.icon), 'text-[20px]']" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </div>

    <!-- User card -->
    <div class="border-t border-outline-variant/80 p-3">
      <NuxtLink
        to="/settings"
        class="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-high p-2.5 transition-colors hover:border-outline"
        @click="emit('navigate')"
      >
        <span class="flex min-w-0 items-center gap-2.5">
          <span
            class="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary"
            aria-hidden="true"
          >
            <i class="pi pi-user text-[16px] text-on-primary" />
          </span>
          <span class="flex min-w-0 flex-col leading-tight">
            <UserCard />
          </span>
        </span>
        <i class="pi pi-ellipsis-v text-sm text-on-surface-variant" aria-hidden="true" />
      </NuxtLink>
    </div>
  </div>
</template>