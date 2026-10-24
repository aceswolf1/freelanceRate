import { Router } from 'express';
import { SettingsController } from './settings.controller.js';
import type { SettingsService } from './settings.service.js';

export function createSettingsRouter(service: SettingsService): Router {
  const controller = new SettingsController(service);
  const router = Router();

  router.get('/', controller.get);
  router.put('/', controller.update);

  return router;
}