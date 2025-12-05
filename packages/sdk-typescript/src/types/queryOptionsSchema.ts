import { z } from 'zod';
import type { CanUseTool } from './types.js';
import type { SubagentConfig } from './protocol.js';

export const ExternalMcpServerConfigSchema = z.object({
  command: z.string().min(1, 'Command must be a non-empty string'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const SdkMcpServerConfigSchema = z.object({
  connect: z.custom<(transport: unknown) => Promise<void>>(
    (val) => typeof val === 'function',
    { message: 'connect must be a function' },
  ),
});

export const ModelConfigSchema = z.object({
  model: z.string().optional(),
  temp: z.number().optional(),
  top_p: z.number().optional(),
});

export const RunConfigSchema = z.object({
  max_time_minutes: z.number().optional(),
  max_turns: z.number().optional(),
});

export const SubagentConfigSchema = z.object({
  name: z.string().min(1, 'Name must be a non-empty string'),
  description: z.string().min(1, 'Description must be a non-empty string'),
  tools: z.array(z.string()).optional(),
  systemPrompt: z.string().min(1, 'System prompt must be a non-empty string'),
  modelConfig: ModelConfigSchema.partial().optional(),
  runConfig: RunConfigSchema.partial().optional(),
  color: z.string().optional(),
  isBuiltin: z.boolean().optional(),
});

export const QueryOptionsSchema = z
  .object({
    cwd: z.string().optional(),
    model: z.string().optional(),
    pathToQwenExecutable: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    permissionMode: z.enum(['default', 'plan', 'auto-edit', 'yolo']).optional(),
    canUseTool: z
      .custom<CanUseTool>((val) => typeof val === 'function', {
        message: 'canUseTool must be a function',
      })
      .optional(),
    mcpServers: z.record(z.string(), ExternalMcpServerConfigSchema).optional(),
    abortController: z.instanceof(AbortController).optional(),
    debug: z.boolean().optional(),
    stderr: z
      .custom<
        (message: string) => void
      >((val) => typeof val === 'function', { message: 'stderr must be a function' })
      .optional(),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    maxSessionTurns: z.number().optional(),
    coreTools: z.array(z.string()).optional(),
    excludeTools: z.array(z.string()).optional(),
    allowedTools: z.array(z.string()).optional(),
    authType: z.enum(['openai', 'qwen-oauth']).optional(),
    agents: z
      .array(
        z.custom<SubagentConfig>(
          (val) =>
            val &&
            typeof val === 'object' &&
            'name' in val &&
            'description' in val &&
            'systemPrompt' in val && {
              message: 'agents must be an array of SubagentConfig objects',
            },
        ),
      )
      .optional(),
    includePartialMessages: z.boolean().optional(),
  })
  .strict();
