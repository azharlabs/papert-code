/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../../config/config.js';
import type { BaseLlmClient } from '../../core/baseLlmClient.js';
import { debugLogger } from '../../utils/debugLogger.js';
import type {
  RoutingContext,
  RoutingDecision,
  RoutingStrategy,
  TerminalStrategy,
} from '../routingStrategy.js';

/**
 * A strategy that attempts a list of child strategies in order (Chain of Responsibility).
 */
export class CompositeStrategy implements TerminalStrategy {
  readonly name: string;

  private strategies: [...RoutingStrategy[], TerminalStrategy];

  /**
   * Initializes the CompositeStrategy.
   * @param strategies The strategies to try, in order of priority. The last strategy must be terminal.
   * @param name The name of this composite configuration (e.g., 'router' or 'composite').
   */
  constructor(
    strategies: [...RoutingStrategy[], TerminalStrategy],
    name: string = 'composite',
  ) {
    this.strategies = strategies;
    this.name = name;
  }

  async route(
    context: RoutingContext,
    config: Config,
    baseLlmClient: BaseLlmClient,
  ): Promise<RoutingDecision> {
    const startTime = performance.now();

    const nonTerminalStrategies = this.strategies.slice(
      0,
      -1,
    ) as RoutingStrategy[];
    const terminalStrategy = this.strategies[
      this.strategies.length - 1
    ] as TerminalStrategy;

    for (const strategy of nonTerminalStrategies) {
      try {
        const decision = await strategy.route(context, config, baseLlmClient);
        if (decision) {
          return this.finalizeDecision(decision, startTime);
        }
      } catch (error) {
        debugLogger.warn(
          `[Routing] Strategy '${strategy.name}' failed. Continuing to next strategy.`,
          error,
        );
      }
    }

    try {
      const decision = await terminalStrategy.route(
        context,
        config,
        baseLlmClient,
      );

      return this.finalizeDecision(decision, startTime);
    } catch (error) {
      debugLogger.error(
        `[Routing] Terminal strategy '${terminalStrategy.name}' failed. Routing cannot proceed.`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper function to enhance the decision metadata with composite information.
   */
  private finalizeDecision(
    decision: RoutingDecision,
    startTime: number,
  ): RoutingDecision {
    const endTime = performance.now();
    const compositeSource = `${this.name}/${decision.metadata.source}`;

    const latency = decision.metadata.latencyMs || endTime - startTime;

    return {
      ...decision,
      metadata: {
        ...decision.metadata,
        source: compositeSource,
        latencyMs: Math.round(latency),
      },
    };
  }
}
