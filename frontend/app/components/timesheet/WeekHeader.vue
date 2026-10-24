<script setup lang="ts">
import type { Week } from '../../types/api'

/**
 * Week navigator and status strip (R4, R7).
 * Contract §3.6 ships a ready-made `label`, so the title is used verbatim.
 */
const props = defineProps<{
  week: Week | null
  pending: boolean
}>()

const emit = defineEmits<{
  previous: []
  next: []
  today: []
  'toggle-closed': []
  generate: []
}>()

const isOpen = computed(() => props.week?.status === 'open')
const hasInvoices = computed(() => (props.week?.invoiceCount ?? 0) > 0)

/** Invoicing is only possible from a closed week (contract §4.1). */
const generateDisabled = computed(() => !props.week || props.week.status !== 'closed')
const generateTooltip = computed(() => {
  if (!props.week) {
    return 'No week loaded'
  }
  return props.week.status === 'closed'
    ? `Generate invoices for ${props.week.label}`
    : 'Close the week before generating invoices'
})
</script>

<template>
  <div class="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-4 lg:flex-row lg:items-center lg:justify-between">
    <div class="flex flex-wrap items-center gap-3 md:gap-4">
      <div class="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1">
        <button
          type="button"
          class="flex items-center rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
          :disabled="!week || pending"
          aria-label="Previous week"
          title="Previous week"
          data-testid="prev-week"
          @click="emit('previous')"
        >
          <i class="pi pi-chevron-left text-sm" aria-hidden="true" />
        </button>
        <div class="flex items-center gap-2 px-2">
          <i class="pi pi-calendar text-sm text-primary" aria-hidden="true" />
          <span class="text-sm font-semibold tracking-tight text-on-surface" data-testid="week-label">
            {{ week?.label ?? 'Loading week…' }}
          </span>
        </div>
        <button
          type="button"
          class="flex items-center rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
          :disabled="!week || pending"
          aria-label="Next week"
          title="Next week"
          data-testid="next-week"
          @click="emit('next')"
        >
          <i class="pi pi-chevron-right text-sm" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        class="rounded-lg border border-outline-variant px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-40"
        :disabled="!week || pending"
        data-testid="today-button"
        @click="emit('today')"
      >
        Today
      </button>

      <div class="flex items-center gap-2.5">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-medium"
          :class="isOpen ? 'border-tertiary/30 bg-tertiary/15 text-tertiary' : 'border-outline-variant bg-surface-container-high text-on-surface-variant'"
          data-testid="week-status"
        >
          <span class="size-1.5 rounded-full" :class="isOpen ? 'bg-tertiary' : 'bg-outline'" aria-hidden="true" />
          {{ week ? (isOpen ? 'Open' : 'Closed') : '—' }}
        </span>
        <span v-if="week" class="font-mono text-xs text-on-surface-variant">
          Lock cutoff: {{ formatShortDate(week.endDate) }}
        </span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <Button
        :label="isOpen ? 'Close Week' : 'Reopen Week'"
        :icon="isOpen ? 'pi pi-lock' : 'pi pi-lock-open'"
        severity="secondary"
        outlined
        size="small"
        :disabled="!week || pending || (!isOpen && hasInvoices)"
        :title="!isOpen && hasInvoices ? 'This week already has invoices and cannot be reopened' : undefined"
        :data-testid="isOpen ? 'close-week' : 'reopen-week'"
        @click="emit('toggle-closed')"
      />

      <span v-tooltip.top="generateTooltip">
        <Button
          label="Generate Invoices from Week"
          icon="pi pi-receipt"
          size="small"
          :disabled="generateDisabled"
          :aria-disabled="generateDisabled"
          :data-testid="'generate-invoices'"
          @click="emit('generate')"
        />
      </span>
    </div>
  </div>
</template>