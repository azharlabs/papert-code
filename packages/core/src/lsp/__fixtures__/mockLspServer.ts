/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { LspStdioMessageReader, encodeLspMessage, type JsonRpcMessage } from '../jsonRpc.js';

const reader = new LspStdioMessageReader();

function write(msg: JsonRpcMessage): void {
  process.stdout.write(encodeLspMessage(msg));
}

reader.onMessage((msg) => {
  if (msg.method === 'initialize' && msg.id !== undefined) {
    write({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        capabilities: {
          hoverProvider: true,
          definitionProvider: true,
          referencesProvider: true,
          documentSymbolProvider: true,
          workspaceSymbolProvider: true,
          implementationProvider: true,
          callHierarchyProvider: true,
          diagnosticProvider: false,
        },
      },
    });

    // Emit a diagnostic after init.
    write({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///mock.ts',
        diagnostics: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
            severity: 1,
            message: 'Mock diagnostic',
            source: 'mock',
          },
        ],
      },
    });

    return;
  }

  if (msg.method === 'initialized') {
    return;
  }

  if (msg.id === undefined || !msg.method) {
    return;
  }

  const result = (() => {
    switch (msg.method) {
      case 'textDocument/hover':
        return { contents: { kind: 'plaintext', value: 'Mock hover' } };
      case 'textDocument/definition':
        return [
          {
            uri: 'file:///mock.ts',
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 1 },
            },
          },
        ];
      case 'textDocument/references':
        return [];
      case 'textDocument/documentSymbol':
        return [];
      case 'workspace/symbol':
        return [];
      case 'textDocument/implementation':
        return [];
      case 'textDocument/prepareCallHierarchy':
        return [];
      case 'callHierarchy/incomingCalls':
        return [];
      case 'callHierarchy/outgoingCalls':
        return [];
      default:
        return null;
    }
  })();

  write({
    jsonrpc: '2.0',
    id: msg.id,
    result,
  });
});

process.stdin.on('data', (chunk) => reader.push(chunk));
process.stdin.on('end', () => reader.end());
