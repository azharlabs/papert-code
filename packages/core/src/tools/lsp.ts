/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import type { Config } from '../config/config.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { ToolNames, ToolDisplayNames } from './tool-names.js';
import { getErrorMessage } from '../utils/errors.js';
import { LspClient } from '../lsp/lspClient.js';
import { LspManager } from '../lsp/lspManager.js';

export type LspOperation =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'prepareCallHierarchy'
  | 'incomingCalls'
  | 'outgoingCalls'
  | 'diagnostics';

export interface LspToolParams {
  operation: LspOperation;
  filePath: string;
  line?: number;
  character?: number;
}

function resolveFilePath(config: Config, filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(config.getProjectRoot(), filePath);
}

class LspToolInvocation extends BaseToolInvocation<LspToolParams, ToolResult> {
  private readonly manager: LspManager;

  constructor(private readonly config: Config, params: LspToolParams) {
    super(params);
    this.manager = config.getLspManager();
  }

  getDescription(): string {
    const loc = this.params.line && this.params.character
      ? `${this.params.filePath}:${this.params.line}:${this.params.character}`
      : this.params.filePath;
    return `${this.params.operation} ${loc}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const absFile = resolveFilePath(this.config, this.params.filePath);

      const clientInfo = await this.manager.getClientForFile(absFile, signal);
      if (!clientInfo) {
        return {
          llmContent: `No LSP server available for this file type (or LSP disabled).`,
          returnDisplay: 'No LSP server available',
        };
      }

      const { client } = clientInfo;
      const uri = LspClient.filePathToUri(absFile);

      // For operations that need a position, require line/character.
      const needsPosition = new Set<LspOperation>([
        'goToDefinition',
        'findReferences',
        'hover',
        'goToImplementation',
        'prepareCallHierarchy',
        'incomingCalls',
        'outgoingCalls',
      ]);

      const position = needsPosition.has(this.params.operation)
        ? {
            line: (this.params.line ?? 1) - 1,
            character: (this.params.character ?? 1) - 1,
          }
        : undefined;

      // Best-effort: tell server we opened the doc. We don't currently send full text.
      client.notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: path.extname(absFile).replace('.', ''),
          version: 1,
          text: '',
        },
      });

      const result = await (async () => {
        switch (this.params.operation) {
          case 'goToDefinition':
            return client.request('textDocument/definition', {
              textDocument: { uri },
              position,
            }, signal);
          case 'findReferences':
            return client.request('textDocument/references', {
              textDocument: { uri },
              position,
              context: { includeDeclaration: true },
            }, signal);
          case 'hover':
            return client.request('textDocument/hover', {
              textDocument: { uri },
              position,
            }, signal);
          case 'documentSymbol':
            return client.request('textDocument/documentSymbol', {
              textDocument: { uri },
            }, signal);
          case 'workspaceSymbol':
            return client.request('workspace/symbol', { query: '' }, signal);
          case 'goToImplementation':
            return client.request('textDocument/implementation', {
              textDocument: { uri },
              position,
            }, signal);
          case 'prepareCallHierarchy':
            return client.request('textDocument/prepareCallHierarchy', {
              textDocument: { uri },
              position,
            }, signal);
          case 'incomingCalls': {
            const items = await client.request('textDocument/prepareCallHierarchy', {
              textDocument: { uri },
              position,
            }, signal);
            const first = Array.isArray(items) ? items[0] : undefined;
            if (!first) return [];
            return client.request('callHierarchy/incomingCalls', { item: first }, signal);
          }
          case 'outgoingCalls': {
            const items = await client.request('textDocument/prepareCallHierarchy', {
              textDocument: { uri },
              position,
            }, signal);
            const first = Array.isArray(items) ? items[0] : undefined;
            if (!first) return [];
            return client.request('callHierarchy/outgoingCalls', { item: first }, signal);
          }
          case 'diagnostics':
            return this.manager.getDiagnostics(uri);
        }
      })();

      const output = (() => {
        if (Array.isArray(result) && result.length === 0) {
          return `No results found for ${this.params.operation}`;
        }
        return JSON.stringify(result, null, 2);
      })();

      return {
        llmContent: output,
        returnDisplay: output,
      };
    } catch (error) {
      const msg = getErrorMessage(error);
      return {
        llmContent: `LSP error: ${msg}`,
        returnDisplay: `LSP error: ${msg}`,
        error: { message: msg },
      };
    }
  }
}

export class LspTool extends BaseDeclarativeTool<LspToolParams, ToolResult> {
  static readonly Name = ToolNames.LSP;

  constructor(private readonly config: Config) {
    super(
      LspTool.Name,
      ToolDisplayNames.LSP,
      'Interact with Language Server Protocol (LSP) servers for code navigation and diagnostics.',
      Kind.Read,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'goToDefinition',
              'findReferences',
              'hover',
              'documentSymbol',
              'workspaceSymbol',
              'goToImplementation',
              'prepareCallHierarchy',
              'incomingCalls',
              'outgoingCalls',
              'diagnostics',
            ],
            description: 'The LSP operation to perform',
          },
          filePath: {
            type: 'string',
            description: 'The absolute or relative path to the file',
          },
          line: {
            type: 'number',
            description: 'The line number (1-based, as shown in editors)',
          },
          character: {
            type: 'number',
            description: 'The character offset (1-based, as shown in editors)',
          },
        },
        required: ['operation', 'filePath'],
        additionalProperties: false,
      },
      false,
      false,
    );

  }

  protected override validateToolParamValues(params: LspToolParams): string | null {
    if (!params.filePath || typeof params.filePath !== 'string') {
      return 'filePath must be a string';
    }

    const needsPosition = new Set<LspOperation>([
      'goToDefinition',
      'findReferences',
      'hover',
      'goToImplementation',
      'prepareCallHierarchy',
      'incomingCalls',
      'outgoingCalls',
    ]);

    if (needsPosition.has(params.operation)) {
      if (typeof params.line !== 'number' || params.line < 1) {
        return 'line must be a number >= 1 for this operation';
      }
      if (typeof params.character !== 'number' || params.character < 1) {
        return 'character must be a number >= 1 for this operation';
      }
    }

    return null;
  }

  protected createInvocation(params: LspToolParams): ToolInvocation<LspToolParams, ToolResult> {
    return new LspToolInvocation(this.config, params);
  }
}
