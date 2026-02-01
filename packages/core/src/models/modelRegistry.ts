/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/contentGenerator.js';
import { DEFAULT_DASHSCOPE_BASE_URL, DEFAULT_OPENAI_BASE_URL } from '../core/openaiContentGenerator/constants.js';
import type {
  ModelConfig,
  ModelProvidersConfig,
  ResolvedModelConfig,
  AvailableModel,
} from './types.js';

function validateAuthTypeKey(key: string): AuthType | undefined {
  if (Object.values(AuthType).includes(key as AuthType)) {
    return key as AuthType;
  }
  return undefined;
}

export class ModelRegistry {
  private modelsByAuthType: Map<AuthType, Map<string, ResolvedModelConfig>>;

  private getDefaultBaseUrl(authType: AuthType): string {
    switch (authType) {
      case AuthType.PAPERT_OAUTH:
        return DEFAULT_DASHSCOPE_BASE_URL;
      case AuthType.USE_OPENAI:
        return DEFAULT_OPENAI_BASE_URL;
      default:
        return '';
    }
  }

  constructor(modelProvidersConfig?: ModelProvidersConfig) {
    this.modelsByAuthType = new Map();

    if (modelProvidersConfig) {
      for (const [rawKey, models] of Object.entries(modelProvidersConfig)) {
        const authType = validateAuthTypeKey(rawKey);
        if (!authType) {
          continue;
        }
        this.registerAuthTypeModels(authType, models);
      }
    }
  }

  private registerAuthTypeModels(
    authType: AuthType,
    models: ModelConfig[],
  ): void {
    const modelMap = new Map<string, ResolvedModelConfig>();
    for (const config of models) {
      const resolved = this.resolveModelConfig(config, authType);
      modelMap.set(config.id, resolved);
    }
    this.modelsByAuthType.set(authType, modelMap);
  }

  getModelsForAuthType(authType: AuthType): AvailableModel[] {
    const models = this.modelsByAuthType.get(authType);
    if (!models) return [];

    return Array.from(models.values()).map((model) => ({
      id: model.id,
      label: model.name,
      description: model.description,
      capabilities: model.capabilities,
      authType: model.authType,
      isVision: model.capabilities?.vision ?? false,
    }));
  }

  getModel(
    authType: AuthType,
    modelId: string,
  ): ResolvedModelConfig | undefined {
    const models = this.modelsByAuthType.get(authType);
    return models?.get(modelId);
  }

  hasModel(authType: AuthType, modelId: string): boolean {
    const models = this.modelsByAuthType.get(authType);
    return models?.has(modelId) ?? false;
  }

  getDefaultModelForAuthType(
    authType: AuthType,
  ): ResolvedModelConfig | undefined {
    const models = this.modelsByAuthType.get(authType);
    if (!models || models.size === 0) return undefined;
    return Array.from(models.values())[0];
  }

  private resolveModelConfig(
    config: ModelConfig,
    authType: AuthType,
  ): ResolvedModelConfig {
    this.validateModelConfig(config, authType);
    return {
      ...config,
      authType,
      name: config.name || config.id,
      baseUrl: config.baseUrl || this.getDefaultBaseUrl(authType),
      generationConfig: config.generationConfig ?? {},
      capabilities: config.capabilities ?? {},
    };
  }

  private validateModelConfig(config: ModelConfig, authType: AuthType): void {
    if (!config.id) {
      throw new Error(
        `Model config in authType '${authType}' missing required field: id`,
      );
    }
  }
}
