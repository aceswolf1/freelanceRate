/**
 * Routers for the invoice feature — mounted by worker-1 in `modules/index.ts`.
 *
 * Export names and mount points are fixed by the contract (§6):
 *   default                    → /api/invoices                 (GET /:id, /:id/pdf, /:id/email)
 *   weekInvoicesRouter         → /api/weeks/:weekId/invoices    (POST /, GET /, GET /zip)
 *   weekInvoicePreviewRouter   → /api/weeks/:weekId/invoice-preview (GET /)
 *
 * Endpoints: #28 POST /api/weeks/:id/invoices · #29 GET · #33 GET /zip
 *            #30 GET /api/weeks/:id/invoice-preview
 *            #31 GET /api/invoices/:id · #32 GET /:id/pdf · #34 GET /:id/email
 */
import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { createInvoicesController } from './invoices.controller.js';
import { InvoicesRepository } from './invoices.repository.js';
import { InvoicesService } from './invoices.service.js';

/**
 * Resolved lazily and memoised: importing this module must never open the
 * database pool (the test suite imports it before it sets anything up).
 */
let instance: InvoicesService | undefined;
function resolveService(): InvoicesService {
  instance ??= new InvoicesService(new InvoicesRepository(getDb()));
  return instance;
}

const controller = createInvoicesController(resolveService);

const router: Router = Router();
// `:weekId` is declared on the parent mount in `modules/index.ts`, so the
// week-scoped routers must merge params in to see it in `req.params`.
const weekInvoicesRouter: Router = Router({ mergeParams: true });
const weekInvoicePreviewRouter: Router = Router({ mergeParams: true });

router.get('/:id', controller.getById);
router.get('/:id/pdf', controller.pdf);
router.get('/:id/email', controller.email);

weekInvoicesRouter.post('/', controller.generate);
weekInvoicesRouter.get('/', controller.list);
// Registered before `/:id`-style paths would shadow it; `zip` is a literal segment.
weekInvoicesRouter.get('/zip', controller.zip);

weekInvoicePreviewRouter.get('/', controller.preview);

export { weekInvoicesRouter, weekInvoicePreviewRouter };
export default router;