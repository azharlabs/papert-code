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
  private readonly wildcardRegexCache = new Map<string, RegExp>();

  constructor(config: PolicyEngineConfig = {}) {
    // Last-match wins: rules are evaluated in ascending priority order and
    // the last matching rule becomes authoritative.
    this.rules = [...(config.rules ?? [])].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
    );
    this.defaultDecision = config.defaultDecision ?? PolicyDecision.ASK_USER;
    this.nonInteractive = config.nonInteractive ?? false;
    this.allowHooks = config.allowHooks ?? true;
  }

  check(
    toolCall: { name?: string; args?: unknown },
    serverName: string | undefined,
  ): PolicyDecision {
    return this.getDecisionDetails(toolCall, serverName).decision;
  }

  getDecisionReason(
    toolCall: { name?: string; args?: unknown },
    serverName: string | undefined,
  ): string | undefined {
    return this.getDecisionDetails(toolCall, serverName).reason;
  }

  getDecisionDetails(
    toolCall: { name?: string; args?: unknown },
    serverName: string | undefined,
  ): { decision: PolicyDecision; reason?: string } {
    const stringifiedArgs =
      toolCall.args && this.rules.some((rule) => rule.argsPattern)
        ? stableStringify(toolCall.args)
        : undefined;

    let matchedRule: PolicyRule | undefined;
    for (const rule of this.rules) {
      if (this.ruleMatches(rule, toolCall.name, stringifiedArgs, serverName)) {
        matchedRule = rule;
      }
    }

    if (matchedRule) {
      const decision = this.applyNonInteractiveMode(matchedRule.decision);
      const deniedByNonInteractive =
        matchedRule.decision === PolicyDecision.ASK_USER &&
        decision === PolicyDecision.DENY &&
        this.nonInteractive;
      return {
        decision,
        reason:
          decision === PolicyDecision.DENY
            ? deniedByNonInteractive
              ? 'Interactive confirmation is disabled in non-interactive mode'
              : this.buildDenyReason(matchedRule)
            : undefined,
      };
    }

    debugLogger.debug(
      `[PolicyEngine.check] no matching rule for ${toolCall.name}, using default ${this.defaultDecision}`,
    );
    const fallbackDecision = this.applyNonInteractiveMode(this.defaultDecision);
    const deniedByNonInteractive =
      this.defaultDecision === PolicyDecision.ASK_USER &&
      fallbackDecision === PolicyDecision.DENY &&
      this.nonInteractive;
    return {
      decision: fallbackDecision,
      reason:
        fallbackDecision === PolicyDecision.DENY
          ? deniedByNonInteractive
            ? 'Interactive confirmation is disabled in non-interactive mode'
            : 'Denied by default policy decision'
          : undefined,
    };
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
    this.rules.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
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
    if (
      rule.toolName &&
      !this.matchesToolPattern(rule.toolName, toolName, serverName)
    ) {
      return false;
    }

    if (rule.argsPattern && stringifiedArgs) {
      return rule.argsPattern.test(stringifiedArgs);
    }

    return !rule.argsPattern;
  }

  private matchesToolPattern(
    pattern: string,
    toolName: string | undefined,
    serverName: string | undefined,
  ): boolean {
    if (!toolName) {
      return false;
    }

    if (!pattern.includes('*')) {
      return pattern === toolName;
    }

    if (pattern.endsWith('__*') && serverName) {
      const serverPrefix = pattern.slice(0, -3);
      if (serverName !== serverPrefix) {
        return false;
      }
    }

    return this.getWildcardRegex(pattern).test(toolName);
  }

  private getWildcardRegex(pattern: string): RegExp {
    const cached = this.wildcardRegexCache.get(pattern);
    if (cached) {
      return cached;
    }

    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const compiled = new RegExp(`^${escaped}$`);
    this.wildcardRegexCache.set(pattern, compiled);
    return compiled;
  }

  private applyNonInteractiveMode(decision: PolicyDecision): PolicyDecision {
    if (this.nonInteractive && decision === PolicyDecision.ASK_USER) {
      return PolicyDecision.DENY;
    }
    return decision;
  }

  private buildDenyReason(rule: PolicyRule): string {
    if (rule.reason?.trim()) {
      return rule.reason;
    }

    const parts: string[] = [];
    if (rule.toolName) {
      parts.push(`tool=${rule.toolName}`);
    }
    if (rule.argsPattern) {
      parts.push(`argsPattern=${rule.argsPattern.source}`);
    }
    if (typeof rule.priority === 'number') {
      parts.push(`priority=${rule.priority}`);
    }

    return parts.length > 0
      ? `Denied by matching policy rule (${parts.join(', ')})`
      : 'Denied by matching policy rule';
  }
}
