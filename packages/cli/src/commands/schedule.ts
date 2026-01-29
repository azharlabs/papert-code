/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  TaskScheduler,
  resolveSchedulerStorePath,
  readRunLogEntries,
  type ScheduledJob,
  type SchedulerLogger,
  type SchedulerRunResult,
  type SchedulerDeliveryTarget,
} from '@papert-code/papert-code-core';
import { spawn } from 'node:child_process';
import * as http from 'node:http';
import * as path from 'node:path';
import { parseDurationMs, formatDurationMs } from '../utils/duration.js';

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
  debug: (obj, msg) => {
    if (process.env['DEBUG']) {
      logWith('debug', msg ?? 'scheduler debug', obj);
    }
  },
  info: (obj, msg) => logWith('info', msg ?? 'scheduler info', obj),
  warn: (obj, msg) => logWith('warn', msg ?? 'scheduler warn', obj),
  error: (obj, msg) => logWith('error', msg ?? 'scheduler error', obj),
};

function logWith(level: 'debug' | 'info' | 'warn' | 'error', msg: string, obj?: unknown) {
  const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
  const line = `[papert] ${msg}${suffix}`;
  if (level === 'debug') console.debug(line);
  else if (level === 'info') console.log(line);
  else if (level === 'warn') console.warn(line);
  else console.error(line);
}

function resolveStorePath(cwd?: string): string {
  const targetCwd = cwd ? path.resolve(cwd) : process.cwd();
  return resolveSchedulerStorePath(targetCwd);
}

function buildPapertArgs(payload: Extract<PapertSchedulePayload, { kind: 'prompt' }>): string[] {
  const args: string[] = [];
  if (payload.model) args.push('--model', payload.model);
  if (payload.approvalMode) args.push('--approval-mode', payload.approvalMode);
  if (payload.outputFormat) args.push('--output-format', payload.outputFormat);
  if (typeof payload.maxSessionTurns === 'number') {
    args.push('--max-session-turns', String(payload.maxSessionTurns));
  }
  args.push(payload.prompt);
  return args;
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

async function runIsolatedPapert(
  entrypoint: string,
  args: string[],
  cwd: string,
): Promise<string> {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      resolve(String(err));
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

async function runPromptJob(
  job: ScheduledJob<PapertSchedulePayload>,
  fallbackCwd: string,
): Promise<SchedulerRunResult> {
  const payload = job.payload;
  if (!payload) {
    return { status: 'skipped', error: 'missing payload' };
  }

  if (payload.kind === 'heartbeat') {
    const text = payload.text?.trim();
    if (!text) return { status: 'skipped', error: 'missing heartbeat text' };
    if (job.delivery && job.delivery.kind !== 'none') {
      await deliverToTarget(job.delivery, text);
    }
    return { status: 'ok', summary: text, outputText: text };
  }

  if (!payload.prompt?.trim()) {
    return { status: 'skipped', error: 'missing prompt payload' };
  }

  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return { status: 'error', error: 'missing CLI entrypoint path' };
  }

  const cwd = payload.cwd ? path.resolve(payload.cwd) : fallbackCwd;
  const args = buildPapertArgs(payload);
  const outputText = await runIsolatedPapert(entrypoint, args, cwd);
  const summary = outputText?.trim() || 'completed';

  if (job.delivery && job.delivery.kind !== 'none') {
    const deliveryText = resolveDeliveryBody(job, summary, outputText);
    await deliverToTarget(job.delivery, deliveryText);
  }

  return { status: 'ok', summary, outputText };
}

function createScheduler(
  cwd: string,
  opts?: { maxConcurrentRuns?: number; queuePolicy?: 'queue' | 'skip' },
) {
  return new TaskScheduler<PapertSchedulePayload>({
    storePath: resolveStorePath(cwd),
    log: schedulerLogger,
    schedulerEnabled: true,
    maxConcurrentRuns: opts?.maxConcurrentRuns,
    queuePolicy: opts?.queuePolicy,
    runJob: (job) => runPromptJob(job, cwd),
    onEvent: (evt) => {
      if (evt.action === 'started') {
        logWith('info', `job ${evt.jobId} started`);
      }
      if (evt.action === 'finished') {
        const status = evt.status ?? 'unknown';
        logWith('info', `job ${evt.jobId} finished (${status})`, {
          nextRunAtMs: evt.nextRunAtMs,
        });
      }
    },
  });
}

function formatSchedule(job: ScheduledJob<PapertSchedulePayload>): string {
  if (job.schedule.kind === 'every') {
    return `every ${formatDurationMs(job.schedule.everyMs)}`;
  }
  if (job.schedule.kind === 'cron') {
    return `cron ${job.schedule.expr}${job.schedule.tz ? ` (${job.schedule.tz})` : ''}`;
  }
  return `at ${new Date(job.schedule.atMs).toISOString()}`;
}

function formatJob(job: ScheduledJob<PapertSchedulePayload>): string {
  const nextRun =
    typeof job.state.nextRunAtMs === 'number'
      ? new Date(job.state.nextRunAtMs).toISOString()
      : 'n/a';
  const lastRun =
    typeof job.state.lastRunAtMs === 'number'
      ? new Date(job.state.lastRunAtMs).toISOString()
      : 'n/a';
  const status = job.state.lastStatus ?? 'never';
  const delivery = job.delivery?.kind ?? 'none';
  const sessionTarget = job.sessionTarget ?? 'main';
  return `${job.id} | ${job.enabled ? 'enabled' : 'disabled'} | ${formatSchedule(job)} | target ${sessionTarget} | delivery ${delivery} | next ${nextRun} | last ${lastRun} | ${status} | ${job.name}`;
}

function buildDeliveryTarget(argv: Record<string, unknown>): SchedulerDeliveryTarget | undefined {
  const kind = argv['deliver'] ? String(argv['deliver']) : undefined;
  if (!kind) return undefined;
  if (kind === 'slack') {
    const url = argv['deliver-url'] ? String(argv['deliver-url']) : '';
    if (!url) throw new Error('Missing --deliver-url for slack delivery.');
    return { kind: 'slack_webhook', url };
  }
  if (kind === 'discord') {
    const url = argv['deliver-url'] ? String(argv['deliver-url']) : '';
    if (!url) throw new Error('Missing --deliver-url for discord delivery.');
    return { kind: 'discord_webhook', url };
  }
  if (kind === 'telegram') {
    const token = argv['telegram-token'] ? String(argv['telegram-token']) : '';
    const chatId = argv['telegram-chat-id'] ? String(argv['telegram-chat-id']) : '';
    if (!token || !chatId) {
      throw new Error('Missing --telegram-token or --telegram-chat-id for telegram delivery.');
    }
    return { kind: 'telegram_bot', token, chatId };
  }
  if (kind === 'none') return { kind: 'none' };
  throw new Error(`Unknown delivery target: ${kind}`);
}

function resolvePreset(preset: string | undefined) {
  if (!preset) return null;
  switch (preset) {
    case 'hourly':
      return { kind: 'every' as const, everyMs: 60 * 60_000, anchorMs: Date.now() };
    case 'daily':
      return { kind: 'every' as const, everyMs: 24 * 60 * 60_000, anchorMs: Date.now() };
    case 'heartbeat-5m':
      return { kind: 'every' as const, everyMs: 5 * 60_000, anchorMs: Date.now() };
    case 'heartbeat-15m':
      return { kind: 'every' as const, everyMs: 15 * 60_000, anchorMs: Date.now() };
    case 'weekday-morning':
      return { kind: 'cron' as const, expr: '0 9 * * 1-5', tz: undefined };
    default:
      return null;
  }
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

function resolveSchedule(argv: Record<string, unknown>) {
  const preset = argv['preset'] ? String(argv['preset']) : undefined;
  const presetSchedule = resolvePreset(preset);
  if (presetSchedule) return presetSchedule;

  if (typeof argv['every'] === 'string') {
    const durationMs = parseDurationMs(argv['every']);
    if (!durationMs) {
      throw new Error('Invalid --every duration. Use values like 10m, 2h, 1d.');
    }
    return { kind: 'every' as const, everyMs: durationMs, anchorMs: Date.now() };
  }
  if (typeof argv['at'] === 'string') {
    const parsed = Date.parse(argv['at']);
    if (!Number.isFinite(parsed)) {
      throw new Error('Invalid --at timestamp. Use ISO-8601 like 2026-01-30T09:00:00Z.');
    }
    return { kind: 'at' as const, atMs: parsed };
  }
  if (typeof argv['cron'] === 'string') {
    return {
      kind: 'cron' as const,
      expr: String(argv['cron']),
      tz: argv['tz'] ? String(argv['tz']) : undefined,
    };
  }
  throw new Error('Missing schedule. Use --every, --at, --cron, or --preset.');
}

function buildPayload(argv: Record<string, unknown>): PapertSchedulePayload {
  if (argv['heartbeat'] === true) {
    const text = argv['text'] ? String(argv['text']).trim() : '';
    if (!text) throw new Error('Heartbeat requires --text.');
    return { kind: 'heartbeat', text };
  }

  const prompt = argv['prompt'] ? String(argv['prompt']).trim() : '';
  if (!prompt) throw new Error('Prompt cannot be empty.');

  return {
    kind: 'prompt',
    prompt,
    cwd: argv['cwd'] ? String(argv['cwd']) : undefined,
    model: argv['model'] ? String(argv['model']) : undefined,
    approvalMode: argv['approval-mode'] as
      | Extract<PapertSchedulePayload, { kind: 'prompt' }>['approvalMode']
      | undefined,
    outputFormat: argv['output-format'] as
      | Extract<PapertSchedulePayload, { kind: 'prompt' }>['outputFormat']
      | undefined,
    maxSessionTurns:
      typeof argv['max-session-turns'] === 'number'
        ? (argv['max-session-turns'] as number)
        : undefined,
  };
}

let webhookServerActive = false;
const webhookGlobalKey = '__papert_webhook_started__';
const webhookEnvKey = 'PAPERT_WEBHOOK_ACTIVE';

async function startWebhookServer(opts: {
  host: string;
  port: number;
  token?: string;
  cwd: string;
  maxConcurrentRuns?: number;
  queuePolicy?: 'queue' | 'skip';
}) {
  if (process.env[webhookEnvKey] === '1') {
    logWith('warn', 'webhook server already running (env)');
    return;
  }

  const globalState = globalThis as typeof globalThis & {
    [webhookGlobalKey]?: boolean;
  };
  if (globalState[webhookGlobalKey]) {
    logWith('warn', 'webhook server already running (global)');
    return;
  }

  if (webhookServerActive) {
    logWith('warn', 'webhook server already running');
    return;
  }
  globalState[webhookGlobalKey] = true;
  webhookServerActive = true;
  process.env[webhookEnvKey] = '1';

  const scheduler = createScheduler(opts.cwd, {
    maxConcurrentRuns: opts.maxConcurrentRuns,
    queuePolicy: opts.queuePolicy,
  });

  await scheduler.start();

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404).end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: 'Use POST.' }),
      );
      return;
    }

    const token = opts.token?.trim();
    if (token) {
      const header = req.headers['authorization'] ?? req.headers['x-papert-token'];
      const headerValue = Array.isArray(header) ? header[0] : header;
      const bearer = headerValue?.startsWith('Bearer ')
        ? headerValue.slice('Bearer '.length)
        : headerValue;
      const queryToken = url.searchParams.get('token');
      if (bearer !== token && queryToken !== token) {
        res.writeHead(401, { 'content-type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Unauthorized' }),
        );
        return;
      }
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'webhook') {
      res.writeHead(404, { 'content-type': 'application/json' }).end(
        JSON.stringify({ ok: false, error: 'Unknown path' }),
      );
      return;
    }

    const idOrName = parts[1];
    let jobId = idOrName;

    if (url.searchParams.get('by') === 'name') {
      const jobs = await scheduler.list({ includeDisabled: true });
      const match = jobs.find((job) => job.name === idOrName);
      if (!match) {
        res.writeHead(404, { 'content-type': 'application/json' }).end(
          JSON.stringify({ ok: false, error: 'Job not found' }),
        );
        return;
      }
      jobId = match.id;
    }

    const mode = url.searchParams.get('mode') === 'due' ? 'due' : 'force';

    let body = '';
    for await (const chunk of req) {
      body += chunk.toString();
    }

    if (body.trim()) {
      logWith('info', 'webhook payload received', {
        jobId,
        bytes: body.length,
      });
    }

    const result = await scheduler.run(jobId, mode);
    res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({ ok: result.ok, ran: result.ran ?? false }),
    );
  });

  server.on('error', (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EADDRINUSE') {
      logWith('error', `webhook port already in use: ${opts.host}:${opts.port}`);
      if (process.env[webhookEnvKey] === '1') {
        return;
      }
    } else {
      logWith('error', 'webhook server error', { error: String(err) });
    }
    scheduler.stop();
    webhookServerActive = false;
    globalState[webhookGlobalKey] = false;
    process.env[webhookEnvKey] = '';
    process.exit(1);
  });

  server.listen(opts.port, opts.host, () => {
    logWith('info', `webhook server listening on http://${opts.host}:${opts.port}`);
  });

  const shutdown = () => {
    server.close();
    scheduler.stop();
    webhookServerActive = false;
    globalState[webhookGlobalKey] = false;
    process.env[webhookEnvKey] = '';
    logWith('info', 'webhook server stopped');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const addCommand: CommandModule = {
  command: 'add',
  describe: 'Add a scheduled Papert prompt or heartbeat.',
  builder: (yargs) =>
    yargs
      .option('name', {
        type: 'string',
        demandOption: true,
        description: 'Job name.',
      })
      .option('prompt', {
        type: 'string',
        description: 'Prompt to run (prompt jobs only).',
      })
      .option('heartbeat', {
        type: 'boolean',
        default: false,
        description: 'Create a heartbeat check-in instead of a prompt job.',
      })
      .option('text', {
        type: 'string',
        description: 'Heartbeat text (when --heartbeat is set).',
      })
      .option('every', {
        type: 'string',
        description: 'Recurring interval (e.g. 10m, 2h, 1d).',
      })
      .option('cron', {
        type: 'string',
        description: 'Cron expression for schedule (e.g. "0 9 * * 1-5").',
      })
      .option('tz', {
        type: 'string',
        description: 'Time zone for cron schedule (e.g. America/Los_Angeles).',
      })
      .option('at', {
        type: 'string',
        description: 'One-shot timestamp (ISO-8601).',
      })
      .option('preset', {
        type: 'string',
        description: 'Schedule preset (hourly, daily, weekday-morning, heartbeat-5m, heartbeat-15m).',
      })
      .option('enabled', {
        type: 'boolean',
        default: true,
        description: 'Enable the job immediately.',
      })
      .option('delete-after-run', {
        type: 'boolean',
        default: false,
        description: 'Delete a one-shot job after it succeeds.',
      })
      .option('no-overlap', {
        type: 'boolean',
        default: false,
        description: 'Prevent overlapping runs for this job.',
      })
      .option('session-target', {
        type: 'string',
        choices: ['main', 'isolated'],
        description: 'Execution target for the job.',
      })
      .option('wake-mode', {
        type: 'string',
        choices: ['now', 'next-heartbeat'],
        description: 'Wake mode for main-lane jobs.',
      })
      .option('post-to-main-prefix', {
        type: 'string',
        description: 'Prefix for isolated job summaries posted back to main.',
      })
      .option('post-to-main-mode', {
        type: 'string',
        choices: ['summary', 'full'],
        description: 'Post summary or full output back to main (isolated jobs).',
      })
      .option('post-to-main-max-chars', {
        type: 'number',
        description: 'Max characters when posting full output back to main.',
      })
      .option('deliver', {
        type: 'string',
        choices: ['slack', 'discord', 'telegram', 'none'],
        description: 'Delivery target for job results.',
      })
      .option('deliver-url', {
        type: 'string',
        description: 'Webhook URL for Slack/Discord delivery.',
      })
      .option('telegram-token', {
        type: 'string',
        description: 'Telegram bot token for delivery.',
      })
      .option('telegram-chat-id', {
        type: 'string',
        description: 'Telegram chat id for delivery.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store and job execution.',
      })
      .option('model', {
        type: 'string',
        description: 'Model override for this job.',
      })
      .option('approval-mode', {
        type: 'string',
        choices: ['plan', 'default', 'auto-edit', 'yolo'],
        description: 'Approval mode override for this job.',
      })
      .option('output-format', {
        type: 'string',
        choices: ['text', 'json', 'stream-json'],
        description: 'Output format for the job run.',
      })
      .option('max-session-turns', {
        type: 'number',
        description: 'Maximum number of turns for the job run.',
      })
      .check((argv) => {
        const hasEvery = typeof argv['every'] === 'string';
        const hasAt = typeof argv['at'] === 'string';
        const hasCron = typeof argv['cron'] === 'string';
        const hasPreset = typeof argv['preset'] === 'string';
        const scheduleCount = [hasEvery, hasAt, hasCron, hasPreset].filter(Boolean).length;
        if (scheduleCount !== 1) {
          return 'Provide exactly one schedule: --every, --at, --cron, or --preset.';
        }
        if (!argv['heartbeat'] && typeof argv['prompt'] !== 'string') {
          return 'Prompt jobs require --prompt.';
        }
        if (argv['heartbeat'] && typeof argv['text'] !== 'string') {
          return 'Heartbeat jobs require --text.';
        }
        return true;
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);

    const schedule = resolveSchedule(argv as Record<string, unknown>);
    const payload = buildPayload(argv as Record<string, unknown>);

    const name = String(argv['name']).trim();
    if (!name) {
      throw new Error('Name cannot be empty.');
    }

    const delivery = buildDeliveryTarget(argv as Record<string, unknown>);

    const job = await scheduler.add({
      name,
      enabled: argv['enabled'] !== false,
      deleteAfterRun: argv['delete-after-run'] === true,
      noOverlap: argv['no-overlap'] === true,
      schedule,
      payload,
      sessionTarget: argv['session-target'] as 'main' | 'isolated' | undefined,
      wakeMode: argv['wake-mode'] as 'now' | 'next-heartbeat' | undefined,
      isolation: {
        postToMainPrefix: argv['post-to-main-prefix']
          ? String(argv['post-to-main-prefix'])
          : undefined,
        postToMainMode: argv['post-to-main-mode'] as 'summary' | 'full' | undefined,
        postToMainMaxChars:
          typeof argv['post-to-main-max-chars'] === 'number'
            ? (argv['post-to-main-max-chars'] as number)
            : undefined,
      },
      delivery,
    });

    logWith('info', `scheduled job ${job.id}`, {
      name: job.name,
      schedule: job.schedule.kind,
      nextRunAtMs: job.state.nextRunAtMs,
    });
  },
};

const heartbeatCommand: CommandModule = {
  command: 'heartbeat',
  describe: 'Add a heartbeat check-in job.',
  builder: (yargs) =>
    yargs
      .option('name', {
        type: 'string',
        demandOption: true,
        description: 'Job name.',
      })
      .option('text', {
        type: 'string',
        demandOption: true,
        description: 'Heartbeat text to emit.',
      })
      .option('every', {
        type: 'string',
        description: 'Recurring interval (e.g. 10m, 2h, 1d).',
      })
      .option('cron', {
        type: 'string',
        description: 'Cron expression for schedule (e.g. "*/5 * * * *").',
      })
      .option('tz', {
        type: 'string',
        description: 'Time zone for cron schedule (e.g. America/Los_Angeles).',
      })
      .option('preset', {
        type: 'string',
        description: 'Schedule preset (heartbeat-5m, heartbeat-15m).',
      })
      .option('enabled', {
        type: 'boolean',
        default: true,
        description: 'Enable the job immediately.',
      })
      .option('no-overlap', {
        type: 'boolean',
        default: true,
        description: 'Prevent overlapping runs for this job.',
      })
      .option('deliver', {
        type: 'string',
        choices: ['slack', 'discord', 'telegram', 'none'],
        description: 'Delivery target for heartbeat output.',
      })
      .option('deliver-url', {
        type: 'string',
        description: 'Webhook URL for Slack/Discord delivery.',
      })
      .option('telegram-token', {
        type: 'string',
        description: 'Telegram bot token for delivery.',
      })
      .option('telegram-chat-id', {
        type: 'string',
        description: 'Telegram chat id for delivery.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .check((argv) => {
        const scheduleCount = [argv['every'], argv['cron'], argv['preset']]
          .filter(Boolean)
          .length;
        if (scheduleCount !== 1) {
          return 'Provide exactly one schedule: --every, --cron, or --preset.';
        }
        return true;
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    const schedule = resolveSchedule({
      every: argv['every'],
      cron: argv['cron'],
      tz: argv['tz'],
      preset: argv['preset'],
    });

    const delivery = buildDeliveryTarget(argv as Record<string, unknown>);

    const job = await scheduler.add({
      name: String(argv['name']).trim(),
      enabled: argv['enabled'] !== false,
      noOverlap: argv['no-overlap'] !== false,
      schedule,
      payload: {
        kind: 'heartbeat',
        text: String(argv['text']).trim(),
      },
      delivery,
    });

    logWith('info', `scheduled heartbeat ${job.id}`, {
      name: job.name,
      schedule: job.schedule.kind,
      nextRunAtMs: job.state.nextRunAtMs,
    });
  },
};

const listCommand: CommandModule = {
  command: 'list',
  describe: 'List scheduled jobs.',
  builder: (yargs) =>
    yargs
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .option('all', {
        type: 'boolean',
        description: 'Include disabled jobs.',
        default: false,
      })
      .option('json', {
        type: 'boolean',
        description: 'Output jobs as JSON.',
        default: false,
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    const jobs = await scheduler.list({ includeDisabled: argv['all'] === true });

    if (argv['json']) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    if (jobs.length === 0) {
      logWith('info', 'no scheduled jobs found');
      return;
    }

    for (const job of jobs) {
      console.log(formatJob(job));
    }
  },
};

const statusCommand: CommandModule = {
  command: 'status',
  describe: 'Show scheduler status.',
  builder: (yargs) =>
    yargs
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    const status = await scheduler.status();
    console.log(JSON.stringify(status, null, 2));
  },
};

const runsCommand: CommandModule = {
  command: 'runs <id>',
  describe: 'Show run history for a job.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('limit', {
        type: 'number',
        default: 20,
        description: 'Number of entries to show.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const entries = await readRunLogEntries(resolveSchedulerStorePath(cwd), String(argv['id']), {
      limit: argv['limit'] as number,
    });
    if (entries.length === 0) {
      logWith('info', 'no run history found');
      return;
    }
    for (const entry of entries) {
      console.log(
        `${new Date(entry.runAtMs).toISOString()} | ${entry.status} | ${entry.summary ?? ''}`,
      );
    }
  },
};

const removeCommand: CommandModule = {
  command: 'remove <id>',
  describe: 'Remove a scheduled job.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    const result = await scheduler.remove(String(argv['id']));
    if (!result.ok || !result.removed) {
      logWith('warn', `job ${String(argv['id'])} not found`);
      return;
    }
    logWith('info', `removed job ${String(argv['id'])}`);
  },
};

const runCommand: CommandModule = {
  command: 'run <id>',
  describe: 'Run a scheduled job immediately.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('force', {
        type: 'boolean',
        description: 'Run even if not due.',
        default: false,
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    const result = await scheduler.run(
      String(argv['id']),
      argv['force'] ? 'force' : 'due',
    );

    if (!result.ok) {
      logWith('error', `failed to run job ${String(argv['id'])}`);
      process.exit(1);
      return;
    }

    if (!result.ran) {
      logWith('info', `job ${String(argv['id'])} not due`);
      return;
    }

    logWith('info', `job ${String(argv['id'])} executed`);
  },
};

const enableCommand: CommandModule = {
  command: 'enable <id>',
  describe: 'Enable a scheduled job.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    await scheduler.update(String(argv['id']), { enabled: true });
    logWith('info', `enabled job ${String(argv['id'])}`);
  },
};

const disableCommand: CommandModule = {
  command: 'disable <id>',
  describe: 'Disable a scheduled job.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);
    await scheduler.update(String(argv['id']), { enabled: false });
    logWith('info', `disabled job ${String(argv['id'])}`);
  },
};

const updateCommand: CommandModule = {
  command: 'update <id>',
  describe: 'Update a scheduled job.',
  builder: (yargs) =>
    yargs
      .positional('id', {
        type: 'string',
        description: 'Job ID.',
      })
      .option('name', {
        type: 'string',
        description: 'New job name.',
      })
      .option('prompt', {
        type: 'string',
        description: 'New prompt (prompt jobs only).',
      })
      .option('heartbeat', {
        type: 'boolean',
        description: 'Switch payload to heartbeat mode.',
      })
      .option('text', {
        type: 'string',
        description: 'Heartbeat text (when --heartbeat is set).',
      })
      .option('every', {
        type: 'string',
        description: 'Recurring interval (e.g. 10m, 2h, 1d).',
      })
      .option('cron', {
        type: 'string',
        description: 'Cron expression for schedule.',
      })
      .option('tz', {
        type: 'string',
        description: 'Time zone for cron schedule.',
      })
      .option('at', {
        type: 'string',
        description: 'One-shot timestamp (ISO-8601).',
      })
      .option('preset', {
        type: 'string',
        description: 'Schedule preset.',
      })
      .option('enabled', {
        type: 'boolean',
        description: 'Enable or disable the job.',
      })
      .option('delete-after-run', {
        type: 'boolean',
        description: 'Delete a one-shot job after it succeeds.',
      })
      .option('no-overlap', {
        type: 'boolean',
        description: 'Prevent overlapping runs for this job.',
      })
      .option('session-target', {
        type: 'string',
        choices: ['main', 'isolated'],
        description: 'Execution target for the job.',
      })
      .option('wake-mode', {
        type: 'string',
        choices: ['now', 'next-heartbeat'],
        description: 'Wake mode for main-lane jobs.',
      })
      .option('post-to-main-prefix', {
        type: 'string',
        description: 'Prefix for isolated job summaries posted back to main.',
      })
      .option('post-to-main-mode', {
        type: 'string',
        choices: ['summary', 'full'],
        description: 'Post summary or full output back to main (isolated jobs).',
      })
      .option('post-to-main-max-chars', {
        type: 'number',
        description: 'Max characters when posting full output back to main.',
      })
      .option('deliver', {
        type: 'string',
        choices: ['slack', 'discord', 'telegram', 'none'],
        description: 'Delivery target for job results.',
      })
      .option('deliver-url', {
        type: 'string',
        description: 'Webhook URL for Slack/Discord delivery.',
      })
      .option('telegram-token', {
        type: 'string',
        description: 'Telegram bot token for delivery.',
      })
      .option('telegram-chat-id', {
        type: 'string',
        description: 'Telegram chat id for delivery.',
      })
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);

    const scheduleFlags = ['every', 'cron', 'at', 'preset'].filter(
      (flag) => argv[flag] !== undefined,
    );
    const schedule = scheduleFlags.length
      ? resolveSchedule(argv as Record<string, unknown>)
      : undefined;

    const payload = (() => {
      if (argv['heartbeat'] === true) {
        if (!argv['text']) throw new Error('Heartbeat updates require --text.');
        return { kind: 'heartbeat', text: String(argv['text']).trim() } as PapertSchedulePayload;
      }
      if (argv['prompt']) {
        return {
          kind: 'prompt',
          prompt: String(argv['prompt']).trim(),
        } as PapertSchedulePayload;
      }
      return undefined;
    })();

    const delivery = argv['deliver'] ? buildDeliveryTarget(argv as Record<string, unknown>) : undefined;

    const patch = {
      name: argv['name'] ? String(argv['name']) : undefined,
      enabled:
        typeof argv['enabled'] === 'boolean' ? (argv['enabled'] as boolean) : undefined,
      deleteAfterRun:
        typeof argv['delete-after-run'] === 'boolean'
          ? (argv['delete-after-run'] as boolean)
          : undefined,
      noOverlap:
        typeof argv['no-overlap'] === 'boolean' ? (argv['no-overlap'] as boolean) : undefined,
      schedule,
      payload,
      sessionTarget: argv['session-target'] as 'main' | 'isolated' | undefined,
      wakeMode: argv['wake-mode'] as 'now' | 'next-heartbeat' | undefined,
      isolation: {
        postToMainPrefix: argv['post-to-main-prefix']
          ? String(argv['post-to-main-prefix'])
          : undefined,
        postToMainMode: argv['post-to-main-mode'] as 'summary' | 'full' | undefined,
        postToMainMaxChars:
          typeof argv['post-to-main-max-chars'] === 'number'
            ? (argv['post-to-main-max-chars'] as number)
            : undefined,
      },
      delivery,
    };

    const updated = await scheduler.update(String(argv['id']), patch);
    logWith('info', `updated job ${updated.id}`);
  },
};

const startCommand: CommandModule = {
  command: 'start',
  describe: 'Start the scheduler loop (runs continuously).',
  builder: (yargs) =>
    yargs
      .option('cwd', {
        type: 'string',
        description: 'Project directory for the schedule store.',
      })
      .option('max-concurrent', {
        type: 'number',
        description: 'Maximum concurrent job runs.',
        default: DEFAULT_MAX_CONCURRENT,
      })
      .option('queue-policy', {
        type: 'string',
        choices: ['queue', 'skip'],
        description: 'Queue policy when concurrency is exceeded.',
        default: 'queue',
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd, {
      maxConcurrentRuns: Number(argv['max-concurrent']) || DEFAULT_MAX_CONCURRENT,
      queuePolicy: argv['queue-policy'] === 'skip' ? 'skip' : 'queue',
    });
    await scheduler.start();

    const keepAlive = setInterval(() => {
      // Keep the process alive for scheduled jobs.
    }, 60_000);

    const shutdown = () => {
      clearInterval(keepAlive);
      scheduler.stop();
      logWith('info', 'scheduler stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logWith('info', 'scheduler running (press Ctrl+C to stop)');
    await new Promise(() => {});
  },
};

const guideCommand: CommandModule = {
  command: 'guide',
  describe: 'Explain when to use cron vs heartbeat schedules.',
  builder: (yargs) => yargs.version(false),
  handler: () => {
    console.log(buildGuideText());
  },
};

const webhookCommand: CommandModule = {
  command: 'webhook <action>',
  describe: 'Run the scheduler webhook trigger server.',
  builder: (yargs) =>
    yargs
      .command(
        'start',
        'Start webhook trigger server.',
        (sub) =>
          sub
            .option('host', {
              type: 'string',
              default: '127.0.0.1',
              description: 'Host to bind the webhook server.',
            })
            .option('port', {
              type: 'number',
              default: 7111,
              description: 'Port to bind the webhook server.',
            })
            .option('token', {
              type: 'string',
              description: 'Optional bearer token required for webhook requests.',
            })
            .option('cwd', {
              type: 'string',
              description: 'Project directory for the schedule store.',
            })
            .option('max-concurrent', {
              type: 'number',
              description: 'Maximum concurrent job runs.',
              default: DEFAULT_MAX_CONCURRENT,
            })
            .option('queue-policy', {
              type: 'string',
              choices: ['queue', 'skip'],
              description: 'Queue policy when concurrency is exceeded.',
              default: 'queue',
            })
            .version(false),
        async (argv) => {
          const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
          await startWebhookServer({
            host: String(argv['host']),
            port: Number(argv['port']),
            token: argv['token'] ? String(argv['token']) : undefined,
            cwd,
            maxConcurrentRuns: Number(argv['max-concurrent']) || DEFAULT_MAX_CONCURRENT,
            queuePolicy: argv['queue-policy'] === 'skip' ? 'skip' : 'queue',
          });
          await new Promise(() => {});
        },
      )
      .demandCommand()
      .version(false),
  handler: () => {},
};

export const scheduleCommand: CommandModule = {
  command: 'schedule <command>',
  describe: 'Manage scheduled Papert prompts.',
  builder: (yargs) =>
    yargs
      .command(addCommand)
      .command(heartbeatCommand)
      .command(updateCommand)
      .command(listCommand)
      .command(statusCommand)
      .command(runsCommand)
      .command(removeCommand)
      .command(runCommand)
      .command(enableCommand)
      .command(disableCommand)
      .command(startCommand)
      .command(guideCommand)
      .command(webhookCommand)
      .demandCommand(),
  handler: () => {},
};
