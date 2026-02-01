/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkillFromFile, loadSkillsFromDir } from './skillLoader.js';

describe('skillLoader', () => {
  it('parses a skill file with frontmatter', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'papert-skill-'),
    );
    const skillFile = path.join(tempDir, 'SKILL.md');
    fs.writeFileSync(
      skillFile,
      `---\nname: Example Skill\ndescription: Does something\n---\n\nBody here`,
    );

    const skill = await loadSkillFromFile(skillFile);
    expect(skill?.name).toBe('Example Skill');
    expect(skill?.description).toBe('Does something');
    expect(skill?.body).toBe('Body here');
  });

  it('loads skills from a directory', async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'papert-skill-dir-'),
    );
    const subDir = path.join(tempDir, 'skill-one');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, 'SKILL.md'),
      `---\nname: Skill One\ndescription: Test skill\n---\n\nBody`,
    );

    const skills = await loadSkillsFromDir(tempDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('Skill One');
  });
});
