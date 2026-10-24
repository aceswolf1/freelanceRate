<script setup lang="ts">
import type { Project, WorkRecord, WorkRecordInput } from '../../types/api'
import { ApiError, toFieldErrors } from '../../composables/useApi'

/**
 * Quick Add / Edit drawer (R6).
 *
 * Owns only form state — every write goes through `useRecords`. All inputs are
 * disabled while the week is closed (R7), and the date is clamped to the week's
 * Monday–Sunday range so a 400 from the API cannot be provoked from the UI.
 */
const props = defineProps<{
  visible: boolean
  weekId: number | null
  startDate: string | null
  endDate: string | null
  /** null = create mode */
  record: WorkRecord | null
  /** date the drawer was opened for; null = fall back to today inside the week */
  requestedDate: string | null
  readOnly: boolean
  currencySymbol: string
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [WorkRecord]
}>()

const STANDALONE_SENTINEL = -1
const { clients, refresh: refreshClients } = useClients()
const { projects, refresh: refreshProjects } = useProjects()
const { create, update, remove, notifyError } = useRecords()

interface FormState {
  date: string
  clientId: number
  projectId: number | null
  hours: number | null
  description: string
}

const form = reactive<FormState>({
  date: '',
  clientId: STANDALONE_SENTINEL,
  projectId: null,
  hours: null,
  description: '',
})

const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const saving = ref(false)
const deleting = ref(false)

const isEdit = computed(() => props.record !== null)

const today = todayLocalIso()

/** Default the date to the requested day, clamped inside the week. */
function defaultDate(): string {
  const requested = props.requestedDate ?? today
  if (props.startDate && requested < props.startDate) {
    return props.startDate
  }
  if (props.endDate && requested > props.endDate) {
    return props.endDate
  }
  return requested
}

/**
 * True while the form is being populated from a record.
 *
 * GAP-004: the `form.clientId` watcher must not clear `projectId` during
 * hydration — the form is filled *before* the project list has loaded, so an
 * empty list would otherwise wipe the record's selection.
 */
const hydrating = ref(false)

watch(
  () => [props.visible, props.record, props.requestedDate] as const,
  async ([visible, record]) => {
    if (!visible) {
      return
    }

    hydrating.value = true
    Object.assign(form, record
      ? {
          date: record.date,
          clientId: record.clientId ?? STANDALONE_SENTINEL,
          projectId: record.projectId,
          hours: record.hours,
          description: record.description,
        }
      : { date: defaultDate(), clientId: STANDALONE_SENTINEL, projectId: null, hours: null, description: '' })

    errors.value = {}
    submitError.value = null

    // `force` so the list is guaranteed to be the real one by the time we
    // re-apply the record's project below.
    await Promise.all([refreshClients({ silent: true }), refreshProjects({ silent: true, force: true })])

    // GAP-004: the project list arrives after the form was filled, so
    // re-apply the record's project now that the list is available.
    if (record?.projectId) {
      const stillValid = projects.value.some(project =>
        project.id === record.projectId
        && !project.archived
        && (record.clientId === null ? project.standalone : project.clientId === record.clientId),
      )
      form.projectId = stillValid ? record.projectId : null
    }

    hydrating.value = false
  },
  { immediate: true },
)

const clientOptions = computed(() => [
  { id: STANDALONE_SENTINEL, label: 'None (Standalone / Internal)' },
  ...clients.value.map(client => ({
    id: client.id,
    label: `${client.name} (${formatMoney(client.billingHour, props.currencySymbol)} default)`,
  })),
])

/** Choosing a client filters the project list, exactly as the design's drawer does. */
const availableProjects = computed(() =>
  projects.value.filter(project => !project.archived && (
    form.clientId === STANDALONE_SENTINEL ? project.standalone : project.clientId === form.clientId
  )),
)

const selectedProject = computed<Project | undefined>(() =>
  availableProjects.value.find(project => project.id === form.projectId),
)

/**
 * The rate to bill at.
 *
 * GAP-004: while the project list is still loading, the selected project is not
 * in it yet, so fall back to the rate snapshotted on the record itself. The
 * estimated total is therefore non-zero the moment the drawer opens.
 */
const effectiveRate = computed(() => selectedProject.value?.effectiveRate ?? props.record?.rate ?? 0)

watch(() => form.clientId, (next, previous) => {
  // GAP-004: while hydrating from a record the project list may still be
  // empty, so the selection must be left alone.
  if (hydrating.value) {
    return
  }

  // A client change made by hand must still drop an incompatible project.
  if (next === previous) {
    return
  }

  if (selectedProject.value === undefined) {
    form.projectId = null
  }
})

/** Rate badge: the effective rate, flagged when the project overrides the client. */
const rateBadge = computed(() => {
  const project = selectedProject.value
  if (!project) {
    // GAP-004: fall back to the record's snapshotted rate until the project
    // list arrives, so the drawer never shows a blank rate.
    if (props.record && form.projectId === props.record.projectId) {
      return {
        text: formatRate(props.record.rate, props.currencySymbol),
        override: false,
        inheritedFrom: props.record.client?.billingHour ?? null,
      }
    }
    return null
  }
  const isOverride = project.rateSource === 'project' && project.client !== null
  return {
    text: formatRate(project.effectiveRate, props.currencySymbol),
    override: isOverride,
    inheritedFrom: project.client?.billingHour ?? null,
  }
})

const estimatedTotal = computed(() => {
  if (form.hours === null) {
    return 0
  }
  return effectiveRate.value * form.hours
})

const hoursInputId = 'record-hours'

/** R5: hours > 0 and <= 24; the input steps by 0.25. */
function validate(): Record<string, string> {
  const found: Record<string, string> = {}

  if (!form.date) {
    found.date = 'Date is required.'
  }
  else if (props.startDate && form.date < props.startDate) {
    found.date = `Date must be on or after ${formatDate(props.startDate)}.`
  }
  else if (props.endDate && form.date > props.endDate) {
    found.date = `Date must be on or before ${formatDate(props.endDate)}.`
  }

  if (!form.projectId) {
    found.projectId = 'Pick a project for this entry.'
  }

  if (form.hours === null || Number.isNaN(form.hours)) {
    found.hours = 'Hours are required.'
  }
  else if (form.hours <= 0) {
    found.hours = 'Hours must be greater than 0.'
  }
  else if (form.hours > 24) {
    found.hours = 'A single entry cannot exceed 24 hours.'
  }

  if (!form.description.trim()) {
    found.description = 'Describe the work.'
  }
  else if (form.description.trim().length > 500) {
    found.description = 'Keep the description under 500 characters.'
  }

  return found
}

function toInput(): WorkRecordInput {
  return {
    projectId: Number(form.projectId),
    description: form.description.trim(),
    hours: Number(form.hours),
    date: form.date,
  }
}

async function save(): Promise<void> {
  if (props.readOnly || props.weekId === null) {
    return
  }

  const found = validate()
  errors.value = found
  submitError.value = null

  if (Object.keys(found).length > 0) {
    return
  }

  saving.value = true
  try {
    const saved = isEdit.value && props.record
      ? await update(props.record.id, toInput())
      : await create(props.weekId, toInput())
    emit('saved', saved)
    emit('update:visible', false)
  }
  catch (error) {
    if (error instanceof ApiError) {
      errors.value = toFieldErrors(error.details)
      submitError.value = error.message
    }
    else {
      submitError.value = 'Could not save the record.'
    }
    notifyError(submitError.value)
  }
  finally {
    saving.value = false
  }
}

async function destroy(): Promise<void> {
  if (!isEdit.value || !props.record) {
    return
  }

  deleting.value = true
  try {
    await remove(props.record.id)
    emit('update:visible', false)
  }
  catch (error) {
    submitError.value = error instanceof ApiError ? error.message : 'Could not delete the record.'
    notifyError(submitError.value)
  }
  finally {
    deleting.value = false
  }
}

const heading = computed(() => (isEdit.value ? 'Edit Record' : 'Quick Add Record'))
</script>

<template>
  <Drawer
    :visible="visible"
    position="right"
    class="w-full sm:w-[26rem]"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2.5">
        <span
          class="flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <i class="pi pi-calendar" />
        </span>
        <div>
          <h3 class="text-sm font-bold tracking-tight text-on-surface">{{ heading }}</h3>
          <p class="text-xs text-on-surface-variant" data-testid="drawer-day-label">
            {{ formatLongDate(form.date) }}
          </p>
        </div>
      </div>
    </template>

    <form class="flex flex-col gap-3.5" novalidate @submit.prevent="save">
      <InlineAlert v-if="props.readOnly" tone="warning" title="Week is closed">
        Time entries cannot be added, edited or removed while the week is closed.
      </InlineAlert>
      <InlineAlert v-else-if="submitError" tone="error" title="Could not save">
        {{ submitError }}
      </InlineAlert>

      <BfFormField label="Date" field-id="record-date" required :error="errors.date">
        <template #default="{ fieldId, describedBy, invalid }">
          <InputText
            :id="fieldId"
            v-model="form.date"
            type="date"
            :min="startDate ?? undefined"
            :max="endDate ?? undefined"
            :aria-describedby="describedBy"
            :invalid="invalid"
            :disabled="props.readOnly"
            class="font-mono"
            fluid
            data-testid="record-date"
          />
        </template>
      </BfFormField>

      <BfFormField label="Client" field-id="record-client">
        <template #label-extra>
          <NuxtLink
            to="/clients"
            class="text-[11px] font-medium text-primary hover:underline"
            data-testid="drawer-new-client"
          >+ New Client</NuxtLink>
        </template>
        <template #default="{ fieldId, describedBy }">
          <Select
            :id="fieldId"
            v-model="form.clientId"
            :options="clientOptions"
            option-label="label"
            option-value="id"
            :aria-describedby="describedBy"
            :disabled="props.readOnly"
            placeholder="Choose a client"
            fluid
            data-testid="record-client-select"
          />
        </template>
      </BfFormField>

      <BfFormField label="Project" field-id="record-project" required :error="errors.projectId">
        <template #default="{ fieldId, describedBy, invalid }">
          <Select
            :id="fieldId"
            v-model="form.projectId"
            :options="availableProjects"
            option-label="name"
            option-value="id"
            :aria-describedby="describedBy"
            :invalid="invalid"
            :disabled="props.readOnly"
            :placeholder="availableProjects.length === 0 ? 'No projects for this client' : 'Choose a project'"
            fluid
            data-testid="record-project-select"
          />
        </template>
        <template #label-extra>
          <span
            v-if="rateBadge"
            class="rounded border px-1.5 py-0.5 font-mono text-[10px]"
            :class="rateBadge.override ? 'border-primary/30 bg-primary/15 text-primary' : 'border-outline-variant bg-surface-container-high text-on-surface-variant'"
            data-testid="rate-badge"
          >
            Rate: {{ rateBadge.text }}
          </span>
        </template>
        <template #hint>
          <span v-if="rateBadge?.override && rateBadge.inheritedFrom !== null" class="text-primary">
            Override — client standard is {{ formatRate(rateBadge.inheritedFrom, currencySymbol) }}
          </span>
        </template>
      </BfFormField>

      <div class="grid grid-cols-2 gap-3">
        <BfFormField
          label="Hours Worked"
          field-id="record-hours-field"
          required
          hint="Steps of 0.25, max 24."
          :error="errors.hours"
        >
          <template #default="{ describedBy, invalid }">
            <InputNumber
              :id="hoursInputId"
              v-model="form.hours"
              :aria-describedby="describedBy"
              :invalid="invalid"
              :disabled="props.readOnly"
              :min="0"
              :max="24"
              :step="0.25"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              suffix=" hrs"
              fluid
              data-testid="record-hours"
            />
          </template>
        </BfFormField>

        <BfFormField label="Estimated Total" field-id="estimated-total">
          <template #default>
            <div
              class="flex h-9 items-center justify-between rounded-lg border border-outline-variant bg-surface-container-low px-3"
              data-testid="estimated-total"
            >
              <span class="text-[11px] text-on-surface-variant">Billable</span>
              <span class="font-mono text-xs font-bold text-tertiary">
                {{ formatMoney(estimatedTotal, currencySymbol) }}
              </span>
            </div>
          </template>
        </BfFormField>
      </div>

      <BfFormField label="Work Description" field-id="record-description" required :error="errors.description">
        <template #default="{ fieldId, describedBy, invalid }">
          <Textarea
            :id="fieldId"
            v-model="form.description"
            :aria-describedby="describedBy"
            :invalid="invalid"
            :disabled="props.readOnly"
            rows="3"
            placeholder="Provide details on deliverables, features, or sprint tasks..."
            fluid
            data-testid="record-description"
          />
        </template>
      </BfFormField>

      <div class="flex items-center justify-end gap-2 border-t border-outline-variant pt-3">
        <Button
          v-if="isEdit"
          type="button"
          severity="danger"
          text
          icon="pi pi-trash"
          label="Delete"
          :loading="deleting"
          :disabled="props.readOnly"
          data-testid="drawer-delete"
          @click="destroy"
        />
        <Button type="button" severity="secondary" outlined label="Cancel" @click="emit('update:visible', false)" />
        <Button
          type="submit"
          icon="pi pi-check"
          :label="isEdit ? 'Save Changes' : 'Save Record'"
          :loading="saving"
          :disabled="props.readOnly"
          data-testid="drawer-save"
        />
      </div>
    </form>

    <InlineAlert tone="info" class="mt-4">
      Rates follow the client agreement. A project that sets its own rate is flagged here and carried
      through to the generated invoice.
    </InlineAlert>
  </Drawer>
</template>