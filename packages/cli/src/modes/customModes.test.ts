/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ApprovalMode } from '@papert-code/papert-code-core';
import { loadCustomModes } from './customModes.js';

describe('loadCustomModes', () => {
  let tempRoot: string;
  let tempHome: string;
  let projectDir: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'papert-modes-test-'));
    tempHome = path.join(tempRoot, 'home');
    projectDir = path.join(tempRoot, 'project');
    await fs.mkdir(tempHome, { recursive: true });
    await fs.mkdir(projectDir, { recursive: true });
    vi.stubEnv('HOME', tempHome);
    vi.stubEnv('USERPROFILE', tempHome);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('loads user and project markdown-defined custom modes', async () => {
    await fs.mkdir(path.join(tempHome, '.papert', 'modes'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempHome, '.papert', 'modes', 'reviewer.md'),
      `---
name: reviewer
description: Review-first custom mode
approvalMode: default
---
Review carefully.`,
      'utf8',
    );

    await fs.mkdir(path.join(projectDir, '.papert', 'modes'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(projectDir, '.papert', 'modes', 'ship-fast.md'),
      `---
name: ship-fast
approvalMode: auto-edit
---
Ship quickly with small safe edits.`,
      'utf8',
    );

    const modes = await loadCustomModes(projectDir);
    expect(modes).toHaveLength(2);
    expect(modes.map((mode) => mode.name)).toEqual([
      'reviewer',
      'ship-fast',
    ]);
    expect(modes.find((mode) => mode.name === 'ship-fast')?.approvalMode).toBe(
      ApprovalMode.AUTO_EDIT,
    );
  });

  it('prefers project custom modes over user modes with the same name', async () => {
    await fs.mkdir(path.join(tempHome, '.papert', 'modes'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tempHome, '.papert', 'modes', 'ops.md'),
      `---
name: ops
description: User ops mode
approvalMode: plan
---
User mode`,
      'utf8',
    );

    await fs.mkdir(path.join(projectDir, '.papert', 'modes'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(projectDir, '.papert', 'modes', 'ops.md'),
      `---
name: ops
description: Project ops mode
approvalMode: yolo
---
Project mode`,
      'utf8',
    );

    const modes = await loadCustomModes(projectDir);
    expect(modes).toHaveLength(1);
    expect(modes[0]?.description).toBe('Project ops mode');
    expect(modes[0]?.approvalMode).toBe(ApprovalMode.YOLO);
    expect(modes[0]?.source).toBe('project');
  });

  it('ignores invalid markdown files', async () => {
    await fs.mkdir(path.join(projectDir, '.papert', 'modes'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(projectDir, '.papert', 'modes', 'broken.md'),
      `name: broken-without-frontmatter`,
      'utf8',
    );
    await fs.writeFile(
      path.join(projectDir, '.papert', 'modes', 'missing-approval.md'),
      `---
name: missing-approval
description: Missing approval mode
---
No approval mode`,
      'utf8',
    );

    const modes = await loadCustomModes(projectDir);
    expect(modes).toEqual([]);
  });
});
