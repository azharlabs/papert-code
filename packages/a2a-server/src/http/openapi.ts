/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export const REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION = '1.0.0';
export const REMOTE_CONTROL_OPENAPI_CONTRACT_ID =
  'papert-remote-control-v1';

export const REMOTE_CONTROL_OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Papert Code Remote Control API',
    version: REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION,
    description:
      'Stable control-plane contract for Papert Code server mode and SDK clients.',
  },
  'x-papert-contract-id': REMOTE_CONTROL_OPENAPI_CONTRACT_ID,
  servers: [{ url: '/' }],
  paths: {
    '/api/v1/health': {
      get: {
        operationId: 'remoteHealth',
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
        operationId: 'createRemoteSession',
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
        operationId: 'releaseRemoteSession',
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
    '/api/v1/share': {
      post: {
        operationId: 'createShare',
        summary: 'Create a share link',
        description:
          'Creates a share record from the provided payload. May require bearer token when share auth is configured.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payload: {
                    type: 'object',
                    additionalProperties: true,
                  },
                  sessionId: { type: 'string' },
                },
                required: ['payload'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Share created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    url: { type: 'string' },
                    secret: { type: 'string' },
                  },
                  required: ['id', 'url', 'secret'],
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/share/{id}': {
      get: {
        operationId: 'getShare',
        summary: 'Get share payload by id',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Share payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          '404': {
            description: 'Share not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      delete: {
        operationId: 'deleteShare',
        summary: 'Delete share by id and secret',
        description:
          'Deletes a share record. Secret may be provided via x-papert-share-secret header or JSON body.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'x-papert-share-secret',
            in: 'header',
            required: false,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  secret: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '204': { description: 'Deleted' },
          '400': {
            description: 'Missing or invalid secret',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '403': {
            description: 'Invalid share secret',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Share not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/webui/catalog': {
      get: {
        operationId: 'getWebUiCatalog',
        summary: 'Fetch Web UI catalog data',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Catalog payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tools: { type: 'array', items: { type: 'object' } },
                    agents: { type: 'array', items: { type: 'object' } },
                    skills: { type: 'array', items: { type: 'object' } },
                    mcps: { type: 'array', items: { type: 'object' } },
                    schedules: { type: 'array', items: { type: 'object' } },
                    rewindPoints: { type: 'array', items: { type: 'object' } },
                    releaseChannel: {
                      type: 'string',
                      enum: ['stable', 'preview', 'nightly'],
                    },
                    releaseChannelGate: {
                      type: 'object',
                      properties: {
                        current: {
                          type: 'string',
                          enum: ['stable', 'preview', 'nightly'],
                        },
                        nextPromotionTarget: {
                          oneOf: [
                            {
                              type: 'string',
                              enum: ['stable', 'preview', 'nightly'],
                            },
                            { type: 'null' },
                          ],
                        },
                        readyForPromotion: { type: 'boolean' },
                        requiredSoakMs: { type: 'number' },
                        soakElapsedMs: { type: 'number' },
                        soakRemainingMs: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/webui/state': {
      get: {
        operationId: 'getWebUiState',
        summary: 'Fetch persisted Web UI state',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Web UI state payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    state: {
                      oneOf: [{ type: 'object' }, { type: 'null' }],
                    },
                  },
                  required: ['state'],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      put: {
        operationId: 'updateWebUiState',
        summary: 'Persist Web UI state',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          '204': { description: 'Updated' },
          '400': {
            description: 'Invalid state payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/webui/release-channel': {
      put: {
        operationId: 'updateWebUiReleaseChannel',
        summary: 'Update release channel for the workspace',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  releaseChannel: {
                    type: 'string',
                    enum: ['stable', 'preview', 'nightly'],
                  },
                },
                required: ['releaseChannel'],
              },
            },
          },
        },
        responses: {
          '204': { description: 'Updated' },
          '400': {
            description: 'Invalid release channel or promotion gate blocked',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['error'],
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
} as const;
