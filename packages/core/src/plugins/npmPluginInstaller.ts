/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export interface NpmPluginInstallOptions {
  globalPluginsDir: string;
  installTarget: string;
}

async function ensurePackageJson(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const pkgPath = path.join(dir, 'package.json');
  try {
    await access(pkgPath);
  } catch {
    await writeFile(
      pkgPath,
      JSON.stringify({ name: 'papert-plugins', private: true }, null, 2) + '\n',
      'utf8',
    );
  }
}

export async function installNpmPlugin(
  opts: NpmPluginInstallOptions,
): Promise<void> {
  await ensurePackageJson(opts.globalPluginsDir);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'npm',
      [
        'install',
        '--silent',
        '--no-fund',
        '--no-audit',
        '--save-exact',
        opts.installTarget,
      ],
      {
        cwd: opts.globalPluginsDir,
        stdio: 'inherit',
      },
    );

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install failed with exit code ${code}`));
    });
  });
}
