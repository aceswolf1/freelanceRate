<script setup lang="ts">
/**
 * Settings → Email content: what "Send as Email Text" / "Copy formatted"
 * reveal to the client. All three are off by default; the PDF is unaffected.
 */
const showRate = defineModel<boolean>('showRate', { required: true })
const showGross = defineModel<boolean>('showGross', { required: true })
const showFee = defineModel<boolean>('showFee', { required: true })

interface EmailOption {
  id: string
  label: string
  description: string
  model: typeof showRate
}

const options: EmailOption[] = [
  {
    id: 'settings-email-rate',
    label: 'Show rate',
    description: 'Adds the hourly rate column to each project table.',
    model: showRate,
  },
  {
    id: 'settings-email-gross',
    label: 'Show gross',
    description: 'Adds the gross amount line to the totals.',
    model: showGross,
  },
  {
    id: 'settings-email-fee',
    label: 'Show fee',
    description: 'Adds the payment-platform fee line to the totals.',
    model: showFee,
  },
]
</script>

<template>
  <div class="bf-panel flex flex-col gap-5 p-5" data-testid="email-content-panel">
    <div class="flex items-center gap-2.5">
      <span class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
        <i class="pi pi-envelope" />
      </span>
      <div>
        <h2 class="text-base font-semibold text-on-surface">Email Content</h2>
        <p class="text-xs text-on-surface-variant">
          What the copied invoice email includes. Hours, line totals and the amount due are always shown.
        </p>
      </div>
    </div>

    <ul class="flex flex-col divide-y divide-outline-variant">
      <li
        v-for="option in options"
        :key="option.id"
        class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
      >
        <label :for="option.id" class="flex flex-col gap-0.5">
          <span class="text-sm font-medium text-on-surface">{{ option.label }}</span>
          <span class="text-xs text-on-surface-variant">{{ option.description }}</span>
        </label>
        <ToggleSwitch
          v-model="option.model.value"
          :input-id="option.id"
          :data-testid="option.id"
        />
      </li>
    </ul>
  </div>
</template>
