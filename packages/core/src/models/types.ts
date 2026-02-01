/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthType } from '../core/contentGenerator.js';

export interface ModelCapabilities {
  vision?: boolean;
  tools?: boolean;
}

export interface ModelConfig {
  id: string;
  name?: string;
  description?: string;
  baseUrl?: string;
  generationConfig?: Record<string, unknown>;
  capabilities?: ModelCapabilities;
}

export interface ResolvedModelConfig extends ModelConfig {
  authType: AuthType;
  name: string;
  baseUrl: string;
  generationConfig: Record<string, unknown>;
  capabilities: ModelCapabilities;
}

export interface AvailableModel {
  id: string;
  label: string;
  description?: string;
  capabilities?: ModelCapabilities;
  authType: AuthType;
  isVision?: boolean;
}

export type ModelProvidersConfig = Record<string, ModelConfig[]>;
