<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: 'pi-inbox',
  description: undefined,
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center"
    data-testid="empty-state"
  >
    <span
      class="flex size-11 items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant"
      aria-hidden="true"
    >
      <i :class="[icon, 'text-xl']" />
    </span>
    <div>
      <p class="text-sm font-semibold text-on-surface">
        {{ title }}
      </p>
      <p v-if="description" class="mt-1 text-xs text-on-surface-variant">
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>