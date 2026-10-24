# Decision: stack choices + harness adaptations (22-10-2026)
## User decisions
- Backend: Express 5 + TypeScript + Drizzle + Zod (MRSC, feature folders)
- Auth: none (single user, LAN/TrueNAS)
- Email: mailto link + "Copy formatted" HTML clipboard (no SMTP)
- Docker: Dockerfiles + docker-compose shipped now
## Orchestrator decisions
- Payment platform fee = percent + optional flat (design shows "Domestic Wire $15 flat").
- Rates snapshotted at invoice generation, not at record entry.
- Invoices only from closed weeks; preview available for open weeks.
- Compose Postgres published on host 5433 (local PG18 occupies 5432); tests use local `freelancer_invoices_test`.
- Light theme derived from DESIGN.md tokens (DESIGN.md is dark-only; R14 requires toggle); dark default.
## Harness adaptations
- TaskCreate/TaskUpdate/TaskList are unavailable in this session → `team-status §Tasks` is the only task ledger; workers told to skip TaskUpdate.
- Workers address `team-lead`, fall back to `main` if rejected (background-subagent addressing in this harness).
- Max 3 concurrent workers; waves 3–4 reuse/spawn after parking.
## User authorization — DB writes (23-10-2026)
User explicitly authorized (via AskUserQuestion in the lead session): workers may TRUNCATE / write the local test DB
`freelancer_invoices_test` (integration test suites) and write to the local dev DB `freelancer_invoices`
(smoke tests: close/reopen weeks, create/delete records; re-seeding). Both are local throwaway DBs created by this project.
Not authorized: dropping databases, any other database, any remote host.
- [23-10-2026] User: backend port 4000 → 4400 (collision with Local.app on 127.0.0.1:4000).
## User authorization — QA wave (23-10-2026, via AskUserQuestion in lead session)
The user explicitly authorized the QA worker (T10) to:
1. Install @playwright/test + Chromium in `e2e/` and run a headless browser against http://localhost:3000 and http://localhost:4400 only; save screenshots (dark/light) into its task folder.
2. Write to local dev DB `freelancer_invoices`: close/reopen the seeded week, add/edit/delete records, generate invoices; restore with `cd backend && npm run db:seed` at the end.
3. Start the production frontend (`node .output/server/index.mjs` on :3000) and stop only servers it started itself.
Not authorized: dropping DBs, other DBs/hosts, killing processes it did not start.
- [23-10-2026] User decision: downgrade PrimeVue 5 → 4 (MIT). Assigned to worker-2 after GAP-002 (tasks/W2-frontend/task-assignment-primevue4.md).
