/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { StringDecoder } from 'node:string_decoder';

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

export interface JsonRpcWriter {
  write(message: JsonRpcMessage): void;
}

export interface JsonRpcReader {
  onMessage(cb: (message: JsonRpcMessage) => void): void;
}

/**
 * Minimal JSON-RPC 2.0 framing used by LSP over stdio.
 *
 * LSP messages are framed as:
 *   Content-Length: <bytes>\r\n
 *   \r\n
 *   <json>
 */
export class LspStdioMessageReader implements JsonRpcReader {
  private readonly decoder = new StringDecoder('utf8');
  private buffer = '';
  private cb: ((message: JsonRpcMessage) => void) | undefined;

  onMessage(cb: (message: JsonRpcMessage) => void): void {
    this.cb = cb;
  }

  push(chunk: Buffer): void {
    this.buffer += this.decoder.write(chunk);
    this.drain();
  }

  end(): void {
    this.buffer += this.decoder.end();
    this.drain();
  }

  private drain(): void {
    // Parse as many complete messages as possible.
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const headerText = this.buffer.slice(0, headerEnd);
      const contentLength = this.parseContentLength(headerText);
      if (contentLength === null) {
        // If we can't parse headers, drop them to avoid infinite loop.
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const bodyStart = headerEnd + 4;
      const available = Buffer.byteLength(this.buffer.slice(bodyStart), 'utf8');
      if (available < contentLength) {
        return;
      }

      // Extract body by bytes, not chars.
      const body = this.sliceUtf8Bytes(this.buffer, bodyStart, contentLength);
      const consumedChars = bodyStart + body.consumedChars;
      this.buffer = this.buffer.slice(consumedChars);

      try {
        const msg = JSON.parse(body.text) as JsonRpcMessage;
        this.cb?.(msg);
      } catch {
        // Ignore malformed messages.
      }
    }
  }

  private parseContentLength(headerText: string): number | null {
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

  private sliceUtf8Bytes(
    text: string,
    startCharIndex: number,
    byteLength: number,
  ): { text: string; consumedChars: number } {
    // Convert progressively until we have enough bytes.
    // This is not the most efficient approach, but is sufficient for LSP payload sizes.
    let end = startCharIndex;
    let bytes = 0;
    while (end < text.length && bytes < byteLength) {
      const next = text.slice(startCharIndex, end + 1);
      bytes = Buffer.byteLength(next, 'utf8');
      end++;
    }

    // Ensure we don't overshoot.
    while (bytes > byteLength && end > startCharIndex) {
      end--;
      bytes = Buffer.byteLength(text.slice(startCharIndex, end), 'utf8');
    }

    const bodyText = text.slice(startCharIndex, end);
    return { text: bodyText, consumedChars: end - startCharIndex };
  }
}

export class LspStdioMessageWriter implements JsonRpcWriter {
  write(message: JsonRpcMessage): void {
    const json = JSON.stringify(message);
    const len = Buffer.byteLength(json, 'utf8');
    process.stdout.write(`Content-Length: ${len}\r\n\r\n${json}`);
  }
}

export function encodeLspMessage(message: JsonRpcMessage): string {
  const json = JSON.stringify(message);
  const len = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${len}\r\n\r\n${json}`;
}
