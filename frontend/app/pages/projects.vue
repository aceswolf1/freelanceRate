<script setup lang="ts">
import type { Project } from '~/types/api'
import type { ProjectQuery, ProjectScope } from '~/composables/useProjects'
import { ApiError } from '~/composables/useApi'

useHead({ title: 'Projects' })

const {
  projects,
  pending,
  loaded,
  query,
  standaloneCount,
  linkedCount,
  overrideCount,
  refresh,
  setQuery,
  remove,
} = useProjects()

const { options: clientOptions, refresh: refreshClients } = useClients()
const notifier = useNotifier()
const confirm = useConfirm()

const dialogVisible = ref(false)
const editing = ref<Project | null>(null)
const loadError = ref<string | null>(null)

/** Fetch the directory during SSR so the table is populated on first paint. */
const { data: ssrProjects } = await useAsyncData(
  'bf:projects:ssr',
  () => useApi().get<Project[]>('/projects', { silent: true }).catch(() => []),
  { default: () => [] as Project[] },
)

watchEffect(() => {
  if (!loaded.value && ssrProjects.value) {
    projects.value = ssrProjects.value
    loaded.value = true
  }
})

async function load(): Promise<void> {
  loadError.value = null
  try {
    await Promise.all([refresh({ force: true, silent: true }), refreshClients({ silent: true })])
  }
  catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not load projects.'
  }
}

onMounted(load)

/** Filter strip mirrors the design: All / Client Linked / Standalone. */
const scopeOptions: Array<{ label: string, value: ProjectScope }> = [
  { label: 'All Projects', value: 'all' },
  { label: 'Client Linked', value: 'client' },
  { label: 'Standalone Projects', value: 'standalone' },
]

const selectedScope = computed({
  get: () => query.value.scope,
  set: (scope: ProjectScope) => void applyFilter({ ...query.value, scope, clientId: null }),
})

const selectedClientId = computed<number | null>({
  get: () => query.value.clientId,
  set: (clientId: number | null) => void applyFilter({ ...query.value, scope: 'client', clientId }),
})

const showArchived = computed({
  get: () => query.value.archived === 'all',
  set: (value: boolean) => void applyFilter({ ...query.value, archived: value ? 'all' : false }),
})

async function applyFilter(next: ProjectQuery): Promise<void> {
  loadError.value = null
  try {
    await setQuery(next)
  }
  catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not filter projects.'
  }
}

function openCreate(): void {
  editing.value = null
  dialogVisible.value = true
}

function openEdit(project: Project): void {
  editing.value = project
  dialogVisible.value = true
}

function onSaved(project: Project): void {
  notifier.success(editing.value ? 'Project updated' : 'Project created', project.name)
  void load()
}

/** Contract §3.4: delete is 409 while the project is referenced by work records. */
function confirmRemove(project: Project): void {
  confirm.require({
    header: 'Delete project',
    message: `Delete ${project.name}? Projects referenced by logged hours cannot be deleted.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await remove(project.id)
        notifier.success('Project deleted', project.name)
        await load()
      }
      catch (error) {
        if (error instanceof ApiError && error.isConflict) {
          notifier.warn('Cannot delete this project', error.message)
        }
        else {
          notifier.error('Could not delete project', error instanceof ApiError ? error.message : undefined)
        }
      }
    },
  })
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      eyebrow="Inventory & Contracts"
      title="Projects Directory"
      description="Track project rates, client associations, and individual billing overrides across engagements."
    >
      <template #eyebrow-icon>
        <i class="pi pi-folder-open text-sm" aria-hidden="true" />
      </template>
      <template #actions>
        <Button label="Create Project" icon="pi pi-plus" data-testid="create-project" @click="openCreate" />
      </template>
    </PageHeader>

    <InlineAlert v-if="loadError" tone="error" title="Could not load projects">
      {{ loadError }}
    </InlineAlert>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Active Inventory"
        :value="String(projects.length)"
        icon="pi-folder-open"
        tone="primary"
        :hint="`${linkedCount} linked • ${standaloneCount} standalone`"
      />
      <StatCard
        label="Custom Overrides"
        :value="String(overrideCount)"
        icon="pi-pencil"
        :hint="overrideCount === 1 ? '1 custom override in flight' : `${overrideCount} custom overrides in flight`"
      />
      <StatCard
        label="Standalone Rate"
        :value="String(standaloneCount)"
        icon="pi-user"
        :hint="`${linkedCount} project${linkedCount === 1 ? '' : 's'} inherit a client rate`"
      />
    </div>

    <!-- Filters -->
    <div class="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 md:flex-row md:items-center">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="option in scopeOptions"
          :key="option.value"
          :label="option.label"
          :outlined="selectedScope !== option.value"
          :severity="selectedScope === option.value ? undefined : 'secondary'"
          size="small"
          :data-testid="`filter-${option.value}`"
          @click="selectedScope = option.value"
        />
      </div>

      <div class="md:ml-auto flex flex-wrap items-center gap-3">
        <Select
          v-model="selectedClientId"
          :options="clientOptions"
          option-label="name"
          option-value="id"
          placeholder="All clients"
          show-clear
          size="small"
          class="min-w-48"
          data-testid="project-client-filter"
          aria-label="Filter by client"
        />
        <label class="flex items-center gap-2 text-xs text-on-surface-variant">
          <ToggleSwitch v-model="showArchived" input-id="show-archived" />
          Include archived
        </label>
      </div>
    </div>

    <div class="bf-panel overflow-hidden">
      <ProjectsTable
        :projects="projects"
        :loading="pending"
        @edit="openEdit"
        @remove="confirmRemove"
      />
    </div>

    <ProjectDialog
      v-model:visible="dialogVisible"
      :project="editing"
      @saved="onSaved"
    />
  </section>
</template>