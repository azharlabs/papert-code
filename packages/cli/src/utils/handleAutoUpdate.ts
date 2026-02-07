/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UpdateObject } from '../ui/utils/updateCheck.js';
import type { LoadedSettings } from '../config/settings.js';
import { getInstallationInfo } from './installationInfo.js';
import { updateEventEmitter } from './updateEventEmitter.js';
import type { HistoryItem } from '../ui/types.js';
import { MessageType } from '../ui/types.js';
import { spawnWrapper } from './spawnWrapper.js';
import type { spawn } from 'node:child_process';
import { parse as parseShellCommand } from 'shell-quote';

function resolveReleaseTag(info: UpdateObject): string {
  if (info.channel === 'nightly') return '@nightly';
  if (info.channel === 'preview') return '@preview';
  const safeLatest = info.update.latest.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(safeLatest)) {
    throw new Error(`Invalid release version: ${safeLatest}`);
  }
  return `@${safeLatest}`;
}

function parseUpdateCommand(command: string): { cmd: string; args: string[] } {
  const parsed = parseShellCommand(command);
  const args: string[] = [];
  for (const part of parsed) {
    if (typeof part !== 'string') {
      throw new Error('Update command contains unsupported shell operators.');
    }
    if (part.length === 0) continue;
    args.push(part);
  }
  if (args.length === 0) {
    throw new Error('Update command is empty.');
  }
  return { cmd: args[0]!, args: args.slice(1) };
}

export function handleAutoUpdate(
  info: UpdateObject | null,
  settings: LoadedSettings,
  projectRoot: string,
  spawnFn: typeof spawn = spawnWrapper,
) {
  if (!info) {
    return;
  }

  if (settings.merged.general?.disableUpdateNag) {
    return;
  }

  const installationInfo = getInstallationInfo(
    projectRoot,
    settings.merged.general?.disableAutoUpdate ?? false,
  );

  let combinedMessage = info.message;
  if (installationInfo.updateMessage) {
    combinedMessage += `\n${installationInfo.updateMessage}`;
  }

  updateEventEmitter.emit('update-received', {
    message: combinedMessage,
  });

  if (
    !installationInfo.updateCommand ||
    settings.merged.general?.disableAutoUpdate
  ) {
    return;
  }
  let releaseTag: string;
  try {
    releaseTag = resolveReleaseTag(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateEventEmitter.emit('update-failed', {
      message: `Automatic update failed. Please try updating manually. (error: ${message})`,
    });
    return;
  }

  const updateCommand = installationInfo.updateCommand.replace(
    '@latest',
    releaseTag,
  );
  let updateProcess: ReturnType<typeof spawnFn>;
  try {
    const parsed = parseUpdateCommand(updateCommand);
    updateProcess = spawnFn(parsed.cmd, parsed.args, { stdio: 'pipe' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateEventEmitter.emit('update-failed', {
      message: `Automatic update failed. Please try updating manually. (error: ${message})`,
    });
    return;
  }
  let errorOutput = '';
  updateProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  updateProcess.on('close', (code) => {
    if (code === 0) {
      updateEventEmitter.emit('update-success', {
        message:
          'Update successful! The new version will be used on your next run.',
      });
    } else {
      updateEventEmitter.emit('update-failed', {
        message: `Automatic update failed. Please try updating manually. (command: ${updateCommand}, stderr: ${errorOutput.trim()})`,
      });
    }
  });

  updateProcess.on('error', (err) => {
    updateEventEmitter.emit('update-failed', {
      message: `Automatic update failed. Please try updating manually. (error: ${err.message})`,
    });
  });
  return updateProcess;
}

export function setUpdateHandler(
  addItem: (item: Omit<HistoryItem, 'id'>, timestamp: number) => void,
  setUpdateInfo: (info: UpdateObject | null) => void,
) {
  let successfullyInstalled = false;
  const handleUpdateRecieved = (info: UpdateObject) => {
    setUpdateInfo(info);
    const savedMessage = info.message;
    setTimeout(() => {
      if (!successfullyInstalled) {
        addItem(
          {
            type: MessageType.INFO,
            text: savedMessage,
          },
          Date.now(),
        );
      }
      setUpdateInfo(null);
    }, 60000);
  };

  const handleUpdateFailed = () => {
    setUpdateInfo(null);
    addItem(
      {
        type: MessageType.ERROR,
        text: `Automatic update failed. Please try updating manually`,
      },
      Date.now(),
    );
  };

  const handleUpdateSuccess = () => {
    successfullyInstalled = true;
    setUpdateInfo(null);
    addItem(
      {
        type: MessageType.INFO,
        text: `Update successful! The new version will be used on your next run.`,
      },
      Date.now(),
    );
  };

  const handleUpdateInfo = (data: { message: string }) => {
    addItem(
      {
        type: MessageType.INFO,
        text: data.message,
      },
      Date.now(),
    );
  };

  updateEventEmitter.on('update-received', handleUpdateRecieved);
  updateEventEmitter.on('update-failed', handleUpdateFailed);
  updateEventEmitter.on('update-success', handleUpdateSuccess);
  updateEventEmitter.on('update-info', handleUpdateInfo);

  return () => {
    updateEventEmitter.off('update-received', handleUpdateRecieved);
    updateEventEmitter.off('update-failed', handleUpdateFailed);
    updateEventEmitter.off('update-success', handleUpdateSuccess);
    updateEventEmitter.off('update-info', handleUpdateInfo);
  };
}
