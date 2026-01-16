import { StringDecoder } from 'node:string_decoder';

const decoder = new StringDecoder('utf8');
let buffer = '';

function encode(msg) {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${len}\r\n\r\n${json}`;
}

function write(msg) {
  process.stdout.write(encode(msg));
}

function parseContentLength(headerText) {
  const lines = headerText.split('\r\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (key !== 'content-length') continue;
    const value = line.slice(idx + 1).trim();
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }
  return null;
}

function drain() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const headerText = buffer.slice(0, headerEnd);
    const contentLength = parseContentLength(headerText);
    if (contentLength === null) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const bodyStart = headerEnd + 4;
    const bodyText = buffer.slice(bodyStart);
    if (Buffer.byteLength(bodyText, 'utf8') < contentLength) return;

    // For this fixture, assume ASCII JSON and slice by chars.
    const jsonText = bodyText.slice(0, contentLength);
    buffer = bodyText.slice(contentLength);

    let msg;
    try {
      msg = JSON.parse(jsonText);
    } catch {
      continue;
    }

    onMessage(msg);
  }
}

function onMessage(msg) {
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
        },
      },
    });

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

  if (msg.method === 'initialized') return;

  if (msg.id === undefined || !msg.method) return;

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
      case 'textDocument/documentSymbol':
      case 'workspace/symbol':
      case 'textDocument/implementation':
      case 'textDocument/prepareCallHierarchy':
      case 'callHierarchy/incomingCalls':
      case 'callHierarchy/outgoingCalls':
        return [];
      default:
        return null;
    }
  })();

  write({ jsonrpc: '2.0', id: msg.id, result });
}

process.stdin.on('data', (chunk) => {
  buffer += decoder.write(chunk);
  drain();
});

process.stdin.on('end', () => {
  buffer += decoder.end();
  drain();
});
