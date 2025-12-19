/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './src/index.js';
export { Storage } from './src/config/storage.js';
export {
  DEFAULT_PAPERT_MODEL,
  DEFAULT_PAPERT_EMBEDDING_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from './src/config/models.js';
export {
  serializeTerminalToObject,
  type AnsiOutput,
  type AnsiLine,
  type AnsiToken,
} from './src/utils/terminalSerializer.js';
export {
  DEFAULT_TRUNCATE_TOOL_OUTPUT_LINES,
  DEFAULT_TRUNCATE_TOOL_OUTPUT_THRESHOLD,
} from './src/config/config.js';
export { detectIdeFromEnv } from './src/ide/detect-ide.js';
export {
  logExtensionEnable,
  logIdeConnection,
  logExtensionDisable,
  logAuth,
} from './src/telemetry/loggers.js';

export {
  IdeConnectionEvent,
  IdeConnectionType,
  ExtensionInstallEvent,
  ExtensionDisableEvent,
  ExtensionEnableEvent,
  ExtensionUninstallEvent,
  ModelSlashCommandEvent,
  AuthEvent,
} from './src/telemetry/types.js';
export { makeFakeConfig } from './src/test-utils/config.js';
export * from './src/utils/pathReader.js';
export * from './src/utils/request-tokenizer/supportedImageFormats.js';
export { ClearcutLogger } from './src/telemetry/clearcut-logger/clearcut-logger.js';
export { PapertLogger } from './src/telemetry/papert-logger/papert-logger.js';
export { logModelSlashCommand } from './src/telemetry/loggers.js';
export { getVersion } from './src/utils/version.js';
