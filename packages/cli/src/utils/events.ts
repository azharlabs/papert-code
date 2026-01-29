/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';

export enum AppEvent {
  OpenDebugConsole = 'open-debug-console',
  LogError = 'log-error',
  OauthDisplayMessage = 'oauth-display-message',
  SubmitPrompt = 'submit-prompt',
}

export const appEvents = new EventEmitter();
