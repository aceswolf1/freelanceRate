<script setup lang="ts">
import type { Client } from '../../types/api'

/**
 * Clients directory table (R1). Presentational — emits row actions to the page.
 * Columns follow `.claude/design/clients_directory`: id, identity, primary +
 * CC email, billing hour with its payout rail, and lifetime totals.
 */
const props = defineProps<{
  clients: Client[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [Client]
  remove: [Client]
}>()

const { currencySymbol } = useSettings()

const rows = computed(() => props.clients)

/** Contract §3.3: fee = percent + flat, and it is absorbed by the freelancer. */
function feeLabel(client: Client): string | null {
  const platform = client.paymentPlatform
  if (!platform) {
    return null
  }

  const parts: string[] = []
  if (platform.feePercent > 0) {
    parts.push(`${trimNumber(platform.feePercent)}%`)
  }
  if (platform.feeFlat > 0) {
    parts.push(`${formatMoney(platform.feeFlat, currencySymbol.value)} flat`)
  }

  return parts.length > 0 ? `${platform.company} (${parts.join(' + ')}, absorbed)` : platform.company
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
</script>

<template>
  <DataTable
    :value="rows"
    :loading="loading"
    data-key="id"
    striped-rows
    size="small"
    class="text-sm"
    data-testid="clients-table"
  >
    <template #empty>
      <EmptyState
        icon="pi-users"
        title="No clients yet"
        description="Create your first client to start logging billable hours and generating invoices."
      />
    </template>

    <Column field="id" header="Client ID" class="w-28">
      <template #body="{ data }">
        <span class="font-mono text-xs text-on-surface-variant" :data-testid="`client-id-${data.id}`">
          {{ formatDisplayId('CLI', data.id) }}
        </span>
      </template>
    </Column>

    <Column field="name" header="Client Name">
      <template #body="{ data, index }">
        <div class="flex items-center gap-2.5">
          <InitialsAvatar :name="data.name" :seed="index" size="sm" />
          <div class="min-w-0">
            <p class="truncate font-semibold text-on-surface">{{ data.name }}</p>
            <p class="truncate font-mono text-[11px] text-on-surface-variant">
              {{ data.projectCount }} project{{ data.projectCount === 1 ? '' : 's' }}
            </p>
          </div>
        </div>
      </template>
    </Column>

    <Column field="contactEmail" header="Primary Contact">
      <template #body="{ data }">
        <span
          v-if="data.contactName"
          class="mb-0.5 block text-sm text-on-surface"
          data-testid="client-contact-name"
        >{{ data.contactName }}</span>
        <a
          :href="`mailto:${data.contactEmail}`"
          class="inline-flex items-center gap-1.5 font-mono text-xs text-on-surface hover:text-primary"
        >
          <i class="pi pi-envelope text-xs" aria-hidden="true" />
          {{ data.contactEmail }}
        </a>
      </template>
    </Column>

    <Column header="Secondary Contact Email">
      <template #body="{ data }">
        <span v-if="data.ccEmail" class="inline-flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
          <i class="pi pi-inbox text-xs" aria-hidden="true" />
          {{ data.ccEmail }}
        </span>
        <span v-else class="text-xs text-on-surface-variant">—</span>
      </template>
    </Column>

    <Column header="Billing Hour & Payout Rail">
      <template #body="{ data }">
        <div>
          <p class="font-mono text-sm font-semibold text-on-surface">
            {{ formatMoney(data.billingHour, currencySymbol) }}
            <span class="text-[11px] font-normal text-on-surface-variant">/hr</span>
          </p>
          <p v-if="feeLabel(data)" class="mt-0.5 text-[11px] text-on-surface-variant">
            {{ feeLabel(data) }}
          </p>
          <p v-else class="mt-0.5 text-[11px] text-on-surface-variant">No payment platform</p>
        </div>
      </template>
    </Column>

    <Column header="Lifetime" class="w-32">
      <template #body="{ data }">
        <p class="font-mono text-xs text-on-surface">{{ formatHours(data.totalHours) }}</p>
        <p class="font-mono text-[11px] text-tertiary">{{ formatMoney(data.totalGross, currencySymbol) }}</p>
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
            :aria-label="`Edit ${data.name}`"
            :data-testid="`edit-client-${data.id}`"
            @click="emit('edit', data)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            :aria-label="`Delete ${data.name}`"
            :data-testid="`delete-client-${data.id}`"
            @click="emit('remove', data)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>