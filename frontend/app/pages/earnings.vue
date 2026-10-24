<script setup lang="ts">
import { ApiError } from '~/composables/useApi'
import type { DateRange, RangePreset } from '~/composables/useEarnings'
import type { EarningsGroupBy } from '~/types/api'

useHead({ title: 'Earnings' })

const notifier = useNotifier()

const {
  from,
  to,
  groupBy,
  preset,
  rows,
  totals,
  unbilled,
  currencySymbol,
  effectiveRange,
  invalidRange,
  hasUnbilled,
  pending,
  load,
  applyPreset,
  setRange,
  setGroupBy,
} = useEarnings()

const loadError = ref<string | null>(null)

async function refresh(): Promise<void> {
  loadError.value = null
  try {
    await load()
  }
  catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not load earnings.'
  }
}

// Top-level await: the ledger renders server-side and hydrates from the Nuxt
// payload, so there is no client-side spinner on first paint.
await refresh()

/** Preset and group changes fetch themselves; wrap so failures surface as a toast. */
async function onApplyPreset(next: RangePreset): Promise<void> {
  try {
    await applyPreset(next)
  }
  catch (error) {
    notifier.error('Could not apply the range', error instanceof ApiError ? error.message : undefined)
  }
}

async function onSetRange(next: DateRange): Promise<void> {
  try {
    await setRange(next)
  }
  catch (error) {
    notifier.error('Could not apply the range', error instanceof ApiError ? error.message : undefined)
  }
}

async function onSetGroupBy(next: EarningsGroupBy): Promise<void> {
  try {
    await setGroupBy(next)
  }
  catch (error) {
    notifier.error('Could not regroup earnings', error instanceof ApiError ? error.message : undefined)
  }
}

/** Hours logged in range that no issued invoice covers yet (§8.1). */
const unbilledPercent = computed(() => {
  const gross = totals.value.gross
  return gross > 0 ? (unbilled.value.gross / gross) * 100 : 0
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Revenue Ledger"
      title="Earnings"
      description="Gross, absorbed platform fees and net realised value by project or client, over any date range."
    >
      <template #eyebrow-icon>
        <i class="pi pi-chart-bar text-sm" aria-hidden="true" />
      </template>
    </PageHeader>

    <InlineAlert v-if="loadError" tone="error" title="Could not load earnings">
      {{ loadError }}
    </InlineAlert>

    <EarningsFilters
      :from="from"
      :to="to"
      :group-by="groupBy"
      :preset="preset"
      :pending="pending"
      :invalid-range="invalidRange"
      :resolved-from="effectiveRange.from"
      :resolved-to="effectiveRange.to"
      @apply-preset="onApplyPreset"
      @update:group-by="onSetGroupBy"
      @update:range="onSetRange"
    />

    <!-- Every figure below comes from `totals` / `unbilled` in the API response. -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Hours Billed"
        :value="formatHours(totals.hours)"
        :hint="`${rows.length} ${groupBy === 'project' ? 'project' : 'client'} bucket${rows.length === 1 ? '' : 's'}`"
        icon="pi pi-clock"
      />
      <StatCard
        label="Gross Billed"
        :value="formatMoney(totals.gross, currencySymbol)"
        hint="Before platform fees"
        icon="pi pi-chart-line"
        tone="primary"
      />
      <StatCard
        label="Fees Absorbed"
        :value="`-${formatMoney(totals.fees, currencySymbol)}`"
        hint="Paid by you on payout"
        icon="pi pi-percentage"
        tone="warning"
      />
      <StatCard
        label="Net Realized"
        :value="formatMoney(totals.net, currencySymbol)"
        hint="Gross minus absorbed fees"
        icon="pi pi-wallet"
        tone="positive"
      />
    </div>

    <!-- §8.1 additive block: logged work not yet covered by an invoice. -->
    <div
      v-if="hasUnbilled"
      class="flex flex-col gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="unbilled-block"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high text-on-surface-variant"
          aria-hidden="true"
        >
          <i class="pi pi-file-excel text-sm" />
        </span>
        <div>
          <p class="text-sm font-semibold text-on-surface">
            Not yet invoiced — {{ formatHours(unbilled.hours) }} across {{ unbilled.weekCount }} week{{ unbilled.weekCount === 1 ? '' : 's' }}
          </p>
          <p class="mt-0.5 text-xs text-on-surface-variant">
            {{ formatMoney(unbilled.gross, currencySymbol) }} gross ·
            <span class="text-warning">−{{ formatMoney(unbilled.fees, currencySymbol) }} fees</span> ·
            {{ formatMoney(unbilled.net, currencySymbol) }} net
            ({{ unbilledPercent.toFixed(0) }}% of this range)
          </p>
        </div>
      </div>

      <NuxtLink
        to="/invoices"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:text-primary"
      >
        <i class="pi pi-receipt text-xs" aria-hidden="true" />
        Go to Invoice Generator
      </NuxtLink>
    </div>

    <EarningsTable
      :rows="rows"
      :totals="totals"
      :group-by="groupBy"
      :currency-symbol="currencySymbol"
      :loading="pending"
    />
  </section>
</template>