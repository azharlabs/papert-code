/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MCPServerConfig } from '@papert-code/papert-code-core';

// Default MCP servers shipped as configuration only. Users can remove or override.
export const DEFAULT_MCP_SERVERS: Record<string, MCPServerConfig> = {
  'chrome-devtools': {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
    description: 'Chrome DevTools MCP server',
  },
};

export function getDefaultMcpServers(): Record<string, MCPServerConfig> {
  // Return a shallow copy so callers can safely mutate.
  return { ...DEFAULT_MCP_SERVERS };
}
