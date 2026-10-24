<script setup lang="ts">
import type { EarningsGroupBy } from '../../types/api'
import type { DateRange, RangePreset } from '../../composables/useEarnings'
import { RANGE_PRESETS, isoToLocalDate, localDateToIso } from '../../composables/useEarnings'

/**
 * Earnings controls (R13): date range + quick presets + the By Project / By Client
 * grouping toggle. Emits only — it owns no report state of its own.
 */
const props = defineProps<{
  from: string
  to: string
  groupBy: EarningsGroupBy
  preset: RangePreset | null
  pending: boolean
  invalidRange: boolean
  resolvedFrom: string
  resolvedTo: string
}>()

const emit = defineEmits<{
  'apply-preset': [RangePreset]
  'update:groupBy': [EarningsGroupBy]
  'update:range': [DateRange]
}>()

const GROUP_OPTIONS: EarningsGroupBy[] = ['project', 'client']

/**
 * `DatePicker` model. Conversion goes through local-midnight `Date`s built
 * component-wise, so an ISO date never shifts a day across a timezone boundary.
 */
const pickerValue = computed<Date[] | null>({
  get() {
    const start = isoToLocalDate(props.from)
    const end = isoToLocalDate(props.to)
    return start && end ? [start, end] : null
  },
  set(next) {
    if (!next || next.length < 2) {
      return
    }
    emit('update:range', { from: localDateToIso(next[0]), to: localDateToIso(next[1]) })
  },
})
</script>

<template>
  <div class="bf-panel flex flex-col gap-4 p-4" data-testid="earnings-filters">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <!-- Range presets + picker -->
      <div class="flex min-w-0 flex-col gap-2.5">
        <span id="earnings-range-label" class="bf-label">Date Range</span>

        <div class="flex flex-wrap items-center gap-2" role="group" aria-labelledby="earnings-range-label">
          <Button
            v-for="option in RANGE_PRESETS"
            :key="option.value"
            :label="option.label"
            size="small"
            :severity="preset === option.value ? undefined : 'secondary'"
            :outlined="preset !== option.value"
            :aria-pressed="preset === option.value"
            :data-testid="`range-preset-${option.value}`"
            @click="emit('apply-preset', option.value)"
          />

          <DatePicker
            v-model="pickerValue"
            selection-mode="range"
            show-icon
            icon-display="pi pi-calendar"
            date-format="dd-mm-yy"
            placeholder="Custom range"
            :disabled="pending"
            input-class="font-mono text-sm"
            class="max-w-[17rem]"
            aria-labelledby="earnings-range-label"
            data-testid="earnings-range-picker"
          />
        </div>

        <p class="font-mono text-[11px] text-on-surface-variant" data-testid="earnings-resolved-range">
          <template v-if="resolvedFrom && resolvedTo">
            {{ formatDate(resolvedFrom) }} → {{ formatDate(resolvedTo) }}
          </template>
          <template v-else-if="resolvedFrom || resolvedTo">
            {{ formatDate(resolvedFrom || resolvedTo) }} → (open ended)
          </template>
          <template v-else>
            All logged time
          </template>
        </p>
      </div>

      <!-- Grouping toggle -->
      <div class="flex flex-col gap-2.5">
        <span id="earnings-group-label" class="bf-label">Group By</span>
        <SelectButton
          :model-value="groupBy"
          :options="GROUP_OPTIONS"
          :allow-empty="false"
          :disabled="pending"
          :aria-labelledby="'earnings-group-label'"
          data-testid="earnings-groupby"
          @update:model-value="emit('update:groupBy', $event as EarningsGroupBy)"
        >
          <template #option="{ option }">
            <span class="capitalize">By {{ option }}</span>
          </template>
        </SelectButton>
      </div>
    </div>

    <InlineAlert v-if="invalidRange" tone="error" title="Invalid date range" data-testid="range-error">
      The start date must be on or before the end date.
    </InlineAlert>
  </div>
</template>