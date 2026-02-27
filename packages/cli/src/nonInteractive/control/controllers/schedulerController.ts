/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  TaskScheduler,
  resolveSchedulerStorePath,
  readRunLogEntries,
  type ScheduledJob,
  type ScheduledJobCreate,
  type ScheduledJobPatch,
  type SchedulerLogger,
  type SchedulerRunResult,
  type SchedulerDeliveryTarget,
  type SchedulerEvent,
} from '@papert-code/papert-code-core';
import { BaseController } from './baseController.js';
import type {
  ControlRequestPayload,
  CLIControlSchedulerListRequest,
  CLIControlSchedulerStatusRequest,
  CLIControlSchedulerAddRequest,
  CLIControlSchedulerUpdateRequest,
  CLIControlSchedulerRemoveRequest,
  CLIControlSchedulerRunRequest,
  CLIControlSchedulerRunsRequest,
  CLIControlSchedulerStartRequest,
  CLIControlSchedulerStopRequest,
} from '../../types.js';

const schedulerLogger: SchedulerLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

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

  if (job.delivery && job.delivery.kind !== 'none') {
    const deliveryText = resolveDeliveryBody(job, summary, outputText);
    await deliverToTarget(job.delivery, deliveryText);
  }

  return { status: 'ok', summary, outputText };
}

export class SchedulerController extends BaseController {
  private readonly schedulers = new Map<string, TaskScheduler<PapertSchedulePayload>>();

  protected async handleRequestPayload(
    payload: ControlRequestPayload,
    _signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    switch (payload.subtype) {
      case 'scheduler_list':
        return this.handleList(payload as CLIControlSchedulerListRequest);
      case 'scheduler_status':
        return this.handleStatus(payload as CLIControlSchedulerStatusRequest);
      case 'scheduler_add':
        return this.handleAdd(payload as CLIControlSchedulerAddRequest);
      case 'scheduler_update':
        return this.handleUpdate(payload as CLIControlSchedulerUpdateRequest);
      case 'scheduler_remove':
        return this.handleRemove(payload as CLIControlSchedulerRemoveRequest);
      case 'scheduler_run':
        return this.handleRun(payload as CLIControlSchedulerRunRequest);
      case 'scheduler_runs':
        return this.handleRuns(payload as CLIControlSchedulerRunsRequest);
      case 'scheduler_start':
        return this.handleStart(payload as CLIControlSchedulerStartRequest);
      case 'scheduler_stop':
        return this.handleStop(payload as CLIControlSchedulerStopRequest);
      default:
        throw new Error('Unsupported request subtype in SchedulerController');
    }
  }

  private resolveCwd(cwd?: string): string {
    if (cwd) return path.resolve(cwd);
    const configCwd = this.context.config.getWorkingDir?.();
    return configCwd ?? process.cwd();
  }

  private createScheduler(
    cwd: string,
    opts?: { maxConcurrentRuns?: number; queuePolicy?: 'queue' | 'skip' },
  ): TaskScheduler<PapertSchedulePayload> {
    const emitSchedulerEvent = (event: SchedulerEvent): void => {
      this.context.streamJson.emitSystemMessage('scheduler_event', {
        cwd,
        event,
      });
    };

    return new TaskScheduler<PapertSchedulePayload>({
      storePath: resolveSchedulerStorePath(cwd),
      log: schedulerLogger,
      schedulerEnabled: true,
      maxConcurrentRuns: opts?.maxConcurrentRuns,
      queuePolicy: opts?.queuePolicy,
      runJob: (job) => runPromptJob(job, cwd),
      onEvent: emitSchedulerEvent,
    });
  }

  private getScheduler(
    cwd: string,
    opts?: { maxConcurrentRuns?: number; queuePolicy?: 'queue' | 'skip' },
  ): TaskScheduler<PapertSchedulePayload> {
    const storePath = resolveSchedulerStorePath(cwd);
    const existing = this.schedulers.get(storePath);
    if (existing) return existing;
    const scheduler = this.createScheduler(cwd, opts);
    this.schedulers.set(storePath, scheduler);
    return scheduler;
  }

  private async handleList(payload: CLIControlSchedulerListRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const jobs = await scheduler.list({ includeDisabled: payload.include_disabled === true });
    return { subtype: 'scheduler_list', jobs };
  }

  private async handleStatus(payload: CLIControlSchedulerStatusRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const status = await scheduler.status();
    return { subtype: 'scheduler_status', status };
  }

  private async handleAdd(payload: CLIControlSchedulerAddRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const job = await scheduler.add(payload.job as ScheduledJobCreate<PapertSchedulePayload>);
    // Scheduler is auto-started on add so explicit start is only needed after stop/restart.
    await scheduler.start();
    return { subtype: 'scheduler_add', job };
  }

  private async handleUpdate(payload: CLIControlSchedulerUpdateRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const job = await scheduler.update(
      payload.id,
      payload.patch as ScheduledJobPatch<PapertSchedulePayload>,
    );
    return { subtype: 'scheduler_update', job };
  }

  private async handleRemove(payload: CLIControlSchedulerRemoveRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const result = await scheduler.remove(payload.id);
    return { subtype: 'scheduler_remove', result };
  }

  private async handleRun(payload: CLIControlSchedulerRunRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd);
    const result = await scheduler.run(payload.id, payload.mode ?? 'due');
    return { subtype: 'scheduler_run', result };
  }

  private async handleRuns(payload: CLIControlSchedulerRunsRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const entries = await readRunLogEntries(resolveSchedulerStorePath(cwd), payload.id, {
      limit: payload.limit,
    });
    return { subtype: 'scheduler_runs', entries };
  }

  private async handleStart(payload: CLIControlSchedulerStartRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const scheduler = this.getScheduler(cwd, {
      maxConcurrentRuns: payload.max_concurrent,
      queuePolicy: payload.queue_policy,
    });
    await scheduler.start();
    return { subtype: 'scheduler_start' };
  }

  private async handleStop(payload: CLIControlSchedulerStopRequest) {
    const cwd = this.resolveCwd(payload.cwd);
    const storePath = resolveSchedulerStorePath(cwd);
    const scheduler = this.schedulers.get(storePath);
    if (scheduler) {
      scheduler.stop();
      this.schedulers.delete(storePath);
    }
    return { subtype: 'scheduler_stop' };
  }

  override cleanup(): void {
    for (const scheduler of this.schedulers.values()) {
      scheduler.stop();
    }
    this.schedulers.clear();
  }
}
