/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from '../config/config.js';
import { LspClient, type LspClientOptions } from './lspClient.js';
import {
  getBuiltInLspServers,
  resolveBuiltInCommand,
  findExecutable,
  type BuiltInLspServer,
  type LspCommandResolution,
} from './lspRegistry.js';

export interface LspServerConfig {
  /**
   * Whether this server is disabled.
   */
  disabled?: boolean;

  /**
   * Command to start the server (first item is executable).
   */
  command: string[];

  /**
   * File extensions handled by this server (e.g. [".ts", ".tsx"]).
   */
  extensions: string[];

  /**
   * Environment variables to set when starting server.
   */
  env?: Record<string, string>;

  /**
   * Initialization options to send to the server.
   */
  initialization?: unknown;
}

export interface LspSettings {
  enabled?: boolean;
  autoDetect?: boolean;
  autoInstall?: boolean;
  servers?: Record<string, LspServerConfig>;
}

export interface LspPosition {
  filePath: string;
  line: number; // 1-based
  character: number; // 1-based
}

export interface LspDiagnostic {
  uri: string;
  diagnostics: unknown;
}

export type LspServerSource = 'configured' | 'builtin';
export type LspServerStatusState = 'connected' | 'idle' | 'missing' | 'disabled';

export interface LspServerStatus {
  id: string;
  label: string;
  source: LspServerSource;
  status: LspServerStatusState;
  extensions: string[];
  command?: string[];
  autoInstall: boolean;
  installable: boolean;
  installHint?: string;
}

export class LspManager {
  private readonly clientsByServer = new Map<string, LspClient>();
  private readonly diagnosticsByUri = new Map<string, unknown>();
  private readonly installingByServer = new Map<string, Promise<LspCommandResolution | null>>();

  constructor(private readonly config: Config) {}

  getSettings(): LspSettings {
    return this.config.getLspSettings();
  }

  isEnabled(): boolean {
    const settings = this.getSettings();
    return settings.enabled ?? false;
  }

  private shouldAutoDetect(): boolean {
    const settings = this.getSettings();
    return settings.autoDetect ?? true;
  }

  private shouldAutoInstall(): boolean {
    const settings = this.getSettings();
    const autoInstall = settings.autoInstall ?? true;
    if (!autoInstall) return false;
    if (process.env['PAPERT_DISABLE_LSP_DOWNLOAD'] === 'true') return false;
    if (this.config.isRestrictiveSandbox()) return false;
    return this.config.isTrustedFolder();
  }

  isAutoDetectEnabled(): boolean {
    return this.shouldAutoDetect();
  }

  isAutoInstallEnabled(): boolean {
    return this.shouldAutoInstall();
  }

  private getServers(): Record<string, LspServerConfig> {
    return this.getSettings().servers ?? {};
  }

  private normalizeExtensions(extensions: string[]): string[] {
    return extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));
  }

  private getDisabledServerNames(): Set<string> {
    const disabled = new Set<string>();
    for (const [name, cfg] of Object.entries(this.getServers())) {
      if (cfg.disabled) disabled.add(name);
    }
    return disabled;
  }

  private findConfiguredServerForFile(
    filePath: string,
  ): { name: string; cfg: LspServerConfig } | null {
    const ext = path.extname(filePath);
    for (const [name, cfg] of Object.entries(this.getServers())) {
      if (cfg.disabled) continue;
      const extensions = this.normalizeExtensions(cfg.extensions ?? []);
      if (extensions.includes(ext)) {
        return { name, cfg };
      }
    }
    return null;
  }

  private async resolveBuiltInServerForFile(
    filePath: string,
  ): Promise<{ server: BuiltInLspServer; command: LspCommandResolution } | null> {
    if (!this.shouldAutoDetect()) return null;

    const ext = path.extname(filePath);
    const context = {
      filePath,
      projectRoot: this.config.getProjectRoot(),
    };
    const disabled = this.getDisabledServerNames();

    for (const server of getBuiltInLspServers()) {
      if (disabled.has(server.id)) continue;
      if (!server.extensions.includes(ext)) continue;
      if (server.detect && !(await server.detect(context))) continue;

      const command = await this.resolveBuiltInCommand(server);
      if (!command) continue;
      return { server, command };
    }
    return null;
  }

  private async resolveBuiltInCommand(
    server: BuiltInLspServer,
  ): Promise<LspCommandResolution | null> {
    const allowInstall = this.shouldAutoInstall();
    const existing = await resolveBuiltInCommand(server, false).catch(() => null);
    if (existing) return existing;

    if (!allowInstall) return null;

    const inflight = this.installingByServer.get(server.id);
    if (inflight) return inflight;

    const task = resolveBuiltInCommand(server, true).catch(() => null);
    this.installingByServer.set(server.id, task);
    task.finally(() => {
      if (this.installingByServer.get(server.id) === task) {
        this.installingByServer.delete(server.id);
      }
    });
    return task;
  }

  async getClientForFile(
    filePath: string,
    signal?: AbortSignal,
  ): Promise<{ client: LspClient; serverName: string } | null> {
    if (!this.isEnabled()) return null;

    const configured = this.findConfiguredServerForFile(filePath);
    let serverName: string | null = null;
    let command: string[] | null = null;
    let env: Record<string, string> | undefined;
    let initialization: unknown;

    if (configured) {
      serverName = configured.name;
      command = configured.cfg.command;
      env = configured.cfg.env;
      initialization = configured.cfg.initialization;
    } else {
      const builtinMatch = await this.resolveBuiltInServerForFile(filePath);
      if (!builtinMatch) return null;
      serverName = builtinMatch.server.id;
      command = builtinMatch.command.command;
      env = builtinMatch.server.env;
      initialization = builtinMatch.server.initialization;
    }

    if (!serverName || !command || command.length === 0) return null;

    const existing = this.clientsByServer.get(serverName);
    if (existing) return { client: existing, serverName };

    const [commandBinary, ...args] = command;
    const root = this.config.getProjectRoot();
    const rootUri = pathToFileURL(path.resolve(root)).href;

    const options: LspClientOptions = {
      command: commandBinary,
      args,
      cwd: root,
      env,
      rootUri,
      workspaceFolders: [{ name: path.basename(root), uri: rootUri }],
      initializationOptions: initialization,
      clientName: 'papert-code',
    };

    const client = new LspClient(options);
    client.onNotification((method, params) => {
      if (method !== 'textDocument/publishDiagnostics') return;
      const p = params as { uri?: string; diagnostics?: unknown };
      if (!p?.uri) return;
      this.diagnosticsByUri.set(p.uri, p.diagnostics ?? []);
      const pluginSystem = this.config.getPluginSystem?.();
      if (pluginSystem) {
        pluginSystem
          .getEventBus()
          .emit(
            'lsp.client.diagnostics',
            {
              serverName,
              uri: p.uri,
              diagnostics: p.diagnostics ?? [],
            },
            { config: pluginSystem.config },
          )
          .catch(() => {
            // ignore plugin errors
          });
      }
    });

    await client.initialize(signal);

    this.clientsByServer.set(serverName, client);
    const pluginSystem = this.config.getPluginSystem?.();
    if (pluginSystem) {
      try {
        await pluginSystem.getEventBus().emit(
          'lsp.updated',
          { serverName, status: 'connected' },
          { config: pluginSystem.config },
        );
      } catch {
        // ignore plugin errors
      }
    }
    return { client, serverName };
  }

  getDiagnostics(uri: string): unknown {
    return this.diagnosticsByUri.get(uri) ?? [];
  }

  async getStatus(): Promise<LspServerStatus[]> {
    const statuses: LspServerStatus[] = [];
    const autoDetect = this.shouldAutoDetect();
    const autoInstall = this.shouldAutoInstall();
    const servers = this.getServers();
    const configuredNames = new Set(Object.keys(servers));

    for (const [name, cfg] of Object.entries(servers)) {
      const extensions = this.normalizeExtensions(cfg.extensions ?? []);
      const disabled = cfg.disabled ?? false;
      const hasClient = this.clientsByServer.has(name);
      const commandAvailable = (() => {
        if (!cfg.command?.length) return false;
        const cmd = cfg.command[0];
        if (path.isAbsolute(cmd)) return fs.existsSync(cmd);
        if (cmd.startsWith('.')) {
          return fs.existsSync(path.resolve(this.config.getProjectRoot(), cmd));
        }
        return !!findExecutable(cmd);
      })();
      const status: LspServerStatusState = disabled
        ? 'disabled'
        : hasClient
          ? 'connected'
          : commandAvailable
            ? 'idle'
            : 'missing';

      statuses.push({
        id: name,
        label: name,
        source: 'configured',
        status,
        extensions,
        command: cfg.command,
        autoInstall,
        installable: false,
      });
    }

    if (autoDetect) {
      for (const server of getBuiltInLspServers()) {
        if (configuredNames.has(server.id)) continue;
        const hasClient = this.clientsByServer.has(server.id);
        const resolved = await resolveBuiltInCommand(server, false).catch(
          () => null,
        );
        const status: LspServerStatusState = hasClient
          ? 'connected'
          : resolved
            ? 'idle'
            : 'missing';

        statuses.push({
          id: server.id,
          label: server.label,
          source: 'builtin',
          status,
          extensions: server.extensions,
          command: resolved?.command ?? server.command,
          autoInstall,
          installable: !!server.npm,
          installHint: server.installHint,
        });
      }
    }

    return statuses;
  }

  dispose(): void {
    const pluginSystem = this.config.getPluginSystem?.();
    if (pluginSystem) {
      for (const serverName of this.clientsByServer.keys()) {
        pluginSystem
          .getEventBus()
          .emit(
            'lsp.updated',
            { serverName, status: 'disposed' },
            { config: pluginSystem.config },
          )
          .catch(() => {
            // ignore plugin errors
          });
      }
    }
    for (const client of this.clientsByServer.values()) {
      client.dispose();
    }
    this.clientsByServer.clear();
    this.diagnosticsByUri.clear();
  }
}
