/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type PackageJson = {
  name?: string;
  version?: string;
  [key: string]: unknown;
  config?: {
    sandboxImageUri?: string;
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let packageJson: PackageJson | undefined;

export async function getPackageJson(): Promise<PackageJson | undefined> {
  if (packageJson) {
    return packageJson;
  }

  let currentDir = __dirname;
  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      packageJson = JSON.parse(content) as PackageJson;
      return packageJson;
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
