/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIContentConverter } from './converter.js';
import type { StreamingToolCallParser } from './streamingToolCallParser.js';
import type { GenerateContentParameters, Content } from '@google/genai';

describe('OpenAIContentConverter', () => {
  let converter: OpenAIContentConverter;

  beforeEach(() => {
    converter = new OpenAIContentConverter('test-model');
  });

  describe('resetStreamingToolCalls', () => {
    it('should clear streaming tool calls accumulator', () => {
      // Access private field for testing
      const parser = (
        converter as unknown as {
          streamingToolCallParser: StreamingToolCallParser;
        }
      ).streamingToolCallParser;

      // Add some test data to the parser
      parser.addChunk(0, '{"arg": "value"}', 'test-id', 'test-function');
      parser.addChunk(1, '{"arg2": "value2"}', 'test-id-2', 'test-function-2');

      // Verify data is present
      expect(parser.getBuffer(0)).toBe('{"arg": "value"}');
      expect(parser.getBuffer(1)).toBe('{"arg2": "value2"}');

      // Call reset method
      converter.resetStreamingToolCalls();

      // Verify data is cleared
      expect(parser.getBuffer(0)).toBe('');
      expect(parser.getBuffer(1)).toBe('');
    });

    it('should be safe to call multiple times', () => {
      // Call reset multiple times
      converter.resetStreamingToolCalls();
      converter.resetStreamingToolCalls();
      converter.resetStreamingToolCalls();

      // Should not throw any errors
      const parser = (
        converter as unknown as {
          streamingToolCallParser: StreamingToolCallParser;
        }
      ).streamingToolCallParser;
      expect(parser.getBuffer(0)).toBe('');
    });

    it('should be safe to call on empty accumulator', () => {
      // Call reset on empty accumulator
      converter.resetStreamingToolCalls();

      // Should not throw any errors
      const parser = (
        converter as unknown as {
          streamingToolCallParser: StreamingToolCallParser;
        }
      ).streamingToolCallParser;
      expect(parser.getBuffer(0)).toBe('');
    });
  });

  describe('convertGeminiRequestToOpenAI', () => {
    const createRequestWithFunctionResponse = (
      response: Record<string, unknown>,
    ): GenerateContentParameters => {
      const contents: Content[] = [
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                id: 'call_1',
                name: 'shell',
                args: {},
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: 'call_1',
                name: 'shell',
                response,
              },
            },
          ],
        },
      ];
      return {
        model: 'models/test',
        contents,
      };
    };

    it('should extract raw output from function response objects', () => {
      const request = createRequestWithFunctionResponse({
        output: 'Raw output text',
      });

      const messages = converter.convertGeminiRequestToOpenAI(request);
      const toolMessage = messages.find((message) => message.role === 'tool');

      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toMatchObject([
        { type: 'text', text: 'Raw output text' },
      ]);
    });

    it('should prioritize error field when present', () => {
      const request = createRequestWithFunctionResponse({
        error: 'Command failed',
      });

      const messages = converter.convertGeminiRequestToOpenAI(request);
      const toolMessage = messages.find((message) => message.role === 'tool');

      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toMatchObject([
        { type: 'text', text: 'Command failed' },
      ]);
    });

    it('should stringify non-string responses', () => {
      const request = createRequestWithFunctionResponse({
        data: { value: 42 },
      });

      const messages = converter.convertGeminiRequestToOpenAI(request);
      const toolMessage = messages.find((message) => message.role === 'tool');

      expect(toolMessage).toBeDefined();
      expect(toolMessage?.content).toMatchObject([
        { type: 'text', text: '{"data":{"value":42}}' },
      ]);
    });

    it('should keep tool media inside the tool message', () => {
      const request: GenerateContentParameters = {
        model: 'models/test',
        contents: [
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'call_1',
                  name: 'figma_get_screenshot',
                  args: {},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'call_1',
                  name: 'figma_get_screenshot',
                  response: {
                    output: 'Screenshot attached',
                  },
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = converter.convertGeminiRequestToOpenAI(request);
      const toolMessage = messages.find((message) => message.role === 'tool');
      const userMessages = messages.filter((message) => message.role === 'user');

      expect(toolMessage).toBeDefined();
      expect(userMessages).toHaveLength(0);
      expect(toolMessage).toMatchObject({
        role: 'tool',
        tool_call_id: 'call_1',
      });

      const toolContent = toolMessage?.content;
      expect(Array.isArray(toolContent)).toBe(true);
      expect(toolContent).toMatchObject([
        {
          type: 'text',
          text: 'Screenshot attached',
        },
        {
          type: 'image_url',
          image_url: {
            url: expect.stringContaining('data:image/png;base64,'),
          },
        },
      ]);
    });
  });
});
