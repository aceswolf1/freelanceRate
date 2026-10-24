<script setup lang="ts">
import type { WeekDay, WorkRecord } from '../../types/api'
import { sortRecords } from '../../utils/records'

/**
 * One of the seven day columns (R6).
 *
 * Sat/Sun are visually muted with a dashed border and a grey header, but they are
 * **not** disabled — weekend work is fully insertable. `isWeekend` only changes
 * presentation; `readOnly` (week closed) is what actually gates the add button.
 */
const props = defineProps<{
  day: WeekDay
  today: string | null
  readOnly: boolean
  currencySymbol: string
}>()

const emit = defineEmits<{
  add: [string]
  edit: [WorkRecord]
  remove: [WorkRecord]
}>()

const records = computed(() => sortRecords(props.day.records))
const isToday = computed(() => props.today === props.day.date)
</script>

<template>
  <section
    class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border"
    :class="day.isWeekend
      ? 'border-2 border-dashed border-outline-variant bg-surface-container-low'
      : 'border border-outline-variant bg-surface-container'"
    :data-testid="`day-${day.date}`"
    :data-weekend="day.isWeekend"
    :aria-label="`${day.dayName} ${formatDate(day.date)}`"
  >
    <header
      class="flex items-center justify-between gap-2 border-b px-2.5 py-2"
      :class="day.isWeekend
        ? 'border-outline-variant/60 bg-surface-container-low'
        : isToday
          ? 'border-primary/30 bg-primary/15'
          : 'border-outline-variant bg-surface-container-low'"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span
            class="text-[10px] font-semibold uppercase tracking-wider"
            :class="day.isWeekend ? 'text-on-surface-variant' : (isToday ? 'text-primary' : 'text-on-surface-variant')"
          >
            {{ day.dayName }}
          </span>
          <span
            v-if="day.isWeekend"
            class="rounded bg-surface-container-highest px-1 py-0.5 text-[9px] text-on-surface-variant"
          >Weekend</span>
          <span
            v-if="isToday"
            class="size-1.5 rounded-full bg-tertiary"
            aria-label="Today"
            data-testid="today-dot"
          />
        </div>
        <span
          class="block text-sm font-semibold"
          :class="day.isWeekend ? 'text-on-surface-variant' : 'text-on-surface'"
        >
          {{ formatShortDate(day.date) }}
        </span>
      </div>
      <div class="shrink-0 text-right">
        <span
          class="block font-mono text-xs font-semibold"
          :class="day.isWeekend ? 'text-on-surface-variant' : 'text-primary'"
        >
          {{ formatHours(day.hours) }}
        </span>
        <span class="block font-mono text-[10px] text-on-surface-variant">
          {{ formatMoney(day.projectedGross, currencySymbol) }}
        </span>
      </div>
    </header>

    <div class="flex flex-grow flex-col gap-2.5 p-2.5">
      <template v-if="records.length > 0">
        <RecordCard
          v-for="record in records"
          :key="record.id"
          :record="record"
          :read-only="readOnly"
          :currency-symbol="currencySymbol"
          @edit="emit('edit', $event)"
          @remove="emit('remove', $event)"
        />
      </template>

      <div
        v-else
        class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center"
      >
        <i
          class="text-2xl"
          :class="day.isWeekend ? 'pi pi-calendar text-outline' : 'pi pi-inbox text-outline-variant'"
          aria-hidden="true"
        />
        <p class="text-xs text-on-surface-variant">No active time entries</p>
      </div>

      <!-- Weekend columns keep their add affordance: Sat/Sun are insertable (R6). -->
      <button
        v-if="!readOnly"
        type="button"
        class="mt-auto w-full rounded-lg border border-dashed border-outline-variant py-2 text-center text-xs text-primary transition-colors hover:bg-surface-container-high hover:border-primary/40"
        :class="day.isWeekend ? '' : ''"
        :data-testid="`add-record-${day.date}`"
        @click="emit('add', day.date)"
      >
        <i class="pi pi-plus text-sm" aria-hidden="true" />
        <span>{{ day.isWeekend ? 'Log Weekend' : 'Add record' }}</span>
      </button>
      <p
        v-else
        class="mt-auto rounded-lg border border-outline-variant/60 py-2 text-center text-[11px] text-on-surface-variant"
      >
        Week closed
      </p>
    </div>
  </section>
</template>