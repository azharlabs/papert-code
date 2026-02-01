/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { SafetyCheckInput, SafetyCheckResult } from './protocol.js';
import { SafetyCheckDecision } from './protocol.js';
import type { AllowedPathConfig } from '../policy/types.js';

export interface InProcessChecker {
  check(input: SafetyCheckInput): Promise<SafetyCheckResult>;
}

export class AllowedPathChecker implements InProcessChecker {
  async check(input: SafetyCheckInput): Promise<SafetyCheckResult> {
    const { toolCall, context } = input;
    const config = input.config as AllowedPathConfig | undefined;

    const allowedDirs = [
      context.environment.cwd,
      ...context.environment.workspaces,
    ];

    const includedArgs = config?.included_args ?? [];
    const excludedArgs = config?.excluded_args ?? [];

    const pathsToCheck = this.collectPathsToCheck(
      toolCall.args,
      includedArgs,
      excludedArgs,
    );

    for (const { path: targetPath, argName } of pathsToCheck) {
      const resolvedPath = this.safelyResolvePath(
        targetPath,
        context.environment.cwd,
      );

      if (!resolvedPath) {
        return {
          decision: SafetyCheckDecision.DENY,
          reason: `Cannot resolve path "${targetPath}" in argument "${argName}"`,
        };
      }

      const isAllowed = allowedDirs.some((dir) => {
        const resolvedDir = this.safelyResolvePath(
          dir,
          context.environment.cwd,
        );
        if (!resolvedDir) return false;
        return this.isPathAllowed(resolvedPath, resolvedDir);
      });

      if (!isAllowed) {
        return {
          decision: SafetyCheckDecision.DENY,
          reason: `Path "${targetPath}" in argument "${argName}" is outside of the allowed workspace directories.`,
        };
      }
    }

    return { decision: SafetyCheckDecision.ALLOW };
  }

  private safelyResolvePath(inputPath: string, cwd: string): string | null {
    try {
      const resolved = path.resolve(cwd, inputPath);
      let current = resolved;
      while (current && current !== path.dirname(current)) {
        if (fs.existsSync(current)) {
          const canonical = fs.realpathSync(current);
          const relative = path.relative(current, resolved);
          return path.join(canonical, relative);
        }
        current = path.dirname(current);
      }
      return resolved;
    } catch {
      return null;
    }
  }

  private isPathAllowed(targetPath: string, allowedDir: string): boolean {
    const relative = path.relative(allowedDir, targetPath);
    return (
      relative === '' ||
      (!relative.startsWith('..') && !path.isAbsolute(relative))
    );
  }

  private collectPathsToCheck(
    args: unknown,
    includedArgs: string[],
    excludedArgs: string[],
    prefix = '',
  ): Array<{ path: string; argName: string }> {
    const paths: Array<{ path: string; argName: string }> = [];

    if (typeof args !== 'object' || args === null) {
      return paths;
    }

    for (const [key, value] of Object.entries(args)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (excludedArgs.includes(fullKey)) {
        continue;
      }

      if (typeof value === 'string') {
        if (
          includedArgs.includes(fullKey) ||
          key.includes('path') ||
          key.includes('directory') ||
          key.includes('file') ||
          key === 'source' ||
          key === 'destination'
        ) {
          paths.push({ path: value, argName: fullKey });
        }
      } else if (typeof value === 'object') {
        paths.push(
          ...this.collectPathsToCheck(
            value,
            includedArgs,
            excludedArgs,
            fullKey,
          ),
        );
      }
    }

    return paths;
  }
}
