/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { ShareStore } from './shareStore.js';
import { logger } from '../utils/logger.js';

export type ShareRouterOptions = {
  store: ShareStore;
  token?: string;
  publicBaseUrl?: string;
};

function normalizeBaseUrl(raw: string): string {
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function isAuthorized(req: express.Request, token?: string): boolean {
  if (!token) return true;
  const authHeader = req.header('authorization') ?? '';
  return authHeader === `Bearer ${token}`;
}

export function createShareRouter(options: ShareRouterOptions): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));

  router.post('/api/v1/share', async (req, res) => {
    try {
      if (!isAuthorized(req, options.token)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const body = req.body as { payload?: Record<string, unknown>; sessionId?: string };
      const payload = body?.payload;

      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid payload.' });
      }

      const record = await options.store.create(payload, body?.sessionId);
      const publicBase = normalizeBaseUrl(
        options.publicBaseUrl ?? `${req.protocol}://${req.get('host')}`,
      );

      return res.status(201).json({
        id: record.id,
        url: `${publicBase}/s/${record.id}`,
        secret: record.secret,
      });
    } catch (error) {
      logger.error('[Share] Failed to create share link:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.delete('/api/v1/share/:id', async (req, res) => {
    const shareId = req.params.id;
    const secret =
      (req.header('x-papert-share-secret') ??
        (req.body as { secret?: string } | undefined)?.secret) ??
      '';

    if (!secret) {
      return res.status(400).json({ error: 'Share secret is required.' });
    }

    try {
      await options.store.remove(shareId, secret);
      return res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('not found') ? 404 : 403;
      return res.status(status).json({ error: message });
    }
  });

  router.get('/api/v1/share/:id', async (req, res) => {
    try {
      const record = await options.store.get(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Share not found.' });
      }
      const { secret: _secret, ...safeRecord } = record;
      return res.status(200).json(safeRecord);
    } catch (error) {
      logger.error('[Share] Failed to load share link:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  router.get('/s/:id', async (req, res) => {
    try {
      const record = await options.store.get(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Share not found.' });
      }
      const { secret: _secret, ...safeRecord } = record;
      return res.status(200).json(safeRecord);
    } catch (error) {
      logger.error('[Share] Failed to render share link:', error);
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
