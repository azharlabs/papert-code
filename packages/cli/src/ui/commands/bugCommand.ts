/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import open from 'open';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';
import { getExtendedSystemInfo } from '../../utils/systemInfo.js';
import {
  getSystemInfoFields,
  getFieldValue,
} from '../../utils/systemInfoFields.js';
import { t } from '../../i18n/index.js';

const BUG_BUNDLE_RELATIVE_DIR = path.join('.papert', 'bug-report-bundles');
const SENSITIVE_ENV_KEY_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|COOKIE)/i;
const BUNDLE_SCHEMA_VERSION = 1;

function sanitizeProxyValue(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = 'redacted';
      parsed.password = 'redacted';
    }
    return parsed.toString();
  } catch {
    return value.replace(/\/\/[^@/]+@/, '//redacted:redacted@');
  }
}

function redactSessionId(sessionId: string | undefined): string {
  if (!sessionId || sessionId === 'unknown') {
    return sessionId ?? 'unknown';
  }
  if (sessionId.length <= 8) {
    return '[REDACTED]';
  }
  return `${sessionId.slice(0, 8)}...`;
}

function shouldCaptureEnvKey(key: string): boolean {
  return (
    key.startsWith('PAPERT_') ||
    key.startsWith('GEMINI_') ||
    key.startsWith('OPENAI_') ||
    key === 'HTTP_PROXY' ||
    key === 'HTTPS_PROXY' ||
    key === 'NO_PROXY' ||
    key === 'SANDBOX' ||
    key === 'SEATBELT_PROFILE' ||
    key === 'NODE_OPTIONS'
  );
}

function sanitizeEnvValue(key: string, value: string): string {
  if (SENSITIVE_ENV_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (key.includes('PROXY')) {
    return sanitizeProxyValue(value);
  }

  return value.length > 256 ? `${value.slice(0, 256)}...` : value;
}

function buildSanitizedEnvironmentSnapshot(): Record<string, string> {
  const capturedEntries = Object.entries(process.env)
    .filter(([key, value]) => !!value && shouldCaptureEnvKey(key))
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, sanitizeEnvValue(key, value as string)] as const);

  return Object.fromEntries(capturedEntries);
}

function sanitizeBaseUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return sanitizeProxyValue(baseUrl);
}

async function createBugReproBundle(
  context: CommandContext,
  bugDescription: string,
  infoMarkdown: string,
  systemInfo: Awaited<ReturnType<typeof getExtendedSystemInfo>>,
): Promise<string> {
  const targetDir = context.services.config?.getTargetDir() ?? process.cwd();
  const bundleDir = path.join(targetDir, BUG_BUNDLE_RELATIVE_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundlePath = path.join(bundleDir, `bug-repro-${timestamp}.json`);
  const config = context.services.config;

  const payload = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    title: bugDescription,
    diagnosticsMarkdown: infoMarkdown,
    systemInfo: {
      ...systemInfo,
      sessionId: redactSessionId(systemInfo.sessionId),
      baseUrl: sanitizeBaseUrl(systemInfo.baseUrl),
    },
    runtime: {
      cwd: path.basename(process.cwd()),
      targetDir: path.basename(targetDir),
      model:
        typeof config?.getModel === 'function'
          ? config.getModel()
          : undefined,
      approvalMode:
        typeof config?.getApprovalMode === 'function'
          ? config.getApprovalMode()
          : undefined,
      sandboxCommand:
        typeof config?.getSandbox === 'function'
          ? config.getSandbox()?.command
          : undefined,
      outputFormat:
        typeof config?.getOutputFormat === 'function'
          ? config.getOutputFormat()
          : undefined,
      inputFormat:
        typeof config?.getInputFormat === 'function'
          ? config.getInputFormat()
          : undefined,
    },
    environment: buildSanitizedEnvironmentSnapshot(),
    reproTemplate: {
      summary: bugDescription || 'Describe the observed failure here.',
      expected: 'Describe expected behavior.',
      observed: 'Describe actual behavior, including errors.',
      steps: [
        'List exact commands and prompts used.',
        'Attach this bundle JSON file to your bug report.',
      ],
    },
  };

  await fs.mkdir(bundleDir, { recursive: true });
  await fs.writeFile(bundlePath, JSON.stringify(payload, null, 2), 'utf8');
  return bundlePath;
}

export const bugCommand: SlashCommand = {
  name: 'bug',
  get description() {
    return t('submit a bug report');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args?: string): Promise<void> => {
    const bugDescription = (args || '').trim();
    const systemInfo = await getExtendedSystemInfo(context);

    const fields = getSystemInfoFields(systemInfo);

    // Generate bug report info using the same field configuration
    let info = '\n';
    for (const field of fields) {
      info += `* **${field.label}:** ${getFieldValue(field, systemInfo)}\n`;
    }

    let bugReportUrl =
      'https://github.com/azharlabs/papert-code/issues/new?template=bug_report.yml&title={title}&info={info}';

    const bugCommandSettings = context.services.config?.getBugCommand();
    if (bugCommandSettings?.urlTemplate) {
      bugReportUrl = bugCommandSettings.urlTemplate;
    }

    bugReportUrl = bugReportUrl
      .replace('{title}', encodeURIComponent(bugDescription))
      .replace('{info}', encodeURIComponent(info));

    let bundlePath: string | undefined;
    try {
      bundlePath = await createBugReproBundle(
        context,
        bugDescription,
        info,
        systemInfo,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `Could not create local diagnostics bundle: ${errorMessage}`,
        },
        Date.now(),
      );
    }

    const infoLines = [
      'To submit your bug report, please open the following URL in your browser:',
      bugReportUrl,
    ];
    if (bundlePath) {
      infoLines.push(
        '',
        `A sanitized diagnostics bundle was saved to:`,
        bundlePath,
        'Attach this file to your bug report to improve reproduction quality.',
      );
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: infoLines.join('\n'),
      },
      Date.now(),
    );

    try {
      await open(bugReportUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `Could not open URL in browser: ${errorMessage}`,
        },
        Date.now(),
      );
    }
  },
};
