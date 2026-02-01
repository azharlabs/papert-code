/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { AuthType } from '../core/contentGenerator.js';
import { ModelRegistry } from './modelRegistry.js';
import { DEFAULT_MODEL_PROVIDERS, DEFAULT_PAPERT_VISION_MODEL } from './defaultModels.js';

describe('ModelRegistry', () => {
  it('returns models for Papert auth type', () => {
    const registry = new ModelRegistry(DEFAULT_MODEL_PROVIDERS);
    const models = registry.getModelsForAuthType(AuthType.PAPERT_OAUTH);
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === DEFAULT_PAPERT_VISION_MODEL)).toBe(true);
  });

  it('returns empty list for unknown auth type', () => {
    const registry = new ModelRegistry({});
    const models = registry.getModelsForAuthType(AuthType.USE_OPENAI);
    expect(models).toEqual([]);
  });
});
