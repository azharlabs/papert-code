/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { z } from 'zod';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { t } from '../../i18n/index.js';

interface AdminLoginPromptProps {
  onSubmit: (baseUrl: string, email: string, password: string) => void;
  onCancel: () => void;
  defaultBaseUrl?: string;
  defaultEmail?: string;
}

const adminLoginSchema = z.object({
  baseUrl: z.string().url('Base URL must be a valid URL'),
  email: z.string().min(1, 'Email is required').email('Email must be valid'),
  password: z.string().min(1, 'Password is required'),
});

export function AdminLoginPrompt({
  onSubmit,
  onCancel,
  defaultBaseUrl,
  defaultEmail,
}: AdminLoginPromptProps): React.JSX.Element {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl || '');
  const [email, setEmail] = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [currentField, setCurrentField] = useState<
    'baseUrl' | 'email' | 'password'
  >('baseUrl');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateAndSubmit = () => {
    setValidationError(null);
    try {
      const validated = adminLoginSchema.parse({
        baseUrl: baseUrl.trim(),
        email: email.trim(),
        password: password,
      });
      onSubmit(validated.baseUrl, validated.email, validated.password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        setValidationError(
          t('Invalid admin credentials: {{errorMessage}}', { errorMessage }),
        );
      } else {
        setValidationError(t('Failed to validate credentials'));
      }
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
        return;
      }

      if (key.name === 'return') {
        if (currentField === 'baseUrl') {
          setCurrentField('email');
          return;
        }
        if (currentField === 'email') {
          setCurrentField('password');
          return;
        }
        if (currentField === 'password') {
          validateAndSubmit();
        }
        return;
      }

      if (key.name === 'tab') {
        if (currentField === 'baseUrl') {
          setCurrentField('email');
        } else if (currentField === 'email') {
          setCurrentField('password');
        } else {
          setCurrentField('baseUrl');
        }
        return;
      }

      if (key.name === 'up') {
        if (currentField === 'email') {
          setCurrentField('baseUrl');
        } else if (currentField === 'password') {
          setCurrentField('email');
        }
        return;
      }

      if (key.name === 'down') {
        if (currentField === 'baseUrl') {
          setCurrentField('email');
        } else if (currentField === 'email') {
          setCurrentField('password');
        }
        return;
      }

      if (key.name === 'backspace' || key.name === 'delete') {
        if (currentField === 'baseUrl') {
          setBaseUrl((prev) => prev.slice(0, -1));
        } else if (currentField === 'email') {
          setEmail((prev) => prev.slice(0, -1));
        } else if (currentField === 'password') {
          setPassword((prev) => prev.slice(0, -1));
        }
        return;
      }

      if (key.paste && key.sequence) {
        let cleanInput = key.sequence
          .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
          .replace(/\[200~/g, '')
          .replace(/\[201~/g, '')
          .replace(/^\[|~$/g, '');
        cleanInput = cleanInput
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');
        if (!cleanInput.length) return;
        if (currentField === 'baseUrl') {
          setBaseUrl((prev) => prev + cleanInput);
        } else if (currentField === 'email') {
          setEmail((prev) => prev + cleanInput);
        } else if (currentField === 'password') {
          setPassword((prev) => prev + cleanInput);
        }
        return;
      }

      if (key.sequence && !key.ctrl && !key.meta) {
        const cleanInput = key.sequence
          .split('')
          .filter((ch) => ch.charCodeAt(0) >= 32)
          .join('');
        if (!cleanInput.length) return;
        if (currentField === 'baseUrl') {
          setBaseUrl((prev) => prev + cleanInput);
        } else if (currentField === 'email') {
          setEmail((prev) => prev + cleanInput);
        } else if (currentField === 'password') {
          setPassword((prev) => prev + cleanInput);
        }
      }
    },
    { isActive: true },
  );

  const passwordMask = password ? '*'.repeat(password.length) : '';

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        {t('Admin Login Required')}
      </Text>
      {validationError && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{validationError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text>{t('Enter your Papert Admin credentials')}</Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'baseUrl' ? Colors.AccentBlue : Colors.Gray}
          >
            {t('Base URL:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'baseUrl' ? '> ' : '  '}
            {baseUrl || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'email' ? Colors.AccentBlue : Colors.Gray}
          >
            {t('Email:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'email' ? '> ' : '  '}
            {email || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={
              currentField === 'password' ? Colors.AccentBlue : Colors.Gray
            }
          >
            {t('Password:')}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'password' ? '> ' : '  '}
            {passwordMask || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {t('Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel')}
        </Text>
      </Box>
    </Box>
  );
}
