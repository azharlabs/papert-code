/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal shell permission helpers to mirror the upstream API surface.
 * Current implementation is permissive; callers can extend with stricter
 * checks as policy support matures.
 */

/**
 * Returns true if the provided shell invocation is allowlisted.
 * Placeholder implementation always allows the command.
 */
export function isShellInvocationAllowlisted(_command: string): boolean {
  return true;
}

/**
 * Returns true if a command is allowed. This is a thin wrapper around
 * {@link isShellInvocationAllowlisted}.
 */
export function isCommandAllowed(
  command: string,
  _allowedCommands?: string[],
): boolean {
  return isShellInvocationAllowlisted(command);
}
