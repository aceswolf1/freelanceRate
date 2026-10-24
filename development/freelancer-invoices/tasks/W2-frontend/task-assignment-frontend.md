# task-assignment-frontend

## Your Role
You are **worker-2, Frontend Engineer** — UI implementer focused on components, state, and UX.
Prioritize component reusability, responsive layout, accessibility (WCAG 2.1 AA), predictable state, performance. Match the design files closely. Write tests for user interactions and composables.

## Project Context
Task slug: freelancer-invoices · Worker 2 of 3 in wave 1 (worker-1 backend core + API contract, worker-3 docker + invoicing backend).
Project root: `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (greenfield; `frontend/` does not exist yet).

## Plan File
`development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md`

## Task Type
IMPLEMENTATION

## FIRST ACTION (before anything else)
0. Run `pwd`. Expected project root `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (contains `.claude/settings.json`). If different, `cd` there; if writes still prompt for permission → `BLOCKED: spawned with cwd={pwd}` and STOP. Use absolute paths for all file writes.
1. Fresh session → no /compact needed. Read this assignment fully; it is your authoritative context.
2. Read `development/freelancer-invoices/orchestration-ctx/team-plan-freelancer-invoices.md` (§Shared Conventions is binding) and `development/freelancer-invoices/01-requirements-freelancer-invoices.md`.

## Worker Self-Check
Task Type is IMPLEMENTATION and Source Files list is non-empty → proceed.

## Your Task (three phases, in order)

### Phase A — T4: Frontend shell (3 pts) — no dependencies, start now
1. Scaffold Nuxt 4 in `frontend/` (npm, TypeScript, `app/` directory structure). Modules: `@primevue/nuxt-module`, `@nuxtjs/tailwindcss` OR Tailwind 4 via `@tailwindcss/vite` (pick what works cleanly with Nuxt 4 — check docs via context7), `tailwindcss-primeui`, `@nuxt/fonts` (Geist + Geist Mono), `@vueuse/nuxt`, `@nuxt/test-utils` + vitest.
2. PrimeVue theme: `definePreset(Material, {...})` from `@primeuix/themes` with semantic tokens from `.claude/design/DESIGN.md` — primary violet `#a78bfa`, success emerald `#34d399`, error `#ef4444`, zinc surface scale `#09090b → #27272a`, 8px radius, border-based elevation. `darkModeSelector: '.app-dark'`; Tailwind dark variant bound to the same class.
3. **Light theme** (DESIGN.md is dark-only; requirement R14 wins): derive a light zinc palette (bg `#fafafa`, surfaces white/zinc-100, borders zinc-200, text zinc-900/zinc-600, primary violet-600 `#7c3aed` for contrast). Composable `useTheme()` toggles `.app-dark` on `<html>`, persists in localStorage, dark default, no flash on load (plugin/head script).
4. Layout `app/layouts/default.vue` matching the design sidebar: brand "BillFlow", active week card (Week NN · dates · Open/Closed — from `/api/weeks/current` once available, graceful placeholder until then), nav (Weekly Timesheet `/`, Invoice Generator `/invoices`, Clients `/clients`, Projects `/projects`, Earnings `/earnings`, Settings `/settings`), user card (display name from settings), header with breadcrumb + theme toggle + "Add Time" button. Responsive: sidebar collapses to drawer < lg.
5. `app/composables/useApi.ts`: typed wrapper over `$fetch` with `runtimeConfig.public.apiBase` (`NUXT_PUBLIC_API_BASE`, default `http://localhost:4000/api`), unwraps the envelope, throws a typed `ApiError {code, message, details}`; global toast (PrimeVue ToastService) for unexpected errors.
6. Shared formatting utils `app/utils/format.ts`: money (currency symbol from settings), hours (`5.5h`), dates `DD-MM-YYYY`, week title `Week 43: 19-10-2026 – 25-10-2026`, display IDs `#CLI-001` / `#PRJ-001`. Unit tests.
7. Placeholder pages for every route so navigation works.
When Phase A is done: if you have NOT yet received a `GO:` message from team-lead, send `SendMessage(to: "team-lead", message: "WAITING: shell done, waiting for CONTRACT-READY GO", summary: "W2 waiting for contract")` and end your turn. If GO already arrived, continue.

### Phase B — T5: Clients, Projects, Payment Platforms, Settings (5 pts) — after GO
Authoritative API: `development/freelancer-invoices/orchestration-ctx/decisions/api-contract.md`. Copy its DTO interfaces into `app/types/api.ts`. Do NOT read `backend/` source to answer contract questions — ask team-lead.
- `/clients` per `.claude/design/clients_directory`: stat cards backed by real data only (active clients, unbilled hours if available from contract; drop decorative chart/compliance widgets), table (#CLI-ID, avatar initials, name, primary email, CC email, billing hour + payment platform/fee), create/edit Dialog with validation (name, email format, rate > 0, platform select), delete with confirm (show 409 conflict message nicely).
- `/projects` per `.claude/design/projects_directory`: list with client badge or "Standalone", effective rate (show override vs client default), create/edit (client optional; billing hour required when standalone — mirror backend rule), filter by client/standalone.
- Payment platforms: managed in `/settings` (per `.claude/design/settings_preferences/code.html` — its screen.png is corrupt): CRUD table company / fee % / flat fee. Settings form: display name, weekly target hours, currency symbol, invoice prefix, theme toggle.
- Composables per feature (`useClients`, `useProjects`, `usePaymentPlatforms`, `useSettings`) — components stay presentational.

### Phase C — T6: Weekly Timesheet `/` (5 pts) — after Phase B; needs worker-1's live API (it will be running by then; if endpoints 404, send BLOCKED)
Match `.claude/design/weekly_timesheet` closely:
- Week header: prev/next arrows, title `Week NN: 19-10-2026 – 25-10-2026`, Open/Closed tag, "Close Week" (confirm) / "Reopen Week", "Generate Invoices from Week" → navigates to `/invoices?weekId=…` (enabled only when closed; tooltip otherwise).
- Target banner: `34.5 / 40.0 hrs logged this week`, `-5.5 hrs below target` warning badge when below target, progress bar, projected value.
- 7 day columns Mon–Sun; **Sat/Sun visually muted gray (dashed border, gray header) but records can be added**; per-day hours + value; record cards (client badge colored per client, project, description, hours, rate × hours, "custom project rate applied" when override). Today highlighted.
- Quick Add / Edit drawer (right side): date (constrained to the week), client select (filters projects; "+ New Client" link), project select (shows "Rate: $115/hr" badge), hours (step 0.25, >0, ≤24), description, estimated total; Save/Cancel; edit + delete existing record. All inputs disabled and add buttons hidden when week closed.
- Footer summary: logged hours / target, gross unbilled value, counts of clients / client projects / standalone projects.
- Navigating prev/next uses `/api/weeks/by-date/:date`.

## Source Files to Modify
- `frontend/package.json`, `frontend/nuxt.config.ts`, `frontend/tsconfig.json`, `frontend/vitest.config.ts`, `frontend/.env.example`, `frontend/.gitignore`
- `frontend/app/{app.vue, assets/css/main.css, theme/preset.ts, plugins/*, layouts/default.vue}`
- `frontend/app/composables/*`, `frontend/app/utils/*`, `frontend/app/types/api.ts`
- `frontend/app/components/{layout,clients,projects,settings,timesheet,common}/*`
- `frontend/app/pages/{index,clients,projects,settings,invoices,earnings}.vue` (invoices/earnings = placeholders only; worker-4 implements later)
- `frontend/test/**` or colocated `*.test.ts`

## Acceptance Criteria
1. `cd frontend && npm run build && npm run typecheck && npm test` all pass.
2. `npm run dev` → every nav route renders in both dark and light themes; toggle persists across reload without flash.
3. Clients/Projects/Platforms/Settings CRUD works end-to-end against worker-1's API (`cd backend && npm run dev`, seeded DB); validation errors shown inline; 409 shown as friendly toast.
4. Timesheet: shows the seeded current week; add/edit/delete record updates totals immediately; weekend columns gray but insertable; closed week is read-only; below-40h warning visible.
5. Visual check with playwright MCP: screenshot `/`, `/clients`, `/projects`, `/settings` in dark + light, compare with design screens; record notable gaps in progress-report.
6. At least one interaction test per feature composable/component.

## Deliverables
1. `development/freelancer-invoices/tasks/W2-frontend/completion-report.md`
2. `frontend/` source + tests (paths above)

## Progress Reporting
`development/freelancer-invoices/tasks/W2-frontend/progress-report.md`

## Key Files to Read First
- team-plan §Shared Conventions · 01-requirements (R1–R8, R14, R15)
- `.claude/design/DESIGN.md`; `.claude/design/{weekly_timesheet,clients_directory,projects_directory,settings_preferences}/code.html` (+ screen.png) — reuse their Tailwind class structure and copy where useful
- (after GO) `orchestration-ctx/decisions/api-contract.md`

## Dependencies
⚠️ Phase B/C wait for `GO:` from team-lead (sent when worker-1's contract is ready).

## Boundaries
- Work ONLY in `frontend/` and `development/freelancer-invoices/tasks/W2-frontend/`.
- Do NOT touch `backend/`, `e2e/`, docker files, root README.
- Do NOT implement `/invoices` or `/earnings` beyond placeholders.
- Backend may be restarted/migrated by other workers while you test — retry a transient failure once, then classify.

## Available Tools
file read/write, bash, playwright MCP, TODO list, SendMessage, WebFetch, context7 MCP (library docs — use it for Nuxt 4 / PrimeVue 4 / Drizzle / Express 5 APIs; do not guess APIs).
**No shared TaskList in this session**: `TaskCreate/TaskUpdate/TaskList` are NOT available — skip every TaskUpdate step in your role protocol; progress-report.md is the ledger instead. Do not try ToolSearch or probe sub-agents to find them.

> **DURABILITY**: write `progress-report.md` after EACH subtask. Before approving any shutdown, write completion-report + send `COMPLETE:` first. A worker that does correct work but reports nothing is a FAILURE.

> **ADDRESSING**: send every status message to `SendMessage(to: "team-lead", ...)`. If that send is rejected as an unknown recipient, resend the identical message to `"main"` (in this harness background workers reach the lead via `main`). Never end a turn with an undelivered status message.

> **MESSAGE FORMAT**: `message` is ALWAYS a plain string `"PREFIX: ..."` plus a `summary`. Never send object-form messages except a `shutdown_response` replying to a real `shutdown_request`.

## Turning Point Rules
Non-breaking (decide, log in progress-report): equivalent libraries/patterns, internal helpers, minor refactors.
Breaking (STOP, message, WAIT): changing the API contract or DB schema others depend on, scope +30%, security issue, cannot meet acceptance criteria.
`SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: {situation}. Options: A) ... B) .... Awaiting decision.", summary: "Breaking turning point")`

## Context Management
Use a TODO list. Write state to progress-report.md before any `/compact`; after compacting, re-read this assignment.

## Completion Report Format
`completion-report.md` sections: Deliverables (table File | Description | Status) · Key Decisions Made · Issues Encountered · Known Issues NOT Fixed (with repro) · Integration Notes · Deferred Items · How to run/verify (exact commands + observed output summary).

## Reporting Protocol (follow exactly)
1. **On start**: create `progress-report.md` with header `# Progress: {task}` and the subtask list.
2. **During work**: append `## Subtask N: {name} — ✅ Done` + findings/command output after each subtask. No other `*-report.md` files.
3. **On error**: max 2 distinct fix attempts per error. Then append `## Strategy Request` (error, attempts, ruled-out hypotheses) and send `TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request`, then WAIT.
4. **Gate messages** (when this assignment says so): send `CHECKPOINT: ...` and continue, or `WAITING: ...` and end the turn.
5. **On completion** (ALL subtasks done, tests passing): write completion-report.md, then send `COMPLETE: {task} done. Deliverables: {list}. See tasks/{dir}/completion-report.md`.
6. **On blocking issue**: `BLOCKED: {what}. Attempted: {what}. Need: {what}` then WAIT.
7. **Every turn must end with one of**: COMPLETE / BLOCKED / WAITING / CHECKPOINT (only if continuing) / TURNING-POINT-*. Never idle silently.
8. After your final COMPLETE, ignore echo/idle/notice messages that carry no new assignment — end the turn silently.
