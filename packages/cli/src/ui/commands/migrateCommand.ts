/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { migrateGeminiEnvNames } from '../../commands/migrate.js';
import type { MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';

const USAGE = 'Usage: /migrate --from-gemini [--dry-run]';

function parseArgs(args: string): { dryRun: boolean; error?: string } {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { dryRun: false, error: USAGE };
  }

  let fromGemini = false;
  let dryRun = false;

  for (const token of tokens) {
    if (token === 'from-gemini' || token === '--from-gemini') {
      fromGemini = true;
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    return { dryRun: false, error: USAGE };
  }

  if (!fromGemini) {
    return { dryRun: false, error: USAGE };
  }

  return { dryRun };
}

function renderResult(result: ReturnType<typeof migrateGeminiEnvNames>): string {
  if (result.updatedFiles.length === 0) {
    return 'No legacy GEMINI_* env references found in migration targets.';
  }

  const cwd = process.cwd();
  const lines: string[] = [];
  for (const fileResult of result.updatedFiles) {
    const relativePath = path.relative(cwd, fileResult.filePath) || '.';
    const vars = fileResult.legacyVariables.join(', ');
    const prefix = result.dryRun ? '[dry-run] ' : '';
    lines.push(
      `${prefix}Updated ${relativePath} (${fileResult.replacements} replacements: ${vars})`,
    );
  }

  const summaryPrefix = result.dryRun ? '[dry-run] ' : '';
  lines.push(
    `${summaryPrefix}Migration complete. ${result.updatedFiles.length} file(s) updated, ${result.totalReplacements} replacement(s).`,
  );
  return lines.join('\n');
}

export const migrateCommand: SlashCommand = {
  name: 'migrate',
  description: 'Migrate legacy Gemini naming to Papert naming (meta command)',
  kind: CommandKind.BUILT_IN,
  action: async (_context, args): Promise<MessageActionReturn> => {
    const parsed = parseArgs(args);
    if (parsed.error) {
      return {
        type: 'message',
        messageType: 'error',
        content: parsed.error,
      };
    }

    const result = migrateGeminiEnvNames(process.cwd(), {
      dryRun: parsed.dryRun,
    });

    return {
      type: 'message',
      messageType: 'info',
      content: renderResult(result),
    };
  },
  completion: async (_context, partialArg) => {
    const query = partialArg.trim();
    const candidates = [
      '--from-gemini',
      '--from-gemini --dry-run',
      'from-gemini',
      'from-gemini --dry-run',
      '--dry-run',
    ];
    if (!query) {
      return candidates;
    }
    return candidates.filter((candidate) => candidate.startsWith(query));
  },
};

