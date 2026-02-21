/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  getCheckpointInfoList,
  parseCheckpointContent,
  serializeCheckpointData,
  type ToolCallData,
} from './checkpointUtils.js';

function createCheckpointData(
  overrides: Partial<ToolCallData> = {},
): ToolCallData {
  return {
    toolCall: { name: 'write_file', args: { file_path: 'a.txt' } },
    ...overrides,
  };
}

describe('checkpointUtils integrity', () => {
  it('serializes checkpoints with an integrity envelope', () => {
    const serialized = serializeCheckpointData(
      createCheckpointData({ messageId: 'msg-1' }),
    );

    const parsed = parseCheckpointContent(serialized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.checkpoint.integrityVerified).toBe(true);
    expect(parsed.checkpoint.data.messageId).toBe('msg-1');
  });

  it('accepts legacy checkpoints without integrity metadata', () => {
    const rawLegacy = JSON.stringify(createCheckpointData({ messageId: 'legacy-1' }));
    const parsed = parseCheckpointContent(rawLegacy);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.checkpoint.integrityVerified).toBe(false);
    expect(parsed.checkpoint.version).toBeNull();
    expect(parsed.checkpoint.data.messageId).toBe('legacy-1');
  });

  it('detects checkpoint tampering via hash mismatch', () => {
    const serialized = serializeCheckpointData(
      createCheckpointData({ messageId: 'msg-2' }),
    );
    const tampered = JSON.parse(serialized) as {
      data: ToolCallData;
      integrity: { algorithm: string; hash: string };
    };
    tampered.data.toolCall.name = 'run_shell_command';

    const parsed = parseCheckpointContent(JSON.stringify(tampered));
    expect(parsed).toEqual({
      success: false,
      error: {
        code: 'integrity_mismatch',
        message: 'Checkpoint integrity hash mismatch.',
      },
    });
  });

  it('returns invalid_json for malformed checkpoint files', () => {
    const parsed = parseCheckpointContent('{not-json');
    expect(parsed).toEqual({
      success: false,
      error: {
        code: 'invalid_json',
        message: 'Checkpoint JSON could not be parsed.',
      },
    });
  });

  it('filters checkpoint listing to valid entries', () => {
    const validModern = serializeCheckpointData(
      createCheckpointData({ messageId: 'modern' }),
    );
    const validLegacy = JSON.stringify(
      createCheckpointData({ messageId: 'legacy' }),
    );
    const tampered = JSON.parse(
      serializeCheckpointData(createCheckpointData({ messageId: 'tampered' })),
    ) as {
      data: ToolCallData;
      integrity: { algorithm: string; hash: string };
    };
    tampered.data.messageId = 'tampered-modified';

    const checkpointFiles = new Map<string, string>([
      ['modern.json', validModern],
      ['legacy.json', validLegacy],
      ['tampered.json', JSON.stringify(tampered)],
      ['broken.json', 'bad json'],
    ]);

    expect(getCheckpointInfoList(checkpointFiles)).toEqual([
      { messageId: 'modern', checkpoint: 'modern' },
      { messageId: 'legacy', checkpoint: 'legacy' },
    ]);
  });
});
