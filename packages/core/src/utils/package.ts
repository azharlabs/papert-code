/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export type PackageJson = {
  name?: string;
  version?: string;
  [key: string]: unknown;
  config?: {
    sandboxImageUri?: string;
  };
};

/**
 * Reads package.json from the current directory or any parent directory.
 *
 * @param cwd - The directory to start searching from (searches upward to filesystem root)
 * @returns The package.json object if found, or `undefined` if no package.json exists
 *          in the directory hierarchy.
 */
export async function getPackageJson(
  cwd: string,
): Promise<PackageJson | undefined> {
  let currentDir = cwd;
  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      return JSON.parse(content) as PackageJson;
    } catch (error) {
      const errorWithCode = error as NodeJS.ErrnoException;
      if (errorWithCode.code && errorWithCode.code !== 'ENOENT') {
        throw error;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        return undefined;
      }
      currentDir = parentDir;
    }
  }
}
