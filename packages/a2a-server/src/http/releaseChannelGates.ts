/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

export const RELEASE_CHANNEL_ORDER = ['nightly', 'preview', 'stable'] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNEL_ORDER)[number];

export interface ReleaseChannelSoakConfig {
  nightlyToPreviewMs: number;
  previewToStableMs: number;
}

export interface ReleaseChannelState {
  enteredAtByChannel: Partial<Record<ReleaseChannel, string>>;
  lastChangedAt?: string;
}

export interface ReleaseChannelGateStatus {
  current: ReleaseChannel;
  nextPromotionTarget: ReleaseChannel | null;
  readyForPromotion: boolean;
  requiredSoakMs: number;
  soakElapsedMs: number;
  soakRemainingMs: number;
}

export interface ReleaseChannelGateResult {
  allowed: boolean;
  code?: 'promotion_order' | 'soak_not_met';
  message?: string;
  requiredSoakMs?: number;
  soakElapsedMs?: number;
  soakRemainingMs?: number;
}

const DEFAULT_NIGHTLY_TO_PREVIEW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREVIEW_TO_STABLE_MS = 72 * 60 * 60 * 1000;

function parseDurationMs(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

export function getReleaseChannelSoakConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReleaseChannelSoakConfig {
  return {
    nightlyToPreviewMs: parseDurationMs(
      env['PAPERT_RELEASE_CHANNEL_SOAK_NIGHTLY_MS'],
      DEFAULT_NIGHTLY_TO_PREVIEW_MS,
    ),
    previewToStableMs: parseDurationMs(
      env['PAPERT_RELEASE_CHANNEL_SOAK_PREVIEW_MS'],
      DEFAULT_PREVIEW_TO_STABLE_MS,
    ),
  };
}

export function normalizeReleaseChannel(value: unknown): ReleaseChannel {
  if (value === 'nightly' || value === 'preview' || value === 'stable') {
    return value;
  }
  return 'stable';
}

function getChannelRank(channel: ReleaseChannel): number {
  return RELEASE_CHANNEL_ORDER.indexOf(channel);
}

function getRequiredSoakMs(
  from: ReleaseChannel,
  soakConfig: ReleaseChannelSoakConfig,
): number {
  if (from === 'nightly') {
    return soakConfig.nightlyToPreviewMs;
  }
  if (from === 'preview') {
    return soakConfig.previewToStableMs;
  }
  return 0;
}

export function parseReleaseChannelState(
  generalSettings: Record<string, unknown>,
  currentChannel: ReleaseChannel,
  now: Date = new Date(),
): { state: ReleaseChannelState; baselineInitialized: boolean } {
  const nowIso = now.toISOString();
  const rawState = generalSettings['releaseChannelState'];
  const enteredAtByChannel: Partial<Record<ReleaseChannel, string>> = {};
  let lastChangedAt: string | undefined;

  if (rawState && typeof rawState === 'object') {
    const stateRecord = rawState as Record<string, unknown>;
    const rawEntered = stateRecord['enteredAtByChannel'];
    if (rawEntered && typeof rawEntered === 'object') {
      const enteredRecord = rawEntered as Record<string, unknown>;
      for (const channel of RELEASE_CHANNEL_ORDER) {
        if (typeof enteredRecord[channel] === 'string') {
          enteredAtByChannel[channel] = enteredRecord[channel];
        }
      }
    }
    if (typeof stateRecord['lastChangedAt'] === 'string') {
      lastChangedAt = stateRecord['lastChangedAt'];
    }
  }

  let baselineInitialized = false;
  if (!enteredAtByChannel[currentChannel]) {
    enteredAtByChannel[currentChannel] = nowIso;
    baselineInitialized = true;
  }

  return {
    state: {
      enteredAtByChannel,
      lastChangedAt,
    },
    baselineInitialized,
  };
}

export function evaluateReleaseChannelTransition(
  currentChannel: ReleaseChannel,
  requestedChannel: ReleaseChannel,
  state: ReleaseChannelState,
  soakConfig: ReleaseChannelSoakConfig,
  now: Date = new Date(),
): ReleaseChannelGateResult {
  if (currentChannel === requestedChannel) {
    return { allowed: true };
  }

  const currentRank = getChannelRank(currentChannel);
  const requestedRank = getChannelRank(requestedChannel);

  // Moving to a less stable channel is always allowed.
  if (requestedRank < currentRank) {
    return { allowed: true };
  }

  if (requestedRank - currentRank !== 1) {
    return {
      allowed: false,
      code: 'promotion_order',
      message:
        'Release-channel promotion must follow nightly -> preview -> stable.',
    };
  }

  const requiredSoakMs = getRequiredSoakMs(currentChannel, soakConfig);
  const baseline = state.enteredAtByChannel[currentChannel];
  const baselineMs = baseline ? Date.parse(baseline) : Number.NaN;
  const nowMs = now.getTime();
  const soakElapsedMs =
    Number.isFinite(baselineMs) && baselineMs <= nowMs ? nowMs - baselineMs : 0;
  const soakRemainingMs = Math.max(0, requiredSoakMs - soakElapsedMs);

  if (soakRemainingMs > 0) {
    return {
      allowed: false,
      code: 'soak_not_met',
      message: `Promotion from ${currentChannel} to ${requestedChannel} requires soak time. Remaining: ${soakRemainingMs}ms.`,
      requiredSoakMs,
      soakElapsedMs,
      soakRemainingMs,
    };
  }

  return { allowed: true };
}

export function applyReleaseChannelTransition(
  state: ReleaseChannelState,
  requestedChannel: ReleaseChannel,
  now: Date = new Date(),
): ReleaseChannelState {
  const nowIso = now.toISOString();
  return {
    enteredAtByChannel: {
      ...state.enteredAtByChannel,
      [requestedChannel]: nowIso,
    },
    lastChangedAt: nowIso,
  };
}

export function getReleaseChannelGateStatus(
  currentChannel: ReleaseChannel,
  state: ReleaseChannelState,
  soakConfig: ReleaseChannelSoakConfig,
  now: Date = new Date(),
): ReleaseChannelGateStatus {
  const currentRank = getChannelRank(currentChannel);
  const nextPromotionTarget =
    currentRank < RELEASE_CHANNEL_ORDER.length - 1
      ? RELEASE_CHANNEL_ORDER[currentRank + 1]
      : null;

  if (!nextPromotionTarget) {
    return {
      current: currentChannel,
      nextPromotionTarget: null,
      readyForPromotion: true,
      requiredSoakMs: 0,
      soakElapsedMs: 0,
      soakRemainingMs: 0,
    };
  }

  const requiredSoakMs = getRequiredSoakMs(currentChannel, soakConfig);
  const enteredAt = state.enteredAtByChannel[currentChannel];
  const enteredMs = enteredAt ? Date.parse(enteredAt) : Number.NaN;
  const nowMs = now.getTime();
  const soakElapsedMs =
    Number.isFinite(enteredMs) && enteredMs <= nowMs ? nowMs - enteredMs : 0;
  const soakRemainingMs = Math.max(0, requiredSoakMs - soakElapsedMs);

  return {
    current: currentChannel,
    nextPromotionTarget,
    readyForPromotion: soakRemainingMs === 0,
    requiredSoakMs,
    soakElapsedMs,
    soakRemainingMs,
  };
}

export function serializeReleaseChannelState(
  state: ReleaseChannelState,
): Record<string, unknown> {
  return {
    enteredAtByChannel: state.enteredAtByChannel,
    lastChangedAt: state.lastChangedAt,
  };
}
