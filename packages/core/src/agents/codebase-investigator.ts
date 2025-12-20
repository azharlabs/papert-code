/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AgentDefinition } from './types.js';

export const CodebaseInvestigatorAgent: AgentDefinition = {
  name: 'codebase_investigator',
  description: 'Examines the repository and summarizes findings (placeholder).',
  instructions:
    'Inspect the codebase structure and provide a concise summary of noteworthy areas.',
  modelConfig: {
    model: 'gemini-pro',
  },
  runConfig: {
    max_time_minutes: 2,
    max_turns: 4,
  },
};
