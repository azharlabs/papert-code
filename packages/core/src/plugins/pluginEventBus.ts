/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  PluginContext,
  PluginEventName,
  PluginEventPayloadMap,
  PluginHandler,
} from './types.js';

type AnyHandler = (payload: any, ctx: PluginContext) => void | Promise<void>;

export class PluginEventBus {
  private readonly handlers = new Map<PluginEventName, AnyHandler[]>();

  on<E extends PluginEventName>(event: E, handler: PluginHandler<E>): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as AnyHandler);
    this.handlers.set(event, list);
  }

  async emit<E extends PluginEventName>(
    event: E,
    payload: PluginEventPayloadMap[E],
    ctx: PluginContext,
  ): Promise<void> {
    const list = this.handlers.get(event);
    if (!list?.length) return;

    for (const handler of list) {
      await handler(payload, ctx);
    }
  }

  getRegisteredEvents(): PluginEventName[] {
    return [...this.handlers.keys()];
  }
}
