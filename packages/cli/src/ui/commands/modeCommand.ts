/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApprovalMode } from '@papert-code/papert-code-core';
import { SettingScope } from '../../config/settings.js';
import { loadCustomModes } from '../../modes/customModes.js';
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

function isBuiltInModeProfile(value: string): value is ModeProfileName {
  return value === 'build' || value === 'plan' || value === 'review';
}

function parseModeArgs(rawArgs: string): {
  profile?: string;
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

  return {
    profile: profileArg,
    scope,
  };
}

function formatModeSummary(
  context: CommandContext,
  customModes: Awaited<ReturnType<typeof loadCustomModes>>,
): string {
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
    ...(customModes.length > 0
      ? [
          '',
          'Custom markdown profiles:',
          ...customModes.map(
            (mode) =>
              `- ${mode.name}: ${mode.description} (approval-mode=${mode.approvalMode}, source=${mode.source})`,
          ),
        ]
      : []),
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

    const workingDir =
      config.getWorkingDir?.() ??
      config.getTargetDir?.() ??
      process.cwd();
    let customModes: Awaited<ReturnType<typeof loadCustomModes>>;
    try {
      customModes = await loadCustomModes(workingDir);
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          error instanceof Error
            ? error.message
            : 'Failed to load custom markdown modes.',
      };
    }

    if (!parsed.profile) {
      return {
        type: 'message',
        messageType: 'info',
        content: formatModeSummary(context, customModes),
      };
    }

    const builtInProfile = isBuiltInModeProfile(parsed.profile)
      ? parsed.profile
      : undefined;
    const customMode = builtInProfile
      ? undefined
      : customModes.find((mode) => mode.name === parsed.profile);
    if (!builtInProfile && !customMode) {
      return {
        type: 'message',
        messageType: 'error',
        content:
          'Unknown mode profile. Valid built-in profiles: build, plan, review. Use /mode to list custom markdown profiles.',
      };
    }

    const approvalMode = builtInProfile
      ? MODE_PROFILE_INFO[builtInProfile].approvalMode
      : customMode!.approvalMode;

    try {
      if (builtInProfile && typeof config.setModeProfile === 'function') {
        config.setModeProfile(builtInProfile);
      } else if (typeof config.setApprovalMode === 'function') {
        if (typeof config.setModeProfile === 'function') {
          config.setModeProfile(undefined);
        }
        config.setApprovalMode(approvalMode);
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
        'tools.approvalMode',
        approvalMode,
      );
      if (builtInProfile) {
        context.services.settings.setValue(
          parsed.scope,
          'tools.modeProfile',
          builtInProfile,
        );
        context.services.settings.setValue(
          parsed.scope,
          'tools.customMode',
          undefined,
        );
      } else {
        context.services.settings.setValue(
          parsed.scope,
          'tools.customMode',
          customMode!.name,
        );
        context.services.settings.setValue(
          parsed.scope,
          'tools.modeProfile',
          undefined,
        );
      }
      persistenceMessage =
        parsed.scope === SettingScope.Workspace
          ? 'Saved to workspace settings.'
          : 'Saved to user settings.';
    }

    return {
      type: 'message',
      messageType: 'info',
      content: `Mode profile switched to "${parsed.profile}" (approval-mode=${approvalMode}). ${persistenceMessage}`,
    };
  },
  completion: async (context, partialArg) => {
    const workingDir =
      context.services.config?.getWorkingDir?.() ??
      context.services.config?.getTargetDir?.() ??
      process.cwd();
    let customModes: Awaited<ReturnType<typeof loadCustomModes>> = [];
    try {
      customModes = await loadCustomModes(workingDir);
    } catch {
      // ignore completion errors for optional custom modes
    }
    const candidates = [
      'build',
      'plan',
      'review',
      ...customModes.map((mode) => mode.name),
      '--project',
      '--user',
    ];
    return candidates.filter((candidate) => candidate.startsWith(partialArg));
  },
};
