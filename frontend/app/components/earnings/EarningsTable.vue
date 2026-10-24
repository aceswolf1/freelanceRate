<script setup lang="ts">
import type { EarningsGroupBy, EarningsRow } from '../../types/api'

/**
 * Earnings ledger (R13): sortable rows by project or client, with a totals footer.
 *
 * Rows arrive pre-sorted by gross DESC (contract §4.8); the DataTable's own
 * sorting lets the user re-sort without another fetch. The footer is a separate
 * strip rather than a `ColumnGroup`, so it stays readable on narrow screens and
 * is assertable in tests.
 */
const props = defineProps<{
  rows: EarningsRow[]
  totals: { hours: number, gross: number, fees: number, net: number }
  groupBy: EarningsGroupBy
  currencySymbol: string
  loading: boolean
}>()

const nameHeader = computed(() => (props.groupBy === 'project' ? 'Project' : 'Client'))
</script>

<template>
  <div class="bf-panel overflow-hidden">
    <DataTable
      :value="rows"
      :loading="loading"
      data-key="name"
      sort-mode="single"
      removable-sort
      striped-rows
      size="small"
      class="text-sm"
      data-testid="earnings-table"
    >
      <template #empty>
        <EmptyState
          icon="pi-chart-bar"
          title="No earnings in this range"
          description="Log billable hours on the timesheet, or widen the date range."
        />
      </template>

      <Column :field="groupBy" :header="nameHeader" sortable>
        <template #body="{ data, index }">
          <div class="flex items-center gap-2.5">
            <InitialsAvatar :name="data.name" :seed="index" size="sm" />
            <div class="min-w-0">
              <p class="truncate font-semibold text-on-surface">{{ data.name }}</p>
              <p v-if="data.id === null" class="font-mono text-[11px] text-on-surface-variant">
                Standalone work
              </p>
            </div>
          </div>
        </template>
      </Column>

      <Column field="hours" header="Hours" sortable class="w-28">
        <template #body="{ data }">
          <span class="font-mono text-xs text-on-surface">{{ formatHours(data.hours) }}</span>
        </template>
      </Column>

      <Column field="gross" header="Gross" sortable class="w-32">
        <template #body="{ data }">
          <span class="font-mono text-xs text-on-surface">{{ formatMoney(data.gross, currencySymbol) }}</span>
        </template>
      </Column>

      <Column field="fees" header="Fees Absorbed" sortable class="w-32">
        <template #body="{ data }">
          <span class="font-mono text-xs text-warning">−{{ formatMoney(data.fees, currencySymbol) }}</span>
        </template>
      </Column>

      <Column field="net" header="Net Realized" sortable class="w-32">
        <template #body="{ data }">
          <span class="font-mono text-xs font-semibold text-tertiary">{{ formatMoney(data.net, currencySymbol) }}</span>
        </template>
      </Column>
    </DataTable>

    <div
      class="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t border-outline-variant bg-surface-container-low px-4 py-3"
      data-testid="earnings-totals-footer"
    >
      <span class="bf-label">Totals</span>
      <span class="font-mono text-xs text-on-surface">
        {{ formatHours(totals.hours) }}
        <span class="ml-1 text-on-surface-variant">hours</span>
      </span>
      <span class="font-mono text-xs text-on-surface">
        {{ formatMoney(totals.gross, currencySymbol) }}
        <span class="ml-1 text-on-surface-variant">gross</span>
      </span>
      <span class="font-mono text-xs text-warning">
        −{{ formatMoney(totals.fees, currencySymbol) }}
        <span class="ml-1 text-on-surface-variant">fees</span>
      </span>
      <span class="font-mono text-sm font-bold text-tertiary" data-testid="earnings-total-net">
        {{ formatMoney(totals.net, currencySymbol) }}
        <span class="ml-1 text-xs font-normal text-on-surface-variant">net</span>
      </span>
    </div>
  </div>
</template>