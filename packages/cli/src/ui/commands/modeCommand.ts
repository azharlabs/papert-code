/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode } from '@papert-code/papert-code-core';
import { SettingScope } from '../../config/settings.js';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

type ModeProfileName = 'build' | 'plan' | 'review';

const MODE_PROFILE_INFO: Record<
  ModeProfileName,
  { description: string; approvalMode: ApprovalMode }
> = {
  build: {
    description:
      'Implementation mode that enables coding and shell workflows with minimal friction.',
    approvalMode: ApprovalMode.AUTO_EDIT,
  },
  plan: {
    description:
      'Planning mode that keeps the session focused on analysis before changes.',
    approvalMode: ApprovalMode.PLAN,
  },
  review: {
    description:
      'Review mode that keeps tool usage read-oriented for audits and code review.',
    approvalMode: ApprovalMode.DEFAULT,
  },
};

function parseModeArgs(rawArgs: string): {
  profile?: ModeProfileName;
  scope?: SettingScope;
  error?: string;
} {
  const args = rawArgs
    .split(/\s+/)
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);

  if (args.length === 0) {
    return {};
  }

  let scope: SettingScope | undefined;
  let profileArg: string | undefined;
  for (const arg of args) {
    if (arg === '--project' || arg === '--workspace') {
      if (scope && scope !== SettingScope.Workspace) {
        return {
          error: 'Use only one scope flag: --project or --user',
        };
      }
      scope = SettingScope.Workspace;
      continue;
    }
    if (arg === '--user') {
      if (scope && scope !== SettingScope.User) {
        return {
          error: 'Use only one scope flag: --project or --user',
        };
      }
      scope = SettingScope.User;
      continue;
    }
    if (arg.startsWith('--')) {
      return {
        error:
          'Unknown flag. Usage: /mode [build|plan|review] [--project|--user]',
      };
    }
    if (profileArg) {
      return {
        error:
          'Too many arguments. Usage: /mode [build|plan|review] [--project|--user]',
      };
    }
    profileArg = arg.toLowerCase();
  }

  if (!profileArg) {
    return { scope };
  }

  if (
    profileArg !== 'build' &&
    profileArg !== 'plan' &&
    profileArg !== 'review'
  ) {
    return {
      error:
        'Unknown mode profile. Valid profiles: build, plan, review',
    };
  }

  return {
    profile: profileArg as ModeProfileName,
    scope,
  };
}

function formatModeSummary(context: CommandContext): string {
  const config = context.services.config;
  const currentProfile = config?.getModeProfile?.();
  const currentApprovalMode = config?.getApprovalMode?.();

  const lines = [
    `Current mode profile: ${currentProfile ?? 'none'}`,
    `Current approval mode: ${currentApprovalMode ?? 'unknown'}`,
    '',
    'Available profiles:',
    ...Object.entries(MODE_PROFILE_INFO).map(
      ([profileId, profile]) =>
        `- ${profileId}: ${profile.description} (approval-mode=${profile.approvalMode})`,
    ),
    '',
    'Usage:',
    '- /mode',
    '- /mode build',
    '- /mode plan --project',
    '- /mode review --user',
  ];
  return lines.join('\n');
}

export const modeCommand: SlashCommand = {
  name: 'mode',
  description:
    'Switch mode profiles (build/plan/review) with optional persistence scope.',
  kind: CommandKind.BUILT_IN,
  action: async (
    context,
    args,
  ): Promise<SlashCommandActionReturn> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const parsed = parseModeArgs(args);
    if (parsed.error) {
      return {
        type: 'message',
        messageType: 'error',
        content: parsed.error,
      };
    }

    if (!parsed.profile) {
      return {
        type: 'message',
        messageType: 'info',
        content: formatModeSummary(context),
      };
    }

    const profileInfo = MODE_PROFILE_INFO[parsed.profile];
    try {
      if (typeof config.setModeProfile === 'function') {
        config.setModeProfile(parsed.profile);
      } else if (typeof config.setApprovalMode === 'function') {
        config.setApprovalMode(profileInfo.approvalMode);
      } else {
        return {
          type: 'message',
          messageType: 'error',
          content: 'Configuration does not support mode switching.',
        };
      }
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          error instanceof Error
            ? error.message
            : 'Failed to switch mode profile.',
      };
    }

    let persistenceMessage = 'Session-only change.';
    if (parsed.scope) {
      context.services.settings.setValue(
        parsed.scope,
        'tools.modeProfile',
        parsed.profile,
      );
      context.services.settings.setValue(
        parsed.scope,
        'tools.approvalMode',
        profileInfo.approvalMode,
      );
      persistenceMessage =
        parsed.scope === SettingScope.Workspace
          ? 'Saved to workspace settings.'
          : 'Saved to user settings.';
    }

    return {
      type: 'message',
      messageType: 'info',
      content: `Mode profile switched to "${parsed.profile}" (approval-mode=${profileInfo.approvalMode}). ${persistenceMessage}`,
    };
  },
  completion: async (_context, partialArg) => {
    const candidates = ['build', 'plan', 'review', '--project', '--user'];
    return candidates.filter((candidate) => candidate.startsWith(partialArg));
  },
};
