export interface AdminControls {
  secureModeEnabled?: boolean;
  strictModeDisabled?: boolean;
  mcpSetting?: {
    mcpEnabled?: boolean;
    overrideMcpConfigJson?: string;
  };
  cliFeatureSetting?: {
    extensionsSetting?: {
      extensionsEnabled?: boolean;
    };
    unmanagedCapabilitiesEnabled?: boolean;
  };
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  models?: string[];
}

export interface UserRecord {
  id: string;
  email: string;
  role: 'admin' | 'user';
  groupId?: string | null;
  selfManaged: boolean;
  provider: ProviderConfig;
  controls: AdminControls;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRecord {
  id: string;
  name: string;
  controls: AdminControls;
  provider: ProviderConfig;
  quotaMonthly?: number | null;
  quotaDaily?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  period: 'daily' | 'monthly';
  periodStart: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  sessionId: string;
  model?: string | null;
  baseUrl?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  usage: Record<string, unknown>;
  transcriptPath?: string | null;
  createdAt: string;
}

export interface QuotaRequestRecord {
  id: string;
  userId: string;
  requestedMonthly?: number | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}
