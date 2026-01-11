/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';

export type PluginEventName =
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'session.start'
  | 'session.end'
  | 'model.before'
  | 'model.after';

export interface PluginContext {
  config: Config;
}

export interface ToolExecuteBeforePayload {
  toolName: string;
  args: unknown;
}

export interface ToolExecuteAfterPayload {
  toolName: string;
  args: unknown;
  result: unknown;
  error?: string;
}

export interface SessionPayload {
  sessionId: string;
}

export interface ModelBeforePayload {
  request: unknown;
}

export interface ModelAfterPayload {
  request: unknown;
  response: unknown;
}

export type PluginEventPayloadMap = {
  'tool.execute.before': ToolExecuteBeforePayload;
  'tool.execute.after': ToolExecuteAfterPayload;
  'session.start': SessionPayload;
  'session.end': SessionPayload;
  'model.before': ModelBeforePayload;
  'model.after': ModelAfterPayload;
};

export type PluginHandler<E extends PluginEventName> = (
  payload: PluginEventPayloadMap[E],
  ctx: PluginContext,
) => void | Promise<void>;

export interface PluginDefinition {
  name: string;
  hooks?: Partial<{ [E in PluginEventName]: PluginHandler<E> | PluginHandler<E>[] }>;
}

export type PluginModule = {
  default?: (ctx: PluginContext) => PluginDefinition | Promise<PluginDefinition>;
  plugin?: (ctx: PluginContext) => PluginDefinition | Promise<PluginDefinition>;
};
