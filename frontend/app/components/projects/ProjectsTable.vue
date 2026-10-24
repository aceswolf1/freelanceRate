<script setup lang="ts">
import type { Project } from '../../types/api'

/**
 * Projects directory table (R2).
 * The rate cell distinguishes an inherited client rate from a project override,
 * which is the whole point of the projects screen.
 */
defineProps<{
  projects: Project[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [Project]
  remove: [Project]
}>()

const { currencySymbol } = useSettings()
</script>

<template>
  <DataTable
    :value="projects"
    :loading="loading"
    data-key="id"
    striped-rows
    size="small"
    class="text-sm"
    data-testid="projects-table"
  >
    <template #empty>
      <EmptyState
        icon="pi-folder-open"
        title="No projects yet"
        description="Create a project to group your time entries and give them a rate."
      />
    </template>

    <Column field="id" header="Project" class="min-w-56">
      <template #body="{ data }">
        <div class="flex items-center gap-2.5">
          <InitialsAvatar :name="data.name" :seed="data.id" size="sm" />
          <div class="min-w-0">
            <p class="truncate font-semibold text-on-surface">{{ data.name }}</p>
            <p class="truncate font-mono text-[11px] text-on-surface-variant" :data-testid="`project-id-${data.id}`">
              {{ formatDisplayId('PRJ', data.id) }}
            </p>
          </div>
        </div>
      </template>
    </Column>

    <Column header="Client Association">
      <template #body="{ data }">
        <span
          v-if="data.client"
          class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          :class="data.archived
            ? 'border-outline-variant bg-surface-container-high text-on-surface-variant'
            : 'border-primary/30 bg-primary/15 text-primary'"
          :data-testid="`project-client-${data.id}`"
        >
          <i class="pi pi-building text-[10px]" aria-hidden="true" />
          {{ data.client.name }}
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant"
          data-testid="project-standalone"
        >
          <i class="pi pi-user text-[10px]" aria-hidden="true" />
          Standalone
        </span>
      </template>
    </Column>

    <Column header="Scope & Description" class="min-w-64">
      <template #body="{ data }">
        <p v-if="data.description" class="line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
          {{ data.description }}
        </p>
        <p v-else class="text-xs text-on-surface-variant">—</p>
      </template>
    </Column>

    <Column header="Billing Rate & Rule">
      <template #body="{ data }">
        <div>
          <p class="font-mono text-sm font-semibold text-on-surface">
            {{ formatMoney(data.effectiveRate, currencySymbol) }}
            <span class="text-[11px] font-normal text-on-surface-variant">/hr</span>
          </p>
          <p
            v-if="data.standalone"
            class="mt-0.5 flex items-center gap-1 text-[11px] text-on-surface-variant"
          >
            <i class="pi pi-pencil text-[10px]" aria-hidden="true" />
            Standalone project rate
          </p>
          <p
            v-else-if="data.rateSource === 'project'"
            class="mt-0.5 flex items-center gap-1 text-[11px] text-primary"
            data-testid="project-override-badge"
          >
            <i class="pi pi-pencil text-[10px]" aria-hidden="true" />
            Override · client standard is {{ formatMoney(data.client?.billingHour ?? 0, currencySymbol) }}
          </p>
          <p
            v-else
            class="mt-0.5 flex items-center gap-1 text-[11px] text-on-surface-variant"
          >
            <i class="pi pi-link text-[10px]" aria-hidden="true" />
            Inherited from {{ data.client?.name }}
          </p>
        </div>
      </template>
    </Column>

    <Column header="Status" class="w-24">
      <template #body="{ data }">
        <Tag
          :value="data.archived ? 'Archived' : 'Active'"
          :severity="data.archived ? 'secondary' : 'success'"
          class="text-[11px]"
        />
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
            :data-testid="`edit-project-${data.id}`"
            @click="emit('edit', data)"
          />
          <Button
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            :aria-label="`Delete ${data.name}`"
            :data-testid="`delete-project-${data.id}`"
            @click="emit('remove', data)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>