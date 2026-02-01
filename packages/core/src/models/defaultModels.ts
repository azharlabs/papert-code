/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/contentGenerator.js';
import { DEFAULT_PAPERT_MODEL } from '../config/models.js';
import type { ModelProvidersConfig } from './types.js';

export const DEFAULT_PAPERT_VISION_MODEL = 'vision-model';

export const DEFAULT_MODEL_PROVIDERS: ModelProvidersConfig = {
  [AuthType.PAPERT_OAUTH]: [
    {
      id: DEFAULT_PAPERT_MODEL,
      name: DEFAULT_PAPERT_MODEL,
      description: 'Papert Coder model',
    },
    {
      id: DEFAULT_PAPERT_VISION_MODEL,
      name: DEFAULT_PAPERT_VISION_MODEL,
      description: 'Papert Vision model',
      capabilities: { vision: true },
    },
  ],
};
