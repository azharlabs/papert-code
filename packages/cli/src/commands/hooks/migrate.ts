/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { debugLogger, getErrorMessage } from '@papert-code/papert-code-core';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { runExitCleanup } from '../../utils/cleanup.js';
import stripJsonComments from 'strip-json-comments';

interface MigrateArgs {
  fromClaude: boolean;
}

const EVENT_MAPPING: Record<string, string> = {
  PreToolUse: 'BeforeTool',
  PostToolUse: 'AfterTool',
  UserPromptSubmit: 'BeforeAgent',
  Stop: 'AfterAgent',
  SubAgentStop: 'AfterAgent',
  SessionStart: 'SessionStart',
  SessionEnd: 'SessionEnd',
  PreCompact: 'PreCompress',
  Notification: 'Notification',
};

const TOOL_NAME_MAPPING: Record<string, string> = {
  Edit: 'replace',
  Bash: 'run_shell_command',
  Read: 'read_file',
  Write: 'write_file',
  Glob: 'glob',
  Grep: 'grep',
  LS: 'ls',
};

function transformMatcher(matcher: string | undefined): string | undefined {
  if (!matcher) return matcher;

  let transformed = matcher;
  for (const [claudeName, geminiName] of Object.entries(TOOL_NAME_MAPPING)) {
    transformed = transformed.replace(
      new RegExp(`\\b${claudeName}\\b`, 'g'),
      geminiName,
    );
  }

  return transformed;
}

function migrateClaudeHook(claudeHook: unknown): unknown {
  if (!claudeHook || typeof claudeHook !== 'object') {
    return claudeHook;
  }

  const hook = claudeHook as Record<string, unknown>;
  const migrated: Record<string, unknown> = {};

  if ('command' in hook) {
    migrated['command'] = hook['command'];

    if (typeof migrated['command'] === 'string') {
      migrated['command'] = migrated['command'].replace(
        /\$CLAUDE_PROJECT_DIR/g,
        '$GEMINI_PROJECT_DIR',
      );
    }
  }

  if ('type' in hook && hook['type'] === 'command') {
    migrated['type'] = 'command';
  }

  if ('timeout' in hook && typeof hook['timeout'] === 'number') {
    migrated['timeout'] = hook['timeout'];
  }

  return migrated;
}

function migrateClaudeHooks(claudeConfig: unknown): Record<string, unknown> {
  if (!claudeConfig || typeof claudeConfig !== 'object') {
    return {};
  }

  const config = claudeConfig as Record<string, unknown>;
  const papertHooks: Record<string, unknown> = {};

  const hooksSection = config['hooks'] as Record<string, unknown> | undefined;
  if (!hooksSection || typeof hooksSection !== 'object') {
    return {};
  }

  for (const [eventName, eventConfig] of Object.entries(hooksSection)) {
    const papertEventName = EVENT_MAPPING[eventName] || eventName;

    if (!Array.isArray(eventConfig)) {
      continue;
    }

    const migratedDefinitions = eventConfig.map((def: unknown) => {
      if (!def || typeof def !== 'object') {
        return def;
      }

      const definition = def as Record<string, unknown>;
      const migratedDef: Record<string, unknown> = {};

      if (
        'matcher' in definition &&
        typeof definition['matcher'] === 'string'
      ) {
        migratedDef['matcher'] = transformMatcher(definition['matcher']);
      }

      if ('sequential' in definition) {
        migratedDef['sequential'] = definition['sequential'];
      }

      if ('hooks' in definition && Array.isArray(definition['hooks'])) {
        migratedDef['hooks'] = definition['hooks'].map(migrateClaudeHook);
      }

      return migratedDef;
    });

    papertHooks[papertEventName] = migratedDefinitions;
  }

  return papertHooks;
}

export async function handleMigrateFromClaude() {
  const workingDir = process.cwd();

  const claudeDir = path.join(workingDir, '.claude');
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');
  const claudeLocalSettingsPath = path.join(claudeDir, 'settings.local.json');

  let claudeSettings: Record<string, unknown> | null = null;
  let sourceFile = '';

  if (fs.existsSync(claudeLocalSettingsPath)) {
    sourceFile = claudeLocalSettingsPath;
    try {
      const content = fs.readFileSync(claudeLocalSettingsPath, 'utf-8');
      claudeSettings = JSON.parse(stripJsonComments(content)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      debugLogger.error(
        `Error reading ${claudeLocalSettingsPath}: ${getErrorMessage(error)}`,
      );
    }
  } else if (fs.existsSync(claudeSettingsPath)) {
    sourceFile = claudeSettingsPath;
    try {
      const content = fs.readFileSync(claudeSettingsPath, 'utf-8');
      claudeSettings = JSON.parse(stripJsonComments(content)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      debugLogger.error(
        `Error reading ${claudeSettingsPath}: ${getErrorMessage(error)}`,
      );
    }
  } else {
    debugLogger.error(
      'No Claude Code settings found in .claude directory. Expected settings.json or settings.local.json',
    );
    return;
  }

  if (!claudeSettings) {
    return;
  }

  debugLogger.log(`Found Claude Code settings in: ${sourceFile}`);

  const migratedHooks = migrateClaudeHooks(claudeSettings);

  if (Object.keys(migratedHooks).length === 0) {
    debugLogger.log('No hooks found in Claude Code settings to migrate.');
    return;
  }

  debugLogger.log(
    `Migrating ${Object.keys(migratedHooks).length} hook event(s)...`,
  );

  const settings = loadSettings(workingDir);

  const existingHooks =
    (settings.merged.hooks as Record<string, unknown>) || {};
  const mergedHooks = { ...existingHooks, ...migratedHooks };

  try {
    settings.setValue(SettingScope.Workspace, 'hooks', mergedHooks);

    debugLogger.log('✓ Hooks successfully migrated to .papert/settings.json');
    debugLogger.log(
      '\nMigration complete! Please review the migrated hooks in .papert/settings.json',
    );
    debugLogger.log(
      'Note: Set tools.enableHooks to true in your settings to enable the hook system.',
    );
  } catch (error) {
    debugLogger.error(`Error saving migrated hooks: ${getErrorMessage(error)}`);
  }
}

export const migrateCommand: CommandModule = {
  command: 'migrate',
  describe: 'Migrate hooks from Claude Code to Papert Code',
  builder: (yargs) =>
    yargs.option('from-claude', {
      describe: 'Migrate from Claude Code hooks',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    const args = argv as unknown as MigrateArgs;
    if (args.fromClaude) {
      await handleMigrateFromClaude();
    } else {
      debugLogger.log(
        'Usage: papert hooks migrate --from-claude\n\nMigrate hooks from Claude Code to Papert Code format.',
      );
    }
    await runExitCleanup();
    process.exit(0);
  },
};
