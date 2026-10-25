# API Contract — freelancer-invoices

**Status:** authoritative · **Owner:** worker-1 (T2) · **Implemented by:** worker-1 (`backend/src/modules/*`, minus the stubs) and worker-3 (`invoices`, `reports`)
**Base URL:** `http://localhost:4400/api` (Docker: `http://backend:4400/api`)

This document is the single source of truth for every endpoint and DTO. Downstream workers should
**not** read backend source to answer contract questions — ask `team-lead`.
Backend source of truth lives in `backend/src/`; where implementation and this document disagree, the
`## Deviations` table at the bottom records it.

---

## 1. Conventions

### 1.1 Envelope

Every response — success or failure — is wrapped in the same envelope.

```ts
// success
{ "success": true, "data": <payload>, "meta"?: { ... } }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Client 42 not found", "details"?: <any> } }
```

`meta` is currently **unused** — no endpoint paginates. List endpoints return a plain JSON array in
`data` (see §1.6).

### 1.2 Dates

| Kind | Format | Example |
|------|--------|---------|
| Calendar date (`date` columns, `?date=` params) | `YYYY-MM-DD` | `"2026-10-19"` |
| Timestamp (`createdAt`, `updatedAt`, `closedAt`) | ISO-8601 UTC | `"2026-10-22T18:04:11.204Z"` |

Dates are **plain strings everywhere** — never epoch numbers, never `Date` objects. Weeks are
Mon–Sun; a week is identified by its **Monday**. There is no timezone conversion anywhere in the
date path: a `date` column round-trips as the exact string you wrote.

UI display convention is `DD-MM-YYYY` (e.g. `19-10-2026`); `DD Mon YYYY` is used in PDF/email bodies.

### 1.3 Money and hours

- **Money** is a JSON **number** in major units: `130.5` = $130.50. Never a string, never cents.
  Every money/hours field — `rate`, `lineTotal`, `gross`, `feeAmount`, `net`, `totalGross` — obeys
  this. The API never emits a numeric field as a string or as `null`.
- **Hours** are numbers with up to 2 decimals: `7.5`.
- The API never emits `NaN`, `Infinity` or `-0`; every money field is rounded to 2dp.
- Business arithmetic happens server-side in **integer cents**; clients only add up numbers for display.
- Currency is a single symbol stored in settings (`currencySymbol`, default `$`) and echoed on invoice/earnings payloads. There is **no multi-currency** (out of scope).

### 1.4 IDs and dates on the wire

Integer identity for every entity. The UI may *display* formatted ids (`#CLI-001`) but must send the
raw integer.

### 1.5 Error codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Zod parse failure, malformed id/date, bad query param. `details` = `Array<{ path: string; message: string }>`. |
| `NOT_FOUND` | 404 | Unknown id, or a route that does not exist (`Route GET /api/x not found`). |
| `CONFLICT` | 409 | Delete blocked by references, reopen blocked by existing invoices, duplicate name/email. |
| `WEEK_CLOSED` | 409 | Record create/update/delete against a closed week. |
| `INTERNAL` | 500 | Unexpected server fault. Never carries stack traces or DB details. |

Other status codes that may appear: **413** (`VALIDATION_ERROR`, body > 1 MB).

### 1.6 Pagination

None. All list endpoints return the full set (this is a single-user LAN app; the dataset is
hundreds of rows). If a list ever grows past a few thousand rows, the endpoint will gain
`?limit=&offset=` and `meta: { total, limit, offset }` — recorded here when it happens.

### 1.7 Conventions used by every list endpoint

- `GET` list returns `data: Item[]`, newest identifiers last, ordered by name or date as documented.
- `DELETE` returns **200** with `data: { id, deleted: true }` (never 204, so the envelope is uniform).
- `PATCH` accepts a **partial** object; omitted fields are untouched. `PUT` (settings only) accepts a partial object too.
- Unknown JSON keys in a request body are **rejected** with `VALIDATION_ERROR`.

---

## 2. DTO TypeScript interfaces

Copy-paste ready for `frontend/types/api.ts`.

```ts
// ---------- enums ----------
export type WeekStatus = 'open' | 'closed';
export type RateSource = 'project' | 'client';
export type WarningCode = 'BELOW_TARGET' | 'WEEK_OPEN' | 'NO_RECORDS';
export type EarningsGroupBy = 'project' | 'client';

// ---------- envelope ----------
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}
export interface ApiFailure {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'WEEK_CLOSED' | 'INTERNAL';
    message: string;
    details?: unknown;
  };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ---------- shared ----------
export interface ClientSummary {
  id: number;
  name: string;
  contactEmail: string;
  ccEmail: string | null;
  billingHour: number;
}

export interface ProjectSummary {
  id: number;
  name: string;
  clientId: number | null;
}

// ---------- payment platforms (R3) ----------
export interface PaymentPlatform {
  id: number;
  company: string;
  feePercent: number; // 1 => 1%
  feeFlat: number;    // 15 => $15.00
  createdAt: string;
}
export type PaymentPlatformInput = {
  company: string;
  feePercent?: number;
  feeFlat?: number;
};
export type PaymentPlatformUpdate = Partial<PaymentPlatformInput>;

// ---------- clients (R1) ----------
export interface Client extends ClientSummary {
  paymentPlatformId: number | null;
  paymentPlatform: PaymentPlatform | null; // embedded on list + get
  projectCount: number;      // non-archived projects
  totalHours: number;        // lifetime hours across all work records
  totalGross: number;        // lifetime projected gross across all work records
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ClientInput {
  name: string;
  contactEmail: string;
  ccEmail?: string | null;
  billingHour: number;
  paymentPlatformId?: number | null;
  notes?: string | null;
}
export type ClientUpdate = Partial<ClientInput>;

// ---------- projects (R2) ----------
export interface Project extends ProjectSummary {
  description: string | null;
  billingHour: number | null;   // project override; null = inherit
  effectiveRate: number;        // billingHour ?? client.billingHour  (never null)
  rateSource: RateSource;       // where effectiveRate came from
  standalone: boolean;          // clientId === null
  archived: boolean;
  client: ClientSummary | null; // embedded on list + get
  createdAt: string;
  updatedAt: string;
}
export interface ProjectInput {
  name: string;
  clientId?: number | null;
  description?: string | null;
  billingHour?: number | null;
  archived?: boolean;
}
export type ProjectUpdate = Partial<ProjectInput>;

// ---------- settings (R15) ----------
export interface Settings {
  id: 1;                         // singleton row
  displayName: string;
  weeklyTargetHours: number;     // default 40
  currencySymbol: string;        // default "$"
  invoicePrefix: string;         // default "INV" → INV-2026-001
  updatedAt: string;
}
export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'updatedAt'>>;

// ---------- work records (R5) ----------
export interface WorkRecord {
  id: number;
  weekId: number;
  projectId: number;
  project: ProjectSummary | null;   // null if the project was deleted after invoicing
  clientId: number | null;          // derived from the project at write time
  client: ClientSummary | null;     // null for standalone projects
  description: string;
  hours: number;                    // > 0, <= 24
  date: string;                     // YYYY-MM-DD, always inside the week
  rate: number;                     // effectiveRate at read time
  lineTotal: number;                // hours * rate, 2dp
  createdAt: string;
  updatedAt: string;
}
export interface WorkRecordInput {
  projectId: number;
  description: string;
  hours: number;   // > 0, <= 24
  date: string;    // YYYY-MM-DD, must fall inside the target week
}
export type WorkRecordUpdate = Partial<WorkRecordInput>;

// ---------- weeks (R4, R7, R8) ----------
export interface WeekTotals {
  totalHours: number;
  projectedGross: number;
  targetHours: number;        // from settings.weeklyTargetHours
  belowTarget: boolean;       // totalHours < targetHours
  hoursBelowTarget: number;   // max(0, targetHours - totalHours), 2dp
  clientCount: number;        // distinct non-null clients in the week
  recordCount: number;
  byProject: WeekProjectTotal[];
  byClient: WeekClientTotal[];
}
export interface WeekProjectTotal {
  projectId: number;
  projectName: string;
  clientId: number | null;
  clientName: string | null;   // null = standalone bucket
  rate: number;                // effective rate used
  hours: number;
  gross: number;
}
export interface WeekClientTotal {
  clientId: number | null;     // null = "No client" (standalone) bucket
  clientName: string | null;   // null for the "No client" bucket
  hours: number;
  gross: number;
}
export interface WeekDay {
  date: string;             // YYYY-MM-DD
  dayName: string;          // "Mon" | "Tue" | ... | "Sun"
  dayOfWeek: number;        // ISO: Monday = 1 … Sunday = 7
  isWeekend: boolean;       // Sat/Sun — muted in the UI but still insertable
  hours: number;
  projectedGross: number;
  records: WorkRecord[];
}
export interface Week {
  id: number;
  startDate: string;        // Monday, YYYY-MM-DD
  endDate: string;          // Sunday, YYYY-MM-DD
  status: WeekStatus;
  closedAt: string | null;
  label: string;            // "Week 43: 19-10-2026 – 25-10-2026"
  isoWeek: number;          // 43
  days: WeekDay[];          // always 7 entries, Monday first, including empty days
  totals: WeekTotals;
  invoiceCount: number;     // invoices already issued for this week
}

// ---------- invoices (R9–R12, designed here, implemented by worker-3) ----------
export interface InvoiceLine {
  id: number;
  recordId: number | null;
  date: string;
  projectId: number | null;
  projectName: string;      // snapshot
  description: string;      // snapshot
  hours: number;
  rate: number;             // snapshot of the effective rate
  lineTotal: number;
}
export interface InvoiceSubtotal {
  projectId: number | null;
  projectName: string;
  hours: number;
  gross: number;
}
export interface Invoice {
  id: number;
  number: string;                 // "INV-2026-001"
  weekId: number;
  clientId: number | null;        // null = "No client" bucket
  clientName: string;             // "No client" when clientId is null
  contactEmail: string;
  ccEmail: string | null;
  platformCompany: string | null; // snapshot, null when the client has no platform
  feePercent: number;
  feeFlat: number;
  totalHours: number;
  gross: number;
  feeAmount: number;              // absorbed by the freelancer
  net: number;                    // gross - feeAmount
  currencySymbol: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  lines: InvoiceLine[];
  subtotals: InvoiceSubtotal[];
}

export interface InvoiceWarning {
  code: WarningCode;
  message: string;   // ready to render, e.g. "32 / 40 hrs, -8 below target"
}
export interface InvoicePreviewRow {
  clientId: number | null;
  clientName: string;
  contactEmail: string;
  ccEmail: string | null;
  platformCompany: string | null;
  feePercent: number;
  feeFlat: number;
  totalHours: number;
  gross: number;
  feeAmount: number;
  net: number;
  lines: Array<Omit<InvoiceLine, 'id'>>;
  subtotals: InvoiceSubtotal[];
}
export interface InvoicePreview {
  weekId: number;
  periodStart: string;
  periodEnd: string;
  status: WeekStatus;
  canGenerate: boolean;   // status === 'closed'
  currencySymbol: string;
  totals: WeekTotals;
  warnings: InvoiceWarning[];
  invoices: InvoicePreviewRow[];
}

export interface InvoiceEmailDraft {
  to: string;
  cc: string | null;
  subject: string;
  text: string;      // plain-text tables, one block per project
  html: string;      // HTML tables for "Copy formatted"
  mailto: string;    // "mailto:...?subject=...&body=..." (percent-encoded)
  truncated: boolean; // true when the body exceeded the mailto length limit
}

export interface EarningsRow {
  id: number | null;   // null for the "No client" bucket when grouping by client
  name: string;        // project name or client name ("No client" when null)
  hours: number;
  gross: number;
  fees: number;
  net: number;
}
export interface EarningsReport {
  from: string;        // YYYY-MM-DD inclusive
  to: string;          // YYYY-MM-DD inclusive
  groupBy: EarningsGroupBy;
  currencySymbol: string;
  rows: EarningsRow[];
  totals: { hours: number; gross: number; fees: number; net: number };
}
```

---

## 3. Endpoints — implemented by worker-1

### 3.1 `GET /api/health`

Docker healthcheck. Probes the database.

**200**
```json
{ "success": true, "data": { "status": "ok", "database": "up", "uptimeSeconds": 42 } }
```
**500** `{ "success": false, "error": { "code": "INTERNAL", "message": "Internal server error" } }` when the database is unreachable.

---

### 3.2 Payment platforms

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/payment-platforms` | ordered by `company` ASC |
| POST | `/api/payment-platforms` | 201 |
| GET | `/api/payment-platforms/:id` | |
| PATCH | `/api/payment-platforms/:id` | partial |
| DELETE | `/api/payment-platforms/:id` | clients referencing it get `paymentPlatformId: null` (FK `ON DELETE SET NULL`) |

**Body** (`PaymentPlatformInput`)
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `company` | string | yes | 1–120 chars, unique (case-insensitive) |
| `feePercent` | number | no | ≥ 0, ≤ 100, 2dp. Default `0` |
| `feeFlat` | number | no | ≥ 0, 2dp. Default `0` |

`PATCH` accepts any subset of the same fields. Unknown keys → `VALIDATION_ERROR`.

**201 / 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company": "Payoneer",
    "feePercent": 1,
    "feeFlat": 0,
    "createdAt": "2026-10-22T18:04:11.204Z"
  }
}
```
**Errors:** `VALIDATION_ERROR` (400) · `NOT_FOUND` (404) · `CONFLICT` (409, duplicate company)

---

### 3.3 Clients

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/clients` | ordered by `name` ASC |
| POST | `/api/clients` | 201 |
| GET | `/api/clients/:id` | |
| PATCH | `/api/clients/:id` | partial |
| DELETE | `/api/clients/:id` | **409** if the client is referenced by any project or work record |

**Body** (`ClientInput`)
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 1–120 chars, unique (case-insensitive) |
| `contactEmail` | string | yes | valid email |
| `ccEmail` | string \| null | no | valid email or `null` |
| `billingHour` | number | yes | > 0, ≤ 10 000, 2dp |
| `paymentPlatformId` | number \| null | no | must exist, or `null` |
| `notes` | string \| null | no | ≤ 4 000 chars |

**200** (list items and single item share this shape)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Acme Corp",
    "contactEmail": "billing@acme.example",
    "ccEmail": "finance@acme.example",
    "billingHour": 130,
    "paymentPlatformId": 1,
    "paymentPlatform": {
      "id": 1,
      "company": "Payoneer",
      "feePercent": 1,
      "feeFlat": 0,
      "createdAt": "2026-10-22T18:04:10.117Z"
    },
    "projectCount": 2,
    "totalHours": 17.5,
    "totalGross": 2275,
    "notes": "Net 15. Monthly retainer invoicing via Payoneer.",
    "createdAt": "2026-10-22T18:04:10.301Z",
    "updatedAt": "2026-10-22T18:04:10.301Z"
  }
}
```
**DELETE 200**
```json
{ "success": true, "data": { "id": 1, "deleted": true } }
```
**Errors:** `VALIDATION_ERROR` · `NOT_FOUND` · `CONFLICT` (409 — duplicate name, or delete while referenced)

---

### 3.4 Projects

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects` | query: `clientId`, `standalone`, `archived` |
| POST | `/api/projects` | 201 |
| GET | `/api/projects/:id` | |
| PATCH | `/api/projects/:id` | partial |
| DELETE | `/api/projects/:id` | **409** if referenced by any work record |

**Query**
| Param | Type | Rules |
|-------|------|-------|
| `clientId` | number | exact match; `clientId=none` lists standalone projects |
| `standalone` | `"true"` \| `"false"` | `true` ⇒ `clientId IS NULL` |
| `archived` | `"true"` \| `"false"` \| `"all"` | default `"false"` (archived hidden) |

**Body** (`ProjectInput`)
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 1–120 chars, unique per client (case-insensitive) |
| `clientId` | number \| null | no | must exist; `null` = standalone |
| `description` | string \| null | no | ≤ 4 000 chars |
| `billingHour` | number \| null | no | > 0, ≤ 10 000, 2dp — project override |
| `archived` | boolean | no | default `false` |

**Business rule (R2):** a **standalone** project (`clientId: null`) **must** set `billingHour`, otherwise
`VALIDATION_ERROR` (`path: "billingHour"`). A client project may omit it and inherits the client's rate.

**200**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Video Streaming Mobile App",
    "clientId": 2,
    "description": "iOS/Android streaming client with offline downloads.",
    "billingHour": 115,
    "effectiveRate": 115,
    "rateSource": "project",
    "standalone": false,
    "archived": false,
    "client": {
      "id": 2,
      "name": "Starlight Media",
      "contactEmail": "accounts@starlight.example",
      "ccEmail": null,
      "billingHour": 100
    },
    "createdAt": "2026-10-22T18:04:10.402Z",
    "updatedAt": "2026-10-22T18:04:10.402Z"
  }
}
```
A standalone project returns `"clientId": null, "client": null, "standalone": true, "rateSource": "project"`.

**Errors:** `VALIDATION_ERROR` · `NOT_FOUND` · `CONFLICT` (409 — duplicate name for that client, or delete while referenced)

---

### 3.5 Settings

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/settings` | always returns the singleton row (creates it on first call) |
| PUT | `/api/settings` | partial update, returns the full row |

**Body** (`SettingsUpdate` — every field optional)
| Field | Type | Rules |
|-------|------|-------|
| `displayName` | string | 1–120 chars |
| `weeklyTargetHours` | number | > 0, ≤ 168, 2dp |
| `currencySymbol` | string | 1–5 chars |
| `invoicePrefix` | string | 1–10 chars, `[A-Za-z0-9-]` — produces invoice numbers like `INV-2026-001` |

**200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "displayName": "Alex Morgan",
    "weeklyTargetHours": 40,
    "currencySymbol": "$",
    "invoicePrefix": "INV",
    "updatedAt": "2026-10-22T18:04:11.001Z"
  }
}
```
**Errors:** `VALIDATION_ERROR` · `INTERNAL`

---

### 3.6 Weeks

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/weeks/current` | the week containing today; **auto-created** if absent |
| GET | `/api/weeks/by-date/:date` | the week containing `:date`; auto-created |
| GET | `/api/weeks/:id` | full week with `days[]` and `totals` |
| POST | `/api/weeks/:id/close` | idempotent-close: 409 if already closed |
| POST | `/api/weeks/:id/reopen` | 409 if invoices already exist for the week |
| GET | `/api/weeks/:id/records` | convenience list of the week's records |
| POST | `/api/weeks/:id/records` | create a record inside this week |

`:date` must be a valid `YYYY-MM-DD` (else `VALIDATION_ERROR`), and `:id` a positive integer.

**Week resolution rule:** both read endpoints are *get-or-create*. They always return **200** (never
404 and never 201) so the frontend can call `GET /api/weeks/current` on every render without
special-casing first-load. `GET /api/weeks/:id` is the only one that 404s on an unknown id.

**200** — identical payload from `current`, `by-date/:date` and `:id`
```json
{
  "success": true,
  "data": {
    "id": 1,
    "startDate": "2026-10-19",
    "endDate": "2026-10-25",
    "status": "open",
    "closedAt": null,
    "label": "Week 43: 19-10-2026 – 25-10-2026",
    "isoWeek": 43,
    "invoiceCount": 0,
    "totals": {
      "totalHours": 34.5,
      "projectedGross": 4180,
      "targetHours": 40,
      "belowTarget": true,
      "hoursBelowTarget": 5.5,
      "clientCount": 2,
      "recordCount": 12,
      "byProject": [
        { "projectId": 1, "projectName": "E-Commerce Storefront", "clientId": 1,
          "clientName": "Acme Corp", "rate": 130, "hours": 15.5, "gross": 2015 },
        { "projectId": 3, "projectName": "Video Streaming Mobile App", "clientId": 2,
          "clientName": "Starlight Media", "rate": 115, "hours": 14.5, "gross": 1667.5 },
        { "projectId": 4, "projectName": "Internal Tools", "clientId": null,
          "clientName": null, "rate": 95, "hours": 2.5, "gross": 237.5 }
      ],
      "byClient": [
        { "clientId": 1, "clientName": "Acme Corp", "hours": 17.5, "gross": 2275 },
        { "clientId": 2, "clientName": "Starlight Media", "hours": 14.5, "gross": 1667.5 },
        { "clientId": null, "clientName": null, "hours": 2.5, "gross": 237.5 }
      ]
    },
    "days": [
      {
        "date": "2026-10-19",
        "dayName": "Mon",
        "dayOfWeek": 1,
        "isWeekend": false,
        "hours": 5.5,
        "projectedGross": 715,
        "records": [
          {
            "id": 1, "weekId": 1, "projectId": 1,
            "project": { "id": 1, "name": "E-Commerce Storefront", "clientId": 1 },
            "clientId": 1,
            "client": { "id": 1, "name": "Acme Corp", "contactEmail": "billing@acme.example",
                        "ccEmail": "finance@acme.example", "billingHour": 130 },
            "description": "Checkout flow rebuild — cart & payment step",
            "hours": 3.5, "date": "2026-10-19", "rate": 130, "lineTotal": 455,
            "createdAt": "2026-10-22T18:04:11.120Z", "updatedAt": "2026-10-22T18:04:11.120Z"
          }
        ]
      },
      { "date": "2026-10-20", "dayName": "Tue", "dayOfWeek": 2, "isWeekend": false,
        "hours": 7, "projectedGross": 910, "records": [] },
      { "date": "2026-10-24", "dayName": "Sat", "dayOfWeek": 6, "isWeekend": true,
        "hours": 1.5, "projectedGross": 142.5, "records": [] }
    ]
  }
}
```
(`days` is trimmed here for readability — it always contains all 7 entries, Monday first, even when empty.)

**Totals rules**
- `projectedGross = Σ (hours × effectiveRate)`; `effectiveRate = project.billingHour ?? client.billingHour`.
- `targetHours` = `settings.weeklyTargetHours` (default 40).
- `belowTarget = totalHours < targetHours`; `hoursBelowTarget = max(0, targetHours − totalHours)`.
- `clientCount` counts **distinct non-null clients** — the standalone bucket is not a client.
- The R8 banner text is `"${totalHours} / ${targetHours} hrs, -${hoursBelowTarget} below target"`; the numbers come straight from `totals`, the API never returns the sentence.

**Close — `POST /api/weeks/:id/close`** → **200**
```json
{ "success": true, "data": { "id": 1, "status": "closed", "closedAt": "2026-10-25T23:59:00.000Z" } }
```
- Already closed → **409** `WEEK_CLOSED`, `message: "Week 43: 19-10-2026 – 25-10-2026 is already closed"`.

**Reopen — `POST /api/weeks/:id/reopen`** → **200** (same shape with `"status": "open"`, `"closedAt": null`)
- Week already open → **409** `CONFLICT`, `message: "<label> is already open"`.
- Invoices exist for the week → **409** `CONFLICT`,
  `message: "Week 43: 19-10-2026 – 25-10-2026 has 2 invoices and cannot be reopened"`,
  `details: { invoiceCount: 2 }`.

**Errors:** `VALIDATION_ERROR` (bad id/date) · `NOT_FOUND` · `WEEK_CLOSED` · `CONFLICT`

---

### 3.7 Work records

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/weeks/:id/records` | 201 |
| GET | `/api/weeks/:id/records` | all records of the week (same objects as `days[].records`) |
| PATCH | `/api/records/:id` | partial |
| DELETE | `/api/records/:id` | 200 |

**Body** (`WorkRecordInput`)
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `projectId` | number | yes | must exist and not be archived |
| `description` | string | yes | 1–500 chars |
| `hours` | number | yes | `> 0` and `<= 24`, 2dp |
| `date` | string | yes | `YYYY-MM-DD`, **must fall inside the week** |

**Derived:** `clientId` = the project's client (or `null` for standalone). It is never accepted from
the client — sending it is a `VALIDATION_ERROR`.

**201 / 200**
```json
{
  "success": true,
  "data": {
    "id": 13, "weekId": 1, "projectId": 1,
    "project": { "id": 1, "name": "E-Commerce Storefront", "clientId": 1 },
    "clientId": 1,
    "client": { "id": 1, "name": "Acme Corp", "contactEmail": "billing@acme.example",
                "ccEmail": "finance@acme.example", "billingHour": 130 },
    "description": "Checkout flow rebuild — cart & payment step",
    "hours": 3.5, "date": "2026-10-19", "rate": 130, "lineTotal": 455,
    "createdAt": "2026-10-22T18:04:11.120Z", "updatedAt": "2026-10-22T18:04:11.120Z"
  }
}
```
**DELETE 200** `{ "success": true, "data": { "id": 13, "deleted": true } }`

**Errors**
| Situation | Code | HTTP | Message |
|-----------|------|------|---------|
| week is closed (create/update/delete) | `WEEK_CLOSED` | 409 | `Week 43: 19-10-2026 – 25-10-2026 is closed` |
| `date` outside the week | `VALIDATION_ERROR` | 400 | `details: [{ path: "date", message: "Date 2026-10-26 is outside week 43 (19-10-2026 – 25-10-2026)" }]` |
| `hours` out of range | `VALIDATION_ERROR` | 400 | `details[0].path === "hours"` |
| unknown project / record | `NOT_FOUND` | 404 | `Project 99 not found` |
| project is archived | `VALIDATION_ERROR` | 400 | `details: [{ path: "projectId", message: "Project 4 is archived and cannot receive new records" }]` |

---

## 4. Endpoints — designed here, implemented by worker-3

> Contract is final for worker-3. The `invoices` / `reports` / `invoice-preview` routers are stubs in
> `backend/src/modules/{invoices,reports}/index.ts`; week-scoped invoice routes are mounted from
> `modules/invoices` in `backend/src/modules/index.ts`.

### 4.1 `POST /api/weeks/:id/invoices` — generate (idempotent)

Groups the week's records into one invoice per client bucket (standalone → a single **"No client"**
bucket), freezes every client-facing value as a snapshot, applies
`fee = round(gross × feePercent / 100) + feeFlat`, `net = gross − fee`, and numbers them
`{prefix}-{YYYY}-{NNN}` sequentially per year from `settings.invoicePrefix`.

- Only for a **closed** week → otherwise **409** `CONFLICT`
  (`message: "Close week 43 before generating invoices"`).
- **Idempotent**: re-running returns the existing invoices with **200** (the first run returns **201**).
- A week with no records → **409** `CONFLICT` (`message: "Week 43 has no records to invoice"`).

**201 / 200** — `data` is the full `Invoice[]` (2 invoices for the seeded week).
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "number": "INV-2026-001",
      "weekId": 1,
      "clientId": 1,
      "clientName": "Acme Corp",
      "contactEmail": "billing@acme.example",
      "ccEmail": "finance@acme.example",
      "platformCompany": "Payoneer",
      "feePercent": 1,
      "feeFlat": 0,
      "totalHours": 17.5,
      "gross": 2275,
      "feeAmount": 22.75,
      "net": 2252.25,
      "currencySymbol": "$",
      "periodStart": "2026-10-19",
      "periodEnd": "2026-10-25",
      "createdAt": "2026-10-26T09:00:00.000Z",
      "lines": [
        { "id": 1, "recordId": 1, "date": "2026-10-19", "projectId": 1,
          "projectName": "E-Commerce Storefront",
          "description": "Checkout flow rebuild — cart & payment step",
          "hours": 3.5, "rate": 130, "lineTotal": 455 }
      ],
      "subtotals": [
        { "projectId": 1, "projectName": "E-Commerce Storefront", "hours": 15.5, "gross": 2015 },
        { "projectId": 2, "projectName": "API Microservice", "hours": 2, "gross": 260 }
      ]
    }
  ]
}
```
**Errors:** `NOT_FOUND` (unknown week) · `VALIDATION_ERROR` (bad id) · `CONFLICT` (week open / no records)

---

### 4.2 `GET /api/weeks/:id/invoices` — list

Returns the week's invoices, `Invoice[]` ordered by `number` ASC. Empty array when none exist.
```json
{ "success": true, "data": [ { "id": 1, "number": "INV-2026-001", "...": "full Invoice" } ] }
```
**Errors:** `NOT_FOUND`

---

### 4.3 `GET /api/weeks/:id/invoice-preview` — preview (works on open weeks)

Computes the invoices **without persisting anything** — usable while the week is still open, which is
where the R8 below-target warning is surfaced. Never writes, so it is safe to call on every render.

```json
{
  "success": true,
  "data": {
    "weekId": 1,
    "periodStart": "2026-10-19",
    "periodEnd": "2026-10-25",
    "status": "open",
    "canGenerate": false,
    "currencySymbol": "$",
    "totals": { "...": "WeekTotals" },
    "warnings": [
      { "code": "WEEK_OPEN", "message": "Close week 43 before generating invoices" },
      { "code": "BELOW_TARGET", "message": "34.5 / 40 hrs, -5.5 below target" }
    ],
    "invoices": [
      {
        "clientId": 1, "clientName": "Acme Corp",
        "contactEmail": "billing@acme.example", "ccEmail": "finance@acme.example",
        "platformCompany": "Payoneer", "feePercent": 1, "feeFlat": 0,
        "totalHours": 17.5, "gross": 2275, "feeAmount": 22.75, "net": 2252.25,
        "lines": [ { "recordId": 1, "date": "2026-10-19", "projectId": 1,
                     "projectName": "E-Commerce Storefront", "description": "Checkout flow rebuild — cart & payment step",
                     "hours": 3.5, "rate": 130, "lineTotal": 455 } ],
        "subtotals": [ { "projectId": 1, "projectName": "E-Commerce Storefront", "hours": 15.5, "gross": 2015 } ]
      }
    ]
  }
}
```
`warnings` is an array and may be empty. Codes: `WEEK_OPEN` (canGenerate is false),
`BELOW_TARGET` (below the target), `NO_RECORDS`.
**Errors:** `NOT_FOUND` · `VALIDATION_ERROR`

---

### 4.4 `GET /api/invoices/:id` — single invoice

Full `Invoice` including `lines[]` and `subtotals[]` (§2). **200**, **404** when unknown.

---

### 4.5 `GET /api/invoices/:id/pdf` — PDF download

Binary, **not** enveloped.

- `200` `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="INV-2026-001-acme-corp.pdf"`
  (slug = invoice number lowercased + client name lowercased, non-alphanumerics → `-`, collapsed).
  The standalone bucket uses `no-client`.
- **404** unknown invoice.
- PDFs must open in any standard viewer; body is a single-page A4 document unless the invoice needs
  more lines.

---

### 4.6 `GET /api/weeks/:id/invoices/zip` — download all

- `200` `Content-Type: application/zip`, `Content-Disposition: attachment; filename="invoices-week-43.zip"`
- Contains one PDF per invoice, named exactly like §4.5.
- Week open or no invoices → **409** `CONFLICT`.
- **404** unknown week.

---

### 4.7 `GET /api/invoices/:id/email` — "Send as Email Text"

Builds the mailto draft and the clipboard HTML. Never sends mail (SMTP is out of scope).

```json
{
  "success": true,
  "data": {
    "to": "billing@acme.example",
    "cc": "finance@acme.example",
    "subject": "Invoice INV-2026-001 — Acme Corp — 19-10-2026 to 25-10-2026",
    "text": "Hi Acme Corp Billing Team,\n\nPlease find invoice INV-2026-001 ...\n\nE-Commerce Storefront\nMon, Oct 19  3.5h @ $130.00 = $455.00\n...",
    "html": "<p>Hi Acme Corp Billing Team,</p> ... <table>...</table>",
    "mailto": "mailto:billing@acme.example?cc=finance%40acme.example&subject=...&body=...",
    "truncated": false
  }
}
```
- `cc` is `null` when the client has no cc address (omit the `cc=` param in that case).
- `truncated: true` when the encoded body exceeds **2000 characters** — the UI then hides the mailto
  link, shows "body too long for mailto — use Copy formatted", and never silently sends a cut-off body.
- `text` groups line items **per project** (R12); `html` uses `<table>` markup for "Copy formatted".
- **404** unknown invoice.

---

### 4.8 `GET /api/reports/earnings` — earnings report (R13)

**Query** (all optional, defaults shown)
| Param | Type | Default | Rules |
|-------|------|---------|-------|
| `from` | `YYYY-MM-DD` | earliest record date | inclusive |
| `to` | `YYYY-MM-DD` | latest record date | inclusive |
| `groupBy` | `"project"` \| `"client"` | `"project"` | — |

Rows are computed from **work records** (via their weeks) and grouped by project or client, using the
same effective-rate and fee model as invoicing. Standalone work is grouped under `id: null,
name: "No client"`. Ordered by `gross` DESC, then `name` ASC.

**200**
```json
{
  "success": true,
  "data": {
    "from": "2026-10-19",
    "to": "2026-10-25",
    "groupBy": "project",
    "currencySymbol": "$",
    "rows": [
      { "id": 1, "name": "E-Commerce Storefront", "hours": 15.5, "gross": 2015, "fees": 20.15, "net": 1994.85 },
      { "id": 3, "name": "Video Streaming Mobile App", "hours": 14.5, "gross": 1667.5, "fees": 16.68, "net": 1650.82 },
      { "id": null, "name": "No client", "hours": 2.5, "gross": 237.5, "fees": 2.38, "net": 235.12 }
    ],
    "totals": { "hours": 34.5, "gross": 4180, "fees": 41.67, "net": 4138.33 }
  }
}
```
**Errors:** `VALIDATION_ERROR` (bad date / `from` after `to` / bad `groupBy`) · `NOT_FOUND` (unknown settings row)

---

## 5. Endpoint summary

| # | Method | Path | Owner |
|---|--------|------|-------|
| 1 | GET | `/api/health` | worker-1 |
| 2 | GET | `/api/payment-platforms` | worker-1 |
| 3 | POST | `/api/payment-platforms` | worker-1 |
| 4 | GET | `/api/payment-platforms/:id` | worker-1 |
| 5 | PATCH | `/api/payment-platforms/:id` | worker-1 |
| 6 | DELETE | `/api/payment-platforms/:id` | worker-1 |
| 7 | GET | `/api/clients` | worker-1 |
| 8 | POST | `/api/clients` | worker-1 |
| 9 | GET | `/api/clients/:id` | worker-1 |
| 10 | PATCH | `/api/clients/:id` | worker-1 |
| 11 | DELETE | `/api/clients/:id` | worker-1 |
| 12 | GET | `/api/projects` | worker-1 |
| 13 | POST | `/api/projects` | worker-1 |
| 14 | GET | `/api/projects/:id` | worker-1 |
| 15 | PATCH | `/api/projects/:id` | worker-1 |
| 16 | DELETE | `/api/projects/:id` | worker-1 |
| 17 | GET | `/api/settings` | worker-1 |
| 18 | PUT | `/api/settings` | worker-1 |
| 19 | GET | `/api/weeks/current` | worker-1 |
| 20 | GET | `/api/weeks/by-date/:date` | worker-1 |
| 21 | GET | `/api/weeks/:id` | worker-1 |
| 22 | POST | `/api/weeks/:id/close` | worker-1 |
| 23 | POST | `/api/weeks/:id/reopen` | worker-1 |
| 24 | GET | `/api/weeks/:id/records` | worker-1 |
| 25 | POST | `/api/weeks/:id/records` | worker-1 |
| 26 | PATCH | `/api/records/:id` | worker-1 |
| 27 | DELETE | `/api/records/:id` | worker-1 |
| 28 | POST | `/api/weeks/:id/invoices` | **worker-3** |
| 29 | GET | `/api/weeks/:id/invoices` | **worker-3** |
| 30 | GET | `/api/weeks/:id/invoice-preview` | **worker-3** |
| 31 | GET | `/api/invoices/:id` | **worker-3** |
| 32 | GET | `/api/invoices/:id/pdf` | **worker-3** |
| 33 | GET | `/api/weeks/:id/invoices/zip` | **worker-3** |
| 34 | GET | `/api/invoices/:id/email` | **worker-3** |
| 35 | GET | `/api/reports/earnings` | **worker-3** |

## 6. Routing notes for worker-3

`backend/src/modules/index.ts` already mounts worker-3's three routers:

```ts
apiRouter.use('/weeks/:weekId/invoices', weekInvoicesRouter);       // #28, #29, #33
apiRouter.use('/weeks/:weekId/invoice-preview', weekInvoicePreviewRouter); // #30
apiRouter.use('/invoices', invoicesRouter);                        // #31, #32, #34
apiRouter.use('/reports', reportsRouter);                          // #35
```

Inside `weekInvoicesRouter` the paths are `/` (generate, list), `/zip`; inside
`weekInvoicePreviewRouter` the path is `/`; inside `invoicesRouter` they are `/:id`, `/:id/pdf`,
`/:id/email`. Inside `reportsRouter` the path is `/earnings`.
Worker-3 edits **only** `src/modules/{invoices,reports}/**` (plus `npm install pdfmake archiver`) —
never `db/schema/*` or `src/modules/index.ts`.

## 7. Database schema (authoritative for worker-3)

Owned by worker-1 — see `backend/src/db/schema/`. Worker-3 must not edit it.

| Table | Notes |
|-------|-------|
| `invoices` | one row per (week, client bucket); all client-facing columns are `*_snapshot`; `UNIQUE(week_id, client_id)` plus a second partial unique index on `week_id` alone for the `client_id IS NULL` bucket |
| `invoice_lines` | `invoice_id` `ON DELETE CASCADE`; `record_id`/`project_id` intentionally **not** FK-constrained (nullable) so deleting a record or project never destroys an issued invoice |
| `weeks` | `status` enum `open|closed`; `start_date` (Monday) unique |
| `work_records` | `client_id` denormalized from the project at write time; `CHECK (hours > 0 AND hours <= 24)` |
| `settings` | singleton `id = 1` |

## 8. Deviations

Wording-level differences between this document's original examples and the shipped implementation.
**No endpoint, field name, field type, status code or error `code` differs** — only the human-readable
`message` strings, which the implementation renders with the full week label (§1.2 date format).

| Date | Endpoint | Planned | Actual | Why |
|------|----------|---------|--------|-----|
| 2026-10-23 | `POST /api/weeks/:id/records` (and `PATCH /api/records/:id`) — date outside week | `"Date 2026-10-26 is outside week 43 (2026-10-19 – 2026-10-25)"` | `"Date 2026-10-26 is outside week 43 (19-10-2026 – 25-10-2026)"` | §1.2 mandates `DD-MM-YYYY` for display; the example had drifted to ISO. |
| 2026-10-23 | `POST /api/weeks/:id/close` | `"Week 43 is already closed"` | `"Week 43: 19-10-2026 – 25-10-2026 is already closed"` | Reuses `label` so the message is unambiguous in a UI toast. |
| 2026-10-23 | `POST /api/weeks/:id/reopen` | `"Week 43 has 2 invoices and cannot be reopened"` | `"Week 43: 19-10-2026 – 25-10-2026 has 2 invoices and cannot be reopened"` | Same. Also documents the new "already open" 409 case. |
| 2026-10-23 | `POST /api/weeks/:id/records` — archived project | *(not specified)* | **400** `VALIDATION_ERROR`, `details[0].path === "projectId"` | Added so archived projects cannot silently accumulate new records. Documented in §3.7. |

### 8.1 Deviations — invoice + reports endpoints (worker-3)

Unlike the rows above, these **do** change behaviour or add a field, so the §8 preamble
("no endpoint, field name, field type … differs") does not apply to them.

| Date | Endpoint | Planned | Actual | Why |
|------|----------|---------|--------|-----|
| 2026-10-23 | #28 `POST /api/weeks/:id/invoices` | Task assignment asked for a new error code `WEEK_NOT_CLOSED` | 409 **`CONFLICT`**, message `Close week 43 before generating invoices` (exactly as §4.1) | `ERROR_CODES` in `lib/http.ts` is worker-1-owned and frozen, and §4.1 already specifies `CONFLICT`. No code was added to the envelope's closed set. |
| 2026-10-23 | #35 `GET /api/reports/earnings` | `EarningsReport` (§2) | **Added** `unbilled: { hours, gross, fees, net, weekCount }` | Required by T8 — the hours that exist as records but are not covered by any issued invoice. Additive: existing clients ignore unknown fields. |
| 2026-10-23 | #35 fees for the "No client" bucket | §4.8 example shows `fees: 2.38` for standalone work | **`fees: 0`** | R3 derives the fee from the *client's* payment platform; a standalone project has no client, so there is no platform and no fee — consistent with the invoice generator, which sets `feePercent`/`feeFlat` to `0` for that bucket. The §4.8 example is also internally inconsistent: its rows sum to `39.21` while `totals.fees` says `41.67`, and to `3 920.00` while `totals.gross` says `4 180.00` (it omits Acme's second project). |
| 2026-10-23 | #35 fee allocation | not specified | An invoiced bucket contributes **exactly** the invoice's fee, split across its lines by line amount using largest-remainder (the split always sums back to the invoice fee). An unbilled bucket gets a notional fee from the same `withFees` rule. | Makes acceptance criterion 6 ("earnings by project and by client sum to the invoice totals") true by construction rather than by luck. |
| 2026-10-23 | #34 `GET /api/invoices/:id/email` | Task assignment said truncate above 1 800 chars | Truncates above **2 000** encoded chars | §4.7 specifies 2 000; the contract wins. The shortened body keeps per-project totals and points at the attached PDF / "Copy formatted". |
| 2026-10-23 | #32 `GET /api/invoices/:id/pdf` | §4.5 parenthetical says "invoice number lowercased" | Filename keeps the number verbatim: `INV-2026-001-acme-corp.pdf` | Follows §4.5's worked example, which shows `INV` uppercase. Only the client name is slugified (lowercased, non-alphanumerics collapsed to `-`); the standalone bucket uses `no-client`. |
| 2026-10-23 | #28/#31 `subtotals` | §2 `InvoiceSubtotal[]` | Derived from the stored `invoice_lines` at read time, not persisted | There is no `subtotals` column. Values are identical to what generation computed (`Σ hours`, `Σ line_total` per project, first-appearance order). |
| 2026-10-23 | #28 invoice number | `{prefix}-{YYYY}-{NNN}` per year | `YYYY` = the **billing period's** start year; the sequence continues from the highest existing `{prefix}-{year}-` number | Keeps a number stable when a week is invoiced after the calendar rolls over. |
| 2026-10-23 | #35 default range | §4.8: `from`/`to` default to earliest/latest **record** date | Implemented as written — defaults are *record* dates, not week boundaries | Called out because with the seeded week the last record is Saturday, so `to` is `2026-10-24` while the week ends `2026-10-25`. With no records at all the range collapses to today. |
| 2026-10-24 | #35 `GET /api/reports/earnings?groupBy=project` | §4.8 example groups standalone work under `id: null, name: "No client"` | Each standalone project is its own row (e.g. `{ id: 4, name: "Internal Tools" }`); only `groupBy=client` uses the `null` / "No client" bucket | Accepted by lead after QA GAP-005: per-project grouping is more informative and totals are identical. |

## 9. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-10-22 | Initial contract: 35 endpoints, all DTOs, envelope, formats, error codes. | worker-1 |
| 2026-10-23 | Reconciled error messages with the implementation; added the archived-project 400 and the "already open" 409; recorded 4 wording deviations. | worker-1 |
| 2026-10-23 | Implemented endpoints #28–#35 (invoice engine, PDF, zip, email text, earnings). Added `unbilled` to `EarningsReport`; recorded 9 deviations in §8.1. | worker-3 |
| 2026-10-23 | **Base URL moved 4000 → 4400** (user decision: `Local.app` owns `127.0.0.1:4000`). Affects the header line, `PORT` default in `src/config/env.ts`, `backend/.env`, both `.env.example` files, both Dockerfiles (`EXPOSE`/`HEALTHCHECK`/build `ARG`), `docker-compose.yml` (`${BACKEND_PORT:-4400}:4400`) and `NUXT_PUBLIC_API_BASE=http://localhost:4400/api`. Paths, payloads and status codes are unchanged. | worker-3 |
| 2026-10-24 | Recorded GAP-005 (earnings groupBy=project standalone rows) as accepted deviation in §8.1. | lead |
| 2026-10-25 | Added `contactName` (nullable) to clients and invoices (snapshot `contact_name_snapshot`); email greets the contact and the PDF prints "Attn:". Added settings `emailShowRate` / `emailShowGross` / `emailShowFee` (all default false) controlling the copied email's Rate column and Gross/fee total lines; the old "Hours" totals line no longer prints the gross amount. Migration `0001_natural_wong.sql`. | lead |
