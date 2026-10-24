<script setup lang="ts">
import type { PaymentPlatform, PaymentPlatformInput, PaymentPlatformUpdate } from '../../types/api'
import { ApiError, toFieldErrors } from '../../composables/useApi'

/** Create / edit dialog for a payment platform (R3). */
const props = defineProps<{
  visible: boolean
  /** null = create mode */
  platform: PaymentPlatform | null
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [PaymentPlatform]
}>()

const { create, update } = usePaymentPlatforms()
const { currencySymbol } = useSettings()

interface FormState {
  company: string
  feePercent: number | null
  feeFlat: number | null
}

const blank = (): FormState => ({ company: '', feePercent: 0, feeFlat: 0 })

const form = reactive<FormState>(blank())
const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const saving = ref(false)

const isEdit = computed(() => props.platform !== null)
const heading = computed(() => (isEdit.value ? `Edit ${props.platform?.company}` : 'Add Payment Platform'))

watch(
  () => [props.visible, props.platform] as const,
  ([visible, platform]) => {
    if (!visible) {
      return
    }
    Object.assign(form, platform
      ? { company: platform.company, feePercent: platform.feePercent, feeFlat: platform.feeFlat }
      : blank())
    errors.value = {}
    submitError.value = null
  },
  { immediate: true },
)

/** Contract §3.2: company 1–120 chars; both fees >= 0, percent <= 100. */
function validate(): Record<string, string> {
  const found: Record<string, string> = {}

  if (!form.company.trim()) {
    found.company = 'Company name is required.'
  }
  else if (form.company.trim().length > 120) {
    found.company = 'Keep the name under 120 characters.'
  }

  if (form.feePercent === null || Number.isNaN(form.feePercent)) {
    found.feePercent = 'Percentage fee must be a number.'
  }
  else if (form.feePercent < 0) {
    found.feePercent = 'Fee cannot be negative.'
  }
  else if (form.feePercent > 100) {
    found.feePercent = 'Percentage fee cannot exceed 100%.'
  }

  if (form.feeFlat !== null && !Number.isNaN(form.feeFlat) && form.feeFlat < 0) {
    found.feeFlat = 'Flat fee cannot be negative.'
  }

  return found
}

function toInput(): PaymentPlatformInput {
  return {
    company: form.company.trim(),
    feePercent: Number(form.feePercent ?? 0),
    feeFlat: Number(form.feeFlat ?? 0),
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
    const saved = isEdit.value && props.platform
      ? await update(props.platform.id, toInput() as PaymentPlatformUpdate)
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
      submitError.value = 'Could not save the payment platform.'
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
    :style="{ width: '28rem', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="flex flex-col gap-4" novalidate @submit.prevent="save">
      <InlineAlert v-if="submitError" tone="error" title="Could not save">
        {{ submitError }}
      </InlineAlert>

      <BfFormField label="Company" field-id="platform-company" required :error="errors.company">
        <template #default="{ fieldId, describedBy, invalid }">
          <InputText
            :id="fieldId"
            v-model="form.company"
            :aria-describedby="describedBy"
            :invalid="invalid"
            placeholder="Payoneer"
            fluid
          />
        </template>
      </BfFormField>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BfFormField
          label="Percentage Fee"
          field-id="platform-percent"
          hint="e.g. 1 for 1% of gross."
          :error="errors.feePercent"
        >
          <template #default="{ fieldId, describedBy, invalid }">
            <InputNumber
              :id="fieldId"
              v-model="form.feePercent"
              :aria-describedby="describedBy"
              :invalid="invalid"
              :min="0"
              :max="100"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              suffix=" %"
              fluid
            />
          </template>
        </BfFormField>

        <BfFormField
          label="Flat Fee"
          field-id="platform-flat"
          :hint="`Charged once per invoice, in ${currencySymbol}.`"
          :error="errors.feeFlat"
        >
          <template #default="{ fieldId, describedBy, invalid }">
            <InputNumber
              :id="fieldId"
              v-model="form.feeFlat"
              :aria-describedby="describedBy"
              :invalid="invalid"
              :min="0"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              mode="decimal"
              :prefix="currencySymbol"
              fluid
            />
          </template>
        </BfFormField>
      </div>

      <InlineAlert tone="info">
        Fees are absorbed by you: the client is invoiced the full gross amount and the fee comes out of
        your payout.
      </InlineAlert>

      <div class="flex items-center justify-end gap-2 border-t border-outline-variant pt-4">
        <Button type="button" severity="secondary" outlined label="Cancel" @click="emit('update:visible', false)" />
        <Button type="submit" :loading="saving" :label="isEdit ? 'Save changes' : 'Add platform'" icon="pi pi-check" />
      </div>
    </form>
  </Dialog>
</template>