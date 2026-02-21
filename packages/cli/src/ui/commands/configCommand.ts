/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildConfigExplainEntries } from '../../commands/config.js';
import type { MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';

const USAGE = 'Usage: /config explain [key] [--json]';

type LoadedSettingsLike = Parameters<typeof buildConfigExplainEntries>[0];

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value);
}

function buildExplainReport(
  loadedSettings: LoadedSettingsLike,
  entries: ReturnType<typeof buildConfigExplainEntries>,
  keyFilter?: string,
): string {
  const lines = [
    'Effective configuration report',
    'Precedence: system-defaults < user < workspace < system (last contributor wins)',
    `Workspace trusted: ${loadedSettings.isTrusted ? 'yes' : 'no'}`,
  ];

  if (keyFilter) {
    lines.push(`Filter: ${keyFilter}`);
  }
  lines.push('');

  if (entries.length === 0) {
    lines.push('No configuration keys matched the requested filter.');
    return lines.join('\n');
  }

  for (const entry of entries) {
    lines.push(`- ${entry.key}`);
    lines.push(`  source: ${entry.source}`);
    lines.push(`  effective: ${formatValue(entry.effectiveValue)}`);
    lines.push(
      `  contributors: ${
        entry.contributors.length > 0 ? entry.contributors.join(', ') : 'none'
      }`,
    );
  }

  return lines.join('\n');
}

function parseArgs(args: string): {
  keyFilter?: string;
  asJson: boolean;
  error?: string;
} {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0] !== 'explain') {
    return { asJson: false, error: USAGE };
  }

  const nonFlagTokens: string[] = [];
  let asJson = false;
  for (const token of tokens.slice(1)) {
    if (token === '--json') {
      asJson = true;
      continue;
    }
    nonFlagTokens.push(token);
  }

  if (nonFlagTokens.length > 1) {
    return { asJson: false, error: USAGE };
  }

  return {
    keyFilter: nonFlagTokens[0],
    asJson,
  };
}

export const configCommand: SlashCommand = {
  name: 'config',
  description: 'Inspect effective config and precedence (meta command)',
  kind: CommandKind.BUILT_IN,
  action: async (context, args): Promise<MessageActionReturn> => {
    const parsed = parseArgs(args);
    if (parsed.error) {
      return {
        type: 'message',
        messageType: 'error',
        content: parsed.error,
      };
    }

    const loadedSettings =
      context.services.settings as unknown as LoadedSettingsLike;
    const entries = buildConfigExplainEntries(loadedSettings, parsed.keyFilter);

    if (parsed.asJson) {
      return {
        type: 'message',
        messageType: 'info',
        content: JSON.stringify(
          {
            trustedWorkspace: loadedSettings.isTrusted,
            keyFilter: parsed.keyFilter ?? null,
            entries,
          },
          null,
          2,
        ),
      };
    }

    return {
      type: 'message',
      messageType: 'info',
      content: buildExplainReport(loadedSettings, entries, parsed.keyFilter),
    };
  },
  completion: async (_context, partialArg) => {
    const query = partialArg.trim();
    const candidates = ['explain', 'explain --json'];
    if (!query) {
      return candidates;
    }
    return candidates.filter((candidate) => candidate.startsWith(query));
  },
};

