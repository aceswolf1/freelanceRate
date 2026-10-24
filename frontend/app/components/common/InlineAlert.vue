<script setup lang="ts">
const props = withDefaults(defineProps<{
  tone?: Tone
  title?: string
}>(), {
  tone: 'info',
  title: undefined,
})

type Tone = 'warning' | 'error' | 'info' | 'success'

const TONE: Record<Tone, { box: string, icon: string }> = {
  warning: { box: 'border-warning/30 bg-warning/10 text-warning', icon: 'pi-exclamation-triangle' },
  error: { box: 'border-error/30 bg-error/10 text-error', icon: 'pi-times' },
  info: { box: 'border-outline-variant bg-surface-container-high text-on-surface-variant', icon: 'pi-info' },
  success: { box: 'border-tertiary/30 bg-tertiary/10 text-tertiary', icon: 'pi-check' },
}
</script>

<template>
  <div
    class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
    :class="TONE[props.tone].box"
    :role="props.tone === 'error' ? 'alert' : 'status'"
  >
    <i :class="[TONE[props.tone].icon, 'mt-0.5 shrink-0 text-sm']" aria-hidden="true" />
    <div class="min-w-0">
      <p v-if="props.title" class="font-semibold">{{ props.title }}</p>
      <p :class="props.title ? 'mt-0.5' : ''">
        <slot />
      </p>
    </div>
  </div>
</template>