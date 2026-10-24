<script setup lang="ts">
import { ApiError } from '~/composables/useApi'
import type { Week } from '~/types/api'

useHead({ title: 'Invoice Generator' })

const route = useRoute()
const router = useRouter()
const notifier = useNotifier()
const confirm = useConfirm()

const { week, pending: weekPending, loadById, load: loadCurrentWeek } = useWeeks()
const { goPrevious, goNext, goToToday } = useWeekNavigation()
const { clients, refresh: loadClients } = useClients()
const {
  cards,
  totals,
  warnings,
  hasInvoices,
  canGenerate,
  belowTarget,
  currencySymbol,
  pending,
  generating,
  load,
  generate,
  loadDrafts,
  draftFor,
  reset,
} = useInvoices()
const { downloadZip } = useInvoiceDownloads()

const loadError = ref<string | null>(null)

/** `?weekId=` — the timesheet links here with the week it wants invoiced. */
const requestedWeekId = computed(() => {
  const raw = route.query.weekId
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
})

const title = computed(() => (week.value ? `Generate Invoices for ${week.value.label}` : 'Invoice Generator'))

/** Week totals for the three headline money cards, summed from what is actually shown. */
const summary = computed(() =>
  cards.value.reduce(
    (acc, card) => ({
      hours: acc.hours + card.totalHours,
      gross: acc.gross + card.gross,
      fees: acc.fees + card.feeAmount,
      net: acc.net + card.net,
    }),
    { hours: 0, gross: 0, fees: 0, net: 0 },
  ),
)

const otherWarnings = computed(() => warnings.value.filter(warning => warning.code !== 'BELOW_TARGET'))

async function loadWeek(id: number | null): Promise<void> {
  loadError.value = null
  try {
    // Clients back the "Rate Logic" strip's client-default comparison.
    await Promise.all([id === null ? loadCurrentWeek() : loadById(id), loadClients({ silent: true })])
    const target = id ?? week.value?.id
    if (target === null || target === undefined) {
      return
    }
    await load(target, { force: true })
    // Prefetch so the mailto anchors render server-side (R12).
    if (hasInvoices.value) {
      await loadDrafts(target)
    }
  }
  catch (error) {
    // Detailed context on the server; a friendly sentence in the UI.
    if (import.meta.server) {
      console.error('[invoices] failed to load week', error)
    }
    loadError.value = error instanceof ApiError ? error.message : 'Could not load this week.'
  }
}

// Top-level await so the cards render on the server and hydrate from the Nuxt
// payload — no client-side spinner on first paint. `useState` guards make the
// client a no-op after hydration.
await loadWeek(requestedWeekId.value)

// Back/forward navigation between weeks reuses the same loader.
watch(requestedWeekId, (id) => {
  reset()
  void loadWeek(id)
})

/** Keep the URL in step with prev/next so a reload lands on the same week. */
async function navigate(target: 'previous' | 'next' | 'today'): Promise<void> {
  const NAVIGATORS: Record<'previous' | 'next' | 'today', () => Promise<Week | null>> = {
    previous: goPrevious,
    next: goNext,
    today: goToToday,
  }

  const next = await NAVIGATORS[target]()
  if (next) {
    await router.replace({ path: '/invoices', query: { weekId: String(next.id) } })
  }
}

/**
 * R9: one `POST` per week bucket. Contract §4.1 makes it idempotent, so the
 * "Regenerate" path is safe and returns the same numbers.
 */
async function runGenerate(): Promise<void> {
  if (!week.value) {
    return
  }

  try {
    const created = await generate(week.value.id)
    await loadDrafts(week.value.id)
    notifier.success(
      created.length > 0 ? `${created.length} invoice${created.length === 1 ? '' : 's'} generated` : 'No invoices generated',
      week.value.label,
    )
  }
  catch (error) {
    if (error instanceof ApiError && error.isConflict) {
      notifier.warn('Could not generate invoices', error.message)
    }
    else {
      notifier.error('Unexpected error', error instanceof Error ? error.message : undefined)
    }
  }
}

/** R8: warn below target, confirm, never block. */
function onGenerateClick(): void {
  if (!belowTarget.value || hasInvoices.value || !week.value) {
    void runGenerate()
    return
  }

  confirm.require({
    header: 'Below the weekly target',
    message: `This week is under target. Generate ${cards.value.length} invoice${cards.value.length === 1 ? '' : 's'} anyway?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Generate anyway',
    accept: () => {
      void runGenerate()
    },
  })
}

function onDownloadZip(): void {
  if (week.value) {
    void downloadZip(week.value.id, week.value.isoWeek)
  }
}
</script>

<template>
  <section class="flex flex-col gap-5">
    <PageHeader
      eyebrow="Billing & Dispatch"
      :title="title"
      :description="hasInvoices
        ? `${cards.length} invoice${cards.length === 1 ? '' : 's'} issued for this week. Download the PDFs or dispatch them as email text.`
        : 'Preview how the week splits per client, then generate the invoices once the week is closed.'"
    >
      <template #eyebrow-icon>
        <i class="pi pi-receipt text-sm" aria-hidden="true" />
      </template>
      <template #actions>
        <div class="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1">
          <button
            type="button"
            class="flex items-center rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
            :disabled="!week || weekPending"
            aria-label="Previous week"
            data-testid="invoices-prev-week"
            @click="navigate('previous')"
          >
            <i class="pi pi-chevron-left text-sm" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
            :disabled="!week || weekPending"
            data-testid="invoices-today"
            @click="navigate('today')"
          >
            This week
          </button>
          <button
            type="button"
            class="flex items-center rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-40"
            :disabled="!week || weekPending"
            aria-label="Next week"
            data-testid="invoices-next-week"
            @click="navigate('next')"
          >
            <i class="pi pi-chevron-right text-sm" aria-hidden="true" />
          </button>
        </div>
      </template>
    </PageHeader>

    <InlineAlert v-if="loadError" tone="error" title="Could not load this week">
      {{ loadError }}
    </InlineAlert>

    <!-- GROSS BILLED / FEES ABSORBED / NET REALIZED -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Gross Billed"
        :value="formatMoney(summary.gross, currencySymbol)"
        :hint="`${formatHours(summary.hours)} across ${cards.length} client bucket${cards.length === 1 ? '' : 's'}`"
        icon="pi pi-check-circle"
        tone="primary"
      />
      <StatCard
        label="Fees Absorbed"
        :value="`-${formatMoney(summary.fees, currencySymbol)}`"
        hint="Paid by you on every payout"
        icon="pi pi-percentage"
        tone="warning"
      />
      <StatCard
        label="Net Realized"
        :value="formatMoney(summary.net, currencySymbol)"
        hint="Gross minus absorbed fees"
        icon="pi pi-wallet"
        tone="positive"
      />
      <StatCard
        label="Hours Billed"
        :value="formatHours(summary.hours)"
        :hint="totals ? `Target ${formatHours(totals.targetHours, '')}` : undefined"
        icon="pi pi-clock"
      />
    </div>

    <InvoiceActionBar
      :week-label="week?.label ?? null"
      :status="week?.status ?? null"
      :invoice-count="cards.length"
      :has-invoices="hasInvoices"
      :can-generate="canGenerate"
      :generating="generating"
      :pending="pending"
      :record-count="totals?.recordCount ?? 0"
      @generate="onGenerateClick"
      @download-zip="onDownloadZip"
    />

    <!-- Open week: preview only (contract §4.3 works on open weeks). -->
    <InlineAlert v-if="week && week.status === 'open'" tone="info" title="Close the week to generate invoices">
      These figures are a live preview — nothing has been written.
      <NuxtLink to="/" class="font-semibold underline">Back to the timesheet</NuxtLink>
      to close <strong>{{ week.label }}</strong>.
    </InlineAlert>

    <!-- R8: informational, never blocks. -->
    <InlineAlert
      v-if="belowTarget && totals"
      tone="warning"
      title="Below the weekly target"
      :data-testid="'below-target-warning'"
    >
      {{ formatHours(totals.totalHours) }} / {{ formatHours(totals.targetHours, '') }} hrs —
      {{ formatHours(totals.hoursBelowTarget, '') }} hrs below target. You can still generate.
    </InlineAlert>

    <InlineAlert
      v-for="warning in otherWarnings"
      :key="warning.code"
      :tone="warning.code === 'NO_RECORDS' ? 'warning' : 'info'"
    >
      {{ warning.message }}
    </InlineAlert>

    <InlineAlert v-if="!pending && cards.length === 0 && !loadError" tone="info">
      Nothing to invoice for this week yet.
    </InlineAlert>

    <div class="flex flex-col gap-4" data-testid="invoice-cards">
      <InvoiceCard
        v-for="(card, index) in cards"
        :key="card.key"
        :card="card"
        :draft="draftFor(card.invoiceId)"
        :clients="clients"
        :index="index"
      />
    </div>
  </section>
</template>