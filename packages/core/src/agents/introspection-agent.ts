/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefinition } from './types.js';

/**
 * Basic introspection agent definition placeholder.
 */
export const IntrospectionAgent: AgentDefinition = {
  name: 'introspection_agent',
  description: 'Provides a summary of the current task and known context.',
  instructions:
    'Review the current task and summarize next steps. This is a placeholder agent.',
};
