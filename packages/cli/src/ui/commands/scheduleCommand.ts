/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import {
  TaskScheduler,
  resolveSchedulerStorePath,
  type ScheduledJob,
  type SchedulerLogger,
  type SchedulerRunResult,
} from '@papert-code/papert-code-core';
import { parse } from 'shell-quote';
import path from 'node:path';
import { parseDurationMs, formatDurationMs } from '../../utils/duration.js';
import { t } from '../../i18n/index.js';
import { appEvents, AppEvent } from '../../utils/events.js';

type PapertSchedulePayload = {
  kind: 'prompt';
  prompt: string;
  cwd?: string;
  model?: string;
  approvalMode?: 'plan' | 'default' | 'auto-edit' | 'yolo';
  outputFormat?: 'text' | 'json' | 'stream-json';
  maxSessionTurns?: number;
};

const schedulerLogger: SchedulerLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

let activeScheduler: TaskScheduler<PapertSchedulePayload> | null = null;
let activeSchedulerCwd: string | null = null;
let keepAliveTimer: NodeJS.Timeout | null = null;

function tokenizeArgs(args: string): string[] {
  return parse(args)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getFlagValue(tokens: string[], flag: string): string | undefined {
  const index = tokens.indexOf(flag);
  if (index === -1) return undefined;
  const value = tokens[index + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function hasFlag(tokens: string[], flag: string): boolean {
  return tokens.includes(flag);
}

function resolveCwd(context: CommandContext, argsTokens: string[]): string {
  const override = getFlagValue(argsTokens, '--cwd');
  if (override) return path.resolve(override);
  const configCwd = context.services.config?.getWorkingDir?.();
  return configCwd ?? process.cwd();
}

async function runPromptJob(
  job: ScheduledJob<PapertSchedulePayload>,
  fallbackCwd: string,
): Promise<SchedulerRunResult> {
  const payload = job.payload;
  if (!payload || payload.kind !== 'prompt' || !payload.prompt?.trim()) {
    return { status: 'skipped', error: 'missing prompt payload' };
  }

  appEvents.emit(AppEvent.SubmitPrompt, {
    content: payload.prompt,
  });

  return { status: 'ok', summary: 'submitted' };
}

function createScheduler(cwd: string): TaskScheduler<PapertSchedulePayload> {
  return new TaskScheduler<PapertSchedulePayload>({
    storePath: resolveSchedulerStorePath(cwd),
    log: schedulerLogger,
    schedulerEnabled: true,
    runJob: (job) => runPromptJob(job, cwd),
  });
}

function formatJob(job: ScheduledJob<PapertSchedulePayload>): string {
  const scheduleLabel =
    job.schedule.kind === 'every'
      ? `every ${formatDurationMs(job.schedule.everyMs)}`
      : `at ${new Date(job.schedule.atMs).toISOString()}`;
  const nextRun =
    typeof job.state.nextRunAtMs === 'number'
      ? new Date(job.state.nextRunAtMs).toISOString()
      : 'n/a';
  const lastRun =
    typeof job.state.lastRunAtMs === 'number'
      ? new Date(job.state.lastRunAtMs).toISOString()
      : 'n/a';
  const status = job.state.lastStatus ?? 'never';
  return `${job.id} | ${job.enabled ? 'enabled' : 'disabled'} | ${scheduleLabel} | next ${nextRun} | last ${lastRun} | ${status} | ${job.name}`;
}

function helpText(): string {
  return [
    'Schedule commands:',
    '  /schedule list [--all] [--cwd <path>]',
    '  /schedule add --name "Job" --prompt "..." --every 10m [--cwd <path>]',
    '  /schedule add --name "Job" --prompt "..." --at 2026-02-01T09:00:00Z [--cwd <path>]',
    '  /schedule start [--cwd <path>]',
    '  /schedule run <id> [--force] [--cwd <path>]',
    '  /schedule enable <id> [--cwd <path>]',
    '  /schedule disable <id> [--cwd <path>]',
    '  /schedule remove <id> [--cwd <path>]',
  ].join('\n');
}

export const scheduleCommand: SlashCommand = {
  name: 'schedule',
  get description() {
    return t('Manage scheduled Papert prompts.');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'help',
      get description() {
        return t('Show schedule command usage.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        context.ui.addItem(
          { type: MessageType.INFO, text: helpText() },
          Date.now(),
        );
      },
    },
    {
      name: 'list',
      get description() {
        return t('List scheduled jobs.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        const jobs = await scheduler.list({ includeDisabled: hasFlag(tokens, '--all') });
        if (jobs.length === 0) {
          context.ui.addItem(
            { type: MessageType.INFO, text: t('No scheduled jobs found.') },
            Date.now(),
          );
          return;
        }
        context.ui.addItem(
          { type: MessageType.INFO, text: jobs.map(formatJob).join('\n') },
          Date.now(),
        );
      },
    },
    {
      name: 'add',
      get description() {
        return t('Add a scheduled job.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);
        const name = getFlagValue(tokens, '--name');
        const prompt = getFlagValue(tokens, '--prompt');
        const every = getFlagValue(tokens, '--every');
        const at = getFlagValue(tokens, '--at');

        if (!name || !prompt) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: t('Missing --name or --prompt.'),
            },
            Date.now(),
          );
          return;
        }

        if ((every && at) || (!every && !at)) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: t('Provide exactly one schedule: --every or --at.'),
            },
            Date.now(),
          );
          return;
        }

        const schedule =
          every && !at
            ? (() => {
                const durationMs = parseDurationMs(every);
                if (!durationMs) return null;
                return { kind: 'every' as const, everyMs: durationMs, anchorMs: Date.now() };
              })()
            : at
              ? (() => {
                  const parsed = Date.parse(at);
                  if (!Number.isFinite(parsed)) return null;
                  return { kind: 'at' as const, atMs: parsed };
                })()
              : null;

        if (!schedule) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Invalid schedule format.') },
            Date.now(),
          );
          return;
        }

        const payload: PapertSchedulePayload = {
          kind: 'prompt',
          prompt,
          cwd,
          model: getFlagValue(tokens, '--model'),
          approvalMode: getFlagValue(tokens, '--approval-mode') as
            | PapertSchedulePayload['approvalMode']
            | undefined,
          outputFormat: getFlagValue(tokens, '--output-format') as
            | PapertSchedulePayload['outputFormat']
            | undefined,
          maxSessionTurns: (() => {
            const raw = getFlagValue(tokens, '--max-session-turns');
            return raw ? Number(raw) : undefined;
          })(),
        };

        const scheduler = createScheduler(cwd);
        const job = await scheduler.add({
          name,
          enabled: !hasFlag(tokens, '--disabled'),
          deleteAfterRun: hasFlag(tokens, '--delete-after-run'),
          schedule,
          payload,
        });

        context.ui.addItem(
          { type: MessageType.INFO, text: `Scheduled job ${job.id}` },
          Date.now(),
        );
      },
    },
    {
      name: 'start',
      get description() {
        return t('Start the scheduler loop in this session.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);

        if (activeScheduler && activeSchedulerCwd === cwd) {
          context.ui.addItem(
            { type: MessageType.INFO, text: t('Scheduler is already running.') },
            Date.now(),
          );
          return;
        }

        activeScheduler = createScheduler(cwd);
        activeSchedulerCwd = cwd;
        await activeScheduler.start();
        if (!keepAliveTimer) {
          keepAliveTimer = setInterval(() => {}, 60_000);
        }

        context.ui.addItem(
          { type: MessageType.INFO, text: t('Scheduler started.') },
          Date.now(),
        );
      },
    },
    {
      name: 'run',
      get description() {
        return t('Run a scheduled job immediately.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const id = tokens.find((token) => !token.startsWith('--'));
        if (!id) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Provide a job id.') },
            Date.now(),
          );
          return;
        }
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        const result = await scheduler.run(id, hasFlag(tokens, '--force') ? 'force' : 'due');
        if (!result.ok) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Failed to run job.') },
            Date.now(),
          );
          return;
        }
        if (!result.ran) {
          context.ui.addItem(
            { type: MessageType.INFO, text: t('Job is not due yet.') },
            Date.now(),
          );
          return;
        }
        context.ui.addItem(
          { type: MessageType.INFO, text: t('Job executed.') },
          Date.now(),
        );
      },
    },
    {
      name: 'enable',
      get description() {
        return t('Enable a scheduled job.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const id = tokens.find((token) => !token.startsWith('--'));
        if (!id) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Provide a job id.') },
            Date.now(),
          );
          return;
        }
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        await scheduler.update(id, { enabled: true });
        context.ui.addItem(
          { type: MessageType.INFO, text: t('Job enabled.') },
          Date.now(),
        );
      },
    },
    {
      name: 'disable',
      get description() {
        return t('Disable a scheduled job.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const id = tokens.find((token) => !token.startsWith('--'));
        if (!id) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Provide a job id.') },
            Date.now(),
          );
          return;
        }
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        await scheduler.update(id, { enabled: false });
        context.ui.addItem(
          { type: MessageType.INFO, text: t('Job disabled.') },
          Date.now(),
        );
      },
    },
    {
      name: 'remove',
      get description() {
        return t('Remove a scheduled job.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const id = tokens.find((token) => !token.startsWith('--'));
        if (!id) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Provide a job id.') },
            Date.now(),
          );
          return;
        }
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        const result = await scheduler.remove(id);
        context.ui.addItem(
          {
            type: result.ok && result.removed ? MessageType.INFO : MessageType.ERROR,
            text: result.ok && result.removed ? t('Job removed.') : t('Job not found.'),
          },
          Date.now(),
        );
      },
    },
  ],
  action: async (context) => {
    context.ui.addItem(
      { type: MessageType.INFO, text: helpText() },
      Date.now(),
    );
  },
};
