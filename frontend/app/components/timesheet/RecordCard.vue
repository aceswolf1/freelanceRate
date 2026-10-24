<script setup lang="ts">
import type { WorkRecord } from '../../types/api'
import { clientAccent, clientNameOf, hasRateOverride, projectNameOf } from '../../utils/records'

/** One logged entry inside a day column. Presentational; emits to the drawer. */
const props = defineProps<{
  record: WorkRecord
  readOnly: boolean
  currencySymbol: string
}>()

const emit = defineEmits<{
  edit: [WorkRecord]
  remove: [WorkRecord]
}>()

const accent = computed(() => clientAccent(props.record.clientId))
const override = computed(() => hasRateOverride(props.record))
</script>

<template>
  <article
    class="group relative flex cursor-pointer flex-col gap-1.5 rounded-lg border border-outline-variant bg-surface-container-high p-2.5 transition-colors hover:border-primary/40"
    :data-testid="`record-${record.id}`"
    tabindex="0"
    role="button"
    :aria-label="`${projectNameOf(record)}, ${formatHours(record.hours)} for ${clientNameOf(record)}`"
    @click="!readOnly && emit('edit', record)"
    @keydown.enter.prevent="!readOnly && emit('edit', record)"
    @keydown.space.prevent="!readOnly && emit('edit', record)"
  >
    <span
      class="absolute inset-y-0 left-0 w-1 rounded-l-lg"
      :class="record.clientId === null ? 'bg-outline' : 'bg-tertiary'"
      aria-hidden="true"
    />

    <div class="flex items-center justify-between gap-1 pl-1.5">
      <span
        class="truncate rounded border px-1.5 py-0.5 text-[10px] font-medium"
        :class="accent"
        data-testid="record-client"
      >
        {{ clientNameOf(record) }}
      </span>
      <span class="shrink-0 font-mono text-xs font-bold text-on-surface">
        {{ formatHours(record.hours) }}
      </span>
    </div>

    <p class="truncate pl-1.5 text-xs font-medium text-on-surface">
      {{ projectNameOf(record) }}
    </p>
    <p v-if="record.description" class="line-clamp-2 pl-1.5 text-[11px] leading-relaxed text-on-surface-variant">
      {{ record.description }}
    </p>

    <p
      v-if="override"
      class="flex items-center gap-1 pl-1.5 text-[10px] font-medium text-primary"
      data-testid="record-override"
    >
      <i class="pi pi-pencil text-[10px]" aria-hidden="true" />
      Custom project rate applied
    </p>

    <div class="flex items-center justify-between border-t border-outline-variant/60 pl-1.5 pt-1 font-mono text-[11px] text-on-surface-variant">
      <span>
        {{ formatRate(record.rate, currencySymbol) }}
        <s v-if="override && record.client" class="text-[10px] opacity-60">
          {{ formatRate(record.client.billingHour, currencySymbol) }}
        </s>
      </span>
      <span class="font-medium text-on-surface">{{ formatMoney(record.lineTotal, currencySymbol) }}</span>
    </div>

    <div
      v-if="!readOnly"
      class="absolute right-1.5 top-1.5 hidden items-center gap-0.5 group-hover:flex group-focus-within:flex"
    >
      <button
        type="button"
        class="rounded p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
        :aria-label="`Edit record: ${projectNameOf(record)}`"
        :data-testid="`edit-record-${record.id}`"
        @click.stop="emit('edit', record)"
      >
        <i class="pi pi-pencil text-[11px]" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="rounded p-1 text-on-surface-variant hover:bg-error/10 hover:text-error"
        :aria-label="`Delete record: ${projectNameOf(record)}`"
        :data-testid="`delete-record-${record.id}`"
        @click.stop="emit('remove', record)"
      >
        <i class="pi pi-trash text-[11px]" aria-hidden="true" />
      </button>
    </div>
  </article>
</template>