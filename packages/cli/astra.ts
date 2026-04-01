#!/usr/bin/env node

/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

process.env['PAPERT_CLI_NAME'] ??= 'astra';
process.env['PAPERT_APP_NAME'] ??= 'Astra';
process.env['PAPERT_CONFIG_DIR'] ??= '.astra';
process.env['PAPERT_IGNORE_FILE'] ??= '.astraignore';
process.env['PAPERT_CONTEXT_FILE'] ??= 'astra.md';
process.env['PAPERT_EXTENSION_CONFIG_FILE'] ??= 'astra-extension.json';
process.env['PAPERT_EXTENSION_SETTINGS_FILE'] ??=
  '.astra-extension-settings.json';
process.env['PAPERT_EXTENSION_INSTALL_METADATA_FILE'] ??=
  '.astra-extension-install.json';
process.env['PAPERT_A2A_SERVER_COMMAND'] ??= 'astra-a2a-server';

await import('./index.js');
