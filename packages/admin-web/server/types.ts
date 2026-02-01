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

export interface AdminPolicyMetadata {
  updatedAt: string;
  updatedBy: string;
}

export interface UserPolicyRecord {
  userId: string;
  controls: AdminControls;
  metadata: AdminPolicyMetadata;
}

export interface AdminPolicyStore {
  version: string;
  defaults: AdminControls;
  defaultsMetadata?: AdminPolicyMetadata;
  users: Record<string, UserPolicyRecord>;
}
