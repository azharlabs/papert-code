/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * System Controller
 *
 * Handles system-level control requests:
 * - initialize: Setup session and return system info
 * - interrupt: Cancel current operations
 * - set_model: Switch model (placeholder)
 */

import { BaseController } from './baseController.js';
import type {
  ControlRequestPayload,
  CLIControlInitializeRequest,
  CLIControlSetModelRequest,
} from '../../types.js';
import { CommandService } from '../../../services/CommandService.js';
import { BuiltinCommandLoader } from '../../../services/BuiltinCommandLoader.js';

export class SystemController extends BaseController {
  /**
   * Handle system control requests
   */
  protected async handleRequestPayload(
    payload: ControlRequestPayload,
    _signal: AbortSignal,
  ): Promise<Record<string, unknown>> {
    switch (payload.subtype) {
      case 'initialize':
        return this.handleInitialize(payload as CLIControlInitializeRequest);

      case 'interrupt':
        return this.handleInterrupt();

      case 'set_model':
        return this.handleSetModel(payload as CLIControlSetModelRequest);

      case 'supported_commands':
        return this.handleSupportedCommands();

      default:
        throw new Error(`Unsupported request subtype in SystemController`);
    }
  }

  /**
   * Handle initialize request
   *
   * Registers SDK MCP servers and returns capabilities
   */
  private async handleInitialize(
    payload: CLIControlInitializeRequest,
  ): Promise<Record<string, unknown>> {
    this.context.config.setSdkMode(true);

    if (payload.sdkMcpServers && typeof payload.sdkMcpServers === 'object') {
      for (const serverName of Object.keys(payload.sdkMcpServers)) {
        this.context.sdkMcpServers.add(serverName);
      }

      try {
        this.context.config.addMcpServers(payload.sdkMcpServers);
        if (this.context.debugMode) {
          console.error(
            `[SystemController] Added ${Object.keys(payload.sdkMcpServers).length} SDK MCP servers to config`,
          );
        }
      } catch (error) {
        if (this.context.debugMode) {
          console.error(
            '[SystemController] Failed to add SDK MCP servers:',
            error,
          );
        }
      }
    }

    if (payload.mcpServers && typeof payload.mcpServers === 'object') {
      try {
        this.context.config.addMcpServers(payload.mcpServers);
        if (this.context.debugMode) {
          console.error(
            `[SystemController] Added ${Object.keys(payload.mcpServers).length} MCP servers to config`,
          );
        }
      } catch (error) {
        if (this.context.debugMode) {
          console.error('[SystemController] Failed to add MCP servers:', error);
        }
      }
    }

    if (payload.agents && Array.isArray(payload.agents)) {
      try {
        this.context.config.setSessionSubagents(payload.agents);

        if (this.context.debugMode) {
          console.error(
            `[SystemController] Added ${payload.agents.length} session subagents to config`,
          );
        }
      } catch (error) {
        if (this.context.debugMode) {
          console.error(
            '[SystemController] Failed to add session subagents:',
            error,
          );
        }
      }
    }

    // Build capabilities for response
    const capabilities = this.buildControlCapabilities();

    if (this.context.debugMode) {
      console.error(
        `[SystemController] Initialized with ${this.context.sdkMcpServers.size} SDK MCP servers`,
      );
    }

    return {
      subtype: 'initialize',
      capabilities,
    };
  }

  /**
   * Build control capabilities for initialize control response
   *
   * This method constructs the control capabilities object that indicates
   * what control features are available. It is used exclusively in the
   * initialize control response.
   */
  buildControlCapabilities(): Record<string, unknown> {
    const capabilities: Record<string, unknown> = {
      can_handle_can_use_tool: true,
      can_handle_hook_callback: false,
      can_set_permission_mode:
        typeof this.context.config.setApprovalMode === 'function',
      can_set_model: typeof this.context.config.setModel === 'function',
      /* TODO: sdkMcpServers support */
      can_handle_mcp_message: false,
    };

    return capabilities;
  }

  /**
   * Handle interrupt request
   *
   * Triggers the interrupt callback to cancel current operations
   */
  private async handleInterrupt(): Promise<Record<string, unknown>> {
    // Trigger interrupt callback if available
    if (this.context.onInterrupt) {
      this.context.onInterrupt();
    }

    // Abort the main signal to cancel ongoing operations
    if (this.context.abortSignal && !this.context.abortSignal.aborted) {
      // Note: We can't directly abort the signal, but the onInterrupt callback should handle this
      if (this.context.debugMode) {
        console.error('[SystemController] Interrupt signal triggered');
      }
    }

    if (this.context.debugMode) {
      console.error('[SystemController] Interrupt handled');
    }

    return { subtype: 'interrupt' };
  }

  /**
   * Handle set_model request
   *
   * Implements actual model switching with validation and error handling
   */
  private async handleSetModel(
    payload: CLIControlSetModelRequest,
  ): Promise<Record<string, unknown>> {
    const model = payload.model;

    // Validate model parameter
    if (typeof model !== 'string' || model.trim() === '') {
      throw new Error('Invalid model specified for set_model request');
    }

    try {
      // Attempt to set the model using config
      await this.context.config.setModel(model);

      if (this.context.debugMode) {
        console.error(`[SystemController] Model switched to: ${model}`);
      }

      return {
        subtype: 'set_model',
        model,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to set model';

      if (this.context.debugMode) {
        console.error(
          `[SystemController] Failed to set model ${model}:`,
          error,
        );
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Handle supported_commands request
   *
   * Returns list of supported slash commands loaded dynamically
   */
  private async handleSupportedCommands(): Promise<Record<string, unknown>> {
    const slashCommands = await this.loadSlashCommandNames();

    return {
      subtype: 'supported_commands',
      commands: slashCommands,
    };
  }

  /**
   * Load slash command names using CommandService
   *
   * @returns Promise resolving to array of slash command names
   */
  private async loadSlashCommandNames(): Promise<string[]> {
    const controller = new AbortController();
    try {
      const service = await CommandService.create(
        [new BuiltinCommandLoader(this.context.config)],
        controller.signal,
      );
      const names = new Set<string>();
      const commands = service.getCommands();
      for (const command of commands) {
        names.add(command.name);
      }
      return Array.from(names).sort();
    } catch (error) {
      if (this.context.debugMode) {
        console.error(
          '[SystemController] Failed to load slash commands:',
          error,
        );
      }
      return [];
    } finally {
      controller.abort();
    }
  }
}
