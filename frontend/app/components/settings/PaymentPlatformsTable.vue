<script setup lang="ts">
import type { PaymentPlatform } from '../../types/api'

/**
 * Payment platform CRUD table (R3), managed inside Settings per
 * `.claude/design/settings_preferences`. Presentational.
 */
defineProps<{
  platforms: PaymentPlatform[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [PaymentPlatform]
  remove: [PaymentPlatform]
}>()

const { currencySymbol } = useSettings()

/** Mirrors the invoicing formula so the operator can sanity-check a rail at a glance. */
function estimateFee(gross: number, platform: PaymentPlatform): number {
  const percent = Math.round(gross * (platform.feePercent / 100) * 100) / 100
  return percent + platform.feeFlat
}
</script>

<template>
  <DataTable
    :value="platforms"
    :loading="loading"
    data-key="id"
    striped-rows
    size="small"
    class="text-sm"
    data-testid="platforms-table"
  >
    <template #empty>
      <EmptyState
        icon="pi-wallet"
        title="No payment platforms"
        description="Add the payout rails you invoice through so fees are computed automatically."
      />
    </template>

    <Column field="company" header="Company">
      <template #body="{ data }">
        <div class="flex items-center gap-2.5">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-tertiary/30 bg-tertiary/10 text-tertiary"
            aria-hidden="true"
          >
            <i class="pi pi-wallet text-sm" />
          </span>
          <span class="font-semibold text-on-surface">{{ data.company }}</span>
        </div>
      </template>
    </Column>

    <Column header="Percentage Fee" class="w-40">
      <template #body="{ data }">
        <span class="font-mono text-sm" :class="data.feePercent > 0 ? 'text-on-surface' : 'text-on-surface-variant'">
          {{ data.feePercent.toFixed(2) }}%
        </span>
      </template>
    </Column>

    <Column header="Flat Fee" class="w-40">
      <template #body="{ data }">
        <span class="font-mono text-sm" :class="data.feeFlat > 0 ? 'text-on-surface' : 'text-on-surface-variant'">
          {{ formatMoney(data.feeFlat, currencySymbol) }}
        </span>
      </template>
    </Column>

    <Column :header="`Fee on ${formatMoney(1000, currencySymbol)}`" class="w-48">
      <template #body="{ data }">
        <span class="font-mono text-sm font-semibold text-tertiary">
          {{ formatMoney(estimateFee(1000, data), currencySymbol) }}
        </span>
      </template>
    </Column>

    <Column header="Actions" class="w-24">
      <template #body="{ data }">
        <div class="flex items-center justify-end gap-1">
          <Button
            icon="pi pi-pencil"
            text
            rounded
            size="small"
            :aria-label="`Edit ${data.company}`"
            :data-testid="`edit-platform-${data.id}`"
            @click="emit('edit', data)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            :aria-label="`Delete ${data.company}`"
            :data-testid="`delete-platform-${data.id}`"
            @click="emit('remove', data)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>