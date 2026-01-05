/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefinition } from './types.js';

export interface AgentLoadError {
  filePath: string;
  message: string;
}

export interface AgentLoadResult {
  agents: AgentDefinition[];
  errors: AgentLoadError[];
}

/**
 * Placeholder loader for agent definitions stored in TOML.
 * Upstream implementation parses on-disk files; here we simply return an
 * empty collection to preserve the API surface.
 */
export async function loadAgentsFromToml(
  _directories: string[],
): Promise<AgentLoadResult> {
  return { agents: [], errors: [] };
}
