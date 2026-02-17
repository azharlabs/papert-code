/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TeamHandoff } from './types.js';

const TAG_REGEX = /\[@([a-zA-Z0-9_,.-]+):\s*([\s\S]*?)\]/g;
const PREFIX_REGEX = /^\s*@([a-zA-Z0-9_.-]+)\s+([\s\S]*)$/;

export function parseInitialAgentPrefix(prompt: string): {
  agent?: string;
  message: string;
} {
  const match = prompt.match(PREFIX_REGEX);
  if (!match) {
    return { message: prompt };
  }

  return {
    agent: match[1].toLowerCase(),
    message: match[2].trim(),
  };
}

export function parseTeamHandoffs(
  response: string,
  validAgents: Set<string>,
): { handoffs: TeamHandoff[]; cleanedResponse: string } {
  const handoffs: TeamHandoff[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(response)) !== null) {
    const message = match[2].trim();
    const rawTargets = match[1].split(',').map((item) => item.trim().toLowerCase());

    for (const target of rawTargets) {
      if (!validAgents.has(target) || seen.has(target)) {
        continue;
      }
      handoffs.push({
        toAgent: target,
        message,
      });
      seen.add(target);
    }
  }

  const cleanedResponse = response.replace(TAG_REGEX, '').trim();
  return { handoffs, cleanedResponse };
}
