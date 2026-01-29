/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Content, Part } from '@google/genai';
import type { Config } from '../config/config.js';
import type {
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolConfirmationPayload,
} from '../tools/tools.js';

export type PluginEventName =
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'session.start'
  | 'session.end'
  | 'model.before'
  | 'model.after'
  | 'message.updated'
  | 'permission.asked'
  | 'permission.replied'
  | 'lsp.updated'
  | 'lsp.client.diagnostics'
  | 'chat.params'
  | 'chat.headers';

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
  source?: string;
  reason?: string;
}

export interface ModelBeforePayload {
  sessionId: string;
  request: unknown;
}

export interface ModelAfterPayload {
  sessionId: string;
  request: unknown;
  response: unknown;
}

export interface MessageUpdatedPayload {
  sessionId: string;
  role: 'user' | 'model' | 'system';
  content: Content;
  parts: Part[];
}

export interface PermissionAskedPayload {
  sessionId: string;
  toolName: string;
  callId: string;
  confirmation: ToolCallConfirmationDetails;
}

export interface PermissionRepliedPayload {
  sessionId: string;
  toolName: string;
  callId: string;
  outcome: ToolConfirmationOutcome;
  payload?: ToolConfirmationPayload;
}

export interface LspUpdatedPayload {
  serverName: string;
  status: 'connected' | 'disposed' | 'error';
}

export interface LspDiagnosticsPayload {
  serverName: string;
  uri: string;
  diagnostics: unknown;
}

export interface ChatParamsPayload {
  sessionId: string;
  model: string;
  message: Content;
  output: {
    temperature?: number;
    topP?: number;
    topK?: number;
    options: Record<string, unknown>;
  };
}

export interface ChatHeadersPayload {
  sessionId: string;
  model: string;
  output: {
    headers: Record<string, string>;
  };
}

export type PluginEventPayloadMap = {
  'tool.execute.before': ToolExecuteBeforePayload;
  'tool.execute.after': ToolExecuteAfterPayload;
  'session.start': SessionPayload;
  'session.end': SessionPayload;
  'model.before': ModelBeforePayload;
  'model.after': ModelAfterPayload;
  'message.updated': MessageUpdatedPayload;
  'permission.asked': PermissionAskedPayload;
  'permission.replied': PermissionRepliedPayload;
  'lsp.updated': LspUpdatedPayload;
  'lsp.client.diagnostics': LspDiagnosticsPayload;
  'chat.params': ChatParamsPayload;
  'chat.headers': ChatHeadersPayload;
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
