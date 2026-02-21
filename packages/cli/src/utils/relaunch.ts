/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import { RELAUNCH_EXIT_CODE } from './processUtils.js';
import { resolveEnvAlias } from './envAliases.js';

export async function relaunchOnExitCode(runner: () => Promise<number>) {
  while (true) {
    try {
      const exitCode = await runner();

      if (exitCode !== RELAUNCH_EXIT_CODE) {
        process.exit(exitCode);
      }
    } catch (error) {
      process.stdin.resume();
      console.error('Fatal error: Failed to relaunch the CLI process.', error);
      process.exit(1);
    }
  }
}

export async function relaunchAppInChildProcess(
  additionalNodeArgs: string[],
  additionalScriptArgs: string[],
) {
  if (resolveEnvAlias('PAPERT_CLI_NO_RELAUNCH', 'GEMINI_CLI_NO_RELAUNCH')) {
    return;
  }

  const runner = () => {
    // process.argv is [node, script, ...args]
    // We want to construct [ ...nodeArgs, script, ...scriptArgs]
    const script = process.argv[1];
    const scriptArgs = process.argv.slice(2);

    const nodeArgs = [
      ...process.execArgv,
      ...additionalNodeArgs,
      script,
      ...additionalScriptArgs,
      ...scriptArgs,
    ];
    const newEnv = {
      ...process.env,
      PAPERT_CLI_NO_RELAUNCH: 'true',
      GEMINI_CLI_NO_RELAUNCH: 'true',
    };

    // The parent process should not be reading from stdin while the child is running.
    process.stdin.pause();

    const child = spawn(process.execPath, nodeArgs, {
      stdio: 'inherit',
      env: newEnv,
    });

    return new Promise<number>((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => {
        // Resume stdin before the parent process exits.
        process.stdin.resume();
        resolve(code ?? 1);
      });
    });
  };

  await relaunchOnExitCode(runner);
}
