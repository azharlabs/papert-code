/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CodeAssistServer } from '../server.js';
import { debugLogger } from '../../utils/debugLogger.js';
import { isDeepStrictEqual } from 'node:util';
import {
  type FetchAdminControlsResponse,
  FetchAdminControlsResponseSchema,
} from '../types.js';
import { getCodeAssistServer } from '../codeAssist.js';
import type { Config } from '../../config/config.js';

let pollingInterval: NodeJS.Timeout | undefined;
let currentSettings: FetchAdminControlsResponse | undefined;

function resolveAdminControlsUrl(base: string, userId: string): string {
  const trimmed = base.replace(/\\/$/, '');
  if (trimmed.endsWith('/admin-controls')) {
    return `${trimmed}?userId=${encodeURIComponent(userId)}`;
  }
  if (trimmed.endsWith('/api/v1/admin-controls')) {
    return `${trimmed}?userId=${encodeURIComponent(userId)}`;
  }
  return `${trimmed}/api/v1/admin-controls?userId=${encodeURIComponent(userId)}`;
}

async function fetchAdminControlsFromUrl(
  url: string,
  userId: string,
  token?: string,
): Promise<FetchAdminControlsResponse> {
  const resolvedUrl = resolveAdminControlsUrl(url, userId);
  const headers: Record<string, string> = { 'x-user-id': userId };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(resolvedUrl, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Admin controls request failed (${response.status}): ${text || response.statusText}`,
    );
  }
  const payload = (await response.json()) as FetchAdminControlsResponse;
  return sanitizeAdminSettings(payload);
}

export function sanitizeAdminSettings(
  settings: FetchAdminControlsResponse,
): FetchAdminControlsResponse {
  const result = FetchAdminControlsResponseSchema.safeParse(settings);
  if (!result.success) {
    return {};
  }
  return result.data;
}

function isFetchError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

export async function fetchAdminControls(
  server: CodeAssistServer | undefined,
  cachedSettings: FetchAdminControlsResponse | undefined,
  adminControlsEnabled: boolean,
  onSettingsChanged: (settings: FetchAdminControlsResponse) => void,
): Promise<FetchAdminControlsResponse> {
  const overrideUrl =
    process.env['PAPERT_ADMIN_CONTROLS_URL'] || process.env['PAPERT_ADMIN_URL'];
  const overrideUserId =
    process.env['PAPERT_ADMIN_USER_ID'] ||
    process.env['PAPERT_ADMIN_EMAIL'];
  const overrideToken = process.env['PAPERT_ADMIN_TOKEN'];

  if (overrideUrl && overrideUserId) {
    if (cachedSettings) {
      currentSettings = cachedSettings;
      return cachedSettings;
    }
    try {
      const fetched = await fetchAdminControlsFromUrl(
        overrideUrl,
        overrideUserId,
        overrideToken,
      );
      currentSettings = fetched;
      return fetched;
    } catch (e) {
      debugLogger.error('Failed to fetch admin controls from override URL: ', e);
      currentSettings = {};
      return {};
    }
  }

  if (!server || !server.projectId || !adminControlsEnabled) {
    stopAdminControlsPolling();
    currentSettings = undefined;
    return {};
  }

  if (cachedSettings) {
    currentSettings = cachedSettings;
    startAdminControlsPolling(server, server.projectId, onSettingsChanged);
    return cachedSettings;
  }

  try {
    const rawSettings = await server.fetchAdminControls({
      project: server.projectId,
    });
    const sanitizedSettings = sanitizeAdminSettings(rawSettings);
    currentSettings = sanitizedSettings;
    startAdminControlsPolling(server, server.projectId, onSettingsChanged);
    return sanitizedSettings;
  } catch (e) {
    if (isFetchError(e) && e.status === 403) {
      stopAdminControlsPolling();
      currentSettings = undefined;
      return {};
    }
    debugLogger.error('Failed to fetch admin controls: ', e);
    currentSettings = {};
    startAdminControlsPolling(server, server.projectId, onSettingsChanged);
    return {};
  }
}

function startAdminControlsPolling(
  server: CodeAssistServer,
  project: string,
  onSettingsChanged: (settings: FetchAdminControlsResponse) => void,
) {
  stopAdminControlsPolling();

  pollingInterval = setInterval(
    async () => {
      try {
        const rawSettings = await server.fetchAdminControls({
          project,
        });
        const newSettings = sanitizeAdminSettings(rawSettings);

        if (!isDeepStrictEqual(newSettings, currentSettings)) {
          currentSettings = newSettings;
          onSettingsChanged(newSettings);
        }
      } catch (e) {
        if (isFetchError(e) && e.status === 403) {
          stopAdminControlsPolling();
          currentSettings = undefined;
          return;
        }
        debugLogger.error('Failed to poll admin controls: ', e);
      }
    },
    5 * 60 * 1000,
  );
}

export function stopAdminControlsPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = undefined;
  }
}

export function getAdminErrorMessage(
  featureName: string,
  config: Config | undefined,
): string {
  const server = config ? getCodeAssistServer(config) : undefined;
  const projectId = server?.projectId;
  const projectParam = projectId ? `?project=${projectId}` : '';
  return `${featureName} is disabled by your administrator. To enable it, please request an update to the settings at: https://papert.ai/admin${projectParam}`;
}
