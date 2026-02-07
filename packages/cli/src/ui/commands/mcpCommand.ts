/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  SlashCommandActionReturn,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import type { DiscoveredMCPPrompt } from '@papert-code/papert-code-core';
import {
  DiscoveredMCPTool,
  getMCPDiscoveryState,
  getMCPServerStatus,
  MCPDiscoveryState,
  MCPServerStatus,
  getErrorMessage,
  MCPOAuthTokenStorage,
  MCPOAuthProvider,
} from '@papert-code/papert-code-core';
import { appEvents, AppEvent } from '../../utils/events.js';
import { MessageType, type HistoryItemMcpStatus } from '../types.js';
import { t } from '../../i18n/index.js';

const authCommand: SlashCommand = {
  name: 'auth',
  get description() {
    return t('Authenticate with an OAuth-enabled MCP server');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn> => {
    const serverName = args.trim();
    const { config } = context.services;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const mcpServers = config.getMcpServers() || {};

    if (!serverName) {
      // List servers that support OAuth
      const oauthServers = Object.entries(mcpServers)
        .filter(([_, server]) => server.oauth?.enabled)
        .map(([name, _]) => name);

      if (oauthServers.length === 0) {
        return {
          type: 'message',
          messageType: 'info',
          content: t('No MCP servers configured with OAuth authentication.'),
        };
      }

      return {
        type: 'message',
        messageType: 'info',
        content: `${t('MCP servers with OAuth authentication:')}\n${oauthServers.map((s) => `  - ${s}`).join('\n')}\n\n${t('Use /mcp auth <server-name> to authenticate.')}`,
      };
    }

    const server = mcpServers[serverName];
    if (!server) {
      return {
        type: 'message',
        messageType: 'error',
        content: t("MCP server '{{name}}' not found.", { name: serverName }),
      };
    }

    // Always attempt OAuth authentication, even if not explicitly configured
    // The authentication process will discover OAuth requirements automatically

    const displayListener = (message: string) => {
      context.ui.addItem({ type: 'info', text: message }, Date.now());
    };

    appEvents.on(AppEvent.OauthDisplayMessage, displayListener);

    try {
      context.ui.addItem(
        {
          type: 'info',
          text: t(
            "Starting OAuth authentication for MCP server '{{name}}'...",
            {
              name: serverName,
            },
          ),
        },
        Date.now(),
      );

      let oauthConfig = server.oauth;
      if (!oauthConfig) {
        oauthConfig = { enabled: false };
      }

      const mcpServerUrl = server.httpUrl || server.url;
      const authProvider = new MCPOAuthProvider(new MCPOAuthTokenStorage());
      await authProvider.authenticate(
        serverName,
        oauthConfig,
        mcpServerUrl,
        appEvents,
      );

      context.ui.addItem(
        {
          type: 'info',
          text: t(
            "Successfully authenticated and refreshed tools for '{{name}}'.",
            {
              name: serverName,
            },
          ),
        },
        Date.now(),
      );

      // Trigger tool re-discovery to pick up authenticated server
      const toolRegistry = config.getToolRegistry();
      if (toolRegistry) {
        context.ui.addItem(
          {
            type: 'info',
            text: t("Re-discovering tools from '{{name}}'...", {
              name: serverName,
            }),
          },
          Date.now(),
        );
        await toolRegistry.discoverToolsForServer(serverName);
      }
      // Update the client with the new tools
      const geminiClient = config.getGeminiClient();
      if (geminiClient) {
        await geminiClient.setTools();
      }

      // Reload the slash commands to reflect the changes.
      context.ui.reloadCommands();

      return {
        type: 'message',
        messageType: 'info',
        content: t(
          "Successfully authenticated and refreshed tools for '{{name}}'.",
          {
            name: serverName,
          },
        ),
      };
    } catch (error) {
      return {
        type: 'message',
        messageType: 'error',
        content: t(
          "Failed to authenticate with MCP server '{{name}}': {{error}}",
          {
            name: serverName,
            error: getErrorMessage(error),
          },
        ),
      };
    } finally {
      appEvents.removeListener(AppEvent.OauthDisplayMessage, displayListener);
    }
  },
  completion: async (context: CommandContext, partialArg: string) => {
    const { config } = context.services;
    if (!config) return [];

    const mcpServers = config.getMcpServers() || {};
    return Object.keys(mcpServers).filter((name) =>
      name.startsWith(partialArg),
    );
  },
};

const listCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('List configured MCP servers and tools');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<void | MessageActionReturn> => {
    const { config } = context.services;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const toolRegistry = config.getToolRegistry();
    if (!toolRegistry) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Could not retrieve tool registry.'),
      };
    }

    const lowerCaseArgs = args.toLowerCase().split(/\s+/).filter(Boolean);

    const hasDesc =
      lowerCaseArgs.includes('desc') || lowerCaseArgs.includes('descriptions');
    const hasNodesc =
      lowerCaseArgs.includes('nodesc') ||
      lowerCaseArgs.includes('nodescriptions');
    const showSchema = lowerCaseArgs.includes('schema');

    const showDescriptions = !hasNodesc && (hasDesc || showSchema);
    const showTips = lowerCaseArgs.length === 0;

    const mcpServers = config.getMcpServers() || {};
    const serverNames = Object.keys(mcpServers);
    const blockedMcpServers = config.getBlockedMcpServers() || [];

    const connectingServers = serverNames.filter(
      (name) => getMCPServerStatus(name) === MCPServerStatus.CONNECTING,
    );
    const discoveryState = getMCPDiscoveryState();
    const discoveryInProgress =
      discoveryState === MCPDiscoveryState.IN_PROGRESS ||
      connectingServers.length > 0;

    const allTools = toolRegistry.getAllTools();
    const mcpTools = allTools.filter(
      (tool) => tool instanceof DiscoveredMCPTool,
    ) as DiscoveredMCPTool[];

    const promptRegistry = await config.getPromptRegistry();
    const mcpPrompts = promptRegistry
      .getAllPrompts()
      .filter(
        (prompt) =>
          'serverName' in prompt &&
          serverNames.includes(prompt.serverName as string),
      ) as DiscoveredMCPPrompt[];

    const authStatus: HistoryItemMcpStatus['authStatus'] = {};
    const tokenStorage = new MCPOAuthTokenStorage();
    for (const serverName of serverNames) {
      const server = mcpServers[serverName];
      if (server.oauth?.enabled) {
        const creds = await tokenStorage.getCredentials(serverName);
        if (creds) {
          if (creds.token.expiresAt && creds.token.expiresAt < Date.now()) {
            authStatus[serverName] = 'expired';
          } else {
            authStatus[serverName] = 'authenticated';
          }
        } else {
          authStatus[serverName] = 'unauthenticated';
        }
      } else {
        authStatus[serverName] = 'not-configured';
      }
    }

    const mcpStatusItem: HistoryItemMcpStatus = {
      type: MessageType.MCP_STATUS,
      servers: mcpServers,
      tools: mcpTools.map((tool) => ({
        serverName: tool.serverName,
        name: tool.name,
        description: tool.description,
        schema: tool.schema,
      })),
      prompts: mcpPrompts.map((prompt) => ({
        serverName: prompt.serverName as string,
        name: prompt.name,
        description: prompt.description,
      })),
      authStatus,
      blockedServers: blockedMcpServers,
      discoveryInProgress,
      connectingServers,
      showDescriptions,
      showSchema,
      showTips,
    };

    context.ui.addItem(mcpStatusItem, Date.now());
  },
};

const refreshCommand: SlashCommand = {
  name: 'refresh',
  get description() {
    return t('Restarts MCP servers.');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
  ): Promise<void | SlashCommandActionReturn> => {
    const { config } = context.services;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const toolRegistry = config.getToolRegistry();
    if (!toolRegistry) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Could not retrieve tool registry.'),
      };
    }

    context.ui.addItem(
      {
        type: 'info',
        text: t('Restarting MCP servers...'),
      },
      Date.now(),
    );

    await toolRegistry.restartMcpServers();

    // Update the client with the new tools
    const geminiClient = config.getGeminiClient();
    if (geminiClient) {
      await geminiClient.setTools();
    }

    // Reload the slash commands to reflect the changes.
    context.ui.reloadCommands();

    return listCommand.action!(context, '');
  },
};

const diagnoseCommand: SlashCommand = {
  name: 'diagnose',
  get description() {
    return t('Diagnose MCP server and OAuth configuration issues');
  },
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn> => {
    const { config } = context.services;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: t('Config not loaded.'),
      };
    }

    const mcpServers = config.getMcpServers() || {};
    const allServerNames = Object.keys(mcpServers);
    const requestedServer = args.trim();

    if (allServerNames.length === 0) {
      return {
        type: 'message',
        messageType: 'info',
        content: t('No MCP servers are configured.'),
      };
    }

    if (requestedServer && !mcpServers[requestedServer]) {
      return {
        type: 'message',
        messageType: 'error',
        content: t("MCP server '{{name}}' not found.", { name: requestedServer }),
      };
    }

    const blockedServers =
      (config.getBlockedMcpServers() || []).map((entry) => entry.name) ?? [];
    const serverNames = requestedServer ? [requestedServer] : allServerNames;
    const tokenStorage = new MCPOAuthTokenStorage();
    const lines: string[] = [];

    for (const serverName of serverNames) {
      const server = mcpServers[serverName];
      const status = getMCPServerStatus(serverName);
      const transport = server.command
        ? 'stdio'
        : server.httpUrl
          ? 'streamable-http'
          : server.url
            ? 'sse'
            : server.tcp
              ? 'tcp'
              : 'unknown';

      const issues: string[] = [];
      const hints: string[] = [];

      if (transport === 'unknown') {
        issues.push('No transport configured');
        hints.push('Set one of command/url/httpUrl/tcp in mcpServers settings');
      }

      const isBlocked = blockedServers.includes(serverName);
      if (isBlocked) {
        issues.push('Server blocked by policy');
        hints.push('Review policy mcp.allowed/mcp.excluded and extension trust');
      }

      const oauthEnabled = Boolean(server.oauth?.enabled);
      if (oauthEnabled) {
        const creds = await tokenStorage.getCredentials(serverName);
        if (!creds) {
          issues.push('OAuth enabled but no stored credentials');
          hints.push(`Run /mcp auth ${serverName}`);
        } else if (creds.token.expiresAt && creds.token.expiresAt < Date.now()) {
          issues.push('OAuth token is expired');
          hints.push(`Run /mcp auth ${serverName} to refresh credentials`);
        }

        if (!server.url && !server.httpUrl) {
          issues.push('OAuth is typically used with url/httpUrl transports');
        }
      }

      if (
        status === MCPServerStatus.DISCONNECTED &&
        !isBlocked &&
        transport !== 'unknown'
      ) {
        hints.push('Run /mcp refresh to restart MCP servers');
      }

      lines.push(
        [
          `Server: ${serverName}`,
          `  Status: ${status}`,
          `  Transport: ${transport}`,
          `  OAuth: ${oauthEnabled ? 'enabled' : 'disabled'}`,
          `  Blocked: ${isBlocked ? 'yes' : 'no'}`,
          `  Issues: ${issues.length > 0 ? issues.join('; ') : 'none'}`,
          `  Next steps: ${hints.length > 0 ? hints.join('; ') : 'none'}`,
        ].join('\n'),
      );
    }

    return {
      type: 'message',
      messageType: 'info',
      content: lines.join('\n\n'),
    };
  },
  completion: async (context: CommandContext, partialArg: string) => {
    const { config } = context.services;
    if (!config) return [];

    const mcpServers = config.getMcpServers() || {};
    return Object.keys(mcpServers).filter((name) =>
      name.startsWith(partialArg),
    );
  },
};

export const mcpCommand: SlashCommand = {
  name: 'mcp',
  get description() {
    return t(
      'list configured MCP servers and tools, or authenticate with OAuth-enabled servers',
    );
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [listCommand, authCommand, refreshCommand, diagnoseCommand],
  // Default action when no subcommand is provided
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<void | SlashCommandActionReturn> =>
    // If no subcommand, run the list command
    listCommand.action!(context, args),
};
