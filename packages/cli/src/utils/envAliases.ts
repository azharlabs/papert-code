/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

const warnedLegacyEnvVars = new Set<string>();

interface ResolveEnvAliasOptions {
  env?: NodeJS.ProcessEnv;
}

function warnLegacyEnvVar(legacyName: string, canonicalName: string): void {
  if (warnedLegacyEnvVars.has(legacyName)) {
    return;
  }
  warnedLegacyEnvVars.add(legacyName);
  console.warn(
    `[DEPRECATION] Environment variable ${legacyName} is deprecated. Use ${canonicalName} instead.`,
  );
}

/**
 * Resolve a canonical environment variable with support for one legacy alias.
 *
 * Precedence:
 * 1) canonical variable
 * 2) legacy alias (with one-time deprecation warning)
 */
export function resolveEnvAlias(
  canonicalName: string,
  legacyName: string,
  options: ResolveEnvAliasOptions = {},
): string | undefined {
  const env = options.env ?? process.env;
  const canonicalValue = env[canonicalName];
  if (canonicalValue !== undefined) {
    return canonicalValue;
  }

  const legacyValue = env[legacyName];
  if (legacyValue !== undefined) {
    warnLegacyEnvVar(legacyName, canonicalName);
  }
  return legacyValue;
}

/**
 * FOR TESTING PURPOSES ONLY.
 */
export function resetEnvAliasWarningsForTesting(): void {
  warnedLegacyEnvVars.clear();
}
