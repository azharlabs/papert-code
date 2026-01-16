/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from '../config/config.js';
import { LspClient, type LspClientOptions } from './lspClient.js';

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

export class LspManager {
  private readonly clientsByServer = new Map<string, LspClient>();
  private readonly diagnosticsByUri = new Map<string, unknown>();

  constructor(private readonly config: Config) {}

  getSettings(): LspSettings {
    return this.config.getLspSettings();
  }

  isEnabled(): boolean {
    const settings = this.getSettings();
    return settings.enabled ?? false;
  }

  private getServers(): Record<string, LspServerConfig> {
    return this.getSettings().servers ?? {};
  }

  private findServerForFile(filePath: string): { name: string; cfg: LspServerConfig } | null {
    const ext = path.extname(filePath);
    for (const [name, cfg] of Object.entries(this.getServers())) {
      if (cfg.disabled) continue;
      if (cfg.extensions.includes(ext)) {
        return { name, cfg };
      }
    }
    return null;
  }

  async getClientForFile(filePath: string, signal?: AbortSignal): Promise<{ client: LspClient; serverName: string } | null> {
    if (!this.isEnabled()) return null;

    const match = this.findServerForFile(filePath);
    if (!match) return null;

    const existing = this.clientsByServer.get(match.name);
    if (existing) return { client: existing, serverName: match.name };

    const [command, ...args] = match.cfg.command;
    const root = this.config.getProjectRoot();
    const rootUri = pathToFileURL(path.resolve(root)).href;

    const options: LspClientOptions = {
      command,
      args,
      cwd: root,
      env: match.cfg.env,
      rootUri,
      workspaceFolders: [{ name: path.basename(root), uri: rootUri }],
      initializationOptions: match.cfg.initialization,
      clientName: 'papert-code',
    };

    const client = new LspClient(options);
    client.onNotification((method, params) => {
      if (method !== 'textDocument/publishDiagnostics') return;
      const p = params as { uri?: string; diagnostics?: unknown };
      if (!p?.uri) return;
      this.diagnosticsByUri.set(p.uri, p.diagnostics ?? []);
    });

    await client.initialize(signal);

    this.clientsByServer.set(match.name, client);
    return { client, serverName: match.name };
  }

  getDiagnostics(uri: string): unknown {
    return this.diagnosticsByUri.get(uri) ?? [];
  }

  dispose(): void {
    for (const client of this.clientsByServer.values()) {
      client.dispose();
    }
    this.clientsByServer.clear();
    this.diagnosticsByUri.clear();
  }
}
