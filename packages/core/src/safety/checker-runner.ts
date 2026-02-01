/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import type { FunctionCall } from '@google/genai';
import type {
  SafetyCheckerConfig,
  InProcessCheckerConfig,
  ExternalCheckerConfig,
} from '../policy/types.js';
import type { SafetyCheckInput, SafetyCheckResult } from './protocol.js';
import { SafetyCheckDecision } from './protocol.js';
import type { CheckerRegistry } from './registry.js';
import type { ContextBuilder } from './context-builder.js';
import { z } from 'zod';

const SafetyCheckResultSchema: z.ZodType<SafetyCheckResult> =
  z.discriminatedUnion('decision', [
    z.object({
      decision: z.literal(SafetyCheckDecision.ALLOW),
      reason: z.string().optional(),
    }),
    z.object({
      decision: z.literal(SafetyCheckDecision.DENY),
      reason: z.string().min(1),
    }),
    z.object({
      decision: z.literal(SafetyCheckDecision.ASK_USER),
      reason: z.string().min(1),
    }),
  ]);

export interface CheckerRunnerConfig {
  timeout?: number;
  checkersPath: string;
}

export class CheckerRunner {
  private static readonly DEFAULT_TIMEOUT = 5000;

  private readonly registry: CheckerRegistry;
  private readonly contextBuilder: ContextBuilder;
  private readonly timeout: number;

  constructor(
    contextBuilder: ContextBuilder,
    registry: CheckerRegistry,
    config: CheckerRunnerConfig,
  ) {
    this.contextBuilder = contextBuilder;
    this.registry = registry;
    this.timeout = config.timeout ?? CheckerRunner.DEFAULT_TIMEOUT;
  }

  async runChecker(
    toolCall: FunctionCall,
    checkerConfig: SafetyCheckerConfig,
  ): Promise<SafetyCheckResult> {
    if (checkerConfig.type === 'in-process') {
      return this.runInProcessChecker(toolCall, checkerConfig);
    }
    return this.runExternalChecker(toolCall, checkerConfig);
  }

  private async runInProcessChecker(
    toolCall: FunctionCall,
    checkerConfig: InProcessCheckerConfig,
  ): Promise<SafetyCheckResult> {
    try {
      const checker = this.registry.resolveInProcess(checkerConfig.name);
      const context = checkerConfig.required_context
        ? this.contextBuilder.buildMinimalContext(
            checkerConfig.required_context,
          )
        : this.contextBuilder.buildFullContext();

      const input: SafetyCheckInput = {
        protocolVersion: '1.0.0',
        toolCall,
        context,
        config: checkerConfig.config,
      };

      return await this.executeWithTimeout(checker.check(input));
    } catch (error) {
      return {
        decision: SafetyCheckDecision.DENY,
        reason: `Failed to run in-process checker "${checkerConfig.name}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async runExternalChecker(
    toolCall: FunctionCall,
    checkerConfig: ExternalCheckerConfig,
  ): Promise<SafetyCheckResult> {
    try {
      const checkerPath = this.registry.resolveExternal(checkerConfig.name);
      const context = checkerConfig.required_context
        ? this.contextBuilder.buildMinimalContext(
            checkerConfig.required_context,
          )
        : this.contextBuilder.buildFullContext();

      const input: SafetyCheckInput = {
        protocolVersion: '1.0.0',
        toolCall,
        context,
        config: checkerConfig.config,
      };

      return await this.executeCheckerProcess(
        checkerPath,
        input,
        checkerConfig.name,
      );
    } catch (error) {
      return {
        decision: SafetyCheckDecision.DENY,
        reason: `Failed to run safety checker "${checkerConfig.name}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private executeCheckerProcess(
    checkerPath: string,
    input: SafetyCheckInput,
    checkerName: string,
  ): Promise<SafetyCheckResult> {
    return new Promise((resolve) => {
      const child = spawn(checkerPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;
      let killed = false;
      let exited = false;

      timeoutHandle = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        resolve({
          decision: SafetyCheckDecision.DENY,
          reason: `Safety checker "${checkerName}" timed out after ${this.timeout}ms`,
        });

        setTimeout(() => {
          if (!exited) {
            child.kill('SIGKILL');
          }
        }, 5000).unref();
      }, this.timeout);

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      }

      child.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        resolve({
          decision: SafetyCheckDecision.DENY,
          reason: `Failed to spawn safety checker "${checkerName}": ${error.message}`,
        });
      });

      child.on('close', (code, signal) => {
        exited = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (killed) return;

        if (code !== 0) {
          resolve({
            decision: SafetyCheckDecision.DENY,
            reason: `Safety checker "${checkerName}" exited with code ${code}${
              signal ? ` (signal: ${signal})` : ''
            }. Stderr: ${stderr || '(empty)'}`,
          });
          return;
        }

        try {
          const rawResult = JSON.parse(stdout);
          const result = SafetyCheckResultSchema.parse(rawResult);
          resolve(result);
        } catch (error) {
          resolve({
            decision: SafetyCheckDecision.DENY,
            reason: `Failed to parse output from safety checker "${checkerName}": ${
              error instanceof Error ? error.message : String(error)
            }. Output: ${stdout || '(empty)'}`,
          });
        }
      });

      try {
        if (!child.stdin) {
          throw new Error('Failed to open stdin for checker process');
        }
        child.stdin.write(JSON.stringify(input));
        child.stdin.end();
      } catch (error) {
        resolve({
          decision: SafetyCheckDecision.DENY,
          reason: `Failed to write to stdin of safety checker "${checkerName}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    });
  }

  private executeWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Safety checker timed out after ${this.timeout}ms`));
      }, this.timeout);

      promise
        .then((result) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }
}
