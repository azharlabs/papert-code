/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IdeClient,
  IdeConnectionEvent,
  IdeConnectionType,
  logIdeConnection,
  fetchAdminControls,
  getCodeAssistServer,
  type Config,
} from '@papert-code/papert-code-core';
import { type LoadedSettings, SettingScope } from '../config/settings.js';
import { performInitialAuth } from './auth.js';
import { validateTheme } from './theme.js';
import { initializeI18n } from '../i18n/index.js';

export interface InitializationResult {
  authError: string | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
  geminiMdFileCount: number;
}

/**
 * Orchestrates the application's startup initialization.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @returns The results of the initialization.
 */
export async function initializeApp(
  config: Config,
  settings: LoadedSettings,
): Promise<InitializationResult> {
  // Initialize i18n system
  const languageSetting =
    process.env['PAPERT_CODE_LANG'] ||
    settings.merged.general?.language ||
    'auto';
  await initializeI18n(languageSetting);

  const authType = settings.merged.security?.auth?.selectedType;
  const authError = await performInitialAuth(config, authType);

  if (!authError) {
    const server = getCodeAssistServer(config);
    const hasAdminOverride = Boolean(
      process.env['PAPERT_ADMIN_CONTROLS_URL'] ||
        process.env['PAPERT_ADMIN_URL'],
    );
    if (server || hasAdminOverride) {
      const adminSettings = await fetchAdminControls(
        server,
        config.getRemoteAdminSettings(),
        true,
        (settings) => {
          config.setRemoteAdminSettings(settings);
        },
      );
      if (adminSettings && Object.keys(adminSettings).length > 0) {
        config.setRemoteAdminSettings(adminSettings);
      }
    }
  }

  // Fallback to user select when initial authentication fails
  if (authError) {
    settings.setValue(
      SettingScope.User,
      'security.auth.selectedType',
      undefined,
    );
  }
  const themeError = validateTheme(settings);

  const shouldOpenAuthDialog =
    settings.merged.security?.auth?.selectedType === undefined || !!authError;

  if (config.getIdeMode()) {
    const ideClient = await IdeClient.getInstance();
    await ideClient.connect();
    logIdeConnection(config, new IdeConnectionEvent(IdeConnectionType.START));
  }

  return {
    authError,
    themeError,
    shouldOpenAuthDialog,
    geminiMdFileCount: config.getGeminiMdFileCount(),
  };
}
