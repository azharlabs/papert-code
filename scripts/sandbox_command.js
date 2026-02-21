/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import stripJsonComments from 'strip-json-comments';
import os from 'node:os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

const argv = yargs(hideBin(process.argv)).option('q', {
  alias: 'quiet',
  type: 'boolean',
  default: false,
}).argv;

const warnedLegacyEnvVars = new Set();

const resolveEnvAlias = (canonicalName, legacyName) => {
  const canonicalValue = process.env[canonicalName];
  if (canonicalValue !== undefined) {
    return canonicalValue;
  }
  const legacyValue = process.env[legacyName];
  if (legacyValue !== undefined && !warnedLegacyEnvVars.has(legacyName)) {
    warnedLegacyEnvVars.add(legacyName);
    console.warn(
      `[DEPRECATION] Environment variable ${legacyName} is deprecated. Use ${canonicalName} instead.`,
    );
  }
  return legacyValue;
};

let configuredSandbox = resolveEnvAlias('PAPERT_SANDBOX', 'GEMINI_SANDBOX');

if (!configuredSandbox) {
  const userSettingsFile = join(os.homedir(), '.papert', 'settings.json');
  if (existsSync(userSettingsFile)) {
    const settings = JSON.parse(
      stripJsonComments(readFileSync(userSettingsFile, 'utf-8')),
    );
    if (settings.sandbox) {
      configuredSandbox = settings.sandbox;
    }
  }
}

if (!configuredSandbox) {
  let currentDir = process.cwd();
  while (true) {
    const papertEnv = join(currentDir, '.papert', '.env');
    const regularEnv = join(currentDir, '.env');
    if (existsSync(papertEnv)) {
      dotenv.config({ path: papertEnv, quiet: true });
      break;
    } else if (existsSync(regularEnv)) {
      dotenv.config({ path: regularEnv, quiet: true });
      break;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  configuredSandbox = resolveEnvAlias('PAPERT_SANDBOX', 'GEMINI_SANDBOX');
}

configuredSandbox = (configuredSandbox || '').toLowerCase();

const commandExists = (cmd) => {
  const checkCommand = os.platform() === 'win32' ? 'where' : 'command -v';
  try {
    execSync(`${checkCommand} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    if (os.platform() === 'win32') {
      try {
        execSync(`${checkCommand} ${cmd}.exe`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
};

let command = '';
if (['1', 'true'].includes(configuredSandbox)) {
  if (commandExists('docker')) {
    command = 'docker';
  } else if (commandExists('podman')) {
    command = 'podman';
  } else {
    console.error(
      'ERROR: install docker or podman or specify command in PAPERT_SANDBOX',
    );
    process.exit(1);
  }
} else if (
  configuredSandbox &&
  !['0', 'false'].includes(configuredSandbox)
) {
  if (commandExists(configuredSandbox)) {
    command = configuredSandbox;
  } else {
    console.error(
      `ERROR: missing sandbox command '${configuredSandbox}' (from PAPERT_SANDBOX)`,
    );
    process.exit(1);
  }
} else {
  if (os.platform() === 'darwin' && process.env.SEATBELT_PROFILE !== 'none') {
    if (commandExists('sandbox-exec')) {
      command = 'sandbox-exec';
    } else {
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

if (!argv.q) {
  console.log(command);
}
process.exit(0);
