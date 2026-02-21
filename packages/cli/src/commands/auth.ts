/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import { AuthType } from '@papert-code/papert-code-core';
import type { CommandModule } from 'yargs';
import { loadSettings, SettingScope, type Settings } from '../config/settings.js';

type AuthMode = 'oauth' | 'api-key' | 'enterprise';

interface AuthArgs {
  action?: string;
  mode?: string;
  json?: boolean;
}

interface LoadedSettingsLike {
  merged: Settings;
  setValue: (scope: SettingScope, key: string, value: unknown) => void;
}

export interface AuthDiagnostics {
  selectedType?: AuthType;
  enforcedType?: AuthType;
  effectiveType?: AuthType;
  env: {
    openaiApiKeyPresent: boolean;
    openaiBaseUrlPresent: boolean;
    papertDefaultAuthType?: string;
    adminBaseUrlPresent: boolean;
    adminSessionTokenPresent: boolean;
  };
  modeReadiness: {
    oauth: { ready: boolean; reason: string };
    apiKey: { ready: boolean; reason: string };
    enterprise: { ready: boolean; reason: string };
  };
}

function resolveAuthMode(mode: string | undefined): AuthMode | null {
  if (!mode) {
    return null;
  }
  const normalized = mode.trim().toLowerCase();
  if (normalized === 'oauth') {
    return 'oauth';
  }
  if (normalized === 'api-key' || normalized === 'apikey' || normalized === 'openai') {
    return 'api-key';
  }
  if (normalized === 'enterprise' || normalized === 'admin') {
    return 'enterprise';
  }
  return null;
}

export function buildAuthDiagnostics(
  settings: Settings,
  env: NodeJS.ProcessEnv = process.env,
): AuthDiagnostics {
  const selectedType = settings.security?.auth?.selectedType;
  const enforcedType = settings.security?.auth?.enforcedType;
  const effectiveType = enforcedType ?? selectedType;
  const openaiApiKeyPresent = Boolean(
    env['OPENAI_API_KEY'] || settings.security?.auth?.apiKey,
  );
  const openaiBaseUrlPresent = Boolean(
    env['OPENAI_BASE_URL'] || settings.security?.auth?.baseUrl,
  );
  const adminBaseUrlPresent = Boolean(env['PAPERT_ADMIN_BASE_URL']);
  const adminSessionTokenPresent = Boolean(env['PAPERT_ADMIN_SESSION_TOKEN']);

  return {
    selectedType,
    enforcedType,
    effectiveType,
    env: {
      openaiApiKeyPresent,
      openaiBaseUrlPresent,
      papertDefaultAuthType: env['PAPERT_DEFAULT_AUTH_TYPE'],
      adminBaseUrlPresent,
      adminSessionTokenPresent,
    },
    modeReadiness: {
      oauth: {
        ready: true,
        reason: 'OAuth flow is available without preconfigured keys.',
      },
      apiKey: {
        ready: openaiApiKeyPresent,
        reason: openaiApiKeyPresent
          ? 'OpenAI-compatible API key detected.'
          : 'Missing OPENAI_API_KEY (or security.auth.apiKey).',
      },
      enterprise: {
        ready:
          openaiApiKeyPresent &&
          (openaiBaseUrlPresent || adminBaseUrlPresent || adminSessionTokenPresent),
        reason:
          openaiApiKeyPresent &&
          (openaiBaseUrlPresent || adminBaseUrlPresent || adminSessionTokenPresent)
            ? 'Enterprise prerequisites detected (key + base URL/admin session).'
            : 'Enterprise mode needs an API key and base URL/admin session context.',
      },
    },
  };
}

function printAuthDiagnostics(diagnostics: AuthDiagnostics) {
  console.log('Authentication diagnostics');
  console.log(`- selectedType: ${diagnostics.selectedType ?? 'unset'}`);
  console.log(`- enforcedType: ${diagnostics.enforcedType ?? 'unset'}`);
  console.log(`- effectiveType: ${diagnostics.effectiveType ?? 'unset'}`);
  console.log('');
  console.log('Environment readiness');
  console.log(
    `- OPENAI_API_KEY: ${diagnostics.env.openaiApiKeyPresent ? 'present' : 'missing'}`,
  );
  console.log(
    `- OPENAI_BASE_URL: ${diagnostics.env.openaiBaseUrlPresent ? 'present' : 'missing'}`,
  );
  console.log(
    `- PAPERT_ADMIN_BASE_URL: ${diagnostics.env.adminBaseUrlPresent ? 'present' : 'missing'}`,
  );
  console.log(
    `- PAPERT_ADMIN_SESSION_TOKEN: ${diagnostics.env.adminSessionTokenPresent ? 'present' : 'missing'}`,
  );
  console.log(
    `- PAPERT_DEFAULT_AUTH_TYPE: ${
      diagnostics.env.papertDefaultAuthType ?? 'unset'
    }`,
  );
  console.log('');
  console.log('Mode readiness');
  console.log(
    `- oauth: ${diagnostics.modeReadiness.oauth.ready ? 'ready' : 'not ready'} (${diagnostics.modeReadiness.oauth.reason})`,
  );
  console.log(
    `- api-key: ${diagnostics.modeReadiness.apiKey.ready ? 'ready' : 'not ready'} (${diagnostics.modeReadiness.apiKey.reason})`,
  );
  console.log(
    `- enterprise: ${
      diagnostics.modeReadiness.enterprise.ready ? 'ready' : 'not ready'
    } (${diagnostics.modeReadiness.enterprise.reason})`,
  );
}

function applyModeSwitch(settings: LoadedSettingsLike, mode: AuthMode) {
  switch (mode) {
    case 'oauth':
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedType',
        AuthType.PAPERT_OAUTH,
      );
      console.log(
        'Switched auth mode to oauth (papert-oauth). Run /auth to complete authentication if needed.',
      );
      break;
    case 'api-key':
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedType',
        AuthType.USE_OPENAI,
      );
      console.log(
        'Switched auth mode to api-key (openai). Ensure OPENAI_API_KEY is configured, then run /auth if needed.',
      );
      break;
    case 'enterprise':
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedType',
        AuthType.USE_OPENAI,
      );
      settings.setValue(
        SettingScope.User,
        'security.auth.enforcedType',
        AuthType.USE_OPENAI,
      );
      console.log(
        'Switched auth mode to enterprise (openai + enforced type). Configure admin/base URL credentials and run /auth.',
      );
      break;
  }
}

export const authCommand: CommandModule = {
  command: 'auth <action> [mode]',
  describe: 'Run auth diagnostics or switch auth mode quickly',
  builder: (yargs) =>
    yargs
      .positional('action', {
        choices: ['diagnose', 'use'],
        describe: 'Auth action to run',
      })
      .positional('mode', {
        describe: 'Mode for `use`: oauth | api-key | enterprise',
        type: 'string',
      })
      .option('json', {
        describe: 'Emit diagnostics output as JSON',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    const args = argv as unknown as AuthArgs;
    const loadedSettings = loadSettings(process.cwd()) as LoadedSettingsLike;

    if (args.action === 'diagnose') {
      const diagnostics = buildAuthDiagnostics(loadedSettings.merged);
      if (args.json) {
        console.log(JSON.stringify(diagnostics, null, 2));
        return;
      }
      printAuthDiagnostics(diagnostics);
      return;
    }

    if (args.action === 'use') {
      const mode = resolveAuthMode(args.mode);
      if (!mode) {
        console.log('Usage: papert auth use <oauth|api-key|enterprise>');
        return;
      }
      applyModeSwitch(loadedSettings, mode);
      return;
    }

    console.log('Usage: papert auth <diagnose|use> [mode] [--json]');
  },
};
