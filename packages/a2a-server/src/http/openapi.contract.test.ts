/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { REMOTE_CONTROL_OPENAPI_SPEC } from './openapi.js';

type RouteContract = {
  path: string;
  method: 'get' | 'post';
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
];

describe('OpenAPI route contract', () => {
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

  it('documents session creation response payload contract', () => {
    const schema = REMOTE_CONTROL_OPENAPI_SPEC.paths['/api/v1/sessions'].post.responses['201'].content['application/json'].schema;
    expect(schema.required).toEqual([
      'sessionId',
      'token',
      'expiresAtMs',
      'workspaceRoot',
    ]);
  });
});
