/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@papert-code/papert-code-core';
import { SchemaValidator } from '@papert-code/papert-code-core';

export type StructuredOutputErrorCode =
  | 'schema_parse_error'
  | 'schema_validation_error'
  | 'generation_failed'
  | 'max_retries_exceeded';

export interface StructuredOutputOptions {
  schema: Record<string, unknown>;
  retries?: number;
}

export interface StructuredOutputResult {
  value: unknown;
  source: 'assistant_json' | 'llm_generation';
  attempts: number;
}

export class StructuredOutputError extends Error {
  readonly code: StructuredOutputErrorCode;
  readonly attempts: number;
  readonly lastValidationError?: string;

  constructor(
    code: StructuredOutputErrorCode,
    message: string,
    details?: {
      attempts?: number;
      lastValidationError?: string;
      cause?: unknown;
    },
  ) {
    super(message, details?.cause ? { cause: details.cause } : undefined);
    this.name = 'StructuredOutputError';
    this.code = code;
    this.attempts = details?.attempts ?? 0;
    this.lastValidationError = details?.lastValidationError;
  }
}

function validateAgainstSchema(
  schema: Record<string, unknown>,
  value: unknown,
): string | null {
  return SchemaValidator.validate(schema, value);
}

function parseAssistantJson(
  assistantText: string,
): { parsed?: unknown; parseError?: Error } {
  const trimmed = assistantText.trim();
  if (trimmed.length === 0) {
    return {
      parseError: new Error('Assistant response is empty; no JSON payload found.'),
    };
  }
  try {
    return { parsed: JSON.parse(trimmed) };
  } catch (error) {
    return {
      parseError:
        error instanceof Error ? error : new Error('Failed to parse JSON output'),
    };
  }
}

function buildTransformationPrompt(
  assistantText: string,
  schema: Record<string, unknown>,
): string {
  return [
    'Convert the assistant response into strict JSON that validates against the schema below.',
    'Return JSON data only.',
    'Schema:',
    JSON.stringify(schema, null, 2),
    'Assistant response:',
    assistantText,
  ].join('\n\n');
}

export async function resolveStructuredOutput(
  config: Config,
  options: StructuredOutputOptions,
  assistantText: string,
  abortSignal: AbortSignal,
  promptId: string,
): Promise<StructuredOutputResult> {
  const parsedAssistant = parseAssistantJson(assistantText);
  let initialValidationError: string | undefined;
  let initialParseError: Error | undefined;

  if (parsedAssistant.parsed !== undefined) {
    const validationError = validateAgainstSchema(
      options.schema,
      parsedAssistant.parsed,
    );
    if (!validationError) {
      return {
        value: parsedAssistant.parsed,
        source: 'assistant_json',
        attempts: 0,
      };
    }
    initialValidationError = validationError;
  } else if (parsedAssistant.parseError) {
    initialParseError = parsedAssistant.parseError;
  }

  const generationAttempts = Math.max(0, Math.floor(options.retries ?? 2));
  if (generationAttempts === 0) {
    if (initialValidationError) {
      throw new StructuredOutputError(
        'schema_validation_error',
        'Assistant JSON response did not match the provided schema.',
        {
          attempts: 0,
          lastValidationError: initialValidationError,
        },
      );
    }
    throw new StructuredOutputError(
      'schema_parse_error',
      'Assistant response is not valid JSON and structured output retries are disabled.',
      {
        attempts: 0,
        cause: initialParseError,
      },
    );
  }

  let sawGenerationError = false;
  let sawValidationError = false;
  let lastValidationError: string | undefined;
  let lastGenerationError: unknown;

  for (let attempt = 1; attempt <= generationAttempts; attempt++) {
    try {
      const generated = await config.getBaseLlmClient().generateJson({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: buildTransformationPrompt(assistantText, options.schema),
              },
            ],
          },
        ],
        schema: options.schema,
        model: config.getModel(),
        abortSignal,
        promptId: `${promptId}-structured-output-${attempt}`,
        maxAttempts: 2,
      });
      const validationError = validateAgainstSchema(options.schema, generated);
      if (!validationError) {
        return {
          value: generated,
          source: 'llm_generation',
          attempts: attempt,
        };
      }
      sawValidationError = true;
      lastValidationError = validationError;
    } catch (error) {
      sawGenerationError = true;
      lastGenerationError = error;
      if (abortSignal.aborted) {
        throw error;
      }
    }
  }

  if (sawValidationError && sawGenerationError) {
    throw new StructuredOutputError(
      'max_retries_exceeded',
      `Failed to produce structured output after ${generationAttempts} attempts.`,
      {
        attempts: generationAttempts,
        lastValidationError,
        cause: lastGenerationError,
      },
    );
  }
  if (sawValidationError) {
    throw new StructuredOutputError(
      'schema_validation_error',
      `Generated output did not match schema after ${generationAttempts} attempts.`,
      {
        attempts: generationAttempts,
        lastValidationError,
      },
    );
  }
  throw new StructuredOutputError(
    'generation_failed',
    `Failed to generate structured output after ${generationAttempts} attempts.`,
    {
      attempts: generationAttempts,
      cause: lastGenerationError,
    },
  );
}
