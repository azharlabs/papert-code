/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'papert-code';

export const EVENT_USER_PROMPT = 'papert-code.user_prompt';
export const EVENT_TOOL_CALL = 'papert-code.tool_call';
export const EVENT_API_REQUEST = 'papert-code.api_request';
export const EVENT_API_ERROR = 'papert-code.api_error';
export const EVENT_API_CANCEL = 'papert-code.api_cancel';
export const EVENT_API_RESPONSE = 'papert-code.api_response';
export const EVENT_CLI_CONFIG = 'papert-code.config';
export const EVENT_EXTENSION_DISABLE = 'papert-code.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'papert-code.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'papert-code.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'papert-code.extension_uninstall';
export const EVENT_FLASH_FALLBACK = 'papert-code.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'papert-code.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'papert-code.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'papert-code.slash_command';
export const EVENT_IDE_CONNECTION = 'papert-code.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'papert-code.chat_compression';
export const EVENT_INVALID_CHUNK = 'papert-code.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'papert-code.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'papert-code.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'papert-code.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'papert-code.malformed_json_response';
export const EVENT_FILE_OPERATION = 'papert-code.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'papert-code.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'papert-code.subagent_execution';
export const EVENT_AUTH = 'papert-code.auth';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'papert-code.startup.performance';
export const EVENT_MEMORY_USAGE = 'papert-code.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'papert-code.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION =
  'papert-code.performance.regression';
