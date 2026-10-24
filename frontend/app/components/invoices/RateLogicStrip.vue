<script setup lang="ts">
import type { ClientSummary } from '../../types/api'
import { buildRateLogic } from '../../composables/useInvoices'
import type { InvoiceCardData } from '../../composables/useInvoices'

/**
 * R2/R3 rate-logic strip (invoice_generator design).
 *
 * The invoice snapshots a rate per line but not its origin, so `buildRateLogic`
 * compares each project's rate against the client's default. Every entry is
 * real contract data — nothing here is decorative.
 */
const props = defineProps<{
  card: InvoiceCardData
  clients: ClientSummary[]
}>()

const entries = computed(() => buildRateLogic(props.card, props.clients))

/** True when at least one project overrides the client default — drives the highlight tone. */
const hasOverride = computed(() => entries.value.some(entry => entry.source === 'project'))

function rateLabel(source: 'client' | 'project', rate: number, clientRate: number | null): string {
  const symbol = props.card.currencySymbol
  if (source === 'client') {
    return `Client default rate (${formatMoney(rate, symbol)}/hr)`
  }
  const suffix = clientRate === null ? '' : ` — client default is ${formatMoney(clientRate, symbol)}/hr`
  return `Project rate override: ${formatMoney(rate, symbol)}/hr${suffix}`
}
</script>

<template>
  <div
    class="flex flex-col gap-2 border-y border-outline-variant px-4 py-3"
    :class="hasOverride ? 'bg-warning/10' : 'bg-surface-container-low'"
    data-testid="rate-logic-strip"
  >
    <div class="flex flex-wrap items-center gap-2">
      <i
        class="text-sm"
        :class="hasOverride ? 'text-warning' : 'text-primary'"
        aria-hidden="true"
      >
        <span :class="hasOverride ? 'pi pi-bolt' : 'pi pi-sliders-h'" />
      </i>
      <span class="bf-label" :class="hasOverride ? 'text-warning' : 'text-primary'">Rate Logic</span>
      <span
        v-for="entry in entries"
        :key="entry.projectId ?? 'none'"
        class="rounded border px-2 py-0.5 font-mono text-[11px]"
        :class="entry.source === 'project'
          ? 'border-warning/40 bg-warning/15 text-warning'
          : 'border-outline-variant bg-surface-container-high text-on-surface-variant'"
        :data-testid="`rate-logic-${entry.projectId ?? 'none'}`"
      >
        {{ rateLabel(entry.source, entry.rate, entry.clientRate) }}
      </span>
    </div>

    <p class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
      <span v-for="entry in entries" :key="`${entry.projectId ?? 'none'}-hours`">
        {{ entry.projectName }}: <span class="font-mono">{{ formatHours(entry.hours) }}</span>
      </span>
    </p>
  </div>
</template>