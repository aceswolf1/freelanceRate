<script setup lang="ts">
const { week } = useActiveWeek()

onMounted(() => {
  void useActiveWeek().load()
})

/** Contract §3.6: the API ships a ready-made `label` ("Week 43: 19-10-2026 – 25-10-2026"). */
const title = computed(() => week.value?.label ?? 'No active week')

const dateRange = computed(() => {
  if (!week.value) {
    return '—'
  }
  return `${formatDate(week.value.startDate)} → ${formatDate(week.value.endDate)}`
})

const isOpen = computed(() => week.value?.status === 'open')
</script>

<template>
  <div
    class="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5"
    data-testid="active-week-card"
  >
    <div class="flex items-center justify-between gap-2 text-xs">
      <span class="inline-flex items-center gap-1.5 font-medium text-on-surface-variant">
        <span
          class="size-1.5 rounded-full"
          :class="week ? (isOpen ? 'bg-tertiary' : 'bg-outline') : 'bg-outline-variant'"
          aria-hidden="true"
        />
        {{ week ? `Week ${week.isoWeek} Active` : 'Active Week' }}
      </span>
      <span
        v-if="week"
        class="font-mono text-[11px]"
        :class="isOpen ? 'text-tertiary' : 'text-on-surface-variant'"
      >{{ isOpen ? 'Open' : 'Closed' }}</span>
      <span v-else class="font-mono text-[11px] text-on-surface-variant">—</span>
    </div>
    <p class="mt-1 font-mono text-[11px] leading-snug text-on-surface" data-testid="active-week-title">
      {{ title }}
    </p>
    <p class="mt-0.5 font-mono text-[10px] text-on-surface-variant">
      {{ dateRange }}
    </p>
  </div>
</template>