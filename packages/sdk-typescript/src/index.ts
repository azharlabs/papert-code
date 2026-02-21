export { query } from './query/createQuery.js';
export { AbortError, isAbortError } from './types/errors.js';
export { Query } from './query/Query.js';
export { createClient, PapertClient, PapertClientSession } from './client.js';
export { SdkLogger } from './utils/logger.js';
export { createPapertAgent } from './agent.js';
export { HttpSseTransport } from './transport/HttpSseTransport.js';
export { createSdkMcpServer } from './mcp/createSdkMcpServer.js';
export { tool } from './mcp/tool.js';
export {
  REMOTE_CONTROL_OPENAPI_CONTRACT_ID,
  REMOTE_CONTROL_OPENAPI_CONTRACT_VERSION,
  RemoteControlApiClient,
  RemoteControlApiError,
} from './generated/remoteControlApiClient.js';

export type { HttpSseTransportOptions } from './transport/HttpSseTransport.js';
export type {
  CreateRemoteSessionResponse,
  ErrorResponse,
  HealthResponse,
  ReleaseChannel,
  ReleaseRemoteSessionParams,
  RemoteControlApiClientOptions,
  UpdateWebUiReleaseChannelParams,
  WebUiCatalogResponse,
  WebUiSessionParams,
} from './generated/remoteControlApiClient.js';

export type { QueryOptions } from './query/createQuery.js';
export type { LogLevel, LoggerConfig, ScopedLogger } from './utils/logger.js';
export type { CreateSessionOptions } from './client.js';
export type {
  PapertAgent,
  PapertAgentOptions,
  RunPromptOptions,
} from './agent.js';

export type {
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKSystemMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
  SDKMessage,
  ControlMessage,
  CLIControlRequest,
  CLIControlResponse,
  ControlCancelRequest,
  SubagentConfig,
  SubagentLevel,
  ModelConfig,
  RunConfig,
} from './types/protocol.js';

export {
  isSDKUserMessage,
  isSDKAssistantMessage,
  isSDKSystemMessage,
  isSDKResultMessage,
  isSDKPartialAssistantMessage,
  isControlRequest,
  isControlResponse,
  isControlCancel,
} from './types/protocol.js';

export type {
  PermissionMode,
  CanUseTool,
  PermissionResult,
  ToolDefinition,
  ExternalMcpServerConfig,
  SdkMcpServerConfig,
} from './types/types.js';
