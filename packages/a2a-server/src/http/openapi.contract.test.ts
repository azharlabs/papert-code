/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  REMOTE_CONTROL_OPENAPI_CONTRACT_ID,
  REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION,
  REMOTE_CONTROL_OPENAPI_SPEC,
} from './openapi.js';

type RouteContract = {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete';
  requiresBearerAuth: boolean;
  expectedStatuses: string[];
};

const ROUTE_CONTRACTS: RouteContract[] = [
  {
    path: '/api/v1/health',
    method: 'get',
    requiresBearerAuth: false,
    expectedStatuses: ['200'],
  },
  {
    path: '/api/v1/sessions',
    method: 'post',
    requiresBearerAuth: true,
    expectedStatuses: ['201', '401', '409', '501'],
  },
  {
    path: '/api/v1/sessions/{sessionId}/release',
    method: 'post',
    requiresBearerAuth: true,
    expectedStatuses: ['204', '401', '501'],
  },
  {
    path: '/api/v1/share',
    method: 'post',
    requiresBearerAuth: false,
    expectedStatuses: ['201', '400', '401'],
  },
  {
    path: '/api/v1/share/{id}',
    method: 'get',
    requiresBearerAuth: false,
    expectedStatuses: ['200', '404', '500'],
  },
  {
    path: '/api/v1/share/{id}',
    method: 'delete',
    requiresBearerAuth: false,
    expectedStatuses: ['204', '400', '403', '404'],
  },
  {
    path: '/api/v1/webui/catalog',
    method: 'get',
    requiresBearerAuth: true,
    expectedStatuses: ['200', '401'],
  },
  {
    path: '/api/v1/webui/state',
    method: 'get',
    requiresBearerAuth: true,
    expectedStatuses: ['200', '401'],
  },
  {
    path: '/api/v1/webui/state',
    method: 'put',
    requiresBearerAuth: true,
    expectedStatuses: ['204', '400', '401'],
  },
];

describe('OpenAPI route contract', () => {
  it('pins contract identity/version for SDK client generation', () => {
    expect(REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION).toBe('1.0.0');
    expect(REMOTE_CONTROL_OPENAPI_SPEC.info.version).toBe(
      REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION,
    );
    expect(REMOTE_CONTROL_OPENAPI_SPEC['x-papert-contract-id']).toBe(
      REMOTE_CONTROL_OPENAPI_CONTRACT_ID,
    );
  });

  it('documents all remote-control routes with expected methods and statuses', () => {
    for (const route of ROUTE_CONTRACTS) {
      const pathItem = REMOTE_CONTROL_OPENAPI_SPEC.paths[route.path];
      expect(pathItem).toBeTruthy();

      const operation = pathItem?.[route.method];
      expect(operation).toBeTruthy();

      for (const status of route.expectedStatuses) {
        expect(operation?.responses?.[status]).toBeTruthy();
      }

      if (route.requiresBearerAuth) {
        expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      } else {
        expect(operation?.security).toBeUndefined();
      }
    }
  });

  it('assigns stable operation ids to documented operations', () => {
    const operationIds = Object.values(REMOTE_CONTROL_OPENAPI_SPEC.paths)
      .flatMap((pathItem) => Object.values(pathItem))
      .map((operation) => operation.operationId)
      .filter((operationId): operationId is string => !!operationId);
    expect(operationIds.length).toBeGreaterThan(0);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('documents session creation response payload contract', () => {
    const schema = REMOTE_CONTROL_OPENAPI_SPEC.paths['/api/v1/sessions'].post.responses['201'].content['application/json'].schema;
    expect(schema.required).toEqual([
      'sessionId',
      'token',
      'expiresAtMs',
      'workspaceRoot',
    ]);
  });

  it('documents release channel endpoint with auth error schema', () => {
    const operation =
      REMOTE_CONTROL_OPENAPI_SPEC.paths['/api/v1/webui/release-channel'].put;
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.responses['400']).toBeTruthy();
    expect(operation.responses['401']).toBeTruthy();
    expect(
      operation.responses['401'].content?.['application/json'].schema,
    ).toEqual({ $ref: '#/components/schemas/ErrorResponse' });
  });
});
