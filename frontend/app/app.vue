<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} · BillFlow` : 'BillFlow'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Global feedback surfaces (PrimeVue services registered in plugins/primevue.client.ts) -->
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>