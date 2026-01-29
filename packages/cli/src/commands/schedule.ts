/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  TaskScheduler,
  resolveSchedulerStorePath,
  type ScheduledJob,
  type SchedulerLogger,
  type SchedulerRunResult,
} from '@papert-code/papert-code-core';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { parseDurationMs, formatDurationMs } from '../utils/duration.js';

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

function buildPapertArgs(payload: PapertSchedulePayload): string[] {
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

async function runPromptJob(
  job: ScheduledJob<PapertSchedulePayload>,
  fallbackCwd: string,
): Promise<SchedulerRunResult> {
  const payload = job.payload;
  if (!payload || payload.kind !== 'prompt' || !payload.prompt?.trim()) {
    return { status: 'skipped', error: 'missing prompt payload' };
  }

  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return { status: 'error', error: 'missing CLI entrypoint path' };
  }

  const cwd = payload.cwd ? path.resolve(payload.cwd) : fallbackCwd;
  const args = buildPapertArgs(payload);

  return await new Promise<SchedulerRunResult>((resolve) => {
    const child = spawn(process.execPath, [entrypoint, ...args], {
      stdio: 'inherit',
      cwd,
      env: process.env,
    });

    child.on('error', (err) => {
      resolve({ status: 'error', error: String(err) });
    });

    child.on('close', (code) => {
      if (!code) {
        resolve({ status: 'ok', summary: 'completed' });
        return;
      }
      resolve({ status: 'error', error: `exit code ${code}` });
    });
  });
}

function createScheduler(cwd: string) {
  return new TaskScheduler<PapertSchedulePayload>({
    storePath: resolveStorePath(cwd),
    log: schedulerLogger,
    schedulerEnabled: true,
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

const addCommand: CommandModule = {
  command: 'add',
  describe: 'Add a scheduled Papert prompt.',
  builder: (yargs) =>
    yargs
      .option('name', {
        type: 'string',
        demandOption: true,
        description: 'Job name.',
      })
      .option('prompt', {
        type: 'string',
        demandOption: true,
        description: 'Prompt to run.',
      })
      .option('every', {
        type: 'string',
        description: 'Recurring interval (e.g. 10m, 2h, 1d).',
      })
      .option('at', {
        type: 'string',
        description: 'One-shot timestamp (ISO-8601).',
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
        if (hasEvery === hasAt) {
          return 'Provide exactly one schedule: --every or --at.';
        }
        return true;
      })
      .version(false),
  handler: async (argv) => {
    const cwd = argv['cwd'] ? path.resolve(String(argv['cwd'])) : process.cwd();
    const scheduler = createScheduler(cwd);

    const schedule = (() => {
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
      throw new Error('Missing schedule. Use --every or --at.');
    })();

    const payload: PapertSchedulePayload = {
      kind: 'prompt',
      prompt: String(argv['prompt']).trim(),
      cwd,
      model: argv['model'] ? String(argv['model']) : undefined,
      approvalMode: argv['approval-mode'] as PapertSchedulePayload['approvalMode'] | undefined,
      outputFormat: argv['output-format'] as PapertSchedulePayload['outputFormat'] | undefined,
      maxSessionTurns:
        typeof argv['max-session-turns'] === 'number'
          ? argv['max-session-turns']
          : undefined,
    };

    if (!payload.prompt) {
      throw new Error('Prompt cannot be empty.');
    }

    const name = String(argv['name']).trim();
    if (!name) {
      throw new Error('Name cannot be empty.');
    }

    const job = await scheduler.add({
      name,
      enabled: argv['enabled'] !== false,
      deleteAfterRun: argv['delete-after-run'] === true,
      schedule,
      payload,
    });

    logWith('info', `scheduled job ${job.id}`, {
      name: job.name,
      schedule: schedule.kind,
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
      console.log(
        `${job.id} | ${job.enabled ? 'enabled' : 'disabled'} | ${scheduleLabel} | next ${nextRun} | last ${lastRun} | ${status} | ${job.name}`,
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

const startCommand: CommandModule = {
  command: 'start',
  describe: 'Start the scheduler loop (runs continuously).',
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
  },
};

export const scheduleCommand: CommandModule = {
  command: 'schedule <command>',
  describe: 'Manage scheduled Papert prompts.',
  builder: (yargs) =>
    yargs
      .command(addCommand)
      .command(listCommand)
      .command(removeCommand)
      .command(runCommand)
      .command(enableCommand)
      .command(disableCommand)
      .command(startCommand)
      .demandCommand(),
  handler: () => {},
};
