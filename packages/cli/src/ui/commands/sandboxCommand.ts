/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';
import { resolveCommandPath } from '@papert-code/papert-code-core';
import {
  type CommandContext,
  type SlashCommand,
  type SlashCommandActionReturn,
  CommandKind,
} from './types.js';

const DIAGNOSTIC_TOOL_COMMANDS = [
  'docker',
  'podman',
  'sandbox-exec',
  'git',
  'node',
  'npm',
];

function parseDeclaredMounts(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readIdentity(): { uid: number | null; gid: number | null; user: string } {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  const gid = typeof process.getgid === 'function' ? process.getgid() : null;
  let user = 'unknown';
  try {
    user = os.userInfo().username;
  } catch {
    // ignored
  }
  return { uid, gid, user };
}

function formatPresence(name: string): string {
  return process.env[name] ? 'set' : 'unset';
}

async function getRuntimeMountSample(): Promise<string> {
  try {
    const mounts = await fs.readFile('/proc/self/mounts', 'utf8');
    const sample = mounts
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(0, 4)
      .map((line) => {
        const parts = line.split(' ');
        const source = parts[0] ?? 'unknown';
        const target = parts[1] ?? 'unknown';
        const fsType = parts[2] ?? 'unknown';
        return `${target} (${fsType}) <- ${source}`;
      });
    return sample.length > 0 ? sample.join(' | ') : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function validateArgs(args: string): string | null {
  const normalized = args.trim();
  if (!normalized) {
    return null;
  }

  if (normalized === 'diagnose') {
    return null;
  }

  return 'Usage: /sandbox [diagnose]';
}

async function runSandboxDiagnostics(
  context: CommandContext,
): Promise<SlashCommandActionReturn> {
  const config = context.services.config;
  const sandboxConfig = config?.getSandbox();
  const declaredMounts = parseDeclaredMounts(process.env['SANDBOX_MOUNTS']);
  const runtimeMountSample = await getRuntimeMountSample();
  const identity = readIdentity();
  const toolStatuses = DIAGNOSTIC_TOOL_COMMANDS.map((tool) => {
    const resolved = resolveCommandPath(tool);
    return {
      tool,
      available: !!resolved.path,
      path: resolved.path,
      error: resolved.error?.message,
    };
  });

  const lines = [
    'Sandbox self-diagnostics',
    '',
    'Profile',
    `- configured sandbox command: ${sandboxConfig?.command ?? 'none'}`,
    `- configured sandbox image: ${sandboxConfig?.image ?? 'n/a'}`,
    `- active SANDBOX env: ${process.env['SANDBOX'] ?? 'unset'}`,
    `- seatbelt profile: ${process.env['SEATBELT_PROFILE'] ?? 'unset'}`,
    `- restrictive profile: ${config?.isRestrictiveSandbox() ? 'yes' : 'no'}`,
    '',
    'Mounts',
    `- workspace root: ${config?.getTargetDir() ?? process.cwd()}`,
    `- declared SANDBOX_MOUNTS: ${declaredMounts.length > 0 ? declaredMounts.join(', ') : 'none'}`,
    `- runtime mount sample: ${runtimeMountSample}`,
    '',
    'Network',
    `- HTTP_PROXY: ${formatPresence('HTTP_PROXY')}`,
    `- HTTPS_PROXY: ${formatPresence('HTTPS_PROXY')}`,
    `- NO_PROXY: ${formatPresence('NO_PROXY')}`,
    `- sandbox proxy command: ${
      process.env['PAPERT_SANDBOX_PROXY_COMMAND'] ||
      process.env['GEMINI_SANDBOX_PROXY_COMMAND']
        ? 'set'
        : 'unset'
    }`,
    '',
    'Identity',
    `- user: ${identity.user}`,
    `- uid/gid: ${identity.uid ?? 'n/a'}/${identity.gid ?? 'n/a'}`,
    `- SANDBOX_SET_UID_GID: ${process.env['SANDBOX_SET_UID_GID'] ?? 'auto'}`,
    '',
    'Tool availability',
    ...toolStatuses.map((status) => {
      if (status.available && status.path) {
        return `- ${status.tool}: available (${status.path})`;
      }
      return `- ${status.tool}: missing${status.error ? ` (${status.error})` : ''}`;
    }),
  ];

  return {
    type: 'message',
    messageType: 'info',
    content: lines.join('\n'),
  };
}

export const sandboxCommand: SlashCommand = {
  name: 'sandbox',
  description: 'Run sandbox self-diagnostics. Usage: /sandbox [diagnose]',
  kind: CommandKind.BUILT_IN,
  action: async (context, args) => {
    const argError = validateArgs(args);
    if (argError) {
      return {
        type: 'message',
        messageType: 'error',
        content: argError,
      };
    }

    return runSandboxDiagnostics(context);
  },
  completion: async (_context, partialArg) => {
    if (!'diagnose'.startsWith(partialArg)) {
      return [];
    }
    return ['diagnose'];
  },
};
