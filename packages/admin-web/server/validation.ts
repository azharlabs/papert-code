import { z } from 'zod';

export const AdminControlsSchema = z
  .object({
    secureModeEnabled: z.boolean().optional(),
    strictModeDisabled: z.boolean().optional(),
    mcpSetting: z
      .object({
        mcpEnabled: z.boolean().optional(),
        overrideMcpConfigJson: z.string().optional(),
      })
      .optional(),
    cliFeatureSetting: z
      .object({
        extensionsSetting: z
          .object({
            extensionsEnabled: z.boolean().optional(),
          })
          .optional(),
        unmanagedCapabilitiesEnabled: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export const ProviderConfigSchema = z
  .object({
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().optional(),
    models: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const GroupSchema = z
  .object({
    name: z.string().min(1),
    controls: AdminControlsSchema.optional(),
    provider: ProviderConfigSchema.optional(),
    quotaMonthly: z.number().int().positive().nullable().optional(),
    quotaDaily: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const UserCreateSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'user']).default('user'),
    groupId: z.string().nullable().optional(),
    selfManaged: z.boolean().optional(),
    provider: ProviderConfigSchema.optional(),
    controls: AdminControlsSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const UserUpdateSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(['admin', 'user']).optional(),
    groupId: z.string().nullable().optional(),
    selfManaged: z.boolean().optional(),
    provider: ProviderConfigSchema.optional(),
    controls: AdminControlsSchema.optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export const UsageReportSchema = z
  .object({
    sessionId: z.string().min(1),
    totalTokens: z.number().int().nonnegative(),
    promptTokens: z.number().int().nonnegative().optional(),
    completionTokens: z.number().int().nonnegative().optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
  })
  .strict();

export const SessionUploadSchema = z
  .object({
    sessionId: z.string().min(1),
    transcript: z.string().min(1),
    usage: z.record(z.unknown()).optional(),
    model: z.string().optional(),
    baseUrl: z.string().optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
  })
  .strict();

export const QuotaRequestSchema = z
  .object({
    requestedMonthly: z.number().int().positive().optional(),
    reason: z.string().optional(),
  })
  .strict();
