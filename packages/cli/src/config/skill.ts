/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MCPServerConfig,
  ExtensionInstallMetadata,
  GeminiCLISkill,
} from '@papert-code/papert-code-core';
import { PAPERT_DIR, Storage } from '@papert-code/papert-code-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadSettings, SettingScope } from './settings.js';
import { getErrorMessage } from '../utils/errors.js';
import {
  recursivelyHydrateStrings,
  type JsonValue,
} from './extensions/variables.js';
import { isWorkspaceTrusted } from './trustedFolders.js';
import { resolveEnvVarsInObject } from '../utils/envVarResolver.js';
import { resolvePath } from '../utils/resolvePath.js';
import {
  cloneFromGit,
  downloadFromGitHubRelease,
} from './skills/github.js';
import { SkillEnablementManager } from './skills/skillEnablement.js';
import chalk from 'chalk';
import type { ConfirmationRequest } from '../ui/types.js';

export const SKILLS_DIRECTORY_NAME = path.join(PAPERT_DIR, 'skills');
export const WORKSPACE_SKILLS_DIRECTORY_NAME = path.join('.agents', 'skills');
export const SKILL_FILENAME = 'SKILL.md';
export const SKILL_INSTALL_METADATA_FILENAME = '.papert-skill-install.json';
const DEFAULT_SKILLS_DIR = path.join('skills');
const SKILLS_PATHS_ENV = 'PAPERT_CODE_SKILLS_PATHS';

export interface Skill {
  path: string;
  config: SkillConfig;
  contextFiles: string[];
  installMetadata?: ExtensionInstallMetadata | undefined;
}

export interface SkillConfig {
  name: string;
  version: string;
  description?: string;
  mcpServers?: Record<string, MCPServerConfig>;
  contextFileName?: string | string[];
  contextFiles?: string[];
  excludeTools?: string[];
}

export interface SkillUpdateInfo {
  name: string;
  originalVersion: string;
  updatedVersion: string;
}

export class SkillStorage {
  private readonly skillName: string;

  constructor(skillName: string) {
    this.skillName = skillName;
  }

  getSkillDir(): string {
    return path.join(SkillStorage.getUserSkillsDir(), this.skillName);
  }

  getConfigPath(): string {
    return path.join(this.getSkillDir(), SKILL_FILENAME);
  }

  static getUserSkillsDir(): string {
    return Storage.getUserSkillsDir();
  }

  static async createTmpDir(): Promise<string> {
    return await fs.promises.mkdtemp(path.join(os.tmpdir(), 'papert-skill'));
  }
}

function getBundledSkillsDir(): string | null {
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    return path.join(moduleDir, '..', DEFAULT_SKILLS_DIR);
  } catch {
    return null;
  }
}

export function ensureBundledSkillsInstalled(): void {
  const bundledSkillsDir = getBundledSkillsDir();
  if (!bundledSkillsDir || !fs.existsSync(bundledSkillsDir)) {
    return;
  }

  const skillsDir = SkillStorage.getUserSkillsDir();
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const entry of fs.readdirSync(bundledSkillsDir)) {
    const bundledSkillDir = path.join(bundledSkillsDir, entry);
    if (!fs.statSync(bundledSkillDir).isDirectory()) {
      continue;
    }
    if (!fs.existsSync(path.join(bundledSkillDir, SKILL_FILENAME))) {
      continue;
    }
    const destinationPath = path.join(skillsDir, entry);
    if (fs.existsSync(destinationPath)) {
      continue;
    }
    fs.cpSync(bundledSkillDir, destinationPath, { recursive: true });
  }
}

export function getWorkspaceSkills(workspaceDir: string): Skill[] {
  if (path.resolve(workspaceDir) === path.resolve(os.homedir())) {
    return [];
  }
  return loadSkillsFromDir(path.join(workspaceDir, WORKSPACE_SKILLS_DIRECTORY_NAME), workspaceDir);
}

export async function copySkill(
  source: string,
  destination: string,
): Promise<void> {
  await fs.promises.cp(source, destination, { recursive: true });
}

export function loadSkills(
  skillEnablementManager: SkillEnablementManager,
  workspaceDir: string = process.cwd(),
): Skill[] {
  const settings = loadSettings(workspaceDir).merged;
  const allSkills = [...loadUserSkills()];
  const additionalSkillsDirs = getAdditionalSkillsDirs();
  for (const skillsDir of additionalSkillsDirs) {
    allSkills.push(...loadSkillsFromDir(skillsDir, workspaceDir));
  }

  if (isWorkspaceTrusted(settings) ?? true) {
    allSkills.push(...getWorkspaceSkills(workspaceDir));
  }

  const uniqueSkills = new Map<string, Skill>();

  for (const skill of allSkills) {
    if (
      !uniqueSkills.has(skill.config.name) &&
      skillEnablementManager.isEnabled(skill.config.name, workspaceDir)
    ) {
      uniqueSkills.set(skill.config.name, skill);
    }
  }

  return Array.from(uniqueSkills.values());
}

export function loadUserSkills(): Skill[] {
  ensureBundledSkillsInstalled();
  const skills = loadSkillsFromDir(SkillStorage.getUserSkillsDir());

  const uniqueSkills = new Map<string, Skill>();
  for (const skill of skills) {
    if (!uniqueSkills.has(skill.config.name)) {
      uniqueSkills.set(skill.config.name, skill);
    }
  }

  return Array.from(uniqueSkills.values());
}

export function loadSkillsFromDir(dir: string, workspaceDir?: string): Skill[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const skills: Skill[] = [];
  for (const subdir of fs.readdirSync(dir)) {
    const skillDir = path.join(dir, subdir);

    const skill = loadSkill({
      skillDir,
      workspaceDir: workspaceDir || process.cwd(),
    });
    if (skill != null) {
      skills.push(skill);
    }
  }
  return skills;
}

export function loadSkill(context: {
  skillDir: string;
  workspaceDir: string;
}): Skill | null {
  const { skillDir, workspaceDir } = context;
  if (!fs.statSync(skillDir).isDirectory()) {
    return null;
  }

  const installMetadata = loadSkillInstallMetadata(skillDir);
  let effectiveSkillPath = skillDir;

  if (installMetadata?.type === 'link') {
    effectiveSkillPath = installMetadata.source;
  }

  try {
    let config = loadSkillConfig({
      skillDir: effectiveSkillPath,
      workspaceDir,
    });

    config = resolveEnvVarsInObject(config);

    if (config.mcpServers) {
      config.mcpServers = Object.fromEntries(
        Object.entries(config.mcpServers).map(([key, value]) => [
          key,
          filterMcpConfig(value),
        ]),
      );
    }

    const contextFiles = getContextFileNames(config)
      .map((contextFileName) => path.join(effectiveSkillPath, contextFileName))
      .filter((contextFilePath) => fs.existsSync(contextFilePath));

    const skill: Skill = {
      path: effectiveSkillPath,
      config,
      contextFiles: ensureSkillContextFilePath(
        path.join(effectiveSkillPath, SKILL_FILENAME),
        contextFiles,
      ),
      installMetadata: installMetadata ?? undefined,
    };

    return skill;
  } catch (e) {
    console.error(
      `Warning: Skipping skill in ${effectiveSkillPath}: ${getErrorMessage(e)}`,
    );
    return null;
  }
}

function ensureSkillContextFilePath(
  skillFilePath: string,
  contextFiles: string[],
): string[] {
  const unique = new Set(contextFiles);
  unique.add(skillFilePath);
  return Array.from(unique);
}

function getContextFileNames(config: SkillConfig): string[] {
  if (config.contextFileName) {
    return Array.isArray(config.contextFileName)
      ? config.contextFileName
      : [config.contextFileName];
  }
  if (config.contextFiles) {
    return config.contextFiles;
  }
  return [];
}

export function annotateActiveSkills(
  skills: Skill[],
  workspaceDir: string,
  manager: SkillEnablementManager,
): GeminiCLISkill[] {
  manager.validateSkillOverrides(skills);
  return skills.map((skill) => ({
    name: skill.config.name,
    version: skill.config.version,
    isActive: manager.isEnabled(skill.config.name, workspaceDir),
    path: skill.path,
    installMetadata: skill.installMetadata,
  }));
}

export async function requestConsentNonInteractive(
  consentDescription: string,
): Promise<boolean> {
  console.info(consentDescription);
  const result = await promptForConsentNonInteractive(
    'Do you want to continue? [Y/n]: ',
  );
  return result;
}

export async function requestConsentInteractive(
  consentDescription: string,
  addSkillUpdateConfirmationRequest: (value: ConfirmationRequest) => void,
): Promise<boolean> {
  return await promptForConsentInteractive(
    consentDescription + '\n\nDo you want to continue?',
    addSkillUpdateConfirmationRequest,
  );
}

export function validateName(name: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(name)) {
    throw new Error(
      `Invalid skill name: "${name}". Only letters (a-z, A-Z), numbers (0-9), and dashes (-) are allowed.`,
    );
  }
}

export function loadSkillConfig(context: {
  skillDir: string;
  workspaceDir: string;
}): SkillConfig {
  const { skillDir, workspaceDir } = context;
  const configFilePath = path.join(skillDir, SKILL_FILENAME);
  if (!fs.existsSync(configFilePath)) {
    throw new Error(
      `Configuration file not found at ${configFilePath}`,
    );
  }
  try {
    const fileContent = fs.readFileSync(configFilePath, 'utf-8');
    const { frontmatter } = parseSkillMarkdown(fileContent);
    const rawConfig = recursivelyHydrateStrings(frontmatter as JsonValue, {
      extensionPath: skillDir,
      workspacePath: workspaceDir,
      '/': path.sep,
      pathSeparator: path.sep,
    }) as unknown as SkillConfig;

    const resolvedName = rawConfig.name ?? path.basename(skillDir);

    const config: SkillConfig = {
      ...rawConfig,
      name: resolvedName,
      version: rawConfig.version ?? '0.0.0',
    };

    validateName(config.name);
    return config;
  } catch (e) {
    throw new Error(
      `Failed to load skill config from ${configFilePath}: ${getErrorMessage(e)}`,
    );
  }
}

function parseSkillMarkdown(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) {
    return { frontmatter: {}, body: '' };
  }
  if (lines[0].trim() !== '---') {
    return { frontmatter: {}, body: content };
  }
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) {
    throw new Error('SKILL.md frontmatter is missing a closing "---".');
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  const frontmatter = parseYamlFrontmatter(frontmatterLines);

  return { frontmatter, body };
}

function parseYamlFrontmatter(lines: string[]): Record<string, unknown> {
  const cleaned = lines
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith('#'));

  if (cleaned.length === 0) {
    return {};
  }

  const { value } = parseYamlBlock(cleaned, 0, getIndent(cleaned[0]));
  if (Array.isArray(value)) {
    throw new Error('Frontmatter must be a mapping, not a list.');
  }
  return value as Record<string, unknown>;
}

function parseYamlBlock(
  lines: string[],
  startIndex: number,
  indentLevel: number,
): { value: unknown; nextIndex: number } {
  const obj: Record<string, unknown> = {};
  const arr: unknown[] = [];
  let hasArrayItems = false;

  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);
    if (indent < indentLevel) {
      break;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      hasArrayItems = true;
      const valueText = trimmed.slice(2).trim();
      if (valueText.length > 0) {
        arr.push(parseYamlScalar(valueText));
        i += 1;
        continue;
      }

      const nextIndent = findNextIndent(lines, i + 1);
      if (nextIndent === null || nextIndent <= indent) {
        arr.push(null);
        i += 1;
        continue;
      }

      const nested = parseYamlBlock(lines, i + 1, nextIndent);
      arr.push(nested.value);
      i = nested.nextIndex;
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line: ${trimmed}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rest = trimmed.slice(separatorIndex + 1).trim();

    if (rest.length > 0) {
      obj[key] = parseYamlScalar(rest);
      i += 1;
      continue;
    }

    const nextIndent = findNextIndent(lines, i + 1);
    if (nextIndent === null || nextIndent <= indent) {
      obj[key] = null;
      i += 1;
      continue;
    }

    const nested = parseYamlBlock(lines, i + 1, nextIndent);
    obj[key] = nested.value;
    i = nested.nextIndex;
  }

  return { value: hasArrayItems ? arr : obj, nextIndex: i };
}

function findNextIndent(lines: string[], startIndex: number): number | null {
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].trim().length === 0 || lines[i].trim().startsWith('#')) {
      continue;
    }
    return getIndent(lines[i]);
  }
  return null;
}

function parseYamlScalar(value: string): unknown {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && value !== '') {
    return asNumber;
  }
  return value;
}

function getIndent(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === ' ') {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

async function promptForConsentNonInteractive(prompt: string) {
  return await new Promise<boolean>((resolve, reject) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      if (answer === '' || answer === 'y' || answer === 'yes') {
        resolve(true);
      } else if (answer === 'n' || answer === 'no') {
        resolve(false);
      } else {
        reject(
          new Error(
            `Invalid response: ${answer}. Please enter 'y' or 'n'.`,
          ),
        );
      }
    });
  });
}

async function promptForConsentInteractive(
  consentDescription: string,
  addSkillUpdateConfirmationRequest: (value: ConfirmationRequest) => void,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    addSkillUpdateConfirmationRequest({
      prompt: consentDescription,
      onConfirm: (resolvedConfirmed) => {
        resolve(resolvedConfirmed);
      },
    });
  });
}

export function loadSkillInstallMetadata(
  skillDir: string,
): ExtensionInstallMetadata | null {
  const metadataFilePath = path.join(skillDir, SKILL_INSTALL_METADATA_FILENAME);
  if (!fs.existsSync(metadataFilePath)) {
    return null;
  }
  try {
    const metadataString = fs.readFileSync(metadataFilePath, 'utf-8');
    return JSON.parse(metadataString) as ExtensionInstallMetadata;
  } catch (e) {
    console.error(
      `Failed to load install metadata from ${metadataFilePath}: ${getErrorMessage(e)}`,
    );
    return null;
  }
}

export async function installSkill(
  installMetadata: ExtensionInstallMetadata,
  requestConsent: (consent: string) => Promise<boolean>,
  cwd: string = process.cwd(),
  previousSkillConfig?: SkillConfig,
): Promise<string[]> {
  let newSkillConfigs: SkillConfig[] = [];
  let localSourcePath: string | undefined;

  try {
    const settings = loadSettings(cwd).merged;
    if (!isWorkspaceTrusted(settings)) {
      throw new Error(
        `Could not install skill from untrusted folder at ${installMetadata.source}`,
      );
    }

    const skillsDir = SkillStorage.getUserSkillsDir();
    await fs.promises.mkdir(skillsDir, { recursive: true });

    if (
      !path.isAbsolute(installMetadata.source) &&
      (installMetadata.type === 'local' || installMetadata.type === 'link')
    ) {
      installMetadata.source = path.resolve(cwd, installMetadata.source);
    }

    let tempDir: string | undefined;

    if (
      installMetadata.type === 'git' ||
      installMetadata.type === 'github-release'
    ) {
      tempDir = await SkillStorage.createTmpDir();
      try {
        const result = await downloadFromGitHubRelease(
          installMetadata,
          tempDir,
        );
        installMetadata.type = result.type;
        installMetadata.releaseTag = result.tagName;
      } catch (_error) {
        await cloneFromGit(installMetadata, tempDir);
        installMetadata.type = 'git';
      }
      localSourcePath = tempDir;
    } else if (
      installMetadata.type === 'local' ||
      installMetadata.type === 'link'
    ) {
      localSourcePath = installMetadata.source;
    } else {
      throw new Error(`Unsupported install type: ${installMetadata.type}`);
    }

    try {
      const resolvedSkillPaths = resolveSkillPaths(localSourcePath);
      if (resolvedSkillPaths.length === 0) {
        throw new Error(
          `Configuration file not found at ${path.join(localSourcePath, SKILL_FILENAME)}`,
        );
      }

      const skillCandidates = resolvedSkillPaths.map((resolvedSkillPath) => ({
        path: resolvedSkillPath,
        config: loadSkillConfig({
          skillDir: resolvedSkillPath,
          workspaceDir: cwd,
        }),
      }));
      newSkillConfigs = skillCandidates.map((candidate) => candidate.config);

      const installedSkills = loadUserSkills();
      const installedNames = new Set(
        installedSkills.map((installed) => installed.config.name),
      );
      const duplicateNames = newSkillConfigs
        .map((config) => config.name)
        .filter((name) => installedNames.has(name));
      if (duplicateNames.length > 0) {
        const label = duplicateNames.length > 1 ? 'Skills' : 'Skill';
        throw new Error(
          `${label} already installed: ${duplicateNames.join(', ')}.`,
        );
      }

      const installedSkillNames: string[] = [];
      for (const candidate of skillCandidates) {
        const resolvedSkillPath = candidate.path;
        const newSkillConfig = candidate.config;
        const newSkillName = newSkillConfig.name;
        const skillStorage = new SkillStorage(newSkillName);
        const destinationPath = skillStorage.getSkillDir();

        const previousConfigForSkill =
          previousSkillConfig?.name === newSkillName
            ? previousSkillConfig
            : undefined;
        await maybeRequestConsentOrFail(
          newSkillConfig,
          requestConsent,
          previousConfigForSkill,
        );
        await fs.promises.mkdir(destinationPath, { recursive: true });

        if (
          installMetadata.type === 'local' ||
          installMetadata.type === 'git' ||
          installMetadata.type === 'github-release'
        ) {
          await copySkill(resolvedSkillPath, destinationPath);
        }

        const metadata =
          installMetadata.type === 'local' ||
          installMetadata.type === 'link'
            ? {
                ...installMetadata,
                source: resolvedSkillPath,
              }
            : installMetadata;
        const metadataString = JSON.stringify(metadata, null, 2);
        const metadataPath = path.join(
          destinationPath,
          SKILL_INSTALL_METADATA_FILENAME,
        );
        await fs.promises.writeFile(metadataPath, metadataString);

        enableSkill(newSkillName, SettingScope.User);
        installedSkillNames.push(newSkillName);
      }

      return installedSkillNames;
    } finally {
      if (tempDir) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    if (newSkillConfigs.length === 0 && localSourcePath) {
      try {
        const resolvedSkillPaths = resolveSkillPaths(localSourcePath);
        newSkillConfigs = resolvedSkillPaths.map((resolvedSkillPath) =>
          loadSkillConfig({
            skillDir: resolvedSkillPath,
            workspaceDir: cwd,
          }),
        );
      } catch {
        // Ignore error, this is just for logging.
      }
    }

    throw error;
  }
}

function resolveSkillPaths(sourcePath: string): string[] {
  const directSkillPath = path.join(sourcePath, SKILL_FILENAME);
  if (fs.existsSync(directSkillPath)) {
    return [sourcePath];
  }

  const nestedSkillsDir = path.join(sourcePath, WORKSPACE_SKILLS_DIRECTORY_NAME);
  const nestedEntries = listSkillDirs(nestedSkillsDir);
  if (nestedEntries.length > 0) {
    return nestedEntries;
  }

  const skillsDir = path.join(sourcePath, 'skills');
  const skillsEntries = listSkillDirs(skillsDir);
  if (skillsEntries.length > 0) {
    return skillsEntries;
  }

  const directEntries = listSkillDirs(sourcePath);
  if (directEntries.length > 0) {
    return directEntries;
  }

  return [];
}

function listSkillDirs(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const stat = fs.statSync(rootDir);
  if (!stat.isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(rootDir)
    .map((entry) => path.join(rootDir, entry))
    .filter((entry) => fs.existsSync(path.join(entry, SKILL_FILENAME)));
}

function skillConsentString(skillConfig: SkillConfig): string {
  const output: string[] = [];
  const mcpServerEntries = Object.entries(skillConfig.mcpServers || {});
  output.push(`Installing skill "${skillConfig.name}".`);
  output.push(
    '**Skills may introduce unexpected behavior. Ensure you have investigated the skill source and trust the author.**',
  );
  if (mcpServerEntries.length) {
    output.push('This skill will run the following MCP servers:');
    for (const [key] of mcpServerEntries) {
      output.push(`- ${key}`);
    }
  }
  const contextFiles = getContextFileNames(skillConfig);
  if (contextFiles.length > 0) {
    output.push(
      `This skill will append info to your papert.md context using ${contextFiles.join(', ')}`,
    );
  }
  if (skillConfig.excludeTools) {
    output.push(
      `This skill will exclude the following core tools: ${skillConfig.excludeTools}`,
    );
  }
  return output.join('\n');
}

async function maybeRequestConsentOrFail(
  skillConfig: SkillConfig,
  requestConsent: (consent: string) => Promise<boolean>,
  previousSkillConfig?: SkillConfig,
): Promise<void> {
  const skillConsent = skillConsentString(skillConfig);
  if (previousSkillConfig) {
    const previousSkillConsent = skillConsentString(previousSkillConfig);
    if (previousSkillConsent === skillConsent) {
      return;
    }
  }
  if (!(await requestConsent(skillConsent))) {
    throw new Error(`Installation cancelled for "${skillConfig.name}".`);
  }
}

export async function uninstallSkill(
  skillIdentifier: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const installedSkills = loadUserSkills();
  const skillName = installedSkills.find(
    (installed) =>
      installed.config.name.toLowerCase() === skillIdentifier.toLowerCase() ||
      installed.installMetadata?.source.toLowerCase() ===
        skillIdentifier.toLowerCase(),
  )?.config.name;
  if (!skillName) {
    throw new Error('Skill not found.');
  }
  disableSkill(skillName, SettingScope.User);
  const storage = new SkillStorage(skillName);

  await fs.promises.rm(storage.getSkillDir(), {
    recursive: true,
    force: true,
  });
}

export function toOutputString(skill: Skill, workspaceDir: string): string {
  const manager = new SkillEnablementManager(SkillStorage.getUserSkillsDir());
  const userEnabled = manager.isEnabled(skill.config.name, os.homedir());
  const workspaceEnabled = manager.isEnabled(skill.config.name, workspaceDir);

  const status = workspaceEnabled ? chalk.green('✓') : chalk.red('✗');
  let output = `${status} ${skill.config.name} (${skill.config.version})`;
  output += `\n Path: ${skill.path}`;
  if (skill.installMetadata) {
    output += `\n Source: ${skill.installMetadata.source} (Type: ${skill.installMetadata.type})`;
    if (skill.installMetadata.ref) {
      output += `\n Ref: ${skill.installMetadata.ref}`;
    }
    if (skill.installMetadata.releaseTag) {
      output += `\n Release tag: ${skill.installMetadata.releaseTag}`;
    }
  }
  output += `\n Enabled (User): ${userEnabled}`;
  output += `\n Enabled (Workspace): ${workspaceEnabled}`;
  if (skill.contextFiles.length > 0) {
    output += `\n Context files:`;
    skill.contextFiles.forEach((contextFile) => {
      output += `\n  ${contextFile}`;
    });
  }
  if (skill.config.mcpServers) {
    output += `\n MCP servers:`;
    Object.keys(skill.config.mcpServers).forEach((key) => {
      output += `\n  ${key}`;
    });
  }
  if (skill.config.excludeTools) {
    output += `\n Excluded tools:`;
    skill.config.excludeTools.forEach((tool) => {
      output += `\n  ${tool}`;
    });
  }
  return output;
}

export function enableSkill(
  name: string,
  scope: SettingScope,
  cwd: string = process.cwd(),
) {
  if (scope === SettingScope.System || scope === SettingScope.SystemDefaults) {
    throw new Error('System and SystemDefaults scopes are not supported.');
  }
  const manager = new SkillEnablementManager(
    SkillStorage.getUserSkillsDir(),
    [name],
  );
  if (!loadSkillByName(name, cwd)) {
    throw new Error(`Skill "${name}" not found.`);
  }
  manager.enable(name, true, scopePathForScope(scope, cwd));
}

export function disableSkill(
  name: string,
  scope: SettingScope,
  cwd: string = process.cwd(),
) {
  if (scope === SettingScope.System || scope === SettingScope.SystemDefaults) {
    throw new Error('System and SystemDefaults scopes are not supported.');
  }
  const manager = new SkillEnablementManager(
    SkillStorage.getUserSkillsDir(),
    [name],
  );
  if (!loadSkillByName(name, cwd)) {
    throw new Error(`Skill "${name}" not found.`);
  }
  manager.disable(name, true, scopePathForScope(scope, cwd));
}

function scopePathForScope(scope: SettingScope, cwd: string): string {
  return scope === SettingScope.User ? os.homedir() : cwd;
}

export function loadSkillByName(
  name: string,
  workspaceDir: string,
): Skill | undefined {
  const searchDirs = [
    SkillStorage.getUserSkillsDir(),
    ...getAdditionalSkillsDirs(),
    path.join(workspaceDir, WORKSPACE_SKILLS_DIRECTORY_NAME),
  ];
  for (const baseDir of searchDirs) {
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    for (const subdir of fs.readdirSync(baseDir)) {
      const skillDir = path.join(baseDir, subdir);
      if (!fs.statSync(skillDir).isDirectory()) {
        continue;
      }
      const skill = loadSkill({ skillDir, workspaceDir });
      if (skill && skill.config.name.toLowerCase() === name.toLowerCase()) {
        return skill;
      }
    }
  }
  return undefined;
}

function filterMcpConfig(config: MCPServerConfig): MCPServerConfig {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { trust, ...rest } = config;
  return {
    ...rest,
    env: rest.env ? sanitizeEnvObject(rest.env) : undefined,
  };
}

function sanitizeEnvObject(env: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    sanitized[key] = value;
  }
  return sanitized;
}

function getAdditionalSkillsDirs(): string[] {
  const raw = process.env[SKILLS_PATHS_ENV];
  if (!raw) {
    return [];
  }
  return parseSkillsPathList(raw)
    .map((entry) => resolvePath(entry.trim()))
    .filter((entry) => entry.length > 0);
}

function parseSkillsPathList(raw: string): string[] {
  const separator = new RegExp(`[${path.delimiter},]`);
  return raw.split(separator).map((entry) => entry.trim()).filter(Boolean);
}
