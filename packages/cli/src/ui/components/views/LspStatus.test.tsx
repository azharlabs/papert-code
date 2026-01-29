/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { LspStatus } from './LspStatus.js';

describe('LspStatus', () => {
  const baseProps = {
    type: 'lsp_status' as const,
    enabled: true,
    autoDetect: true,
    autoInstall: true,
    servers: [
      {
        id: 'typescript',
        label: 'TypeScript/JavaScript',
        source: 'builtin' as const,
        status: 'connected' as const,
        extensions: ['.ts', '.tsx'],
        command: ['typescript-language-server', '--stdio'],
        autoInstall: true,
        installable: true,
      },
      {
        id: 'pyright',
        label: 'Pyright',
        source: 'builtin' as const,
        status: 'missing' as const,
        extensions: ['.py'],
        command: ['pyright-langserver', '--stdio'],
        autoInstall: true,
        installable: true,
        installHint: 'npm install -g pyright',
      },
    ],
  };

  it('renders disabled state', () => {
    const { lastFrame } = render(
      <LspStatus
        type="lsp_status"
        enabled={false}
        autoDetect={true}
        autoInstall={true}
        servers={[]}
      />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders connected and missing servers', () => {
    const { lastFrame } = render(<LspStatus {...baseProps} />);
    expect(lastFrame()).toMatchSnapshot();
  });

  it('renders auto-install disabled banner', () => {
    const { lastFrame } = render(
      <LspStatus {...baseProps} autoInstall={false} />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });
});
