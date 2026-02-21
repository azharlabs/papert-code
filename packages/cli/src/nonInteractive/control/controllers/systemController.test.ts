/**
 * @license
 * Copyright 2025 Papert Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import type { IControlContext } from '../ControlContext.js';
import type { IPendingRequestRegistry } from './baseController.js';
import { SystemController } from './systemController.js';

function createRegistry(): IPendingRequestRegistry {
  return {
    registerIncomingRequest: vi.fn(),
    deregisterIncomingRequest: vi.fn(),
    registerOutgoingRequest: vi.fn(),
    deregisterOutgoingRequest: vi.fn(),
  };
}

function createContext(overrides?: Partial<IControlContext>): IControlContext {
  const abortController = new AbortController();
  const base: IControlContext = {
    config: {
      setApprovalMode: vi.fn(),
      setModel: vi.fn(),
      setSdkMode: vi.fn(),
      addMcpServers: vi.fn(),
      setSessionSubagents: vi.fn(),
    } as unknown as IControlContext['config'],
    streamJson: { send: vi.fn() } as unknown as IControlContext['streamJson'],
    sessionId: 'test-session',
    abortSignal: abortController.signal,
    debugMode: false,
    permissionMode: 'default',
    sdkMcpServers: new Set(),
    mcpClients: new Map(),
  };
  return { ...base, ...overrides };
}

describe('SystemController', () => {
  it('buildControlCapabilities enables MCP handling', () => {
    const controller = new SystemController(
      createContext(),
      createRegistry(),
      'SystemController',
    );

    expect(controller.buildControlCapabilities()).toMatchObject({
      can_handle_can_use_tool: true,
      can_handle_hook_callback: false,
      can_set_permission_mode: true,
      can_set_model: true,
      can_handle_mcp_message: true,
    });
  });

  it('buildControlCapabilities reflects config mutability checks', () => {
    const controller = new SystemController(
      createContext({
        config: {} as IControlContext['config'],
      }),
      createRegistry(),
      'SystemController',
    );

    expect(controller.buildControlCapabilities()).toMatchObject({
      can_set_permission_mode: false,
      can_set_model: false,
      can_handle_mcp_message: true,
    });
  });
});
