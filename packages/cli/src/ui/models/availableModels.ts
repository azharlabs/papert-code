/**
 * @license
 * Copyright 2025 Papert
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  DEFAULT_PAPERT_MODEL,
  DEFAULT_MODEL_PROVIDERS,
  DEFAULT_PAPERT_VISION_MODEL,
  ModelRegistry,
} from '@papert-code/papert-code-core';
import { t } from '../../i18n/index.js';

export type AvailableModel = {
  id: string;
  label: string;
  description?: string;
  isVision?: boolean;
};

export const MAINLINE_VLM = DEFAULT_PAPERT_VISION_MODEL;
export const MAINLINE_CODER = DEFAULT_PAPERT_MODEL;

const modelRegistry = new ModelRegistry(DEFAULT_MODEL_PROVIDERS);

function toAvailableModel(model: {
  id: string;
  label: string;
  description?: string;
  isVision?: boolean;
}): AvailableModel {
  let description = model.description;
  if (model.id === MAINLINE_CODER) {
    description = t(
      'The latest Papert Coder model from Alibaba Cloud ModelStudio (version: papert3-coder-plus-2025-09-23)',
    );
  }
  if (model.id === MAINLINE_VLM) {
    description = t(
      'The latest Papert Vision model from Alibaba Cloud ModelStudio (version: papert3-vl-plus-2025-09-23)',
    );
  }
  return {
    id: model.id,
    label: model.label,
    description,
    isVision: model.isVision,
  };
}

export const AVAILABLE_MODELS_PAPERT: AvailableModel[] =
  modelRegistry
    .getModelsForAuthType(AuthType.PAPERT_OAUTH)
    .map((model) =>
      toAvailableModel({
        id: model.id,
        label: model.label,
        description: model.description,
        isVision: model.isVision,
      }),
    );

/**
 * Get available Papert models filtered by vision model preview setting
 */
export function getFilteredPapertModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_PAPERT;
  }
  return AVAILABLE_MODELS_PAPERT.filter((model) => !model.isVision);
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

export function getAvailableModelsForAuthType(
  authType: AuthType,
): AvailableModel[] {
  switch (authType) {
    case AuthType.PAPERT_OAUTH:
      return AVAILABLE_MODELS_PAPERT;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      const registryModels = modelRegistry
        .getModelsForAuthType(AuthType.USE_OPENAI)
        .map((model) =>
          toAvailableModel({
            id: model.id,
            label: model.label,
            description: model.description,
            isVision: model.isVision,
          }),
        );
      return openAIModel ? [openAIModel] : registryModels;
    }
    default:
      // For other auth types, return empty array for now
      // This can be expanded later according to the design doc
      return [];
  }
}

/**
/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_PAPERT.some(
    (model) => model.id === modelId && model.isVision,
  );
}
