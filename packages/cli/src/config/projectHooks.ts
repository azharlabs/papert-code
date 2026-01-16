/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HookDefinition, HookEventName } from '@papert-code/papert-code-core';
import { debugLogger } from '@papert-code/papert-code-core';
import stripJsonComments from 'strip-json-comments';

export type ProjectHooksConfig = { [K in HookEventName]?: HookDefinition[] } & {
  disabled?: string[];
};

export function loadProjectHooksFromHooksJson(
  cwd: string,
): ProjectHooksConfig | undefined {
  const hooksJsonPath = path.join(cwd, 'hooks', 'hooks.json');

  if (!fs.existsSync(hooksJsonPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(hooksJsonPath, 'utf-8');
    const parsed = JSON.parse(stripJsonComments(content)) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      debugLogger.warn(
        `Invalid hooks file (expected object): ${hooksJsonPath}. Ignoring.`,
      );
      return undefined;
    }

    // Claude-style hooks.json uses a top-level { hooks: { ... } } wrapper.
    // Support both wrapped and unwrapped formats.
    const maybeWrapped = parsed as { hooks?: unknown };
    const hooks =
      maybeWrapped.hooks && typeof maybeWrapped.hooks === 'object'
        ? (maybeWrapped.hooks as unknown)
        : parsed;

    return hooks as ProjectHooksConfig;
  } catch (error) {
    debugLogger.warn(`Failed to read hooks file: ${hooksJsonPath}`, error);
    return undefined;
  }
}
