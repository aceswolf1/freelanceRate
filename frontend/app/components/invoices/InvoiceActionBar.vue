<script setup lang="ts">
/**
 * Week-level invoice actions (R11): status chip, invoice-count badge, the
 * idempotent "Generate Invoices" button and the zip download.
 *
 * `canGenerate` mirrors `InvoicePreview.canGenerate` (contract §4.3) — false while
 * the week is open — so the button is disabled rather than hidden, and the reason
 * is available to assistive tech via the tooltip + `title`.
 */
const props = defineProps<{
  weekLabel: string | null
  status: 'open' | 'closed' | null
  invoiceCount: number
  hasInvoices: boolean
  canGenerate: boolean
  generating: boolean
  pending: boolean
  recordCount: number
}>()

const emit = defineEmits<{
  generate: []
  'download-zip': []
}>()

const isOpen = computed(() => props.status === 'open')

const generateLabel = computed(() => {
  if (props.generating) {
    return 'Generating…'
  }
  return props.hasInvoices ? 'Regenerate Invoices' : 'Generate Invoices'
})

const generateTooltip = computed(() => {
  if (props.status === null) {
    return 'No week loaded'
  }
  if (props.hasInvoices) {
    return `Invoices already exist for ${props.weekLabel}. Regenerating returns the same numbers.`
  }
  if (isOpen.value) {
    return 'Close the week to generate invoices'
  }
  if (props.recordCount === 0) {
    return 'This week has no records to invoice'
  }
  return `Generate invoices for ${props.weekLabel}`
})

const generateDisabled = computed(() =>
  !props.canGenerate || props.generating || props.pending || props.recordCount === 0,
)
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 lg:flex-row lg:items-center lg:justify-between"
    data-testid="invoice-action-bar"
  >
    <div class="flex flex-wrap items-center gap-2.5">
      <span
        class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-medium"
        :class="isOpen ? 'border-tertiary/30 bg-tertiary/15 text-tertiary' : 'border-outline-variant bg-surface-container-high text-on-surface-variant'"
        data-testid="invoice-week-status"
      >
        <span class="size-1.5 rounded-full" :class="isOpen ? 'bg-tertiary' : 'bg-outline'" aria-hidden="true" />
        {{ status === null ? '—' : (isOpen ? 'Open' : 'Closed') }}
      </span>

      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-1 font-mono text-xs text-on-surface-variant"
        data-testid="invoice-count-badge"
      >
        <i class="pi pi-file text-[11px]" aria-hidden="true" />
        <!-- Preview rows are not invoices yet — label them honestly. -->
        <template v-if="hasInvoices">
          {{ invoiceCount }} Invoice{{ invoiceCount === 1 ? '' : 's' }}
        </template>
        <template v-else>
          {{ invoiceCount }} Preview Bucket{{ invoiceCount === 1 ? '' : 's' }}
        </template>
      </span>

      <span
        v-if="recordCount === 0"
        class="inline-flex items-center gap-1.5 text-xs text-on-surface-variant"
        data-testid="no-records-note"
      >
        <i class="pi pi-info-circle text-[11px]" aria-hidden="true" />
        No records logged in this week
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <Button
        :label="generateLabel"
        icon="pi pi-receipt"
        :loading="generating"
        :disabled="generateDisabled"
        :aria-disabled="generateDisabled"
        :title="generateTooltip"
        data-testid="generate-invoices"
        @click="emit('generate')"
      />

      <Button
        label="Download All PDFs (.zip)"
        icon="pi pi-download"
        severity="secondary"
        outlined
        :disabled="!hasInvoices || pending"
        :title="hasInvoices ? 'Download every invoice in this week as a zip' : 'Generate invoices first'"
        data-testid="download-zip"
        @click="emit('download-zip')"
      />
    </div>
  </div>
</template>