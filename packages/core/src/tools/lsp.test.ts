/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Config } from '../config/config.js';
import { LspTool } from './lsp.js';

function createConfigWithMockLsp(projectRoot: string): Config {
  const mockServerPath = path.join(
    projectRoot,
    'packages/core/src/lsp/__fixtures__/mockLspServer.mjs',
  );

  return new Config({
    targetDir: projectRoot,
    cwd: projectRoot,
    debugMode: true,
    lsp: {
      enabled: true,
      servers: {
        mock: {
          command: ['node', mockServerPath],
          extensions: ['.ts'],
        },
      },
    },
  });
}

describe('LspTool', () => {
  it('returns hover result from mock server', async () => {
    const projectRoot = path.resolve(__dirname, '../../../..');
    const config = createConfigWithMockLsp(projectRoot);

    const tool = new LspTool(config);
    const invocation = tool.build({
      operation: 'hover',
      filePath: 'mock.ts',
      line: 1,
      character: 1,
    });

    const result = await invocation.execute(new AbortController().signal);
    expect(String(result.llmContent)).toContain('Mock hover');
  });
});
