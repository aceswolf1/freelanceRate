import { Router } from 'express';
import { PaymentPlatformsController } from './payment-platforms.controller.js';
import type { PaymentPlatformsService } from './payment-platforms.service.js';

export function createPaymentPlatformsRouter(service: PaymentPlatformsService): Router {
  const controller = new PaymentPlatformsController(service);
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}