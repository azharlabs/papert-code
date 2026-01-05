/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';

export function createLogger(
  context: vscode.ExtensionContext,
  logger: vscode.OutputChannel,
) {
  return (message: string) => {
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      logger.appendLine(message);
    }
  };
}
