/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPackageJson } from './package.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the CLI version from package.json or CLI_VERSION env override.
 */
export async function getVersion(): Promise<string> {
  const pkgJson = await getPackageJson(__dirname);
  return process.env['CLI_VERSION'] || pkgJson?.version || 'unknown';
}
