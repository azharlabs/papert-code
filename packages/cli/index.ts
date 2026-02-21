#!/usr/bin/env node

/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

function isServerCommand(argv: string[]): boolean {
  // Support: `papert server ...`, `papert serve ...`, and dist variants.
  return argv.includes('server') || argv.includes('serve');
}

function isFatalErrorLike(
  error: unknown,
): error is { message: string; exitCode: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'exitCode' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    typeof (error as { exitCode: unknown }).exitCode === 'number'
  );
}

async function mainEntrypoint() {
  // The `server` command is a non-interactive daemon runner. Avoid initializing
  // the interactive Gemini UI (which enables TTY raw mode) to prevent crashes
  // in environments where stdin isn't a proper TTY.
  if (isServerCommand(process.argv.slice(2))) {
    const { serverCommand } = await import('./src/commands/server.js');
    // yargs normally passes argv, but serverCommand.handler only relies on the
    // parsed keys we use here.
    // Avoid yargs here: yargs' help formatting pulls in CJS deps that can
    // break under ESM in some environments. The server command only needs a
    // small subset of flags, so parse them directly.
    const rawArgs = process.argv.slice(2);
    const getArgValue = (name: string): string | undefined => {
      const idx = rawArgs.indexOf(name);
      if (idx === -1) return undefined;
      return rawArgs[idx + 1];
    };

    const hasFlag = (name: string): boolean => rawArgs.includes(name);

    const portRaw = getArgValue('--port');
    const tokenRaw = getArgValue('--token');
    const hostRaw = getArgValue('--host');
    const ttlRaw = getArgValue('--session-ttl-ms');

    const argv = {
      port: portRaw ? Number(portRaw) : undefined,
      token: tokenRaw,
      host: hostRaw,
      'session-ttl-ms': ttlRaw ? Number(ttlRaw) : undefined,
      docs: hasFlag('--docs'),
      'allow-empty-token': hasFlag('--allow-empty-token'),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serverCommand as any).handler(argv);
    return;
  }

  const { main } = await import('./src/gemini.js');
  await main();
}

// --- Global Entry Point ---
mainEntrypoint().catch((error) => {
  if (isFatalErrorLike(error)) {
    let errorMessage = error.message;
    if (!process.env['NO_COLOR']) {
      errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
    }
    console.error(errorMessage);
    process.exit(error.exitCode);
  }
  console.error('An unexpected critical error occurred:');
  if (error instanceof Error) {
    console.error(error.stack);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
