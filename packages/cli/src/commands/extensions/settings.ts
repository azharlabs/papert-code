/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ExtensionStorage,
  loadExtensionByName,
} from '../../config/extension.js';
import { getErrorMessage } from '../../utils/errors.js';
import { getBrandConfig } from '@papert-code/papert-code-core';

const EXTENSION_SETTINGS_FILE = getBrandConfig().extensionSettingsFileName;

type ExtensionSettings = Record<string, string>;

function resolveSettingsPath(extensionName: string): string {
  const extension = loadExtensionByName(extensionName, process.cwd());
  if (!extension) {
    throw new Error(`Extension "${extensionName}" not found.`);
  }
  const storage = new ExtensionStorage(extension.config.name);
  return path.join(storage.getExtensionDir(), EXTENSION_SETTINGS_FILE);
}

function readSettings(extensionName: string): ExtensionSettings {
  const filePath = resolveSettingsPath(extensionName);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as ExtensionSettings;
}

function writeSettings(extensionName: string, settings: ExtensionSettings): void {
  const filePath = resolveSettingsPath(extensionName);
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

const setCommand: CommandModule = {
  command: 'set <extension> <key> <value>',
  describe: 'Set an extension setting key/value pair.',
  builder: (yargs) =>
    yargs
      .positional('extension', {
        describe: 'Extension name.',
        type: 'string',
        demandOption: true,
      })
      .positional('key', {
        describe: 'Setting key.',
        type: 'string',
        demandOption: true,
      })
      .positional('value', {
        describe: 'Setting value.',
        type: 'string',
        demandOption: true,
      }),
  handler: (argv) => {
    try {
      const extension = argv['extension'] as string;
      const key = argv['key'] as string;
      const value = argv['value'] as string;
      const settings = readSettings(extension);
      settings[key] = value;
      writeSettings(extension, settings);
      console.log(
        `Set extension setting "${key}" for "${extension}" successfully.`,
      );
    } catch (error) {
      console.error(getErrorMessage(error));
      process.exit(1);
    }
  },
};

const unsetCommand: CommandModule = {
  command: 'unset <extension> <key>',
  describe: 'Remove an extension setting key.',
  builder: (yargs) =>
    yargs
      .positional('extension', {
        describe: 'Extension name.',
        type: 'string',
        demandOption: true,
      })
      .positional('key', {
        describe: 'Setting key.',
        type: 'string',
        demandOption: true,
      }),
  handler: (argv) => {
    try {
      const extension = argv['extension'] as string;
      const key = argv['key'] as string;
      const settings = readSettings(extension);
      if (!Object.hasOwn(settings, key)) {
        throw new Error(
          `Setting "${key}" not found for extension "${extension}".`,
        );
      }
      delete settings[key];
      writeSettings(extension, settings);
      console.log(
        `Unset extension setting "${key}" for "${extension}" successfully.`,
      );
    } catch (error) {
      console.error(getErrorMessage(error));
      process.exit(1);
    }
  },
};

const listCommand: CommandModule = {
  command: 'list <extension>',
  describe: 'List all settings for an extension.',
  builder: (yargs) =>
    yargs.positional('extension', {
      describe: 'Extension name.',
      type: 'string',
      demandOption: true,
    }),
  handler: (argv) => {
    try {
      const extension = argv['extension'] as string;
      const settings = readSettings(extension);
      const entries = Object.entries(settings);
      if (entries.length === 0) {
        console.log(`No settings found for extension "${extension}".`);
        return;
      }
      console.log(`Settings for extension "${extension}":`);
      for (const [key, value] of entries) {
        console.log(`  ${key}=${value}`);
      }
    } catch (error) {
      console.error(getErrorMessage(error));
      process.exit(1);
    }
  },
};

const showCommand: CommandModule = {
  command: 'show <extension> <key>',
  describe: 'Show one setting value for an extension.',
  builder: (yargs) =>
    yargs
      .positional('extension', {
        describe: 'Extension name.',
        type: 'string',
        demandOption: true,
      })
      .positional('key', {
        describe: 'Setting key.',
        type: 'string',
        demandOption: true,
      }),
  handler: (argv) => {
    try {
      const extension = argv['extension'] as string;
      const key = argv['key'] as string;
      const settings = readSettings(extension);
      const value = settings[key];
      if (value === undefined) {
        throw new Error(
          `Setting "${key}" not found for extension "${extension}".`,
        );
      }
      console.log(value);
    } catch (error) {
      console.error(getErrorMessage(error));
      process.exit(1);
    }
  },
};

export const settingsCommand: CommandModule = {
  command: 'settings <command>',
  describe: 'Manage extension settings.',
  builder: (yargs) =>
    yargs
      .command(setCommand)
      .command(unsetCommand)
      .command(listCommand)
      .command(showCommand)
      .demandCommand(1, 'You need at least one settings command.'),
  handler: () => {
    // handled by subcommands
  },
};
