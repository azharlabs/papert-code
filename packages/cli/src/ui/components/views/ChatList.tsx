/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../semantic-colors.js';
import type { ChatDetail } from '../../types.js';
import { t } from '../../../i18n/index.js';

interface ChatListProps {
  chats: readonly ChatDetail[];
}

export const ChatList: React.FC<ChatListProps> = ({ chats }) => {
  if (chats.length === 0) {
    return <Text>{t('No saved conversation checkpoints found.')}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text>{t('List saved conversation checkpoints')}</Text>
      <Box height={1} />
      {chats.map((chat) => {
        const isoString = chat.mtime;
        const match = isoString.match(
          /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/,
        );
        const formattedDate = match ? `${match[1]} ${match[2]}` : 'Invalid Date';
        return (
          <Box key={chat.name} flexDirection="row">
            <Text>
              {'  '}- <Text color={theme.text.accent}>{chat.name}</Text>{' '}
              <Text color={theme.text.secondary}>({formattedDate})</Text>
            </Text>
          </Box>
        );
      })}
      <Box height={1} />
      <Text color={theme.text.secondary}>
        {t('Note: Newest last, oldest first')}
      </Text>
    </Box>
  );
};
