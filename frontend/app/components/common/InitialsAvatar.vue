<script setup lang="ts">
import { initials } from '../../utils/format'

const props = withDefaults(defineProps<{
  name: string
  /** Deterministic hue index so a client keeps the same accent across views. */
  seed?: number
  size?: 'sm' | 'md'
}>(), {
  size: 'md',
  seed: 0,
})

/** Design accents: violet for client work, zinc for standalone. */
const accents = [
  'bg-primary/15 text-primary border-primary/30',
  'bg-tertiary/15 text-tertiary border-tertiary/30',
  'bg-warning/15 text-warning border-warning/30',
  'bg-secondary-container text-on-surface-variant border-outline-variant',
]

const accent = computed(() => accents[Math.abs(props.seed) % accents.length] ?? accents[0])
const sizeClass = computed(() => (props.size === 'sm' ? 'size-8 text-[11px]' : 'size-9 text-xs'))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full border font-semibold"
    :class="[sizeClass, accent]"
    :aria-label="name"
    :data-testid="`initials-${name}`"
    aria-hidden="true"
  >
    {{ initials(name) }}
  </span>
</template>