<script setup lang="ts">
import type { Project, ProjectInput, ProjectUpdate } from '../../types/api'
import { ApiError, toFieldErrors } from '../../composables/useApi'

/**
 * Create / edit dialog for a project (R2).
 *
 * Business rule mirrored from contract §3.4: a **standalone** project
 * (`clientId: null`) must set `billingHour`; a client project may omit it and
 * inherits the client's rate.
 */
const props = defineProps<{
  visible: boolean
  /** null = create mode */
  project: Project | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [Project]
}>()

const { create, update } = useProjects()
const { options: clientOptions } = useClients()
const { currencySymbol } = useSettings()

const STANDALONE_SENTINEL = -1

interface FormState {
  name: string
  /** STANDALONE_SENTINEL represents "no client" without fighting the Select's null option */
  clientId: number
  description: string
  billingHour: number | null
  archived: boolean
}

const blank = (): FormState => ({
  name: '',
  clientId: STANDALONE_SENTINEL,
  description: '',
  billingHour: null,
  archived: false,
})

const form = reactive<FormState>(blank())
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const saving = ref(false)

const isEdit = computed(() => props.project !== null)
const isStandalone = computed(() => form.clientId === STANDALONE_SENTINEL)
const heading = computed(() => (isEdit.value ? `Edit ${props.project?.name}` : 'Create New Project'))

/** Sentinel + real clients in one option list for the Select. */
const scopeOptions = computed(() => [
  { id: STANDALONE_SENTINEL, label: 'Standalone (No Client)' },
  ...clientOptions.value.map(client => ({
    id: client.id,
    label: `${client.name} (#CLI-${String(client.id).padStart(3, '0')}) — Default ${formatMoney(client.rate, currencySymbol.value)}/hr`,
  })),
])

const selectedClient = computed(() =>
  form.clientId === STANDALONE_SENTINEL ? null : clientOptions.value.find(c => c.id === form.clientId) ?? null,
)

watch(
  () => [props.visible, props.project] as const,
  ([visible, project]) => {
    if (!visible) {
      return
    }
    Object.assign(form, project
      ? {
          name: project.name,
          clientId: project.clientId ?? STANDALONE_SENTINEL,
          description: project.description ?? '',
          billingHour: project.billingHour,
          archived: project.archived,
        }
      : blank())
    errors.value = {}
    submitError.value = null
  },
  { immediate: true },
)

function validate(): Record<string, string> {
  const found: Record<string, string> = {}

  if (!form.name.trim()) {
    found.name = 'Project name is required.'
  }
  else if (form.name.trim().length > 120) {
    found.name = 'Keep the name under 120 characters.'
  }

  // R2 / contract §3.4: standalone without a rate is invalid.
  if (isStandalone.value && (form.billingHour === null || Number.isNaN(form.billingHour))) {
    found.billingHour = 'Standalone projects must set their own billing hour.'
  }

  if (form.billingHour !== null && !Number.isNaN(form.billingHour)) {
    if (form.billingHour <= 0) {
      found.billingHour = 'Rate must be greater than 0.'
    }
    else if (form.billingHour > 10_000) {
      found.billingHour = 'Rate must be 10,000 or less.'
    }
  }

  if (form.description.length > 4000) {
    found.description = 'Description is limited to 4,000 characters.'
  }

  return found
}

function toInput(): ProjectInput {
  const override = form.billingHour === null || Number.isNaN(form.billingHour)
    ? null
    : Number(form.billingHour)

  return {
    name: form.name.trim(),
    clientId: form.clientId === STANDALONE_SENTINEL ? null : form.clientId,
    description: form.description.trim() ? form.description.trim() : null,
    billingHour: override,
    archived: form.archived,
  }
}

async function save(): Promise<void> {
  const found = validate()
  errors.value = found
  submitError.value = null

  if (Object.keys(found).length > 0) {
    return
  }

  saving.value = true
  try {
    const saved = isEdit.value && props.project
      ? await update(props.project.id, toInput() as ProjectUpdate)
      : await create(toInput())
    emit('saved', saved)
    emit('update:visible', false)
  }
  catch (error) {
    if (error instanceof ApiError) {
      errors.value = toFieldErrors(error.details)
      submitError.value = error.message
    }
    else {
      submitError.value = 'Could not save the project.'
    }
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="heading"
    :style="{ width: '32rem', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="flex flex-col gap-4" novalidate @submit.prevent="save">
      <InlineAlert v-if="submitError" tone="error" title="Could not save">
        {{ submitError }}
      </InlineAlert>

      <BfFormField
        label="Project Name"
        field-id="project-name"
        required
        hint="Names are unique per client."
        :error="errors.name"
      >
        <template #default="{ fieldId, describedBy, invalid }">
          <InputText
            :id="fieldId"
            v-model="form.name"
            :aria-describedby="describedBy"
            :invalid="invalid"
            placeholder="E-Commerce Storefront"
            fluid
          />
        </template>
      </BfFormField>

      <BfFormField label="Client Association" field-id="project-client" required :error="errors.clientId">
        <template #default="{ fieldId, describedBy }">
          <Select
            :id="fieldId"
            v-model="form.clientId"
            :options="scopeOptions"
            option-label="label"
            option-value="id"
            :aria-describedby="describedBy"
            fluid
            data-testid="project-client-select"
          />
        </template>
      </BfFormField>

      <BfFormField
        label="Billing Rate Override"
        field-id="project-rate"
        :required="isStandalone"
        :hint="isStandalone
          ? 'Standalone projects must set their own rate.'
          : `Leave blank to inherit ${selectedClient ? formatMoney(selectedClient.rate, currencySymbol) : 'the client'} per hour.`"
        :error="errors.billingHour"
      >
        <template #default="{ fieldId, describedBy, invalid }">
          <InputNumber
            :id="fieldId"
            v-model="form.billingHour"
            :aria-describedby="describedBy"
            :invalid="invalid"
            :min="0"
            :max="10000"
            :min-fraction-digits="2"
            :max-fraction-digits="2"
            mode="decimal"
            :prefix="currencySymbol"
            :placeholder="isStandalone ? 'Required' : 'Inherited'"
            fluid
          />
        </template>
      </BfFormField>

      <BfFormField label="Scope & Description" field-id="project-description" :error="errors.description">
        <template #default="{ fieldId, describedBy, invalid }">
          <Textarea
            :id="fieldId"
            v-model="form.description"
            :aria-describedby="describedBy"
            :invalid="invalid"
            rows="3"
            placeholder="Next.js storefront, Stripe checkout & headless CMS"
            fluid
          />
        </template>
      </BfFormField>

      <div class="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5">
        <div>
          <p class="text-xs font-medium text-on-surface">Archived</p>
          <p class="text-[11px] text-on-surface-variant">Hidden from the timesheet picker, kept for history.</p>
        </div>
        <ToggleSwitch v-model="form.archived" input-id="project-archived" />
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-outline-variant pt-4">
        <Button type="button" severity="secondary" outlined label="Cancel" @click="emit('update:visible', false)" />
        <Button type="submit" :loading="saving" :label="isEdit ? 'Save changes' : 'Create project'" icon="pi pi-check" />
      </div>
    </form>
  </Dialog>
</template>