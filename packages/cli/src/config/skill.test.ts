/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSkillConfig, SKILL_FILENAME } from './skill.js';

const tmpDirs: string[] = [];

function createSkillDir(skillContent: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'papert-skill-test-'));
  tmpDirs.push(dir);
  fs.writeFileSync(path.join(dir, SKILL_FILENAME), skillContent, 'utf-8');
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('loadSkillConfig frontmatter parsing', () => {
  it('parses multiline flow-style metadata blocks with trailing commas', () => {
    const skillDir = createSkillDir(`---
name: sample-skill
description: Example skill
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["op"], },
      },
  }
---
# Sample skill
`);

    const config = loadSkillConfig({
      skillDir,
      workspaceDir: skillDir,
    }) as unknown as Record<string, unknown>;

    expect(config['name']).toBe('sample-skill');
    expect(config['description']).toBe('Example skill');
    expect(config['metadata']).toEqual({
      openclaw: {
        requires: {
          bins: ['op'],
        },
      },
    });
  });

  it('parses inline flow-style metadata blocks', () => {
    const skillDir = createSkillDir(`---
name: inline-skill
user-invocable: true
metadata:
  { "openclaw": { "primaryEnv": "GH_TOKEN" } }
---
# Inline skill
`);

    const config = loadSkillConfig({
      skillDir,
      workspaceDir: skillDir,
    }) as unknown as Record<string, unknown>;

    expect(config['name']).toBe('inline-skill');
    expect(config['user-invocable']).toBe(true);
    expect(config['metadata']).toEqual({
      openclaw: {
        primaryEnv: 'GH_TOKEN',
      },
    });
  });
});
