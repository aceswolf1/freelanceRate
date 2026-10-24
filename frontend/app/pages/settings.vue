<script setup lang="ts">
import type { PaymentPlatform, SettingsUpdate } from '~/types/api'
import type { Settings } from '~/types/api'
import { ApiError, toFieldErrors } from '~/composables/useApi'

useHead({ title: 'Settings' })

const { settings, displayName, load, save, loaded, notifySaved, notifyError } = useSettings()
const { platforms, pending: platformsPending, refresh: refreshPlatforms, create, update, remove } = usePaymentPlatforms()
const notifier = useNotifier()
const confirm = useConfirm()
const { mode, setMode } = useTheme()

interface SettingsForm {
  displayName: string
  weeklyTargetHours: number | null
  currencySymbol: string
  invoicePrefix: string
}

const form = reactive<SettingsForm>({
  displayName: '',
  weeklyTargetHours: 40,
  currencySymbol: '$',
  invoicePrefix: 'INV',
})

const errors = ref<Record<string, string>>({})
const submitError = ref<string | null>(null)
const saving = ref(false)
const platformDialogVisible = ref(false)
const editingPlatform = ref<PaymentPlatform | null>(null)

/**
 * Fetch the settings during SSR.
 *
 * GAP-007: the form must never be seeded with `SETTINGS_FALLBACK` ("Consultant"),
 * because saving that back would overwrite the stored name. This runs **before**
 * the form is hydrated below, so the very first paint already shows the real
 * values. The layout fetches the same key, so Nuxt dedupes the request.
 */
const { data: ssrSettings } = await useAsyncData<Settings | null>(
  'bf:settings:ssr',
  () => useApi().get<Settings>('/settings', { silent: true }).catch(() => null),
  { default: () => null },
)

watchEffect(() => {
  if (ssrSettings.value) {
    useSettings().set(ssrSettings.value)
  }
})

/** R15 validation, mirroring contract §3.5. */
function validate(): Record<string, string> {
  const found: Record<string, string> = {}

  if (!form.displayName.trim()) {
    found.displayName = 'Display name is required.'
  }
  else if (form.displayName.trim().length > 120) {
    found.displayName = 'Keep the name under 120 characters.'
  }

  if (form.weeklyTargetHours === null || Number.isNaN(form.weeklyTargetHours)) {
    found.weeklyTargetHours = 'Weekly target is required.'
  }
  else if (form.weeklyTargetHours <= 0) {
    found.weeklyTargetHours = 'Target must be greater than 0.'
  }
  else if (form.weeklyTargetHours > 168) {
    found.weeklyTargetHours = 'Target cannot exceed 168 hours.'
  }

  if (!form.currencySymbol.trim()) {
    found.currencySymbol = 'Currency symbol is required.'
  }
  else if (form.currencySymbol.trim().length > 5) {
    found.currencySymbol = 'Use at most 5 characters.'
  }

  if (!form.invoicePrefix.trim()) {
    found.invoicePrefix = 'Invoice prefix is required.'
  }
  else if (!/^[A-Za-z0-9-]{1,10}$/.test(form.invoicePrefix.trim())) {
    found.invoicePrefix = 'Use 1–10 letters, digits or hyphens.'
  }

  return found
}

/**
 * Snapshot of the values the form was last hydrated with.
 *
 * GAP-007: the form must not be seeded from `SETTINGS_FALLBACK` and then
 * overwrite the real stored values. It is hydrated from the settings *state*
 * whenever that state arrives, and a user edit is never clobbered.
 */
let hydratedSnapshot = ''

/** Seed the snapshot from the form's initial values so the first hydrate counts as pristine. */
function initHydratedSnapshot(): void {
  hydratedSnapshot = JSON.stringify(currentFormValues())
}

function currentFormValues(): Record<string, unknown> {
  return {
    displayName: form.displayName,
    weeklyTargetHours: form.weeklyTargetHours,
    currencySymbol: form.currencySymbol,
    invoicePrefix: form.invoicePrefix,
  }
}

function hydrate(next: Settings): void {
  Object.assign(form, {
    displayName: next.displayName,
    weeklyTargetHours: next.weeklyTargetHours,
    currencySymbol: next.currencySymbol,
    invoicePrefix: next.invoicePrefix,
  })
  hydratedSnapshot = JSON.stringify(currentFormValues())
  errors.value = {}
  submitError.value = null
}

/** True while the form still matches what was last loaded — i.e. untouched. */
function isPristine(): boolean {
  return JSON.stringify(currentFormValues()) === hydratedSnapshot
}

// Hydrate from the settings state itself, so the form picks up the real
// values whenever they arrive — including when they arrive after the page
// mounted, which is exactly the GAP-007 race.
initHydratedSnapshot()

watch(
  settings,
  (next) => {
    if (next && isPristine()) {
      hydrate(next)
    }
  },
  { immediate: true },
)

/** Save stays disabled until the real settings have loaded. */
const canSave = computed(() => loaded.value)

async function boot(): Promise<void> {
  // `load` now awaits any in-flight request rather than returning the fallback.
  // After SSR it is already loaded, so this is a no-op unless the API was down.
  await load()
  await refreshPlatforms({ silent: true, force: true })
}

onMounted(boot)

async function saveSettings(): Promise<void> {
  // Defence in depth behind the disabled button: never write a form that was
  // seeded from the fallback values (GAP-007 — silent data loss).
  if (!canSave.value) {
    notifier.warn('Settings are still loading', 'Wait for the current values to load before saving.')
    return
  }

  const found = validate()
  errors.value = found
  submitError.value = null

  if (Object.keys(found).length > 0) {
    return
  }

  saving.value = true
  try {
    const payload: SettingsUpdate = {
      displayName: form.displayName.trim(),
      weeklyTargetHours: Number(form.weeklyTargetHours),
      currencySymbol: form.currencySymbol.trim(),
      invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
    }
    hydrate(await save(payload))
    notifySaved()
  }
  catch (error) {
    if (error instanceof ApiError) {
      errors.value = toFieldErrors(error.details)
      submitError.value = error.message
    }
    else {
      submitError.value = 'Could not save settings.'
    }
    notifyError(submitError.value)
  }
  finally {
    saving.value = false
  }
}

function openCreatePlatform(): void {
  editingPlatform.value = null
  platformDialogVisible.value = true
}

function onPlatformSaved(platform: PaymentPlatform): void {
  notifier.success(editingPlatform.value ? 'Payment platform updated' : 'Payment platform added', platform.company)
}

/** Contract §3.2: deleting a rail nulls `paymentPlatformId` on referencing clients. */
function confirmRemovePlatform(platform: PaymentPlatform): void {
  confirm.require({
    header: 'Delete payment platform',
    message: `Delete ${platform.company}? Clients using it will simply have no payout rail attached.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await remove(platform.id)
        notifier.success('Payment platform deleted', platform.company)
        await useClients().refresh({ silent: true, force: true })
      }
      catch (error) {
        notifier.error(
          'Could not delete platform',
          error instanceof ApiError ? error.message : undefined,
        )
      }
    },
  })
}

const invoicePreview = computed(() => `${form.invoicePrefix.trim().toUpperCase() || 'INV'}-2026-001`)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      eyebrow="System Configurations"
      title="Settings & Preferences"
      :description="`Configure your consultant profile, weekly target, currency and invoice numbering. Signed in as ${displayName}.`"
    >
      <template #eyebrow-icon>
        <i class="pi pi-cog text-sm" aria-hidden="true" />
      </template>
      <template #actions>
        <Button
          label="Save All Changes"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!canSave"
          :title="canSave ? undefined : 'Waiting for the current settings to load'"
          data-testid="save-settings"
          @click="saveSettings"
        />
      </template>
    </PageHeader>

    <InlineAlert v-if="submitError" tone="error" title="Could not save settings">
      {{ submitError }}
    </InlineAlert>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <!-- Profile, thresholds, appearance -->
      <div class="flex flex-col gap-6 xl:col-span-7">
        <div class="bf-panel flex flex-col gap-5 p-5">
          <div class="flex items-center gap-2.5">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
              <i class="pi pi-user" />
            </span>
            <div>
              <h2 class="text-base font-semibold text-on-surface">Consultant Profile</h2>
              <p class="text-xs text-on-surface-variant">This name appears on the timesheet and generated invoices.</p>
            </div>
          </div>

          <BfFormField label="Display Name" field-id="settings-name" required :error="errors.displayName">
            <template #default="{ fieldId, describedBy, invalid }">
              <InputText
                :id="fieldId"
                v-model="form.displayName"
                :aria-describedby="describedBy"
                :invalid="invalid"
                autocomplete="name"
                placeholder="Alex Morgan"
                fluid
              />
            </template>
          </BfFormField>
        </div>

        <div class="bf-panel flex flex-col gap-5 p-5">
          <div class="flex items-center gap-2.5">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
              <i class="pi pi-clock" />
            </span>
            <div>
              <h2 class="text-base font-semibold text-on-surface">Billing & Weekly Thresholds</h2>
              <p class="text-xs text-on-surface-variant">Baseline parameters for time tracking and audit alerts.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <BfFormField
              label="Weekly Target Hours"
              field-id="settings-target"
              required
              hint="R8 warning threshold."
              :error="errors.weeklyTargetHours"
            >
              <template #default="{ fieldId, describedBy, invalid }">
                <InputNumber
                  :id="fieldId"
                  v-model="form.weeklyTargetHours"
                  :aria-describedby="describedBy"
                  :invalid="invalid"
                  :min="0"
                  :max="168"
                  :min-fraction-digits="1"
                  :max-fraction-digits="2"
                  suffix=" hrs"
                  fluid
                />
              </template>
            </BfFormField>

            <BfFormField
              label="Currency Symbol"
              field-id="settings-currency"
              required
              :error="errors.currencySymbol"
            >
              <template #default="{ fieldId, describedBy, invalid }">
                <InputText
                  :id="fieldId"
                  v-model="form.currencySymbol"
                  :aria-describedby="describedBy"
                  :invalid="invalid"
                  maxlength="5"
                  class="font-mono"
                  fluid
                />
              </template>
            </BfFormField>

            <BfFormField
              label="Invoice Number Prefix"
              field-id="settings-prefix"
              required
              :hint="`e.g. ${invoicePreview}`"
              :error="errors.invoicePrefix"
            >
              <template #default="{ fieldId, describedBy, invalid }">
                <InputText
                  :id="fieldId"
                  v-model="form.invoicePrefix"
                  :aria-describedby="describedBy"
                  :invalid="invalid"
                  maxlength="10"
                  class="font-mono"
                  fluid
                />
              </template>
            </BfFormField>
          </div>
        </div>

        <div class="bf-panel flex items-center justify-between gap-4 p-5">
          <div class="flex items-center gap-2.5">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
              <i class="pi pi-sun" />
            </span>
            <div>
              <h2 class="text-base font-semibold text-on-surface">Appearance</h2>
              <p class="text-xs text-on-surface-variant">
                Currently {{ mode === 'dark' ? 'dark' : 'light' }} theme. Saved to this browser.
              </p>
            </div>
          </div>
          <ToggleSwitch
            :model-value="mode === 'dark'"
            input-id="settings-theme"
            data-testid="settings-theme-toggle"
            @update:model-value="setMode($event ? 'dark' : 'light')"
          />
        </div>
      </div>

      <!-- Payment platforms -->
      <div class="flex flex-col gap-6 xl:col-span-5">
        <div class="bf-panel flex flex-col gap-4 p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="flex size-8 items-center justify-center rounded-lg bg-tertiary/15 text-tertiary" aria-hidden="true">
                <i class="pi pi-wallet" />
              </span>
              <div>
                <h2 class="text-base font-semibold text-on-surface">Payment Platform Fee Engine</h2>
                <p class="text-xs text-on-surface-variant">Fee is absorbed: clients are invoiced full gross.</p>
              </div>
            </div>
            <Button
              label="Add"
              icon="pi pi-plus"
              size="small"
              outlined
              data-testid="create-platform"
              @click="openCreatePlatform"
            />
          </div>

          <PaymentPlatformsTable
            :platforms="platforms"
            :loading="platformsPending"
            @edit="(platform) => { editingPlatform = platform; platformDialogVisible = true }"
            @remove="confirmRemovePlatform"
          />
        </div>
      </div>
    </div>

    <PlatformDialog
      v-model:visible="platformDialogVisible"
      :platform="editingPlatform"
      @saved="onPlatformSaved"
    />
  </section>
</template>