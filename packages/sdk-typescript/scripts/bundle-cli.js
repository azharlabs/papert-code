/**
 * @license
 * Copyright 2025 Papert Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bundles/copies the Papert Code CLI into the SDK package dist/ so consumers
 * don't need a separate CLI install.
 *
 * This is intentionally NOT part of the SDK "build" step; it is a packaging
 * concern (run via npm lifecycle hooks like prepack/prepublishOnly).
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sdkRoot = join(__dirname, '..');
const repoRoot = join(sdkRoot, '..', '..');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.error) throw res.error;
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(
      `Command failed (${res.status}): ${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`,
    );
  }
}

function ensureRootBundle() {
  const rootDistDir = join(repoRoot, 'dist');
  const rootCliJs = join(rootDistDir, 'cli.js');
  if (existsSync(rootCliJs)) return;

  console.log('[sdk prepack] Root CLI bundle missing; running `npm run bundle`');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['run', 'bundle'], { cwd: repoRoot });
}

function copyIfExists(source, target) {
  if (!existsSync(source)) return false;
  cpSync(source, target, { recursive: true });
  return true;
}

function main() {
  ensureRootBundle();

  const rootDistDir = join(repoRoot, 'dist');
  const rootCliJs = join(rootDistDir, 'cli.js');
  const cliDistDir = join(sdkRoot, 'dist', 'cli');

  if (!existsSync(join(sdkRoot, 'dist'))) {
    throw new Error(
      '[sdk prepack] SDK dist/ not found. Run `npm run build` in packages/sdk-typescript first.',
    );
  }

  rmSync(cliDistDir, { recursive: true, force: true });
  mkdirSync(cliDistDir, { recursive: true });

  console.log('[sdk prepack] Copying CLI bundle into SDK dist/...');
  cpSync(rootCliJs, join(cliDistDir, 'cli.js'));

  const vendorSource = join(rootDistDir, 'vendor');
  copyIfExists(vendorSource, join(cliDistDir, 'vendor'));

  const sandboxProfiles = readdirSync(rootDistDir).filter((entry) =>
    entry.endsWith('.sb'),
  );
  for (const profile of sandboxProfiles) {
    cpSync(join(rootDistDir, profile), join(cliDistDir, profile));
  }

  console.log('[sdk prepack] CLI bundle copied successfully');
}

main();
