<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>(), {
  eyebrow: undefined,
  description: undefined,
})
</script>

<template>
  <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div class="min-w-0">
      <p
        v-if="eyebrow"
        class="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-primary"
      >
        <slot name="eyebrow-icon" />
        {{ eyebrow }}
      </p>
      <h1 class="mt-3 text-3xl font-bold tracking-tight text-on-surface lg:text-4xl">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>