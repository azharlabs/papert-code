/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob } from 'glob';
import { debugLogger } from '../utils/debugLogger.js';

export interface SkillDefinition {
  name: string;
  description: string;
  location: string;
  body: string;
  disabled?: boolean;
  isBuiltin?: boolean;
}

export const FRONTMATTER_REGEX =
  /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?/;

function parseFrontmatter(
  content: string,
): { name: string; description: string } | null {
  return parseSimpleFrontmatter(content);
}

function parseSimpleFrontmatter(
  content: string,
): { name: string; description: string } | null {
  const lines = content.split(/\r?\n/);
  let name: string | undefined;
  let description: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const nameMatch = line.match(/^\s*name:\s*(.*)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^\s*description:\s*(.*)$/);
    if (descMatch) {
      const descLines = [descMatch[1].trim()];

      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.match(/^[ \t]+\S/)) {
          descLines.push(nextLine.trim());
          i++;
        } else {
          break;
        }
      }

      description = descLines.filter(Boolean).join(' ');
      continue;
    }
  }

  if (name !== undefined && description !== undefined) {
    return { name, description };
  }
  return null;
}

export async function loadSkillsFromDir(
  dir: string,
): Promise<SkillDefinition[]> {
  const discoveredSkills: SkillDefinition[] = [];

  try {
    const absoluteSearchPath = path.resolve(dir);
    const stats = await fs.stat(absoluteSearchPath).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return [];
    }

    const skillFiles = await glob(['SKILL.md', '*/SKILL.md'], {
      cwd: absoluteSearchPath,
      absolute: true,
      nodir: true,
    });

    for (const skillFile of skillFiles) {
      const metadata = await loadSkillFromFile(skillFile);
      if (metadata) {
        discoveredSkills.push(metadata);
      }
    }

    if (discoveredSkills.length === 0) {
      const files = await fs.readdir(absoluteSearchPath);
      if (files.length > 0) {
        debugLogger.debug(
          `Failed to load skills from ${absoluteSearchPath}. The directory is not empty but no valid skills were discovered.`,
        );
      }
    }
  } catch (error) {
    debugLogger.warn(`Error discovering skills in ${dir}:`, error);
  }

  return discoveredSkills;
}

export async function loadSkillFromFile(
  filePath: string,
): Promise<SkillDefinition | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const match = content.match(FRONTMATTER_REGEX);
    if (!match) {
      return null;
    }

    const frontmatter = parseFrontmatter(match[1]);
    if (!frontmatter) {
      return null;
    }

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      location: filePath,
      body: match[2]?.trim() ?? '',
    };
  } catch (error) {
    debugLogger.warn(`Error parsing skill file ${filePath}:`, error);
    return null;
  }
}
