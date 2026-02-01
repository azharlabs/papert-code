/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import {
  getAdminErrorMessage,
  type Config,
} from '@papert-code/papert-code-core';
import { runExitCleanup } from './utils/cleanup.js';
import process from 'node:process';

export interface DeferredCommand {
  handler: (argv: ArgumentsCamelCase) => void | Promise<void>;
  argv: ArgumentsCamelCase;
  commandName: string;
}

let deferredCommand: DeferredCommand | undefined;

export function setDeferredCommand(command: DeferredCommand | undefined) {
  deferredCommand = command;
}

export function hasDeferredCommand(): boolean {
  return Boolean(deferredCommand);
}

function isFeatureDisabled(
  adminSettings: Record<string, unknown> | undefined,
  feature: 'mcp' | 'extensions' | 'skills',
): boolean {
  if (!adminSettings) {
    return false;
  }
  const entry = adminSettings[feature];
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  return (entry as { enabled?: boolean }).enabled === false;
}

export async function runDeferredCommand(config: Config) {
  if (!deferredCommand) {
    return;
  }

  const adminSettings = config.getRemoteAdminSettings?.() as
    | Record<string, unknown>
    | undefined;
  const commandName = deferredCommand.commandName;

  if (commandName === 'mcp' && isFeatureDisabled(adminSettings, 'mcp')) {
    console.error(getAdminErrorMessage('MCP', config));
    await runExitCleanup();
    process.exit(1);
  }

  if (
    commandName === 'extensions' &&
    isFeatureDisabled(adminSettings, 'extensions')
  ) {
    console.error(getAdminErrorMessage('Extensions', config));
    await runExitCleanup();
    process.exit(1);
  }

  if (commandName === 'skills' && isFeatureDisabled(adminSettings, 'skills')) {
    console.error(getAdminErrorMessage('Agent skills', config));
    await runExitCleanup();
    process.exit(1);
  }

  await deferredCommand.handler(deferredCommand.argv);
  await runExitCleanup();
  process.exit(0);
}

/**
 * Wraps a command's handler to defer its execution.
 * It stores the handler and arguments in a singleton `deferredCommand` variable.
 */
export function defer<T = object, U = object>(
  commandModule: CommandModule<T, U>,
  parentCommandName?: string,
): CommandModule<T, U> {
  return {
    ...commandModule,
    handler: (argv: ArgumentsCamelCase<U>) => {
      setDeferredCommand({
        handler: commandModule.handler as (
          argv: ArgumentsCamelCase,
        ) => void | Promise<void>,
        argv: argv as unknown as ArgumentsCamelCase,
        commandName: parentCommandName || 'unknown',
      });
    },
  };
}
