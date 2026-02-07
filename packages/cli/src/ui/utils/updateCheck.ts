/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UpdateInfo } from 'update-notifier';
import updateNotifier from 'update-notifier';
import semver from 'semver';
import { getPackageJson } from '../../utils/package.js';

export const FETCH_TIMEOUT_MS = 2000;
export type ReleaseChannel = 'stable' | 'preview' | 'nightly';

export interface UpdateObject {
  message: string;
  update: UpdateInfo;
  channel: ReleaseChannel;
}

/**
 * From a list of available updates, determines which is the "best" one to offer.
 * If base versions are equal, channel precedence determines the winner.
 */
function getBestAvailableUpdate(
  candidates: Array<{ channel: ReleaseChannel; info: UpdateInfo | null }>,
): { channel: ReleaseChannel; info: UpdateInfo } | null {
  const validCandidates = candidates.filter(
    (candidate): candidate is { channel: ReleaseChannel; info: UpdateInfo } =>
      Boolean(candidate.info),
  );

  if (validCandidates.length === 0) {
    return null;
  }

  const channelPriority: Record<ReleaseChannel, number> = {
    nightly: 0,
    preview: 1,
    stable: 2,
  };

  return validCandidates.reduce((best, current) => {
    const bestBase = semver.coerce(best.info.latest)?.version;
    const currentBase = semver.coerce(current.info.latest)?.version;
    if (bestBase && currentBase && bestBase === currentBase) {
      return channelPriority[current.channel] < channelPriority[best.channel]
        ? current
        : best;
    }

    return semver.gt(current.info.latest, best.info.latest) ? current : best;
  });
}

function getTagsForChannel(
  channel: ReleaseChannel,
): Array<{ channel: ReleaseChannel; distTag: 'latest' | 'preview' | 'nightly' }> {
  if (channel === 'nightly') {
    return [
      { channel: 'nightly', distTag: 'nightly' },
      { channel: 'preview', distTag: 'preview' },
      { channel: 'stable', distTag: 'latest' },
    ];
  }
  if (channel === 'preview') {
    return [
      { channel: 'preview', distTag: 'preview' },
      { channel: 'stable', distTag: 'latest' },
    ];
  }
  return [{ channel: 'stable', distTag: 'latest' }];
}

export async function checkForUpdates(
  releaseChannel: ReleaseChannel = 'stable',
): Promise<UpdateObject | null> {
  try {
    // Skip update check when running from source (development mode)
    if (process.env['DEV'] === 'true') {
      return null;
    }
    const packageJson = await getPackageJson();
    if (!packageJson || !packageJson.name || !packageJson.version) {
      return null;
    }

    const { name, version: currentVersion } = packageJson;
    const createNotifier = (distTag: 'latest' | 'preview' | 'nightly') =>
      updateNotifier({
        pkg: {
          name,
          version: currentVersion,
        },
        updateCheckInterval: 0,
        shouldNotifyInNpmScript: true,
        distTag,
      });

    const channelTags = getTagsForChannel(releaseChannel);
    const updates = await Promise.all(
      channelTags.map(async ({ channel, distTag }) => ({
        channel,
        info: await createNotifier(distTag).fetchInfo(),
      })),
    );

    const bestUpdate = getBestAvailableUpdate(updates);
    if (bestUpdate && semver.gt(bestUpdate.info.latest, currentVersion)) {
      const message = `Papert Code update available! ${currentVersion} → ${bestUpdate.info.latest}`;
      return {
        message,
        update: { ...bestUpdate.info, current: currentVersion },
        channel: releaseChannel,
      };
    }

    return null;
  } catch (e) {
    console.warn('Failed to check for updates: ' + e);
    return null;
  }
}
