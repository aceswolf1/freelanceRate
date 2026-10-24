<script setup lang="ts">
const { displayName, role } = useProfile()

onMounted(() => {
  void useProfile().load()
})
</script>

<template>
  <span class="flex min-w-0 flex-col leading-tight">
    <span class="truncate text-xs font-semibold text-on-surface" data-testid="user-display-name">
      {{ displayName }}
    </span>
    <span class="truncate text-[11px] text-on-surface-variant">{{ role }}</span>
  </span>
</template>