/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const packageDir = join(root, 'packages', 'a2a-server');
const entry = join(packageDir, 'dist', 'src', 'http', 'server.js');

if (!existsSync(join(root, 'node_modules'))) {
  execSync('npm install', { stdio: 'inherit', cwd: root });
}

if (!existsSync(entry)) {
  execSync('npm run build --workspace=packages/a2a-server', {
    stdio: 'inherit',
    cwd: root,
  });
}

const child = spawn('node', [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
