/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType, type HistoryItemScheduleList } from '../types.js';
import {
  TaskScheduler,
  resolveSchedulerStorePath,
  readRunLogEntries,
  type ScheduledJob,
  type SchedulerLogger,
  type SchedulerRunResult,
  type SchedulerDeliveryTarget,
} from '@papert-code/papert-code-core';
import { parse } from 'shell-quote';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseDurationMs, formatDurationMs } from '../../utils/duration.js';
import { t } from '../../i18n/index.js';
import { appEvents, AppEvent } from '../../utils/events.js';

const DEFAULT_MAX_CONCURRENT = 1;

type PapertSchedulePayload =
  | {
      kind: 'prompt';
      prompt: string;
      cwd?: string;
      model?: string;
      approvalMode?: 'plan' | 'default' | 'auto-edit' | 'yolo';
      outputFormat?: 'text' | 'json' | 'stream-json';
      maxSessionTurns?: number;
    }
  | {
      kind: 'heartbeat';
      text: string;
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

function buildDeliveryTarget(tokens: string[]): SchedulerDeliveryTarget | undefined {
  const target = getFlagValue(tokens, '--deliver');
  if (!target) return undefined;
  if (target === 'slack') {
    const url = getFlagValue(tokens, '--deliver-url');
    if (!url) return undefined;
    return { kind: 'slack_webhook', url };
  }
  if (target === 'discord') {
    const url = getFlagValue(tokens, '--deliver-url');
    if (!url) return undefined;
    return { kind: 'discord_webhook', url };
  }
  if (target === 'telegram') {
    const token = getFlagValue(tokens, '--telegram-token');
    const chatId = getFlagValue(tokens, '--telegram-chat-id');
    if (!token || !chatId) return undefined;
    return { kind: 'telegram_bot', token, chatId };
  }
  if (target === 'none') return { kind: 'none' };
  return undefined;
}

function resolveCwd(context: CommandContext, argsTokens: string[]): string {
  const override = getFlagValue(argsTokens, '--cwd');
  if (override) return path.resolve(override);
  const configCwd = context.services.config?.getWorkingDir?.();
  return configCwd ?? process.cwd();
}

function parsePapertJsonOutput(raw: string): string | null {
  const lines = raw.split('\n').filter(Boolean);
  const lastLine = lines[lines.length - 1];
  if (!lastLine) return null;
  try {
    const payload = JSON.parse(lastLine) as Array<Record<string, unknown>>;
    const result = payload.find((item) => item['type'] === 'result');
    if (result && typeof result['result'] === 'string') {
      return result['result'];
    }
    const lastAssistant = [...payload]
      .reverse()
      .find((item) => item['type'] === 'assistant');
    if (lastAssistant && typeof lastAssistant['message'] === 'object') {
      const message = lastAssistant['message'] as { content?: Array<{ text?: string }> };
      const text = message.content?.map((part) => part.text ?? '').join('');
      return text ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

async function deliverToTarget(target: SchedulerDeliveryTarget, text: string): Promise<void> {
  if (!text.trim()) return;
  if (target.kind === 'slack_webhook' || target.kind === 'discord_webhook') {
    await fetch(target.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return;
  }
  if (target.kind === 'telegram_bot') {
    const url = `https://api.telegram.org/bot${target.token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: target.chatId, text }),
    });
  }
}

async function runIsolatedPapert(
  entrypoint: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', () => {
      const parsed = parsePapertJsonOutput(stdout);
      if (parsed) return resolve(parsed);
      if (stderr.trim()) return resolve(stderr.trim());
      resolve(stdout.trim());
    });
  });
}

function resolveDeliveryBody(
  job: ScheduledJob<PapertSchedulePayload>,
  summary: string,
  outputText?: string,
): string {
  const mode = job.isolation?.postToMainMode ?? 'summary';
  if (mode === 'full') {
    const maxCharsRaw = job.isolation?.postToMainMaxChars;
    const maxChars = Number.isFinite(maxCharsRaw) ? Math.max(0, maxCharsRaw as number) : 4000;
    const fullText = (outputText ?? '').trim();
    if (!fullText) return summary;
    return fullText.length > maxChars ? `${fullText.slice(0, maxChars)}...` : fullText;
  }
  return summary;
}

async function runPromptJob(
  job: ScheduledJob<PapertSchedulePayload>,
  fallbackCwd: string,
): Promise<SchedulerRunResult> {
  const payload = job.payload;
  if (!payload) {
    return { status: 'skipped', error: 'missing payload' };
  }

  const sessionTarget = job.sessionTarget ?? 'main';

  if (payload.kind === 'heartbeat') {
    const text = payload.text?.trim();
    if (!text) return { status: 'skipped', error: 'missing heartbeat text' };

    if (sessionTarget === 'main') {
      appEvents.emit(AppEvent.NotifyMessage, { content: text, type: 'info' });
    }

    if (job.delivery && job.delivery.kind !== 'none') {
      await deliverToTarget(job.delivery, text);
    }

    return { status: 'ok', summary: text, outputText: text };
  }

  if (!payload.prompt?.trim()) {
    return { status: 'skipped', error: 'missing prompt payload' };
  }

  if (sessionTarget === 'main') {
    appEvents.emit(AppEvent.SubmitPrompt, {
      content: payload.prompt,
    });
    return { status: 'ok', summary: 'submitted' };
  }

  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return { status: 'error', error: 'missing CLI entrypoint path' };
  }

  const cwd = payload.cwd ? path.resolve(payload.cwd) : fallbackCwd;
  const args: string[] = [];
  if (payload.model) args.push('--model', payload.model);
  if (payload.approvalMode) args.push('--approval-mode', payload.approvalMode);
  args.push('--output-format', payload.outputFormat ?? 'json');
  if (typeof payload.maxSessionTurns === 'number') {
    args.push('--max-session-turns', String(payload.maxSessionTurns));
  }
  args.push(payload.prompt);

  const outputText = await runIsolatedPapert(entrypoint, args, cwd);
  const summary = outputText?.trim() || 'completed';

  const postMode = job.isolation?.postToMainMode ?? 'summary';
  const postPrefix = job.isolation?.postToMainPrefix?.trim() || 'Schedule';
  if (postMode === 'summary' || postMode === 'full') {
    const body = resolveDeliveryBody(job, summary, outputText);
    appEvents.emit(AppEvent.NotifyMessage, {
      content: `${postPrefix}: ${body}`,
      type: 'info',
    });
  }

  if (job.delivery && job.delivery.kind !== 'none') {
    const deliveryText = resolveDeliveryBody(job, summary, outputText);
    await deliverToTarget(job.delivery, deliveryText);
  }

  return { status: 'ok', summary, outputText };
}

function createScheduler(
  cwd: string,
  opts?: { maxConcurrentRuns?: number; queuePolicy?: 'queue' | 'skip' },
): TaskScheduler<PapertSchedulePayload> {
  return new TaskScheduler<PapertSchedulePayload>({
    storePath: resolveSchedulerStorePath(cwd),
    log: schedulerLogger,
    schedulerEnabled: true,
    maxConcurrentRuns: opts?.maxConcurrentRuns,
    queuePolicy: opts?.queuePolicy,
    runJob: (job) => runPromptJob(job, cwd),
  });
}

function formatJob(job: ScheduledJob<PapertSchedulePayload>): string {
  const scheduleLabel =
    job.schedule.kind === 'every'
      ? `every ${formatDurationMs(job.schedule.everyMs)}`
      : job.schedule.kind === 'cron'
        ? `cron ${job.schedule.expr}${job.schedule.tz ? ` (${job.schedule.tz})` : ''}`
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

function buildGuideText(): string {
  return [
    'Cron vs heartbeat guidance:',
    '- Use cron when you need specific times or weekdays (e.g. 0 9 * * 1-5).',
    '- Use heartbeat when you want lightweight reminders or periodic check-ins.',
    '- Prefer isolated jobs for long prompts or heavy context to avoid blocking the main UI.',
    '',
    'Preset schedules:',
    '- hourly',
    '- daily',
    '- weekday-morning',
    '- heartbeat-5m',
    '- heartbeat-15m',
  ].join('\n');
}

function helpText(): string {
  return [
    'Schedule commands:',
    '  /schedule panel [--all] [--cwd <path>]',
    '  /schedule list [--all] [--cwd <path>]',
    '  /schedule add --name "Job" --prompt "..." --every 10m [--cwd <path>]',
    '  /schedule add --name "Job" --prompt "..." --cron "0 7 * * *" --tz "America/Los_Angeles"',
    '  /schedule add --name "Job" --prompt "..." --at 2026-02-01T09:00:00Z [--cwd <path>]',
    '  /schedule heartbeat --name "Check-in" --text "Ping" --every 15m',
    '  /schedule update <id> [--name ...] [--prompt ...] [--every|--cron|--at|--preset ...]',
    '  /schedule start [--cwd <path>] [--max-concurrent 2] [--queue-policy skip]',
    '  /schedule status [--cwd <path>]',
    '  /schedule run <id> [--force] [--cwd <path>]',
    '  /schedule enable <id> [--cwd <path>]',
    '  /schedule disable <id> [--cwd <path>]',
    '  /schedule remove <id> [--cwd <path>]',
    '  /schedule runs <id> [--limit 20]',
    '  /schedule guide',
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
      name: 'guide',
      get description() {
        return t('Show guidance on cron vs heartbeat schedules.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        context.ui.addItem(
          { type: MessageType.INFO, text: buildGuideText() },
          Date.now(),
        );
      },
    },
    {
      name: 'panel',
      get description() {
        return t('Display scheduled jobs in a panel view.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        const jobs = await scheduler.list({ includeDisabled: hasFlag(tokens, '--all') });
        const panelItem: HistoryItemScheduleList = {
          type: MessageType.SCHEDULE_LIST,
          cwd,
          jobs,
        };
        context.ui.addItem(panelItem, Date.now());
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
        const heartbeat = hasFlag(tokens, '--heartbeat');
        const heartbeatText = getFlagValue(tokens, '--text');
        const every = getFlagValue(tokens, '--every');
        const at = getFlagValue(tokens, '--at');
        const cron = getFlagValue(tokens, '--cron');
        const tz = getFlagValue(tokens, '--tz');
        const preset = getFlagValue(tokens, '--preset');

        if (!name) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Missing --name.') },
            Date.now(),
          );
          return;
        }

        if (!heartbeat && !prompt) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Missing --prompt.') },
            Date.now(),
          );
          return;
        }

        if (heartbeat && !heartbeatText) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Heartbeat requires --text.') },
            Date.now(),
          );
          return;
        }

        const scheduleCount = [every, at, cron, preset].filter(Boolean).length;
        if (scheduleCount !== 1) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: t('Provide exactly one schedule: --every, --at, --cron, or --preset.'),
            },
            Date.now(),
          );
          return;
        }

        const schedule =
          preset
            ? (() => {
                switch (preset) {
                  case 'hourly':
                    return { kind: 'every' as const, everyMs: 60 * 60_000, anchorMs: Date.now() };
                  case 'daily':
                    return {
                      kind: 'every' as const,
                      everyMs: 24 * 60 * 60_000,
                      anchorMs: Date.now(),
                    };
                  case 'heartbeat-5m':
                    return { kind: 'every' as const, everyMs: 5 * 60_000, anchorMs: Date.now() };
                  case 'heartbeat-15m':
                    return { kind: 'every' as const, everyMs: 15 * 60_000, anchorMs: Date.now() };
                  case 'weekday-morning':
                    return { kind: 'cron' as const, expr: '0 9 * * 1-5', tz: undefined };
                  default:
                    return null;
                }
              })()
            : every
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
                : cron
                  ? (() => {
                      return { kind: 'cron' as const, expr: cron, tz: tz || undefined };
                    })()
                  : null;

        if (!schedule) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Invalid schedule format.') },
            Date.now(),
          );
          return;
        }

        const payload: PapertSchedulePayload = heartbeat
          ? { kind: 'heartbeat', text: heartbeatText ?? '' }
          : {
              kind: 'prompt',
              prompt: prompt ?? '',
              cwd,
              model: getFlagValue(tokens, '--model'),
              approvalMode: getFlagValue(tokens, '--approval-mode') as
                | Extract<PapertSchedulePayload, { kind: 'prompt' }>['approvalMode']
                | undefined,
              outputFormat: getFlagValue(tokens, '--output-format') as
                | Extract<PapertSchedulePayload, { kind: 'prompt' }>['outputFormat']
                | undefined,
              maxSessionTurns: (() => {
                const raw = getFlagValue(tokens, '--max-session-turns');
                return raw ? Number(raw) : undefined;
              })(),
            };

        const sessionTarget = getFlagValue(tokens, '--session-target') as
          | 'main'
          | 'isolated'
          | undefined;

        const delivery = buildDeliveryTarget(tokens);

        const scheduler = createScheduler(cwd);
        const job = await scheduler.add({
          name,
          enabled: !hasFlag(tokens, '--disabled'),
          deleteAfterRun: hasFlag(tokens, '--delete-after-run'),
          noOverlap: hasFlag(tokens, '--no-overlap'),
          schedule,
          payload,
          sessionTarget,
          wakeMode: getFlagValue(tokens, '--wake-mode') as 'now' | 'next-heartbeat' | undefined,
          isolation: {
            postToMainPrefix: getFlagValue(tokens, '--post-to-main-prefix') ?? undefined,
            postToMainMode: getFlagValue(tokens, '--post-to-main-mode') as
              | 'summary'
              | 'full'
              | undefined,
            postToMainMaxChars: (() => {
              const raw = getFlagValue(tokens, '--post-to-main-max-chars');
              return raw ? Number(raw) : undefined;
            })(),
          },
          delivery,
        });

        context.ui.addItem(
          { type: MessageType.INFO, text: `Scheduled job ${job.id}` },
          Date.now(),
        );
      },
    },
    {
      name: 'heartbeat',
      get description() {
        return t('Add a heartbeat check-in job.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);
        const name = getFlagValue(tokens, '--name');
        const text = getFlagValue(tokens, '--text');
        const every = getFlagValue(tokens, '--every');
        const cron = getFlagValue(tokens, '--cron');
        const tz = getFlagValue(tokens, '--tz');
        const preset = getFlagValue(tokens, '--preset');

        if (!name || !text) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Missing --name or --text.') },
            Date.now(),
          );
          return;
        }

        const scheduleCount = [every, cron, preset].filter(Boolean).length;
        if (scheduleCount !== 1) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Provide --every, --cron, or --preset.') },
            Date.now(),
          );
          return;
        }

        const schedule =
          preset
            ? (() => {
                switch (preset) {
                  case 'heartbeat-5m':
                    return { kind: 'every' as const, everyMs: 5 * 60_000, anchorMs: Date.now() };
                  case 'heartbeat-15m':
                    return { kind: 'every' as const, everyMs: 15 * 60_000, anchorMs: Date.now() };
                  default:
                    return null;
                }
              })()
            : every
              ? (() => {
                  const durationMs = parseDurationMs(every);
                  if (!durationMs) return null;
                  return { kind: 'every' as const, everyMs: durationMs, anchorMs: Date.now() };
                })()
              : cron
                ? (() => {
                    return { kind: 'cron' as const, expr: cron, tz: tz || undefined };
                  })()
                : null;

        if (!schedule) {
          context.ui.addItem(
            { type: MessageType.ERROR, text: t('Invalid schedule format.') },
            Date.now(),
          );
          return;
        }

        const delivery = buildDeliveryTarget(tokens);

        const scheduler = createScheduler(cwd);
        const job = await scheduler.add({
          name,
          enabled: !hasFlag(tokens, '--disabled'),
          noOverlap: true,
          schedule,
          payload: { kind: 'heartbeat', text },
          delivery,
        });

        context.ui.addItem(
          { type: MessageType.INFO, text: `Scheduled heartbeat ${job.id}` },
          Date.now(),
        );
      },
    },
    {
      name: 'update',
      get description() {
        return t('Update a scheduled job.');
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

        const scheduleFlags = ['--every', '--cron', '--at', '--preset'].filter((flag) =>
          tokens.includes(flag),
        );
        const schedule = scheduleFlags.length
          ? (() => {
              const every = getFlagValue(tokens, '--every');
              const at = getFlagValue(tokens, '--at');
              const cron = getFlagValue(tokens, '--cron');
              const tz = getFlagValue(tokens, '--tz');
              const preset = getFlagValue(tokens, '--preset');
              if (preset) {
                switch (preset) {
                  case 'hourly':
                    return { kind: 'every' as const, everyMs: 60 * 60_000, anchorMs: Date.now() };
                  case 'daily':
                    return {
                      kind: 'every' as const,
                      everyMs: 24 * 60 * 60_000,
                      anchorMs: Date.now(),
                    };
                  case 'heartbeat-5m':
                    return { kind: 'every' as const, everyMs: 5 * 60_000, anchorMs: Date.now() };
                  case 'heartbeat-15m':
                    return { kind: 'every' as const, everyMs: 15 * 60_000, anchorMs: Date.now() };
                  case 'weekday-morning':
                    return { kind: 'cron' as const, expr: '0 9 * * 1-5', tz: undefined };
                  default:
                    return undefined;
                }
              }
              if (every) {
                const durationMs = parseDurationMs(every);
                if (!durationMs) return undefined;
                return { kind: 'every' as const, everyMs: durationMs, anchorMs: Date.now() };
              }
              if (at) {
                const parsed = Date.parse(at);
                if (!Number.isFinite(parsed)) return undefined;
                return { kind: 'at' as const, atMs: parsed };
              }
              if (cron) {
                return { kind: 'cron' as const, expr: cron, tz: tz || undefined };
              }
              return undefined;
            })()
          : undefined;

        const heartbeat = hasFlag(tokens, '--heartbeat');
        const payload = (() => {
          if (heartbeat) {
            const text = getFlagValue(tokens, '--text');
            if (!text) return undefined;
            return { kind: 'heartbeat', text } as PapertSchedulePayload;
          }
          const prompt = getFlagValue(tokens, '--prompt');
          if (prompt) return { kind: 'prompt', prompt } as PapertSchedulePayload;
          return undefined;
        })();

        const delivery = buildDeliveryTarget(tokens);

        const patch = {
          name: getFlagValue(tokens, '--name') ?? undefined,
          enabled: hasFlag(tokens, '--enabled') ? true : hasFlag(tokens, '--disabled') ? false : undefined,
          deleteAfterRun: hasFlag(tokens, '--delete-after-run') ? true : undefined,
          noOverlap: hasFlag(tokens, '--no-overlap') ? true : undefined,
          schedule,
          payload,
          sessionTarget: getFlagValue(tokens, '--session-target') as 'main' | 'isolated' | undefined,
          wakeMode: getFlagValue(tokens, '--wake-mode') as 'now' | 'next-heartbeat' | undefined,
          isolation: {
            postToMainPrefix: getFlagValue(tokens, '--post-to-main-prefix') ?? undefined,
            postToMainMode: getFlagValue(tokens, '--post-to-main-mode') as
              | 'summary'
              | 'full'
              | undefined,
            postToMainMaxChars: (() => {
              const raw = getFlagValue(tokens, '--post-to-main-max-chars');
              return raw ? Number(raw) : undefined;
            })(),
          },
          delivery,
        };

        await scheduler.update(id, patch);

        context.ui.addItem(
          { type: MessageType.INFO, text: t('Job updated.') },
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
        const maxConcurrent = Number(getFlagValue(tokens, '--max-concurrent') ?? DEFAULT_MAX_CONCURRENT);
        const queuePolicy = getFlagValue(tokens, '--queue-policy') === 'skip' ? 'skip' : 'queue';

        if (activeScheduler && activeSchedulerCwd === cwd) {
          context.ui.addItem(
            { type: MessageType.INFO, text: t('Scheduler is already running.') },
            Date.now(),
          );
          return;
        }

        activeScheduler = createScheduler(cwd, {
          maxConcurrentRuns: maxConcurrent,
          queuePolicy,
        });
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
      name: 'status',
      get description() {
        return t('Show scheduler status.');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context, args) => {
        const tokens = tokenizeArgs(args);
        const cwd = resolveCwd(context, tokens);
        const scheduler = createScheduler(cwd);
        const status = await scheduler.status();
        context.ui.addItem(
          { type: MessageType.INFO, text: JSON.stringify(status, null, 2) },
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
      name: 'runs',
      get description() {
        return t('Show run history for a job.');
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
        const limitRaw = getFlagValue(tokens, '--limit');
        const limit = limitRaw ? Number(limitRaw) : 20;
        const cwd = resolveCwd(context, tokens);
        const entries = await readRunLogEntries(resolveSchedulerStorePath(cwd), id, {
          limit,
        });
        if (entries.length === 0) {
          context.ui.addItem(
            { type: MessageType.INFO, text: t('No run history found.') },
            Date.now(),
          );
          return;
        }
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: entries
              .map(
                (entry) =>
                  `${new Date(entry.runAtMs).toISOString()} | ${entry.status} | ${entry.summary ?? ''}`,
              )
              .join('\n'),
          },
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
