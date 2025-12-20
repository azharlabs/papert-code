/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ApprovalMode, type PolicyRule } from './types.js';

export interface PolicyFileError {
  filePath: string;
  fileName: string;
  tier: 'default' | 'user' | 'admin';
  errorType: string;
  message: string;
}

export interface PolicyLoadResult {
  rules: PolicyRule[];
  errors: PolicyFileError[];
}

/**
 * Lightweight TOML loader stub. For now we simply return an empty rule set
 * to keep the API surface compatible with upstream without introducing new
 * parsing dependencies.
 */
export async function loadPoliciesFromToml(
  _approvalMode: ApprovalMode,
  _policyDirs: string[],
  _getPolicyTier: (dir: string) => number,
): Promise<PolicyLoadResult> {
  return { rules: [], errors: [] };
}
