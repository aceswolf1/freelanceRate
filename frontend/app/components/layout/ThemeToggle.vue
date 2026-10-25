<script setup lang="ts">
const { isDark, toggle } = useTheme()

const label = computed(() => (isDark.value ? 'Switch to light theme' : 'Switch to dark theme'))
const icon = computed(() => (isDark.value ? 'pi-sun' : 'pi-moon'))
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
    :aria-label="label"
    :title="label"
    :data-testid="'theme-toggle'"
    :aria-pressed="isDark"
    @click="toggle()"
  >
    <i :class="[iconClass(icon), 'text-base']" aria-hidden="true" />
  </button>
</template>