/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getNpmInstallTarget, parseNpmPluginSpec } from './npmPluginSpec.js';

describe('npmPluginSpec', () => {
  it('parses unscoped package without version', () => {
    expect(parseNpmPluginSpec('papert-plugin-foo')).toEqual({
      raw: 'papert-plugin-foo',
      packageName: 'papert-plugin-foo',
    });
  });

  it('parses unscoped package with version', () => {
    expect(parseNpmPluginSpec('papert-plugin-foo@1.2.3')).toEqual({
      raw: 'papert-plugin-foo@1.2.3',
      packageName: 'papert-plugin-foo',
      version: '1.2.3',
    });
  });

  it('parses scoped package with version', () => {
    expect(parseNpmPluginSpec('@scope/papert-plugin@1.2.3')).toEqual({
      raw: '@scope/papert-plugin@1.2.3',
      packageName: '@scope/papert-plugin',
      version: '1.2.3',
    });
  });

  it('builds install target', () => {
    expect(
      getNpmInstallTarget(parseNpmPluginSpec('@scope/papert-plugin@1.2.3')),
    ).toBe('@scope/papert-plugin@1.2.3');
  });
});
