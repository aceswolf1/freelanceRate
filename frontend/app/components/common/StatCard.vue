<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  icon?: string
  hint?: string
  tone?: 'neutral' | 'positive' | 'primary' | 'warning'
}>(), {
  icon: undefined,
  hint: undefined,
  tone: 'neutral',
})

const toneClasses: Record<string, string> = {
  neutral: 'bg-surface-container-high border-outline-variant text-on-surface-variant',
  positive: 'bg-tertiary/10 border-tertiary/30 text-tertiary',
  primary: 'bg-primary/10 border-primary/30 text-primary',
  warning: 'bg-warning/10 border-warning/30 text-warning',
}

const valueTone: Record<string, string> = {
  neutral: 'text-on-surface',
  positive: 'text-tertiary',
  primary: 'text-primary',
  warning: 'text-warning',
}
</script>

<template>
  <div class="bf-card flex items-start gap-4 p-4">
    <span
      v-if="icon"
      class="flex size-10 shrink-0 items-center justify-center rounded-xl border"
      :class="toneClasses[tone]"
      aria-hidden="true"
    >
      <i :class="[icon, 'text-xl']" />
    </span>
    <div class="min-w-0">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {{ label }}
      </p>
      <p class="mt-1 font-mono text-2xl font-bold" :class="valueTone[tone]">
        {{ value }}
      </p>
      <p v-if="hint" class="mt-1 text-[11px] text-on-surface-variant">
        {{ hint }}
      </p>
    </div>
  </div>
</template>