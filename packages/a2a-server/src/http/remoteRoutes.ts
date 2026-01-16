/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { RemoteAuthConfig, RemoteSessionStore } from './remoteAuth.js';
import { parseBearerToken } from './remoteAuth.js';

export const REMOTE_SESSION_ID_HEADER = 'x-papert-session-id';

export function createRemoteRouter(options: {
  auth: RemoteAuthConfig;
  sessions: RemoteSessionStore;
  workspaceRoot: string;
}): express.Router {
  const { auth, sessions, workspaceRoot } = options;

  const router = express.Router();
  router.use(express.json());

  router.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.post('/api/v1/sessions', (req, res) => {
    if (!auth.enabled) {
      return res.status(501).json({ error: 'Remote driving is disabled.' });
    }

    const serverToken = auth.serverToken;
    if (serverToken) {
      const bearer = parseBearerToken(req.header('authorization'));
      if (!bearer || bearer !== serverToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const { session, token } = sessions.createSession(workspaceRoot);
    const acquired = sessions.acquireWorkspaceLock(session.id, workspaceRoot);
    if (!acquired) {
      sessions.releaseSession(session.id);
      return res.status(409).json({
        error: 'Workspace is already in use by another client.',
        code: 'WORKSPACE_LOCKED',
      });
    }

    return res.status(201).json({
      sessionId: session.id,
      token,
      expiresAtMs: session.expiresAtMs,
      workspaceRoot: session.workspaceRoot,
    });
  });

  router.post('/api/v1/sessions/:sessionId/release', (req, res) => {
    if (!auth.enabled) {
      return res.status(501).json({ error: 'Remote driving is disabled.' });
    }

    const sessionId = req.params.sessionId;
    const bearer = parseBearerToken(req.header('authorization'));
    if (!bearer || !sessions.validateSessionToken(sessionId, bearer)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    sessions.releaseSession(sessionId);
    return res.status(204).end();
  });

  return router;
}

export function createRemoteAuthMiddleware(options: {
  auth: RemoteAuthConfig;
  sessions: RemoteSessionStore;
  workspaceRoot: string;
}): express.RequestHandler {
  const { auth, sessions, workspaceRoot } = options;

  return (req, res, next) => {
    if (!auth.enabled) {
      return next();
    }

    // Allow unauthenticated access to health + session creation.
    if (
      req.method === 'GET' &&
      (req.path === '/api/v1/health' || req.path === '/.well-known/agent-card.json')
    ) {
      return next();
    }
    if (req.method === 'POST' && req.path === '/api/v1/sessions') {
      return next();
    }

    const sessionId = req.header(REMOTE_SESSION_ID_HEADER);
    const bearer = parseBearerToken(req.header('authorization'));

    if (!sessionId || !bearer) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!sessions.validateSessionToken(sessionId, bearer)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = sessions.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Enforce exclusive workspace lock for all non-control-plane requests.
    if (!sessions.hasWorkspaceLock(sessionId, workspaceRoot)) {
      return res.status(409).json({
        error: 'Workspace is already in use by another client.',
        code: 'WORKSPACE_LOCKED',
      });
    }

    sessions.touchSession(sessionId);
    return next();
  };
}
