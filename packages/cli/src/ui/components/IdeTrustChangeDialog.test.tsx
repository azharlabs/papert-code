/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as processUtils from '../../utils/processUtils.js';
import { renderWithProviders } from '../../test-utils/render.js';
import { IdeTrustChangeDialog } from './IdeTrustChangeDialog.js';
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
};

describe('IdeTrustChangeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keypressHandlers.clear();
  });

  it('renders the correct message for CONNECTION_CHANGE', () => {
    const { lastFrame } = renderWithProviders(
      <IdeTrustChangeDialog reason="CONNECTION_CHANGE" />,
    );

    const frameText = lastFrame();
    expect(frameText).toContain(
      'Workspace trust has changed due to a change in the IDE connection.',
    );
    expect(frameText).toContain("Press 'r' to restart Gemini");
  });

  it('renders the correct message for TRUST_CHANGE', () => {
    const { lastFrame } = renderWithProviders(
      <IdeTrustChangeDialog reason="TRUST_CHANGE" />,
    );

    const frameText = lastFrame();
    expect(frameText).toContain(
      'Workspace trust has changed due to a change in the IDE trust.',
    );
    expect(frameText).toContain("Press 'r' to restart Gemini");
  });

  it('renders a generic message and logs an error for NONE reason', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => { });
    const { lastFrame } = renderWithProviders(
      <IdeTrustChangeDialog reason="NONE" />,
    );

    const frameText = lastFrame();
    expect(frameText).toContain('Workspace trust has changed.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'IdeTrustChangeDialog rendered with unexpected reason "NONE"',
    );
  });

  it('calls relaunchApp when "r" is pressed', async () => {
    const relaunchAppSpy = vi.spyOn(processUtils, 'relaunchApp');
    renderWithProviders(
      <IdeTrustChangeDialog reason="NONE" />,
    );

    triggerKey('r');

    expect(relaunchAppSpy).toHaveBeenCalledTimes(1);
  });

  it('calls relaunchApp when "R" is pressed', async () => {
    const relaunchAppSpy = vi.spyOn(processUtils, 'relaunchApp');
    renderWithProviders(
      <IdeTrustChangeDialog reason="CONNECTION_CHANGE" />,
    );

    triggerKey('R', 'R');

    expect(relaunchAppSpy).toHaveBeenCalledTimes(1);
  });

  it('does not call relaunchApp when another key is pressed', async () => {
    const relaunchAppSpy = vi.spyOn(processUtils, 'relaunchApp');
    renderWithProviders(
      <IdeTrustChangeDialog reason="CONNECTION_CHANGE" />,
    );

    triggerKey('a');

    // Give it a moment to ensure no async actions are triggered
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(relaunchAppSpy).not.toHaveBeenCalled();
  });
});
