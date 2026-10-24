<script setup lang="ts">
/**
 * Label + control + inline error. Keeps every dialog form visually consistent
 * and gives errors a single accessible home (`aria-describedby`).
 *
 * Named `BfFormField` (GAP-002): PrimeVue's auto-imported `FormField` from
 * `@primevue/forms` shadowed the original `FormField.vue`, so every form
 * rendered without labels or inline errors. A distinct name cannot collide.
 *
 * Slots:
 *   default   — the control, receiving `{ fieldId, describedBy, invalid }`
 *   label-extra — right-aligned affordance inside the label row (badges, links)
 *   hint      — replaces the `hint` prop when a slot is needed
 */
const props = withDefaults(defineProps<{
  label: string
  fieldId: string
  error?: string
  hint?: string
  required?: boolean
}>(), {
  error: undefined,
  hint: undefined,
  required: false,
})

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint) {
    ids.push(`${props.fieldId}-hint`)
  }
  if (props.error) {
    ids.push(`${props.fieldId}-error`)
  }
  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between gap-2">
      <label :for="fieldId" class="bf-label">
        {{ label }}
        <span v-if="required" class="text-error" aria-hidden="true">*</span>
      </label>
      <slot name="label-extra" />
    </div>

    <slot :field-id="fieldId" :described-by="describedBy" :invalid="Boolean(error)" />

    <slot name="hint">
      <p v-if="hint && !error" :id="`${fieldId}-hint`" class="text-[11px] text-on-surface-variant">
        {{ hint }}
      </p>
    </slot>

    <p
      v-if="error"
      :id="`${fieldId}-error`"
      class="flex items-center gap-1.5 text-[11px] text-error"
      role="alert"
    >
      <i class="pi pi-exclamation-triangle text-xs" aria-hidden="true" />
      {{ error }}
    </p>
  </div>
</template>