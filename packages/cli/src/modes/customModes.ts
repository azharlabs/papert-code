/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ApprovalMode } from '@papert-code/papert-code-core';

export interface CustomModeDefinition {
  name: string;
  description: string;
  approvalMode: ApprovalMode;
  source: 'project' | 'user';
  filePath: string;
}

function parseApprovalMode(value: string | undefined): ApprovalMode | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'plan':
      return ApprovalMode.PLAN;
    case 'default':
      return ApprovalMode.DEFAULT;
    case 'yolo':
      return ApprovalMode.YOLO;
    case 'auto-edit':
    case 'auto_edit':
    case 'autoedit':
      return ApprovalMode.AUTO_EDIT;
    default:
      return undefined;
  }
}

function parseFrontmatter(
  content: string,
): { metadata: Record<string, string>; body: string } | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return undefined;
  }

  const [, rawMetadata, body] = match;
  const metadata: Record<string, string> = {};
  for (const line of rawMetadata.split('\n')) {
    const index = line.indexOf(':');
    if (index < 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key) {
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

function parseCustomModeFile(
  content: string,
  filePath: string,
  source: 'project' | 'user',
): CustomModeDefinition | undefined {
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return undefined;
  }

  const name = parsed.metadata['name']?.trim();
  const approvalMode = parseApprovalMode(parsed.metadata['approvalMode']);
  const description =
    parsed.metadata['description']?.trim() ||
    parsed.body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ||
    'Custom mode loaded from markdown';

  if (!name || !approvalMode) {
    return undefined;
  }

  return {
    name,
    description,
    approvalMode,
    source,
    filePath,
  };
}

async function loadModesFromDirectory(
  directory: string,
  source: 'project' | 'user',
): Promise<CustomModeDefinition[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return [];
    }
    throw error;
  }

  const modes: CustomModeDefinition[] = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.md')) {
      continue;
    }
    const filePath = path.join(directory, entry);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const mode = parseCustomModeFile(content, filePath, source);
    if (mode) {
      modes.push(mode);
    }
  }

  return modes;
}

export async function loadCustomModes(
  cwd: string,
): Promise<CustomModeDefinition[]> {
  const userDir = path.join(os.homedir(), '.papert', 'modes');
  const projectDir = path.join(cwd, '.papert', 'modes');

  const [userModes, projectModes] = await Promise.all([
    loadModesFromDirectory(userDir, 'user'),
    loadModesFromDirectory(projectDir, 'project'),
  ]);

  // Project-level modes override user-level modes with the same name.
  const merged = new Map<string, CustomModeDefinition>();
  for (const mode of userModes) {
    merged.set(mode.name, mode);
  }
  for (const mode of projectModes) {
    merged.set(mode.name, mode);
  }

  return [...merged.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

