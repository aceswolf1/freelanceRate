# Requirements: freelancer-invoices

## Functional Requirements
| ID | Requirement | Acceptance Criterion | Research? |
|----|-------------|----------------------|-----------|
| R1 | CRUD Clients {id, name, contactEmail, ccEmail?, billingHour, paymentPlatformId?} | Create/list/edit/delete via UI+API; validation errors shown; delete blocked (409) if referenced by records | no |
| R2 | CRUD Projects {id, name, clientId?, description?, billingHour?} — standalone allowed | Project without client saves; effective rate = project.billingHour ?? client.billingHour; standalone without rate → validation error | no |
| R3 | CRUD Payment Platforms {id, company, feePercent, feeFlat} | Client selects one; fee = gross*pct/100 + flat; net = gross - fee | no |
| R4 | Weeks Mon–Sun; current week auto-created on access; navigate prev/next | Title "Week NN: 19-10-2026 – 25-10-2026"; status open/closed | no |
| R5 | Work records {id, weekId, projectId, clientId (derived from project), description, hours (decimal, >0, ≤24), date} | Add/edit/delete only while week open and date inside week; 409 when closed | no |
| R6 | Weekly calendar UI: 7 day columns, Sat/Sun muted gray but insertable; per-day totals; quick-add drawer | Matches `.claude/design/weekly_timesheet` | no |
| R7 | Close week (and reopen if no invoices issued) | Closed week rejects record mutations (UI disabled + API 409) | no |
| R8 | <40h warning (target configurable in settings, default 40) | Banner shows "X / 40 hrs, -Y below target" on timesheet and before invoice generation; never blocks | no |
| R9 | Generate invoices for a closed week: split per client; standalone projects grouped as "No client" bucket | 3 projects A,B (client A) + C (client B) → exactly 2 invoices, 2 PDFs, 2 email links | no |
| R10 | Invoice content: number (INV-YYYY-NNN), client, date range, line items (date, project, description, hours, rate, total), per-project subtotals, gross, platform fee, net | Snapshot persisted; regenerating returns the same invoices (idempotent) | no |
| R11 | PDF download per client invoice + "Download all (.zip)" | Valid PDF opens; filename `INV-2026-001-acme-corp.pdf` | no |
| R12 | "Send as Email Text": mailto: link (to contactEmail, cc ccEmail, subject, plain-text tables per project) + "Copy formatted" button (HTML tables to clipboard) | Link opens mail client prefilled; body under mailto length limit (fallback: truncated + note to copy) | no |
| R13 | Earnings: by project and by client (gross, fees, net, hours) with date-range filter | Totals match sum of invoiced/recorded data | no |
| R14 | Light/dark theme toggle persisted (localStorage), dark default | Toggle in Settings + header; all views readable in both | no |
| R15 | Settings: user display name, weekly target hours, currency symbol, invoice number prefix | Persisted in DB | no |

## Non-Functional Requirements
- Backend: Express + TypeScript + Drizzle + Zod; layered Model → Repository → Service → Controller; feature folders.
- API envelope `{ success, data, error, meta? }`; input validated with Zod at controllers.
- Money computed in integer cents in services; DB numeric(12,2).
- Frontend: Nuxt 4 + PrimeVue 4 (Material preset, tokens overridden from DESIGN.md) + Tailwind; Geist font.
- Single user, no auth (LAN/TrueNAS). CORS restricted to configured frontend origin.
- docker-compose (postgres, backend, frontend) with env config, healthchecks, named volume.
- Tests: Vitest unit (services), Supertest integration (API against test Postgres), Playwright E2E for critical flow; ≥80% backend coverage.

## Out of Scope
- Multi-user / login, SMTP sending, multi-currency conversion, payment tracking/collections, the decorative design widgets (rate-distribution chart, "compliance" card, search, notifications) unless trivially backed by real data.
