/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import open from 'open';
import * as fs from 'node:fs/promises';
import { bugCommand } from './bugCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { GIT_COMMIT_INFO } from '../../generated/git-commit.js';
import { AuthType } from '@papert-code/papert-code-core';
import * as systemInfoUtils from '../../utils/systemInfo.js';

// Mock dependencies
vi.mock('open');
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const mkdir = vi.fn();
  const writeFile = vi.fn();
  return {
    ...actual,
    mkdir,
    writeFile,
    default: {
      ...actual,
      mkdir,
      writeFile,
    },
  };
});
vi.mock('../../utils/systemInfo.js');

describe('bugCommand', () => {
  beforeEach(() => {
    vi.mocked(systemInfoUtils.getExtendedSystemInfo).mockResolvedValue({
      cliVersion: '0.1.0',
      osPlatform: 'test-platform',
      osArch: 'x64',
      osRelease: '22.0.0',
      nodeVersion: 'v20.0.0',
      npmVersion: '10.0.0',
      sandboxEnv: 'test',
      modelVersion: 'papert3-coder-plus',
      selectedAuthType: '',
      ideClient: 'VSCode',
      sessionId: 'test-session-id',
      memoryUsage: '100 MB',
      gitCommit:
        GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO)
          ? GIT_COMMIT_INFO
          : undefined,
    });
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.stubEnv('SANDBOX', 'papert-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should generate the default GitHub issue URL', async () => {
    const mockContext = createMockCommandContext({
      services: {
        config: {
          getBugCommand: () => undefined,
        },
      },
    });

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'A test bug');

    const gitCommitLine =
      GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO)
        ? `* **Git Commit:** ${GIT_COMMIT_INFO}\n`
        : '';
    const expectedInfo = `
* **CLI Version:** 0.1.0
${gitCommitLine}* **Model:** papert3-coder-plus
* **Sandbox:** test
* **OS Platform:** test-platform
* **OS Arch:** x64
* **OS Release:** 22.0.0
* **Node.js Version:** v20.0.0
* **NPM Version:** 10.0.0
* **Session ID:** test-session-id
* **Auth Method:** 
* **Memory Usage:** 100 MB
* **IDE Client:** VSCode
`;
    const expectedUrl =
      'https://github.com/azharlabs/papert-code/issues/new?template=bug_report.yml&title=A%20test%20bug&info=' +
      encodeURIComponent(expectedInfo);

    expect(open).toHaveBeenCalledWith(expectedUrl);
  });

  it('should use a custom URL template from config if provided', async () => {
    const customTemplate =
      'https://internal.bug-tracker.com/new?desc={title}&details={info}';
    const mockContext = createMockCommandContext({
      services: {
        config: {
          getBugCommand: () => ({ urlTemplate: customTemplate }),
        },
      },
    });

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'A custom bug');

    const gitCommitLine =
      GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO)
        ? `* **Git Commit:** ${GIT_COMMIT_INFO}\n`
        : '';
    const expectedInfo = `
* **CLI Version:** 0.1.0
${gitCommitLine}* **Model:** papert3-coder-plus
* **Sandbox:** test
* **OS Platform:** test-platform
* **OS Arch:** x64
* **OS Release:** 22.0.0
* **Node.js Version:** v20.0.0
* **NPM Version:** 10.0.0
* **Session ID:** test-session-id
* **Auth Method:** 
* **Memory Usage:** 100 MB
* **IDE Client:** VSCode
`;
    const expectedUrl = customTemplate
      .replace('{title}', encodeURIComponent('A custom bug'))
      .replace('{info}', encodeURIComponent(expectedInfo));

    expect(open).toHaveBeenCalledWith(expectedUrl);
  });

  it('should include Base URL when auth type is OpenAI', async () => {
    vi.mocked(systemInfoUtils.getExtendedSystemInfo).mockResolvedValue({
      cliVersion: '0.1.0',
      osPlatform: 'test-platform',
      osArch: 'x64',
      osRelease: '22.0.0',
      nodeVersion: 'v20.0.0',
      npmVersion: '10.0.0',
      sandboxEnv: 'test',
      modelVersion: 'papert3-coder-plus',
      selectedAuthType: AuthType.USE_OPENAI,
      ideClient: 'VSCode',
      sessionId: 'test-session-id',
      memoryUsage: '100 MB',
      baseUrl: 'https://api.openai.com/v1',
      gitCommit:
        GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO)
          ? GIT_COMMIT_INFO
          : undefined,
    });

    const mockContext = createMockCommandContext({
      services: {
        config: {
          getBugCommand: () => undefined,
        },
      },
    });

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'OpenAI bug');

    const gitCommitLine =
      GIT_COMMIT_INFO && !['N/A'].includes(GIT_COMMIT_INFO)
        ? `* **Git Commit:** ${GIT_COMMIT_INFO}\n`
        : '';
    const expectedInfo = `
* **CLI Version:** 0.1.0
${gitCommitLine}* **Model:** papert3-coder-plus
* **Sandbox:** test
* **OS Platform:** test-platform
* **OS Arch:** x64
* **OS Release:** 22.0.0
* **Node.js Version:** v20.0.0
* **NPM Version:** 10.0.0
* **Session ID:** test-session-id
* **Auth Method:** ${AuthType.USE_OPENAI}
* **Base URL:** https://api.openai.com/v1
* **Memory Usage:** 100 MB
* **IDE Client:** VSCode
`;
    const expectedUrl =
      'https://github.com/azharlabs/papert-code/issues/new?template=bug_report.yml&title=OpenAI%20bug&info=' +
      encodeURIComponent(expectedInfo);

    expect(open).toHaveBeenCalledWith(expectedUrl);
  });

  it('should write a sanitized diagnostics bundle for reproduction', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret-value');
    vi.stubEnv('HTTPS_PROXY', 'https://user:password@example.com:8443');

    const mockContext = createMockCommandContext({
      services: {
        config: {
          getTargetDir: () => '/workspace/project',
          getBugCommand: () => undefined,
          getModel: () => 'papert3-coder-plus',
          getApprovalMode: () => 'default',
          getSandbox: () => ({ command: 'docker' }),
          getOutputFormat: () => 'text',
          getInputFormat: () => 'text',
        },
      },
    });

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'sanitization bug');

    expect(fs.mkdir).toHaveBeenCalledWith(
      '/workspace/project/.papert/bug-report-bundles',
      { recursive: true },
    );

    const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
    expect(writeCall?.[0]).toContain(
      '/workspace/project/.papert/bug-report-bundles/bug-repro-',
    );

    const payload = JSON.parse(String(writeCall?.[1]));
    expect(payload.systemInfo.sessionId).toBe('test-ses...');
    expect(payload.environment.OPENAI_API_KEY).toBe('[REDACTED]');
    expect(payload.environment.HTTPS_PROXY).toContain('redacted:redacted');
  });

  it('should continue and open issue URL when diagnostics bundle writing fails', async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('disk full'));
    const mockContext = createMockCommandContext({
      services: {
        config: {
          getTargetDir: () => '/workspace/project',
          getBugCommand: () => undefined,
        },
      },
    });

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'bundle fail');

    expect(open).toHaveBeenCalledOnce();
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text: expect.stringContaining(
          'Could not create local diagnostics bundle: disk full',
        ),
      }),
      expect.any(Number),
    );
  });
});
