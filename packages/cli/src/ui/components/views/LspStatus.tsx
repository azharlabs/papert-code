/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type React from 'react';
import { theme } from '../../semantic-colors.js';
import type { HistoryItemLspStatus } from '../../types.js';
import { t } from '../../../i18n/index.js';

type LspStatusProps = HistoryItemLspStatus;

function renderStatusIndicator(status: HistoryItemLspStatus['servers'][number]['status']) {
  switch (status) {
    case 'connected':
      return { icon: '🟢', color: theme.status.success, label: t('Connected') };
    case 'idle':
      return { icon: '🟡', color: theme.status.warning, label: t('Ready') };
    case 'missing':
      return { icon: '🔴', color: theme.status.error, label: t('Missing') };
    case 'disabled':
    default:
      return { icon: '⚪', color: theme.text.secondary, label: t('Disabled') };
  }
}

export const LspStatus: React.FC<LspStatusProps> = ({
  enabled,
  autoDetect,
  autoInstall,
  servers,
}) => {
  if (!enabled) {
    return (
      <Box flexDirection="column">
        <Text color={theme.text.secondary}>
          {t('LSP is disabled. Enable it in settings to auto-detect servers.')}
        </Text>
      </Box>
    );
  }

  if (servers.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>{t('No LSP servers are configured or detected.')}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>{t('LSP status')}</Text>
      <Text color={theme.text.secondary}>
        {t('Auto-detect:')} {autoDetect ? t('on') : t('off')} ·{' '}
        {t('Auto-install:')} {autoInstall ? t('on') : t('off')}
      </Text>
      <Box height={1} />

      {servers.map((server) => {
        const indicator = renderStatusIndicator(server.status);
        const extensionList = server.extensions.join(', ');
        const sourceLabel =
          server.source === 'builtin' ? t('built-in') : t('configured');

        return (
          <Box key={server.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={indicator.color}>{indicator.icon} </Text>
              <Text bold>
                {server.label}{' '}
                <Text color={theme.text.secondary}>
                  ({sourceLabel})
                </Text>
              </Text>
              <Text>
                {' '}
                - {indicator.label}
              </Text>
            </Box>
            <Text color={theme.text.secondary}>
              {t('Extensions:')} {extensionList || t('none')}
            </Text>
            {server.status === 'missing' && (
              <Text color={theme.status.warning}>
                {server.installable && server.autoInstall
                  ? t('Auto-install available on first use.')
                  : server.installHint ??
                  t('Install this server and ensure it is on PATH.')}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
