/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { CheckerRegistry } from './registry.js';
import { AllowedPathChecker } from './built-in.js';
import { InProcessCheckerType } from '../policy/types.js';

describe('CheckerRegistry', () => {
  it('resolves built-in in-process checkers', () => {
    const registry = new CheckerRegistry('/tmp');
    const checker = registry.resolveInProcess(InProcessCheckerType.ALLOWED_PATH);
    expect(checker).toBeInstanceOf(AllowedPathChecker);
  });

  it('throws for unknown in-process checkers', () => {
    const registry = new CheckerRegistry('/tmp');
    expect(() =>
      registry.resolveInProcess('unknown-checker'),
    ).toThrow(/Unknown in-process checker/);
  });
});
