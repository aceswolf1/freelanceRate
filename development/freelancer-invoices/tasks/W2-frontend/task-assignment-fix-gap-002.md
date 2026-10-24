# task-assignment-fix-gap-002 (worker-2, revision from QA)

## Task Type
IMPLEMENTATION (bug fix). Same author, exact repro from QA (worker-5).

## GAP-002 (severity HIGH): every form renders without labels and without inline errors (R1, R2, R3, R15 + timesheet drawer)
Cause per QA: `primevue: { autoImport: true }` + installed `@primevue/forms` → @primevue/nuxt-module registers PrimeVue's `FormField`, which shadows the app's `app/components/common/FormField.vue` (label + control + `<p role="alert">` error).
SSR proof (/settings): `<div class="p-formfield p-component" label="Display Name" field-id="settings-name" ...><input ...></div>` with no `<label>`, no `for=`, no error paragraph.
Effect: Create Client dialog shows 6 unlabelled inputs; a malformed email + "Create client" gives no inline error, toast or API call (silent no-op). Same in ProjectDialog, PlatformDialog, Settings and the timesheet drawer.

## Fix requirements (lead decision: option a)
- Rename the app component to a collision-proof name, `BfFormField` (file `app/components/common/BfFormField.vue`, so the auto-import name is `CommonBfFormField` or whatever the existing naming convention yields; keep consistent), and update every usage.
- If `@primevue/forms` isn't actually used by the app, remove it from dependencies so the collision can't recur. Otherwise keep it.
- Make sure each label's `for` matches the control's `id`, and that the error element has `role="alert"`, so QA's selectors (`getByLabel`, `role=alert`) work.
- Add a component test asserting the rendered DOM contains `<label for=...>` and, after a failed validate, a `role="alert"` message. Mount the real dialog (e.g. the client dialog), not FormField alone, so a shadowing regression is caught.
- Do NOT change the PrimeVue version (a licence decision is pending with the user).

## Verification
`cd frontend && npm run typecheck && npm test && npm run build` all green; SSR of `/settings` from the production build (`PORT=3301 NUXT_PUBLIC_API_BASE=http://localhost:4400/api node .output/server/index.mjs`, stop it after) contains `<label` elements. Paste evidence in progress-report.md.

## Boundaries
Only your files in `frontend/` (not worker-4's invoices/earnings files, though you MAY update FormField usages inside them if any exist; note it). No backend changes. Conserve tokens.

## Reporting
Append `## GAP-002 fix` to progress-report.md, add a Deliverables row, then `SendMessage(to: "team-lead", message: "COMPLETE: GAP-002 fixed. <one line>. typecheck/test/build: <numbers>", summary: "GAP-002 fixed")` (fallback `main`).
