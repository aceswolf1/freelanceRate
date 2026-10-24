import { getDb } from '../../db/client.js';
import { DrizzlePaymentPlatformRepository } from './payment-platforms.repository.js';
import { createPaymentPlatformsRouter } from './payment-platforms.routes.js';
import { PaymentPlatformsService } from './payment-platforms.service.js';

export const paymentPlatformsService = new PaymentPlatformsService(
  new DrizzlePaymentPlatformRepository(getDb()),
);

export { DrizzlePaymentPlatformRepository } from './payment-platforms.repository.js';
export { createPaymentPlatformsRouter } from './payment-platforms.routes.js';
export { PaymentPlatformsService } from './payment-platforms.service.js';
export type * from './payment-platforms.service.js';

export default createPaymentPlatformsRouter(paymentPlatformsService);