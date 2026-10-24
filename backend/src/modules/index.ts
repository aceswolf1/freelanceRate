import { Router } from 'express';
import clientsRouter from './clients/index.js';
import invoicesRouter, {
  weekInvoicePreviewRouter,
  weekInvoicesRouter,
} from './invoices/index.js';
import paymentPlatformsRouter from './payment-platforms/index.js';
import projectsRouter from './projects/index.js';
import { recordsRouter, weekRecordsRouter } from './records/index.js';
import reportsRouter from './reports/index.js';
import settingsRouter from './settings/index.js';
import weeksRouter from './weeks/index.js';

/** Everything under `/api`. `invoices` and `reports` are worker-3's stubs for now. */
export const apiRouter: Router = Router();

apiRouter.use('/payment-platforms', paymentPlatformsRouter);
apiRouter.use('/clients', clientsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/weeks', weeksRouter);
// Creating a record hangs off its week — the week is what locks the write.
apiRouter.use('/weeks/:weekId/records', weekRecordsRouter);
apiRouter.use('/records', recordsRouter);

// Week-scoped invoice endpoints live in worker-3's folder but hang off /weeks.
// Mounted here so `POST /api/weeks/:id/invoices` and friends keep their
// documented paths while worker-3 edits only `modules/invoices/**`.
apiRouter.use('/weeks/:weekId/invoices', weekInvoicesRouter);
apiRouter.use('/weeks/:weekId/invoice-preview', weekInvoicePreviewRouter);
apiRouter.use('/invoices', invoicesRouter);
apiRouter.use('/reports', reportsRouter);

export default apiRouter;