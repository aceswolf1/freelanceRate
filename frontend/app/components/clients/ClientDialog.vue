<script setup lang="ts">
import type { Client, ClientInput, ClientUpdate } from '../../types/api'
import { ApiError } from '../../composables/useApi'
import { toFieldErrors } from '../../composables/useApi'

/**
 * Create / edit dialog for a client (R1).
 * Presentational: it owns the form state and emits, but all persistence lives
 * in `useClients`.
 */
const props = defineProps<{
  visible: boolean
  /** null = create mode */
  client: Client | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [Client]
}>()

const { create, update } = useClients()
const { options: platformOptions, refresh: refreshPlatforms } = usePaymentPlatforms()
const { currencySymbol } = useSettings()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormState {
  name: string
  contactName: string
  contactEmail: string
  ccEmail: string
  billingHour: number | null
  paymentPlatformId: number | null
  notes: string
}

const blank = (): FormState => ({
  name: '',
  contactName: '',
  contactEmail: '',
  ccEmail: '',
  billingHour: null,
  paymentPlatformId: null,
  notes: '',
})

const form = reactive<FormState>(blank())
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const saving = ref(false)

const isEdit = computed(() => props.client !== null)
const heading = computed(() => (isEdit.value ? `Edit ${props.client?.name}` : 'Create New Client'))

watch(
  () => [props.visible, props.client] as const,
  ([visible, client]) => {
    if (!visible) {
      return
    }
    Object.assign(form, client
      ? {
          name: client.name,
          contactName: client.contactName ?? '',
          contactEmail: client.contactEmail,
          ccEmail: client.ccEmail ?? '',
          billingHour: client.billingHour,
          paymentPlatformId: client.paymentPlatformId,
          notes: client.notes ?? '',
        }
      : blank())
    errors.value = {}
    submitError.value = null
    void refreshPlatforms()
  },
  { immediate: true },
)

/** Mirrors the backend's rules so the user sees the problem before the round-trip. */
function validate(): Record<string, string> {
  const found: Record<string, string> = {}

  if (!form.name.trim()) {
    found.name = 'Client name is required.'
  }
  else if (form.name.trim().length > 120) {
    found.name = 'Keep the name under 120 characters.'
  }

  if (form.contactName.trim().length > 120) {
    found.contactName = 'Keep the contact name under 120 characters.'
  }

  if (!form.contactEmail.trim()) {
    found.contactEmail = 'Primary billing email is required.'
  }
  else if (!EMAIL_RE.test(form.contactEmail.trim())) {
    found.contactEmail = 'Enter a valid email address.'
  }

  if (form.ccEmail.trim() && !EMAIL_RE.test(form.ccEmail.trim())) {
    found.ccEmail = 'Enter a valid email address, or leave blank.'
  }

  if (form.billingHour === null || Number.isNaN(form.billingHour)) {
    found.billingHour = 'Billing hour is required.'
  }
  else if (form.billingHour <= 0) {
    found.billingHour = 'Rate must be greater than 0.'
  }
  else if (form.billingHour > 10_000) {
    found.billingHour = 'Rate must be 10,000 or less.'
  }

  if ((form.notes ?? '').length > 4000) {
    found.notes = 'Notes are limited to 4,000 characters.'
  }

  return found
}

function toInput(): ClientInput {
  return {
    name: form.name.trim(),
    contactName: form.contactName.trim() ? form.contactName.trim() : null,
    contactEmail: form.contactEmail.trim(),
    ccEmail: form.ccEmail.trim() ? form.ccEmail.trim() : null,
    billingHour: Number(form.billingHour),
    paymentPlatformId: form.paymentPlatformId,
    notes: form.notes.trim() ? form.notes.trim() : null,
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
    const saved = isEdit.value && props.client
      ? await update(props.client.id, toInput() as ClientUpdate)
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
      submitError.value = 'Could not save the client.'
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

      <BfFormField label="Client Name" field-id="client-name" required :error="errors.name">
        <template #default="{ fieldId, describedBy, invalid }">
          <InputText
            :id="fieldId"
            v-model="form.name"
            :aria-describedby="describedBy"
            :invalid="invalid"
            autocomplete="organization"
            placeholder="Acme Corp"
            fluid
          />
        </template>
      </BfFormField>

      <BfFormField
        label="Contact Name"
        field-id="client-contact-name"
        hint="Optional. Greets this person in the invoice email and appears on the PDF."
        :error="errors.contactName"
      >
        <template #default="{ fieldId, describedBy, invalid }">
          <InputText
            :id="fieldId"
            v-model="form.contactName"
            :aria-describedby="describedBy"
            :invalid="invalid"
            autocomplete="name"
            placeholder="Jane Doe"
            maxlength="120"
            fluid
          />
        </template>
      </BfFormField>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BfFormField
          label="Primary Billing Email"
          field-id="client-email"
          required
          :error="errors.contactEmail"
        >
          <template #default="{ fieldId, describedBy, invalid }">
            <InputText
              :id="fieldId"
              v-model="form.contactEmail"
              type="email"
              :aria-describedby="describedBy"
              :invalid="invalid"
              autocomplete="email"
              placeholder="billing@acme.example"
              fluid
            />
          </template>
        </BfFormField>

        <BfFormField
          label="Secondary (CC) Email"
          field-id="client-cc"
          hint="Optional — invoices copy this address."
          :error="errors.ccEmail"
        >
          <template #default="{ fieldId, describedBy, invalid }">
            <InputText
              :id="fieldId"
              v-model="form.ccEmail"
              type="email"
              :aria-describedby="describedBy"
              :invalid="invalid"
              placeholder="finance@acme.example"
              fluid
            />
          </template>
        </BfFormField>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BfFormField
          label="Default Billing Hour"
          field-id="client-rate"
          required
          :hint="`Fallback rate for this client's projects, in ${currencySymbol}.`"
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
              fluid
            />
          </template>
        </BfFormField>

        <BfFormField
          label="Payment Platform"
          field-id="client-platform"
          hint="Fee is absorbed on generated invoices."
          :error="errors.paymentPlatformId"
        >
          <template #default="{ fieldId, describedBy }">
            <Select
              :id="fieldId"
              v-model="form.paymentPlatformId"
              :options="platformOptions"
              option-label="company"
              option-value="id"
              :aria-describedby="describedBy"
              placeholder="No payment platform"
              fluid
            />
          </template>
        </BfFormField>
      </div>

      <BfFormField label="Notes" field-id="client-notes" :error="errors.notes">
        <template #default="{ fieldId, describedBy, invalid }">
          <Textarea
            :id="fieldId"
            v-model="form.notes"
            :aria-describedby="describedBy"
            :invalid="invalid"
            rows="3"
            placeholder="Net 15. Monthly retainer invoicing."
            fluid
          />
        </template>
      </BfFormField>

      <div class="flex items-center justify-end gap-2 border-t border-outline-variant pt-4">
        <Button type="button" severity="secondary" outlined label="Cancel" @click="emit('update:visible', false)" />
        <Button type="submit" :loading="saving" :label="isEdit ? 'Save changes' : 'Create client'" icon="pi pi-check" />
      </div>
    </form>
  </Dialog>
</template>