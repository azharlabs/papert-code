/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@papert-code/papert-code-core';
import { describe, expect, it, vi } from 'vitest';
import { resolveStructuredOutput } from './structuredOutput.js';

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
  additionalProperties: false,
} as const;

function createMockConfig(
  generateJson: ReturnType<typeof vi.fn>,
): Config {
  return {
    getBaseLlmClient: vi.fn(() => ({
      generateJson,
    })),
    getModel: vi.fn(() => 'test-model'),
  } as unknown as Config;
}

describe('resolveStructuredOutput', () => {
  it('returns parsed assistant JSON when it already matches schema', async () => {
    const generateJson = vi.fn();
    const config = createMockConfig(generateJson);

    const result = await resolveStructuredOutput(
      config,
      {
        schema: TEST_SCHEMA,
        retries: 2,
      },
      '{"name":"papert"}',
      new AbortController().signal,
      'prompt-structured-1',
    );

    expect(result).toEqual({
      value: { name: 'papert' },
      source: 'assistant_json',
      attempts: 0,
    });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it('regenerates structured output when assistant text is not JSON', async () => {
    const generateJson = vi.fn().mockResolvedValue({ name: 'converted' });
    const config = createMockConfig(generateJson);

    const result = await resolveStructuredOutput(
      config,
      {
        schema: TEST_SCHEMA,
        retries: 2,
      },
      'Name is papert',
      new AbortController().signal,
      'prompt-structured-2',
    );

    expect(result).toEqual({
      value: { name: 'converted' },
      source: 'llm_generation',
      attempts: 1,
    });
    expect(generateJson).toHaveBeenCalledTimes(1);
  });

  it('throws schema_parse_error when retries are disabled and assistant text is not JSON', async () => {
    const generateJson = vi.fn();
    const config = createMockConfig(generateJson);

    await expect(
      resolveStructuredOutput(
        config,
        {
          schema: TEST_SCHEMA,
          retries: 0,
        },
        'not-json',
        new AbortController().signal,
        'prompt-structured-3',
      ),
    ).rejects.toMatchObject({
      code: 'schema_parse_error',
      attempts: 0,
    });

    expect(generateJson).not.toHaveBeenCalled();
  });

  it('throws schema_validation_error when assistant JSON fails schema and retries are disabled', async () => {
    const generateJson = vi.fn();
    const config = createMockConfig(generateJson);

    await expect(
      resolveStructuredOutput(
        config,
        {
          schema: TEST_SCHEMA,
          retries: 0,
        },
        '{"count":1}',
        new AbortController().signal,
        'prompt-structured-4',
      ),
    ).rejects.toMatchObject({
      code: 'schema_validation_error',
      attempts: 0,
    });

    expect(generateJson).not.toHaveBeenCalled();
  });

  it('throws max_retries_exceeded when retries include both validation and generation failures', async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('temporary generator failure'));
    const config = createMockConfig(generateJson);

    await expect(
      resolveStructuredOutput(
        config,
        {
          schema: TEST_SCHEMA,
          retries: 2,
        },
        'still-not-json',
        new AbortController().signal,
        'prompt-structured-5',
      ),
    ).rejects.toMatchObject({
      code: 'max_retries_exceeded',
      attempts: 2,
    });

    expect(generateJson).toHaveBeenCalledTimes(2);
  });
});
