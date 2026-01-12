/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { FolderTrustDialog, FolderTrustChoice } from './FolderTrustDialog.js';
import * as processUtils from '../../utils/processUtils.js';
import { act } from 'react';
import type { Key } from '../hooks/useKeypress.js';

const keypressHandlers = new Set<(key: Key) => void>();
vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: (handler: (key: Key) => void, options?: { isActive: boolean }) => {
    if (options?.isActive === false) {
      return;
    }
    keypressHandlers.add(handler);
  },
}));

const triggerKey = (name: string, sequence = name) => {
  act(() => {
    keypressHandlers.forEach((handler) =>
      handler({
        name,
        ctrl: false,
        meta: false,
        shift: false,
        paste: false,
        sequence,
      }),
    );
  });
};

vi.mock('../../utils/processUtils.js', () => ({
  relaunchApp: vi.fn(),
}));

const mockedExit = vi.hoisted(() => vi.fn());
const mockedCwd = vi.hoisted(() => vi.fn());

vi.mock('node:process', async () => {
  const actual =
    await vi.importActual<typeof import('node:process')>('node:process');
  return {
    ...actual,
    exit: mockedExit,
    cwd: mockedCwd,
  };
});

describe('FolderTrustDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCwd.mockReturnValue('/home/user/project');
    keypressHandlers.clear();
  });

  it('should render the dialog with title and description', () => {
    const { lastFrame } = renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Do you trust this folder?');
    expect(lastFrame()).toContain(
      'Trusting a folder allows Papert Code to execute commands it suggests.',
    );
  });

  it('should call onSelect with DO_NOT_TRUST when escape is pressed and not restarting', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <FolderTrustDialog onSelect={onSelect} isRestarting={false} />,
    );

    triggerKey('escape', '\x1b');

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(FolderTrustChoice.DO_NOT_TRUST);
    });
  });

  it('should not call onSelect when escape is pressed and is restarting', async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <FolderTrustDialog onSelect={onSelect} isRestarting={true} />,
    );

    triggerKey('escape', '\x1b');

    await waitFor(() => {
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it('should display restart message when isRestarting is true', () => {
    const { lastFrame } = renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={true} />,
    );

    expect(lastFrame()).toContain(' Papert Code is restarting');
  });

  it('should call relaunchApp when isRestarting is true', async () => {
    vi.useFakeTimers();
    const relaunchApp = vi.spyOn(processUtils, 'relaunchApp');
    renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={true} />,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(relaunchApp).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not call process.exit when "r" is pressed and isRestarting is false', async () => {
    renderWithProviders(
      <FolderTrustDialog onSelect={vi.fn()} isRestarting={false} />,
    );

    triggerKey('r');

    await waitFor(() => {
      expect(mockedExit).not.toHaveBeenCalled();
    });
  });

  describe('directory display', () => {
    it('should correctly display the folder name for a nested directory', () => {
      mockedCwd.mockReturnValue('/home/user/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust folder (project)');
    });

    it('should correctly display the parent folder name for a nested directory', () => {
      mockedCwd.mockReturnValue('/home/user/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust parent folder (user)');
    });

    it('should correctly display an empty parent folder name for a directory directly under root', () => {
      mockedCwd.mockReturnValue('/project');
      const { lastFrame } = renderWithProviders(
        <FolderTrustDialog onSelect={vi.fn()} />,
      );
      expect(lastFrame()).toContain('Trust parent folder ()');
    });
  });
});
