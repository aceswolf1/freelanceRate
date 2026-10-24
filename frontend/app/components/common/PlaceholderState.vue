<script setup lang="ts">
/**
 * Generic "this view is coming" panel used by the Phase A placeholder routes so
 * every nav destination renders something real before its feature lands.
 */
defineProps<{
  icon: string
  title: string
  description: string
  status: string
}>()
</script>

<template>
  <section class="flex flex-col gap-6">
    <slot name="header" />

    <div class="bf-panel flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span
        class="flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <i :class="[icon, 'text-2xl']" />
      </span>
      <div class="max-w-md">
        <h2 class="text-lg font-semibold text-on-surface">
          {{ title }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-on-surface-variant">
          {{ description }}
        </p>
      </div>
      <span class="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1 font-mono text-[11px] text-on-surface-variant">
        <i class="pi pi-hourglass text-xs" aria-hidden="true" />
        {{ status }}
      </span>
    </div>
  </section>
</template>