/**
 * @license
 * Copyright 2025 Papert Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import type { IControlContext } from './ControlContext.js';
import { ControlService } from './ControlService.js';

function createMockDispatcher() {
  return {
    permissionController: {
      buildPermissionSuggestions: vi.fn().mockReturnValue([]),
      getToolCallUpdateCallback: vi.fn().mockReturnValue(() => {}),
    },
    systemController: {
      buildControlCapabilities: vi.fn().mockReturnValue({
        can_handle_mcp_message: true,
      }),
    },
    mcpController: {
      getMcpClient: vi.fn(),
      listServerNames: vi.fn().mockReturnValue(['sdk-server', 'cli-server']),
    },
    schedulerController: {
      sendControlRequest: vi.fn(),
    },
    shutdown: vi.fn(),
  };
}

describe('ControlService', () => {
  it('delegates MCP getMcpClient through mcp service API', async () => {
    const dispatcher = createMockDispatcher();
    const expected = {
      client: { close: vi.fn() },
      config: { command: 'node', args: ['server.js'] },
    };
    dispatcher.mcpController.getMcpClient.mockResolvedValue(expected);

    const service = new ControlService(
      {} as IControlContext,
      dispatcher as unknown as ConstructorParameters<typeof ControlService>[1],
    );

    const result = await service.mcp.getMcpClient('sdk-server');
    expect(dispatcher.mcpController.getMcpClient).toHaveBeenCalledWith(
      'sdk-server',
    );
    expect(result).toBe(expected);
  });

  it('delegates MCP listServers through mcp service API', () => {
    const dispatcher = createMockDispatcher();
    const service = new ControlService(
      {} as IControlContext,
      dispatcher as unknown as ConstructorParameters<typeof ControlService>[1],
    );

    const servers = service.mcp.listServers();
    expect(dispatcher.mcpController.listServerNames).toHaveBeenCalled();
    expect(servers).toEqual(['sdk-server', 'cli-server']);
  });

  it('cleanup delegates to dispatcher shutdown', () => {
    const dispatcher = createMockDispatcher();
    const service = new ControlService(
      {} as IControlContext,
      dispatcher as unknown as ConstructorParameters<typeof ControlService>[1],
    );

    service.cleanup();
    expect(dispatcher.shutdown).toHaveBeenCalledTimes(1);
  });
});
