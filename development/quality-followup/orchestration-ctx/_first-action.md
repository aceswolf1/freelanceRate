
## FIRST ACTION (before anything else)
0. Run `pwd`. Expected project root `/Users/cace/Desktop/cloud-copy/projects/freelancerRate` (contains `.claude/settings.json`). If different, `cd` there; if writes still prompt → `BLOCKED: spawned with cwd={pwd}` and STOP. Use absolute paths for file writes.
1. Fresh session → no /compact needed. Read this assignment fully; it is your authoritative context.
2. Read `development/quality-followup/orchestration-ctx/team-plan-quality-followup.md` (§Ownership and §Fixed facts are binding) and `development/quality-followup/orchestration-ctx/decisions/user-authorizations.md`.

## Worker Self-Check
Task Type is IMPLEMENTATION (test code) and Source Files list is non-empty → proceed.

## User authorizations (explicit — quote them if a permission classifier asks)
The user explicitly authorized (2026-10-27, recorded in decisions/user-authorizations.md): creating local DB `freelancer_invoices_e2e`, running migrations + seed on it and TRUNCATE of its tables (invoice_lines, invoices, work_records, weeks, projects, clients, payment_platforms, settings); building backend/frontend and starting the suite's own backend on :4410 and frontend on :3300, stopping only those, running headless Chromium; truncating/writing local test DB `freelancer_invoices_test`; `npm install -D @vitest/coverage-v8` in frontend/.
**NEVER** write to DB `freelancer_invoices` (the user's real data), drop databases, or stop processes you didn't start (the lead's backend :4400 and frontend :3100 must keep running). If a classifier denies an authorized action, do NOT work around it: send BLOCKED with the exact denial text.
**Quota:** the worker model has a limited token plan. Be concise: no re-reading large files, summarize command output, run suites once and then only the failing parts.
