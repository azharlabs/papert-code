/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export const REMOTE_CONTROL_OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Papert Code Remote Control API',
    version: '0.1.0',
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                  },
                  required: ['status'],
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/sessions': {
      post: {
        summary: 'Create remote session',
        description:
          'Creates a remote session and acquires an exclusive workspace lock. Requires server token when configured.',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': {
            description: 'Session created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string' },
                    token: { type: 'string' },
                    expiresAtMs: { type: 'number' },
                    workspaceRoot: { type: 'string' },
                  },
                  required: ['sessionId', 'token', 'expiresAtMs', 'workspaceRoot'],
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
          '409': { description: 'Workspace locked' },
          '501': { description: 'Remote driving disabled' },
        },
      },
    },
    '/api/v1/sessions/{sessionId}/release': {
      post: {
        summary: 'Release remote session',
        description: 'Releases the session and frees the workspace lock.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': { description: 'Released' },
          '401': { description: 'Unauthorized' },
          '501': { description: 'Remote driving disabled' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
} as const;
