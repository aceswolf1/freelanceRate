# User authorizations — quality-followup (2026-10-27, via AskUserQuestion in the lead session)
Plan approved: "Approve & execute".
The user explicitly authorized workers to:
1. **E2E database:** create local DB `freelancer_invoices_e2e`; run `npm run db:migrate` and `npm run db:seed` against it; TRUNCATE its tables (invoice_lines, invoices, work_records, weeks, projects, clients, payment_platforms, settings) between runs.
2. **E2E servers + browser:** build backend and frontend; start the suite's own backend on :4410 and frontend on :3300; stop only those processes; run headless Chromium against them.
3. **Test DB + installs:** truncate/write local test DB `freelancer_invoices_test` (backend suite); `npm install -D @vitest/coverage-v8` in frontend/.
NOT authorized: any write to `freelancer_invoices` (the user's real data), dropping databases, stopping processes the worker did not start (incl. the lead's :4400 backend and :3100 frontend).
