/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type ApprovalMode,
  type PolicyRule,
  PolicyDecision,
  type SafetyCheckerRule,
  InProcessCheckerType,
  type SafetyCheckerConfig,
} from './types.js';
import fs from 'node:fs';
import path from 'node:path';
import toml from '@iarna/toml';

export interface PolicyFileError {
  filePath: string;
  fileName: string;
  tier: 'default' | 'user' | 'admin';
  errorType: string;
  message: string;
}

export interface PolicyLoadResult {
  rules: PolicyRule[];
  checkers: SafetyCheckerRule[];
  errors: PolicyFileError[];
}

function toTierName(tier: number): PolicyFileError['tier'] {
  if (tier === 3) return 'admin';
  if (tier === 2) return 'user';
  return 'default';
}

export function loadPoliciesFromToml(
  approvalMode: ApprovalMode,
  policyDirs: string[],
  getPolicyTier: (dir: string) => number,
): PolicyLoadResult {
  const rules: PolicyRule[] = [];
  const checkers: SafetyCheckerRule[] = [];
  const errors: PolicyFileError[] = [];

  for (const dir of policyDirs) {
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.toml'));
    } catch {
      continue;
    }

    const tier = getPolicyTier(dir);
    const tierName = toTierName(tier);

    for (const fileName of files) {
      const filePath = path.join(dir, fileName);
      let parsed: unknown;
      try {
        parsed = toml.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (error) {
        errors.push({
          filePath,
          fileName,
          tier: tierName,
          errorType: 'toml_parse',
          message: (error as Error).message,
        });
        continue;
      }

      const rawRules = Array.isArray((parsed as any).rule)
        ? (parsed as any).rule
        : [];
      const rawCheckers = Array.isArray((parsed as any).safety_checker)
        ? (parsed as any).safety_checker
        : [];

      for (const rawRule of rawRules) {
        try {
          const toolNames = Array.isArray(rawRule.toolName)
            ? rawRule.toolName
            : rawRule.toolName
              ? [rawRule.toolName]
              : [undefined];

          for (const toolName of toolNames) {
            const decision = rawRule.decision as PolicyDecision;
            const priority = tier + (Number(rawRule.priority) || 0) / 1000;

            // Filter by mode if present
            if (
              rawRule.modes &&
              Array.isArray(rawRule.modes) &&
              !rawRule.modes.includes(String(approvalMode))
            ) {
              continue;
            }

            let argsPattern: RegExp | undefined;
            if (rawRule.argsPattern) {
              argsPattern = new RegExp(String(rawRule.argsPattern));
            }

            rules.push({
              toolName,
              decision,
              priority,
              argsPattern,
            });
          }
        } catch (error) {
          errors.push({
            filePath,
            fileName,
            tier: tierName,
            errorType: 'rule_validation',
            message: (error as Error).message,
          });
        }
      }

      for (const rawChecker of rawCheckers) {
        try {
          const toolNames = Array.isArray(rawChecker.toolName)
            ? rawChecker.toolName
            : rawChecker.toolName
              ? [rawChecker.toolName]
              : [undefined];

          const checkerConfig = rawChecker.checker as SafetyCheckerConfig;
          if (!checkerConfig || typeof checkerConfig !== 'object') {
            throw new Error('Missing checker configuration');
          }

          if (
            checkerConfig.type === 'in-process' &&
            checkerConfig.name &&
            !Object.values(InProcessCheckerType).includes(
              checkerConfig.name as InProcessCheckerType,
            )
          ) {
            throw new Error(
              `Invalid in-process checker name "${checkerConfig.name}"`,
            );
          }

          for (const toolName of toolNames) {
            const priority = tier + (Number(rawChecker.priority) || 0) / 1000;

            if (
              rawChecker.modes &&
              Array.isArray(rawChecker.modes) &&
              !rawChecker.modes.includes(String(approvalMode))
            ) {
              continue;
            }

            let argsPattern: RegExp | undefined;
            if (rawChecker.argsPattern) {
              argsPattern = new RegExp(String(rawChecker.argsPattern));
            }

            checkers.push({
              toolName,
              argsPattern,
              priority,
              checker: checkerConfig,
              modes: rawChecker.modes as ApprovalMode[] | undefined,
            });
          }
        } catch (error) {
          errors.push({
            filePath,
            fileName,
            tier: tierName,
            errorType: 'checker_validation',
            message: (error as Error).message,
          });
        }
      }
    }
  }

  // Sort descending by priority
  rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  checkers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return { rules, checkers, errors };
}
