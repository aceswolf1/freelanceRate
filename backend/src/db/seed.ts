/**
 * Idempotent demo seed — reproduces the reference dataset from
 * `.claude/design/weekly_timesheet`:
 *
 *   Platforms : Payoneer (1%), Wise (0.5%), Domestic Wire ($15 flat)
 *   Clients   : Acme Corp ($130/h, Payoneer), Starlight Media ($100/h, Payoneer)
 *   Projects  : E-Commerce Storefront + API Microservice (Acme, $130 inherited),
 *               Video Streaming Mobile App (Starlight, $115 override),
 *               Internal Tools (standalone, $95)
 *   Week      : the current Mon–Sun week carrying 34.5h →
 *               Acme $2,275.00 · Starlight $1,667.50 · standalone $237.50
 *
 * Re-running truncates and rebuilds, so it is safe to run against a fresh or an
 * already-seeded database.
 */
import { sql } from 'drizzle-orm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDbHandle } from './client.js';
import {
  clients,
  paymentPlatforms,
  projects,
  settings,
  weeks,
  workRecords,
} from './schema/index.js';
import { todayIso, weekDays, weekStart } from '../lib/dates.js';

interface SeedRecord {
  dayOffset: number;
  projectName: string;
  description: string;
  hours: number;
}

/** 15.5h + 2.0h (Acme) · 14.5h (Starlight) · 2.5h (standalone) = 34.5h */
const CURRENT_WEEK_RECORDS: readonly SeedRecord[] = [
  { dayOffset: 0, projectName: 'E-Commerce Storefront', description: 'Checkout flow rebuild — cart & payment step', hours: 3.5 },
  { dayOffset: 0, projectName: 'API Microservice', description: 'Rate-limit middleware for the public API', hours: 2 },
  { dayOffset: 1, projectName: 'E-Commerce Storefront', description: 'Product listing page — pagination & filters', hours: 4 },
  { dayOffset: 1, projectName: 'Video Streaming Mobile App', description: 'Playback pipeline spike — HLS segmenting', hours: 3 },
  { dayOffset: 2, projectName: 'E-Commerce Storefront', description: 'Order history + receipt download', hours: 4 },
  { dayOffset: 2, projectName: 'Video Streaming Mobile App', description: 'Offline download manager (iOS)', hours: 3 },
  { dayOffset: 3, projectName: 'E-Commerce Storefront', description: 'Search relevance tuning with merchandising rules', hours: 2 },
  { dayOffset: 3, projectName: 'Video Streaming Mobile App', description: 'Subtitle track rendering', hours: 4 },
  { dayOffset: 4, projectName: 'E-Commerce Storefront', description: 'Admin dashboard widgets', hours: 2 },
  { dayOffset: 4, projectName: 'Video Streaming Mobile App', description: 'Profile & subscription management', hours: 4.5 },
  { dayOffset: 5, projectName: 'Internal Tools', description: 'Invoice PDF template cleanup', hours: 1.5 },
  { dayOffset: 6, projectName: 'Internal Tools', description: 'Seed-data + smoke-test scripts', hours: 1 },
] as const;

const TRUNCATE_ORDER = [
  'invoice_lines',
  'invoices',
  'work_records',
  'weeks',
  'projects',
  'clients',
  'payment_platforms',
  'settings',
];

export async function runSeed(databaseUrl?: string): Promise<void> {
  const { db, pool } = createDbHandle(databaseUrl);
  try {
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${TRUNCATE_ORDER.join(', ')} RESTART IDENTITY CASCADE`),
    );

    await db.insert(paymentPlatforms).values([
      { company: 'Payoneer', feePercent: 1, feeFlat: 0 },
      { company: 'Wise', feePercent: 0.5, feeFlat: 0 },
      { company: 'Domestic Wire', feePercent: 0, feeFlat: 15 },
    ]);

    const [payoneer] = await db
      .select({ id: paymentPlatforms.id })
      .from(paymentPlatforms)
      .where(sql`${paymentPlatforms.company} = 'Payoneer'`)
      .limit(1);
    if (!payoneer) throw new Error('Seed failed: Payoneer platform was not created');

    const [acme, starlight] = await db
      .insert(clients)
      .values([
        {
          name: 'Acme Corp',
          contactEmail: 'billing@acme.example',
          ccEmail: 'finance@acme.example',
          billingHour: 130,
          paymentPlatformId: payoneer.id,
          notes: 'Net 15. Monthly retainer invoicing via Payoneer.',
        },
        {
          name: 'Starlight Media',
          contactEmail: 'accounts@starlight.example',
          ccEmail: null,
          billingHour: 100,
          paymentPlatformId: payoneer.id,
          notes: 'Video product team. Mobile app billed at a custom rate.',
        },
      ])
      .returning({ id: clients.id, name: clients.name });
    if (!acme || !starlight) throw new Error('Seed failed: clients were not created');

    const seededProjects = await db
      .insert(projects)
      .values([
        {
          name: 'E-Commerce Storefront',
          clientId: acme.id,
          description: 'Customer-facing storefront: catalogue, cart, checkout, order history.',
          billingHour: null,
        },
        {
          name: 'API Microservice',
          clientId: acme.id,
          description: 'Internal REST API powering the storefront and partner integrations.',
          billingHour: null,
        },
        {
          name: 'Video Streaming Mobile App',
          clientId: starlight.id,
          description: 'iOS/Android streaming client with offline downloads.',
          billingHour: 115, // project override of Starlight's $100 default
        },
        {
          name: 'Internal Tools',
          clientId: null, // standalone → invoiced into the "No client" bucket
          description: 'Self-directed tooling: invoicing, exports, maintenance.',
          billingHour: 95,
        },
      ])
      .returning({ id: projects.id, name: projects.name, clientId: projects.clientId });

    const projectByName = new Map(seededProjects.map((project) => [project.name, project]));

    const startDate = weekStart(todayIso());
    const days = weekDays(startDate);

    const [week] = await db
      .insert(weeks)
      .values({ startDate, status: 'open' })
      .returning({ id: weeks.id });
    if (!week) throw new Error('Seed failed: current week was not created');

    const recordValues = CURRENT_WEEK_RECORDS.map((record) => {
      const project = projectByName.get(record.projectName);
      const date = days[record.dayOffset];
      if (!project || !date) {
        throw new Error(`Seed failed: unknown project "${record.projectName}" or day ${record.dayOffset}`);
      }
      return {
        weekId: week.id,
        projectId: project.id,
        clientId: project.clientId,
        description: record.description,
        hours: record.hours,
        date,
      };
    });
    await db.insert(workRecords).values(recordValues);

    await db
      .insert(settings)
      .values({
        id: 1,
        displayName: 'Alex Morgan',
        weeklyTargetHours: 40,
        currencySymbol: '$',
        invoicePrefix: 'INV',
      })
      .onConflictDoNothing();

    const totalHours = CURRENT_WEEK_RECORDS.reduce((total, record) => total + record.hours, 0);
    console.log(
      `[seed] ${TRUNCATE_ORDER.length} tables rebuilt · 3 platforms · 2 clients · ` +
        `${seededProjects.length} projects · week ${startDate} (${totalHours}h) · settings ready`,
    );
  } finally {
    await pool.end();
  }
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isEntryPoint()) {
  runSeed().catch((error: unknown) => {
    console.error('[seed] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}