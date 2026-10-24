<script setup lang="ts">
import type { InvoiceLineView } from '../../composables/useInvoices'
import { formatLineDate } from '../../composables/useInvoices'

/**
 * Invoice line items (R10): date, project, description, hours, rate, line total,
 * with per-project subtotals and the card footer totals.
 *
 * Presentational only — every number comes from the invoice snapshot.
 */
const props = defineProps<{
  lines: InvoiceLineView[]
  totalHours: number
  gross: number
  feeAmount: number
  net: number
  feePercent: number
  feeFlat: number
  currencySymbol: string
  clientName: string
}>()

/** Shared money cell so columns align. */
function money(amount: number): string {
  return formatMoney(amount, props.currencySymbol)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[44rem] border-collapse text-left text-sm" data-testid="invoice-lines">
      <caption class="sr-only">
        Itemised work log for {{ clientName }}: {{ lines.length }} line items
      </caption>
      <thead>
        <tr class="border-b border-outline-variant">
          <th scope="col" class="bf-label px-4 py-2.5">Date</th>
          <th scope="col" class="bf-label px-4 py-2.5">Project</th>
          <th scope="col" class="bf-label px-4 py-2.5">Itemised Work Log</th>
          <th scope="col" class="bf-label px-4 py-2.5 text-right">Hours</th>
          <th scope="col" class="bf-label px-4 py-2.5 text-right">Rate</th>
          <th scope="col" class="bf-label px-4 py-2.5 text-right">Line Total</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="line in lines"
          :key="line.key"
          class="border-b border-outline-variant/50 align-top transition-colors hover:bg-surface-container-low"
          :data-testid="`invoice-line-${line.key}`"
        >
          <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-on-surface-variant">
            {{ formatLineDate(line.date) }}
          </td>
          <td class="px-4 py-3">
            <span
              class="inline-block rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 font-mono text-[11px] text-on-surface"
            >
              {{ line.projectName }}
            </span>
          </td>
          <td class="max-w-md px-4 py-3 text-xs leading-relaxed text-on-surface">
            {{ line.description }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-xs text-on-surface">
            {{ formatHours(line.hours) }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-xs text-on-surface-variant">
            {{ money(line.rate) }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-sm font-semibold text-on-surface">
            {{ money(line.lineTotal) }}
          </td>
        </tr>
      </tbody>

      <tfoot>
        <tr class="border-t border-outline-variant bg-surface-container-low">
          <th scope="row" colspan="3" class="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {{ clientName }} total allocated ({{ formatHours(totalHours) }} @ {{ feePercent > 0 || feeFlat > 0 ? 'absorbed fee' : 'no fee' }})
          </th>
          <td class="px-4 py-3 text-right font-mono text-xs font-semibold text-on-surface">
            {{ formatHours(totalHours) }}
          </td>
          <td class="px-4 py-3 text-right font-mono text-xs text-on-surface-variant">—</td>
          <td class="px-4 py-3 text-right font-mono text-sm font-semibold text-on-surface">
            {{ money(gross) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>