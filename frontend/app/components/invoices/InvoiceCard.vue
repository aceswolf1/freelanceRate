<script setup lang="ts">
import type { ClientSummary, InvoiceEmailDraft } from '../../types/api'
import type { InvoiceCardData } from '../../composables/useInvoices'
import { useInvoiceDownloads } from '../../composables/useInvoices'

/**
 * One invoice — persisted or preview (R9–R12).
 *
 * A preview row has no `invoiceId`, so the PDF button and the mailto link are
 * omitted rather than rendered dead. Everything else is identical between the
 * two states, which is why both funnel through the same `InvoiceCardData`.
 */
const props = defineProps<{
  card: InvoiceCardData
  draft: InvoiceEmailDraft | null
  clients: ClientSummary[]
  index?: number
}>()

const { downloadPdf } = useInvoiceDownloads()
const { copyFormatted } = useInvoices()

const isIssued = computed(() => props.card.invoiceId !== null)
/** Contract §4.7: a truncated body must never be handed to a mail client. */
const draftTruncated = computed(() => props.draft?.truncated ?? false)
const mailtoAvailable = computed(() => isIssued.value && props.draft !== null && !draftTruncated.value)

/** `Payoneer (1.0% fee absorbed)` — `null` for a client with no platform. */
const platformLabel = computed(() => {
  const { platformCompany, feePercent, feeFlat, currencySymbol } = props.card
  if (!platformCompany) {
    return null
  }

  const parts: string[] = []
  if (feePercent > 0) {
    parts.push(`${trimNumber(feePercent)}%`)
  }
  if (feeFlat > 0) {
    parts.push(`${formatMoney(feeFlat, currencySymbol)} flat`)
  }

  return parts.length > 0 ? `${platformCompany} (${parts.join(' + ')}, absorbed)` : platformCompany
})

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function onCopy(): void {
  if (props.draft) {
    void copyFormatted(props.draft)
  }
}
</script>

<template>
  <article
    class="bf-card overflow-hidden"
    :data-testid="`invoice-card-${card.clientName}`"
    :data-issued="isIssued"
  >
    <!-- Header: identity on the left, money + actions on the right. -->
    <header class="flex flex-col gap-4 p-4 xl:flex-row xl:items-start xl:justify-between">
      <div class="flex min-w-0 items-start gap-3.5">
        <InitialsAvatar :name="card.clientName" :seed="index ?? 0" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="truncate text-lg font-bold tracking-tight text-on-surface" :data-testid="`invoice-client-${card.clientName}`">
              {{ card.clientName }}
            </h2>
            <span
              v-if="card.number"
              class="rounded border border-outline-variant bg-surface-container-high px-2 py-0.5 font-mono text-[11px] text-on-surface-variant"
              :data-testid="`invoice-number-${card.clientName}`"
            >
              {{ card.number }}
            </span>
            <span
              v-else
              class="rounded border border-warning/30 bg-warning/15 px-2 py-0.5 font-mono text-[11px] text-warning"
            >
              Preview — not generated
            </span>
          </div>

          <p
            v-if="platformLabel"
            class="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
          >
            <i class="pi pi-credit-card text-[10px]" aria-hidden="true" />
            {{ platformLabel }}
          </p>
          <p v-else class="mt-1.5 text-[11px] text-on-surface-variant">No payment platform — no fee absorbed</p>

          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              :href="`mailto:${card.contactEmail}`"
              class="inline-flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant hover:text-primary"
            >
              <i class="pi pi-envelope text-[11px]" aria-hidden="true" />
              {{ card.contactEmail }}
            </a>
            <span
              v-if="card.ccEmail"
              class="inline-flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant"
            >
              <i class="pi pi-inbox text-[11px]" aria-hidden="true" />
              cc: {{ card.ccEmail }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start">
        <dl class="grid grid-cols-3 gap-3 text-right sm:grid-cols-1 sm:gap-1">
          <div>
            <dt class="bf-label">Gross Billed</dt>
            <dd class="font-mono text-base font-bold text-on-surface" :data-testid="`invoice-gross-${card.clientName}`">
              {{ formatMoney(card.gross, card.currencySymbol) }}
            </dd>
          </div>
          <div>
            <dt class="bf-label">Fee Absorbed</dt>
            <dd class="font-mono text-xs text-warning" :data-testid="`invoice-fee-${card.clientName}`">
              −{{ formatMoney(card.feeAmount, card.currencySymbol) }}
            </dd>
          </div>
          <div>
            <dt class="bf-label">Net Payable</dt>
            <dd class="font-mono text-lg font-bold text-primary" :data-testid="`invoice-net-${card.clientName}`">
              {{ formatMoney(card.net, card.currencySymbol) }}
            </dd>
          </div>
        </dl>

        <div class="flex shrink-0 flex-col gap-2 sm:items-stretch">
          <Button
            label="Download PDF"
            icon="pi pi-file-pdf"
            severity="secondary"
            outlined
            size="small"
            :disabled="!isIssued"
            :aria-label="`Download PDF for ${card.clientName}`"
            :data-testid="`download-pdf-${card.clientName}`"
            @click="downloadPdf(card)"
          />

          <template v-if="isIssued && draftTruncated">
            <!-- §4.7: a shortened body must not be silently mailed. -->
            <span class="text-right text-[11px] leading-snug text-warning sm:text-left" data-testid="truncated-hint">
              Email body shortened — use Copy formatted for full tables
            </span>
            <Button
              label="Copy formatted"
              icon="pi pi-copy"
              size="small"
              :aria-label="`Copy formatted invoice text for ${card.clientName}`"
              :data-testid="`copy-formatted-${card.clientName}`"
              @click="onCopy"
            />
          </template>

          <span
            v-else-if="isIssued && !draft"
            class="text-right text-[11px] text-on-surface-variant sm:text-left"
            data-testid="draft-loading"
          >
            Preparing email draft…
          </span>

          <template v-else-if="mailtoAvailable">
            <div class="flex items-stretch gap-1.5">
              <a
                :href="draft?.mailto"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
                :data-testid="`mailto-${card.clientName}`"
              >
                <i class="pi pi-envelope text-xs" aria-hidden="true" />
                Send as Email Text
              </a>
              <Button
                icon="pi pi-copy"
                severity="secondary"
                outlined
                aria-label="Copy formatted invoice"
                :data-testid="`copy-formatted-${card.clientName}`"
                @click="onCopy"
              />
            </div>
          </template>
        </div>
      </div>
    </header>

    <RateLogicStrip :card="card" :clients="clients" />

    <InvoiceLineTable
      :lines="card.lines"
      :total-hours="card.totalHours"
      :gross="card.gross"
      :fee-amount="card.feeAmount"
      :net="card.net"
      :fee-percent="card.feePercent"
      :fee-flat="card.feeFlat"
      :currency-symbol="card.currencySymbol"
      :client-name="card.clientName"
    />
  </article>
</template>