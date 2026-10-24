<script setup lang="ts">
import type { WeekTotals } from '../../types/api'

/**
 * Bottom summary strip: hours against target, gross unbilled value, and the
 * distinct client / client-project / standalone-project counts.
 */
defineProps<{
  totals: WeekTotals
  clientProjects: number
  standaloneProjects: number
  currencySymbol: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container p-4 md:flex-row"
    data-testid="week-summary"
  >
    <div class="flex w-full flex-wrap items-center gap-6 md:w-auto">
      <div class="flex items-center gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <i class="pi pi-clock text-xl" />
        </span>
        <div>
          <span class="block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Logged Hours
          </span>
          <span class="flex items-baseline gap-1.5">
            <span class="font-mono text-xl font-bold text-on-surface" data-testid="summary-hours">
              {{ formatHours(totals.totalHours) }}
            </span>
            <span class="font-mono text-xs text-on-surface-variant">/ {{ formatHours(totals.targetHours) }} hrs</span>
          </span>
        </div>
      </div>

      <span class="hidden h-8 w-px bg-outline-variant sm:block" aria-hidden="true" />

      <div class="flex items-center gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-tertiary/30 bg-tertiary/15 text-tertiary"
          aria-hidden="true"
        >
          <i class="pi pi-wallet text-xl" />
        </span>
        <div>
          <span class="block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Gross Unbilled Value
          </span>
          <span class="font-mono text-xl font-bold text-tertiary" data-testid="summary-gross">
            {{ formatMoney(totals.projectedGross, currencySymbol) }}
          </span>
        </div>
      </div>

      <span class="hidden h-8 w-px bg-outline-variant lg:block" aria-hidden="true" />

      <div class="flex items-center gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant"
          aria-hidden="true"
        >
          <i class="pi pi-users text-xl" />
        </span>
        <div>
          <span class="block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Breakdown
          </span>
          <span class="font-mono text-xs text-on-surface">
            <span data-testid="summary-clients">{{ totals.clientCount }}</span> clients
            <span aria-hidden="true"> • </span>
            <span data-testid="summary-client-projects">{{ clientProjects }}</span> client projects
            <span aria-hidden="true"> • </span>
            <span data-testid="summary-standalone-projects">{{ standaloneProjects }}</span> standalone
          </span>
        </div>
      </div>
    </div>

    <div class="shrink-0 text-right">
      <span class="block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        Records
      </span>
      <span class="font-mono text-xl font-bold text-on-surface">{{ totals.recordCount }}</span>
    </div>
  </div>
</template>