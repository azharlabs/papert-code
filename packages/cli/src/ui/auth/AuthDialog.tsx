/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType } from '@papert-code/papert-code-core';
import { Box, Text } from 'ink';
import { SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useSettings } from '../contexts/SettingsContext.js';
import { t } from '../../i18n/index.js';
import {
  AdminQuotaError,
  applyAdminSessionToEnv,
  resolveAdminSession,
} from '../../admin/adminClient.js';

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog(): React.JSX.Element {
  const { pendingAuthType, authError } = useUIState();
  const { handleAuthSelect: onAuthSelect } = useUIActions();
  const settings = useSettings();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasAdminUrl = Boolean(process.env['PAPERT_ADMIN_URL']);
  const items = [
    ...(hasAdminUrl
      ? [
        {
          key: 'admin-managed',
          label: t('Admin-managed login (Papert Admin)'),
          value: { authType: AuthType.USE_OPENAI, source: 'admin' as const },
        },
      ]
      : []),
    {
      key: AuthType.USE_OPENAI,
      label: t('Custom models (OpenAI compatible APIs)'),
      value: { authType: AuthType.USE_OPENAI, source: 'openai' as const },
    },
  ];

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      // Priority 1: pendingAuthType
      if (pendingAuthType) {
        return item.value.authType === pendingAuthType;
      }

      // Priority 2: settings.merged.security?.auth?.selectedType
      if (settings.merged.security?.auth?.selectedType) {
        return item.value.authType === settings.merged.security?.auth?.selectedType;
      }

      // Priority 3: PAPERT_DEFAULT_AUTH_TYPE env var
      const defaultAuthType = parseDefaultAuthType(
        process.env['PAPERT_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value.authType === defaultAuthType;
      }

      // Priority 4: default to admin when available, otherwise OpenAI
      if (hasAdminUrl) {
        return item.value.source === 'admin';
      }
      return item.value.authType === AuthType.USE_OPENAI;
    }),
  );

  const handleAuthSelect = async (selection: {
    authType: AuthType;
    source: 'admin' | 'openai';
  }) => {
    setErrorMessage(null);
    if (selection.source === 'admin') {
      if (!process.env['PAPERT_ADMIN_URL']) {
        setErrorMessage(
          t('Set PAPERT_ADMIN_URL to use admin-managed authentication.'),
        );
        return;
      }
      try {
        const session = await resolveAdminSession();
        if (!session) {
          setErrorMessage(
            t('Admin login required. Provide credentials to continue.'),
          );
          return;
        }
        if (!session.provider?.apiKey) {
          setErrorMessage(
            t('Admin-managed login requires a provider API key.'),
          );
          return;
        }
        if (!session.provider?.baseUrl) {
          setErrorMessage(
            t(
              'Admin-managed login requires a provider Base URL (set Base URL in the admin controls).',
            ),
          );
          return;
        }
        applyAdminSessionToEnv(session);
        const adminModel =
          session.provider.model || session.provider.models?.[0];
        await onAuthSelect(selection.authType, SettingScope.User, {
          apiKey: session.provider.apiKey,
          baseUrl: session.provider.baseUrl,
          model: adminModel,
        });
        return;
      } catch (err) {
        if (err instanceof AdminQuotaError) {
          setErrorMessage(err.message);
          return;
        }
        setErrorMessage(
          t('Failed to authenticate. Message: {{message}}', {
            message: err instanceof Error ? err.message : String(err),
          }),
        );
        return;
      }
    }
    await onAuthSelect(selection.authType, SettingScope.User);
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            t(
              'You must select an auth method to proceed. Press Ctrl+C again to exit.',
            ),
          );
          return;
        }
        onAuthSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{t('Get started')}</Text>
      <Box marginTop={1}>
        <Text>{t('How would you like to authenticate for this project?')}</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {(authError || errorMessage) && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{authError || errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>{t('(Use Enter to Set Auth)')}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>{t('Terms of Services and Privacy Notice for Papert Code')}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://github.com/azharlabs/papert-code/blob/main/README.md'}
        </Text>
      </Box>
    </Box>
  );
}
