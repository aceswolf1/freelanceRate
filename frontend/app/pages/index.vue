<script setup lang="ts">
import type { WorkRecord } from '~/types/api'

useHead({ title: 'Weekly Timesheet' })

const { week, pending, load, loaded } = useWeeks()
const { goPrevious, goNext, goToToday, toggleClosed } = useWeekNavigation()
const { week: activeWeek, set: setActiveWeek } = useActiveWeek()
const { currencySymbol, weeklyTargetHours } = useSettings()
const { close, request } = useQuickAdd()
const confirm = useConfirm()
const notifier = useNotifier()

const editing = ref<WorkRecord | null>(null)

const readOnly = computed(() => week.value?.status === 'closed')
/** Local calendar date — `toISOString()` would be UTC and could be tomorrow (GAP-010). */
const today = todayLocalIso()

onMounted(() => {
  // The layout fetches the current week during SSR (GAP-009), so the store is
  // already populated; this is a no-op unless the API was unreachable.
  if (!loaded.value) {
    void load()
  }
})

// The sidebar card and the timesheet share one week (contract §3.6 get-or-create).
watch(week, (next) => {
  if (next) {
    setActiveWeek(next)
  }
}, { immediate: true })

/**
 * Drawer visibility is **local state**. The shared `useQuickAdd` request is a
 * one-way signal used only by the layout's "Add Time" button.
 *
 * GAP-001: the previous version watched `request.token` and called
 * `openDrawer()` → `open()`, which bumps `token` again — an infinite loop that
 * froze the tab. This watcher now only *copies* the requested date into local
 * state, so it can never re-enter itself.
 */
const drawerVisible = ref(false)
const drawerDate = ref<string | null>(null)

watch(() => request.value?.token, () => {
  if (!request.value?.open) {
    return
  }
  editing.value = null
  drawerDate.value = request.value.date
  drawerVisible.value = true
}, { immediate: true })

function openDrawer(date: string | null = null): void {
  editing.value = null
  drawerDate.value = date
  drawerVisible.value = true
}

function editRecord(record: WorkRecord): void {
  editing.value = record
  drawerDate.value = record.date
  drawerVisible.value = true
}

/** Closing clears the signal too, so returning to the page does not reopen it. */
function onDrawerVisibleChange(value: boolean): void {
  drawerVisible.value = value
  if (!value) {
    close()
  }
}

onBeforeUnmount(() => {
  close()
})

function confirmRemove(record: WorkRecord): void {
  confirm.require({
    header: 'Delete record',
    message: `Delete this ${formatHours(record.hours)} entry? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      await useRecords().remove(record.id)
      notifier.success('Record deleted')
    },
  })
}

async function onSaved(): Promise<void> {
  notifier.success('Record saved')
  await load({ force: true })
}

/** Contract §4.1: invoices are generated from a closed week, so navigate there. */
async function generateInvoices(): Promise<void> {
  if (!week.value) {
    return
  }
  if (week.value.status !== 'closed') {
    notifier.warn('Close the week first', 'Invoices can only be generated from a closed week.')
    return
  }
  await navigateTo({ path: '/invoices', query: { weekId: String(week.value.id) } })
}

/** Counts for the footer strip, derived from what is actually on the week. */
const projectBreakdown = computed(() => {
  const seen = new Set<number>()
  let clientProjects = 0
  let standaloneProjects = 0

  for (const day of week.value?.days ?? []) {
    for (const record of day.records) {
      if (seen.has(record.projectId)) {
        continue
      }
      seen.add(record.projectId)
      if (record.clientId === null) {
        standaloneProjects += 1
      }
      else {
        clientProjects += 1
      }
    }
  }

  return { clientProjects, standaloneProjects }
})
</script>

<template>
  <section class="flex flex-col gap-5">
    <WeekHeader
      :week="week"
      :pending="pending"
      @previous="goPrevious"
      @next="goNext"
      @today="goToToday"
      @toggle-closed="toggleClosed"
      @generate="generateInvoices"
    />

    <InlineAlert v-if="!week && pending" tone="info">
      Loading the current week…
    </InlineAlert>

    <InlineAlert v-else-if="!week" tone="warning" title="No week loaded">
      The API did not return a week. Start the backend, then
      <button type="button" class="font-semibold underline" @click="load({ force: true })">retry</button>.
    </InlineAlert>

    <template v-else>
      <TargetBanner :totals="week.totals" :currency-symbol="currencySymbol" />

      <div class="flex flex-col gap-3 xl:flex-row xl:items-start">
        <!-- 7-day grid -->
        <div class="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7" data-testid="week-grid">
          <DayColumn
            v-for="day in week.days"
            :key="day.date"
            :day="day"
            :today="today"
            :read-only="readOnly"
            :currency-symbol="currencySymbol"
            @add="openDrawer"
            @edit="editRecord"
            @remove="confirmRemove"
          />
        </div>

        <!-- Drawer -->
        <div class="w-full shrink-0 xl:w-[26rem]">
          <RecordDrawer
            :visible="drawerVisible"
            :week-id="week.id"
            :start-date="week.startDate"
            :end-date="week.endDate"
            :record="editing"
            :requested-date="drawerDate"
            :read-only="readOnly"
            :currency-symbol="currencySymbol"
            @update:visible="onDrawerVisibleChange"
            @saved="onSaved"
          />
        </div>
      </div>

      <WeekSummaryStrip
        :totals="week.totals"
        :client-projects="projectBreakdown.clientProjects"
        :standalone-projects="projectBreakdown.standaloneProjects"
        :currency-symbol="currencySymbol"
      />

      <p v-if="readOnly" class="text-xs text-on-surface-variant" data-testid="closed-note">
        This week is closed — {{ formatMoney(week.totals.projectedGross, currencySymbol) }} is ready to invoice.
        Entries stay visible but cannot be edited.
      </p>
      <p v-else-if="weeklyTargetHours > 0" class="text-xs text-on-surface-variant">
        Logging is open. Closing the week locks these entries and unlocks invoice generation.
      </p>
    </template>
  </section>
</template>