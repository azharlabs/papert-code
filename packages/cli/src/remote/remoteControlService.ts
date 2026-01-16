/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ControlService } from '../nonInteractive/control/ControlService.js';

export type RemoteControlServiceOptions = {
  baseUrl: string;
  serverToken: string;
};

type SessionResponse = {
  sessionId: string;
  token: string;
};

export async function createRemoteControlService(
  options: RemoteControlServiceOptions,
): Promise<ControlService> {
  const res = await fetch(new URL('/api/v1/sessions', options.baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.serverToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to create remote session: ${res.status} ${res.statusText}`);
  }

  const session = (await res.json()) as SessionResponse;

  // Minimal ControlService implementation for stream-json mode.
  // It injects remote session headers into tool calls that use fetch.
  // (Full remote tool approval routing is a follow-up.)
  return {
    permission: {
      getToolCallUpdateCallback: () => undefined,
    },
    remote: {
      baseUrl: options.baseUrl,
      sessionId: session.sessionId,
      token: session.token,
    },
  } as unknown as ControlService;
}
