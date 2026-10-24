<script setup lang="ts">
import type { Client } from '~/types/api'
import { ApiError } from '~/composables/useApi'

useHead({ title: 'Clients' })

const { clients, pending, loaded, totalUnbilledGross, totalUnbilledHours, refresh, remove } = useClients()
const notifier = useNotifier()
const confirm = useConfirm()
const { currencySymbol } = useSettings()

const dialogVisible = ref(false)
const editing = ref<Client | null>(null)
const loadError = ref<string | null>(null)

/** Fetch the directory during SSR so the table is populated on first paint. */
const { data: ssrClients } = await useAsyncData(
  'bf:clients:ssr',
  () => useApi().get<Client[]>('/clients', { silent: true }).catch(() => []),
  { default: () => [] as Client[] },
)

watchEffect(() => {
  if (!loaded.value && ssrClients.value) {
    clients.value = ssrClients.value
    loaded.value = true
  }
})

async function load(): Promise<void> {
  loadError.value = null
  try {
    // Projects come along because deleting a client is blocked by project references.
    await Promise.all([refresh({ force: true, silent: true }), useProjects().refresh({ silent: true, force: true })])
  }
  catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not load clients.'
  }
}

onMounted(load)

const activeCount = computed(() => clients.value.length)

const averageRate = computed(() => {
  if (clients.value.length === 0) {
    return '—'
  }
  const sum = clients.value.reduce((acc, client) => acc + client.billingHour, 0)
  return formatMoney(sum / clients.value.length, currencySymbol.value)
})

function openCreate(): void {
  editing.value = null
  dialogVisible.value = true
}

function openEdit(client: Client): void {
  editing.value = client
  dialogVisible.value = true
}

function onSaved(client: Client): void {
  notifier.success(editing.value ? 'Client updated' : 'Client created', client.name)
  void load()
}

/** Contract §3.3: delete is 409 while the client is referenced by projects or records. */
function confirmRemove(client: Client): void {
  confirm.require({
    header: 'Delete client',
    message: `Delete ${client.name}? Clients referenced by projects or work records cannot be deleted.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await remove(client.id)
        notifier.success('Client deleted', client.name)
        await load()
      }
      catch (error) {
        if (error instanceof ApiError && error.isConflict) {
          notifier.warn('Cannot delete this client', error.message)
        }
        else {
          notifier.error('Could not delete client', error instanceof ApiError ? error.message : undefined)
        }
      }
    },
  })
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Accounts & Rates Ledger"
      title="Clients Directory"
      description="Manage billing accounts, default hourly rates, payout rails and contact addresses."
    >
      <template #eyebrow-icon>
        <i class="pi pi-users text-sm" aria-hidden="true" />
      </template>
      <template #actions>
        <Button label="Create New Client" icon="pi pi-plus" data-testid="create-client" @click="openCreate" />
      </template>
    </PageHeader>

    <InlineAlert v-if="loadError" tone="error" title="Could not load clients">
      {{ loadError }}
    </InlineAlert>

    <!-- Stats backed only by real contract data. The design's rate-distribution chart
         and "compliance" card are out of scope (no real data behind them). -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        label="Total Active Clients"
        :value="String(activeCount)"
        icon="pi-users"
        tone="primary"
      />
      <StatCard
        label="Total Unbilled Hours"
        :value="formatHours(totalUnbilledHours)"
        icon="pi-clock"
        tone="positive"
        :hint="`${formatMoney(totalUnbilledGross, currencySymbol)} projected across all clients`"
      />
      <StatCard
        label="Avg Billing Rate"
        :value="averageRate"
        icon="pi-chart-bar"
        :hint="`Across ${activeCount} client${activeCount === 1 ? '' : 's'}`"
      />
    </div>

    <div class="bf-panel overflow-hidden">
      <ClientsTable
        :clients="clients"
        :loading="pending"
        @edit="openEdit"
        @remove="confirmRemove"
      />
    </div>

    <ClientDialog
      v-model:visible="dialogVisible"
      :client="editing"
      @saved="onSaved"
    />
  </section>
</template>