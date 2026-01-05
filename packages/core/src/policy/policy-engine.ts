/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PolicyDecision,
  type PolicyEngineConfig,
  type PolicyRule,
  type HookExecutionContext,
} from './types.js';
import { stableStringify } from './stable-stringify.js';
import { debugLogger } from '../utils/debugLogger.js';

export class PolicyEngine {
  private rules: PolicyRule[];
  private readonly defaultDecision: PolicyDecision;
  private readonly nonInteractive: boolean;
  private readonly allowHooks: boolean;

  constructor(config: PolicyEngineConfig = {}) {
    this.rules = (config.rules ?? []).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
    this.defaultDecision = config.defaultDecision ?? PolicyDecision.ASK_USER;
    this.nonInteractive = config.nonInteractive ?? false;
    this.allowHooks = config.allowHooks ?? true;
  }

  check(
    toolCall: { name?: string; args?: unknown },
    serverName: string | undefined,
  ): PolicyDecision {
    const stringifiedArgs =
      toolCall.args && this.rules.some((rule) => rule.argsPattern)
        ? stableStringify(toolCall.args)
        : undefined;

    for (const rule of this.rules) {
      if (this.ruleMatches(rule, toolCall.name, stringifiedArgs, serverName)) {
        return this.applyNonInteractiveMode(rule.decision);
      }
    }

    debugLogger.debug(
      `[PolicyEngine.check] no matching rule for ${toolCall.name}, using default ${this.defaultDecision}`,
    );
    return this.applyNonInteractiveMode(this.defaultDecision);
  }

  checkHook(context: HookExecutionContext): PolicyDecision {
    if (!this.allowHooks) {
      debugLogger.debug(
        `[PolicyEngine.checkHook] hooks disabled, denying ${context.eventName}`,
      );
      return PolicyDecision.DENY;
    }

    return PolicyDecision.ALLOW;
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  getRules(): readonly PolicyRule[] {
    return this.rules;
  }

  private ruleMatches(
    rule: PolicyRule,
    toolName: string | undefined,
    stringifiedArgs: string | undefined,
    serverName: string | undefined,
  ): boolean {
    if (rule.toolName) {
      if (rule.toolName.endsWith('__*')) {
        const prefix = rule.toolName.slice(0, -3);
        if (serverName && serverName !== prefix) {
          return false;
        }
        if (!toolName?.startsWith(`${prefix}__`)) {
          return false;
        }
      } else if (rule.toolName !== toolName) {
        return false;
      }
    }

    if (rule.argsPattern && stringifiedArgs) {
      return rule.argsPattern.test(stringifiedArgs);
    }

    return !rule.argsPattern;
  }

  private applyNonInteractiveMode(decision: PolicyDecision): PolicyDecision {
    if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
      return PolicyDecision.DENY;
    }
    return decision;
  }
}
