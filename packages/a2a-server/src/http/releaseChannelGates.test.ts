/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  applyReleaseChannelTransition,
  evaluateReleaseChannelTransition,
  getReleaseChannelGateStatus,
  getReleaseChannelSoakConfig,
  normalizeReleaseChannel,
  parseReleaseChannelState,
  type ReleaseChannelState,
} from './releaseChannelGates.js';

describe('releaseChannelGates', () => {
  it('normalizes unknown values to stable', () => {
    expect(normalizeReleaseChannel('nightly')).toBe('nightly');
    expect(normalizeReleaseChannel('preview')).toBe('preview');
    expect(normalizeReleaseChannel('invalid')).toBe('stable');
  });

  it('initializes state baseline for current channel when missing', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const parsed = parseReleaseChannelState({}, 'nightly', now);

    expect(parsed.baselineInitialized).toBe(true);
    expect(parsed.state.enteredAtByChannel.nightly).toBe(now.toISOString());
  });

  it('blocks direct nightly -> stable promotions', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { nightly: '2026-01-01T00:00:00.000Z' },
    };
    const result = evaluateReleaseChannelTransition(
      'nightly',
      'stable',
      state,
      { nightlyToPreviewMs: 0, previewToStableMs: 0 },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('promotion_order');
  });

  it('enforces soak before nightly -> preview promotion', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { nightly: '2026-01-01T00:00:00.000Z' },
    };
    const result = evaluateReleaseChannelTransition(
      'nightly',
      'preview',
      state,
      { nightlyToPreviewMs: 10_000, previewToStableMs: 0 },
      new Date('2026-01-01T00:00:05.000Z'),
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('soak_not_met');
    expect(result.soakRemainingMs).toBe(5_000);
  });

  it('allows promotion after soak window passes', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { preview: '2026-01-01T00:00:00.000Z' },
    };
    const result = evaluateReleaseChannelTransition(
      'preview',
      'stable',
      state,
      { nightlyToPreviewMs: 0, previewToStableMs: 10_000 },
      new Date('2026-01-01T00:00:10.001Z'),
    );

    expect(result.allowed).toBe(true);
  });

  it('allows demotions without soak checks', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { stable: '2026-01-01T00:00:00.000Z' },
    };
    const result = evaluateReleaseChannelTransition(
      'stable',
      'nightly',
      state,
      { nightlyToPreviewMs: 999_999, previewToStableMs: 999_999 },
      new Date('2026-01-01T00:00:00.100Z'),
    );

    expect(result.allowed).toBe(true);
  });

  it('reports gate status for current promotion step', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { nightly: '2026-01-01T00:00:00.000Z' },
    };
    const status = getReleaseChannelGateStatus(
      'nightly',
      state,
      { nightlyToPreviewMs: 10_000, previewToStableMs: 20_000 },
      new Date('2026-01-01T00:00:07.000Z'),
    );

    expect(status.current).toBe('nightly');
    expect(status.nextPromotionTarget).toBe('preview');
    expect(status.readyForPromotion).toBe(false);
    expect(status.soakRemainingMs).toBe(3_000);
  });

  it('applies transition by stamping destination channel timestamp', () => {
    const state: ReleaseChannelState = {
      enteredAtByChannel: { nightly: '2026-01-01T00:00:00.000Z' },
    };
    const now = new Date('2026-01-02T12:00:00.000Z');
    const nextState = applyReleaseChannelTransition(state, 'preview', now);

    expect(nextState.enteredAtByChannel.preview).toBe(now.toISOString());
    expect(nextState.lastChangedAt).toBe(now.toISOString());
  });

  it('reads soak overrides from environment', () => {
    const soak = getReleaseChannelSoakConfig({
      PAPERT_RELEASE_CHANNEL_SOAK_NIGHTLY_MS: '1',
      PAPERT_RELEASE_CHANNEL_SOAK_PREVIEW_MS: '2',
    });

    expect(soak.nightlyToPreviewMs).toBe(1);
    expect(soak.previewToStableMs).toBe(2);
  });
});
