<script setup lang="ts">
import type { WeekTotals } from '../../types/api'

/**
 * R8 target banner. Informational only — it never blocks invoicing.
 * Contract §3.6 supplies every number; the sentence is assembled here.
 */
const props = defineProps<{
  totals: WeekTotals
  currencySymbol: string
}>()

const percent = computed(() => toPercent(props.totals.totalHours, props.totals.targetHours))
const isBelow = computed(() => props.totals.belowTarget)
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
    :class="isBelow ? 'border-warning/30 bg-warning/10' : 'border-tertiary/30 bg-tertiary/10'"
    data-testid="target-banner"
    :data-below-target="isBelow"
  >
    <div class="flex items-start gap-3.5">
      <span
        class="flex size-9 shrink-0 items-center justify-center rounded-lg border"
        :class="isBelow ? 'border-warning/30 bg-warning/15 text-warning' : 'border-tertiary/30 bg-tertiary/15 text-tertiary'"
        aria-hidden="true"
      >
        <i :class="isBelow ? 'pi pi-exclamation-triangle' : 'pi pi-check'" />
      </span>
      <div>
        <div class="flex flex-wrap items-center gap-2.5">
          <h2 class="text-sm font-semibold text-on-surface">
            {{ formatHours(totals.totalHours, '') }} / {{ formatHours(totals.targetHours, '') }} hrs logged this week
          </h2>
          <span
            v-if="isBelow"
            class="rounded border border-warning/30 bg-warning/15 px-2 py-0.5 font-mono text-[11px] font-medium text-warning"
            data-testid="below-target-badge"
          >
            -{{ formatHours(totals.hoursBelowTarget, '') }} hrs below target
          </span>
        </div>
        <p class="mt-1 text-xs text-on-surface-variant">
          Billable:
          <span class="font-mono font-medium text-on-surface">{{ formatHours(totals.totalHours) }}</span>
          <span aria-hidden="true"> • </span>
          Projected Value:
          <span class="font-mono font-bold text-tertiary">{{ formatMoney(totals.projectedGross, currencySymbol) }}</span>
          <span aria-hidden="true"> • </span>
          {{ totals.recordCount }} record{{ totals.recordCount === 1 ? '' : 's' }}
        </p>
      </div>
    </div>

    <div class="w-full shrink-0 md:w-80">
      <div class="flex items-center justify-between font-mono text-xs text-on-surface-variant">
        <span>Weekly Target Progress</span>
        <span class="font-semibold text-on-surface">{{ percent.toFixed(2) }}%</span>
      </div>
      <div
        class="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-outline-variant bg-surface-container-low"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Weekly target progress: ${percent.toFixed(2)} percent`"
      >
        <div
          class="h-full rounded-full bg-gradient-to-r from-primary-container to-primary transition-all duration-500"
          :style="{ width: `${percent}%` }"
        />
      </div>
      <div class="mt-1 flex justify-between font-mono text-[10px] text-on-surface-variant">
        <span>0h</span>
        <span class="text-tertiary">{{ formatHours(totals.totalHours) }} actual</span>
        <span>{{ formatHours(totals.targetHours) }} goal</span>
      </div>
    </div>
  </div>
</template>