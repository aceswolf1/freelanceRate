# Intake: freelancer-invoices

## Objective
Build "Freelancer Invoices" (design codename BillFlow): a single-tenant web app that tracks hours worked per
project/client in weekly timesheets, closes weeks, and generates per-client invoices (PDF download + email-text
link), with earnings reports per project/client, payment-platform fees per client, and a light/dark theme.

## Assumptions
- Week = Monday..Sunday (e.g. 19-10-2026 → 25-10-2026). All 7 days shown; Sat/Sun rendered in muted gray but editable
  (design `weekly_timesheet` matches this).
- Rate resolution: project.billing_hour ?? client.billing_hour. Standalone projects (no client) are grouped into a
  separate "No client" invoice bucket.
- Payment platform = {company, fee %}; each client references one payment platform; fee deducted from gross → net.
- 40h weekly target is a warning only, never blocks.
- Closed week = read-only for records; invoices only generated from closed weeks (open weeks: preview only).
- Single currency (USD) — configurable later.
- Design source of truth: `.claude/design/*/{screen.png,code.html}` (5 views: weekly_timesheet, invoice_generator,
  clients_directory, projects_directory, settings_preferences) + `.claude/design/DESIGN.md` tokens (dark "Obsidian").
  Light theme must be derived (DESIGN.md says "never light backgrounds" — conflicts with the toggle requirement;
  requirement wins, dark is default).

## Open Questions
- [confirm-with-user] Backend framework/ORM for the separate `backend/` folder (Model/Repository/Service/Controller).
- [confirm-with-user] Authentication: single-user without login vs login.
- [confirm-with-user] "Send invoice as email text": mailto link vs real SMTP sending.
- [confirm-with-user] Docker: ship Dockerfiles + docker-compose now vs only keep it docker-ready.

## Known Constraints
- Stack: PostgreSQL, Nuxt 4, PrimeVue (Material preset), Tailwind.
- Frontend and backend in separate folders. MRSC layering on backend.
- Target deploy: TrueNAS (Docker) — env-driven config, no host-specific paths.
- requirements.md typo: Client has "Contact email" twice — treat as single contact email (+ optional CC email per design).

## Input Source
`requirements.md` (project root), `.claude/design/`.
