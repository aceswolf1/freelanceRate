/**
 * HTTP layer for the invoice endpoints (contract §4.1–§4.7).
 *
 * Controllers only: parse params with Zod, delegate to the service, and shape
 * the response. Every failure leaves as a standard envelope via the app's error
 * middleware — nothing is caught here except the zip stream, which must report
 * mid-flight errors to Express.
 */
import { ZipArchive } from 'archiver';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { asyncHandler, ok, validateParams } from '../../lib/http.js';
import { invoiceFileName, renderInvoicePdf } from '../../lib/pdf/invoice-pdf.js';
import { idParamSchema, weekParamSchema } from './invoices.schemas.js';
import type { InvoicesService } from './invoices.service.js';

function attachHeaders(res: Response, contentType: string, fileName: string): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
}

/**
 * `resolveService` is a factory rather than an instance so the router module can
 * defer opening the database pool until the first request (and tests can inject
 * a fake service without a database).
 */
export function createInvoicesController(resolveService: () => InvoicesService) {
  const generate: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { weekId } = validateParams(weekParamSchema, req);
    const { invoices, created } = await resolveService().generate(weekId);
    // 201 on the first run, 200 when the week was already invoiced (idempotent).
    res.status(created ? 201 : 200).json(ok(invoices));
  });

  const list: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { weekId } = validateParams(weekParamSchema, req);
    res.json(ok(await resolveService().listByWeek(weekId)));
  });

  const preview: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { weekId } = validateParams(weekParamSchema, req);
    res.json(ok(await resolveService().preview(weekId)));
  });

  const getById: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamSchema, req);
    res.json(ok(await resolveService().getById(id)));
  });

  const email: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamSchema, req);
    res.json(ok(await resolveService().buildEmailDraftFor(id)));
  });

  const pdf: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validateParams(idParamSchema, req);
    const invoice = await resolveService().getById(id);
    const buffer = await renderInvoicePdf({ invoice, senderName: await resolveService().senderName() });

    attachHeaders(res, 'application/pdf', invoiceFileName(invoice));
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  });

  const zip: RequestHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { weekId } = validateParams(weekParamSchema, req);
    const { invoices, senderName, fileName } = await resolveService().prepareWeekArchive(weekId);

    attachHeaders(res, 'application/zip', fileName);
    // archiver 8 dropped the `archiver()` factory; `ZipArchive` is the class.
    const archive = new ZipArchive({ zlib: { level: 9 } });
    // The stream has already started here, so failures must go to Express
    // rather than back through the JSON error envelope.
    archive.on('warning', (warning: Error) => next(warning));
    archive.on('error', (error: Error) => next(error));
    archive.pipe(res);

    for (const invoice of invoices) {
      const buffer = await renderInvoicePdf({ invoice, senderName });
      archive.append(buffer, { name: invoiceFileName(invoice) });
    }

    await archive.finalize();
  });

  return { generate, list, preview, getById, email, pdf, zip };
}