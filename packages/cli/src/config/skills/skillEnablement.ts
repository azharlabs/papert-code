/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { type Skill } from '../skill.js';

export interface SkillEnablementConfig {
  overrides: string[];
}

export interface AllSkillsEnablementConfig {
  [skillName: string]: SkillEnablementConfig;
}

export class Override {
  constructor(
    public baseRule: string,
    public isDisable: boolean,
    public includeSubdirs: boolean,
  ) {}

  static fromInput(inputRule: string, includeSubdirs: boolean): Override {
    const isDisable = inputRule.startsWith('!');
    let baseRule = isDisable ? inputRule.substring(1) : inputRule;
    baseRule = ensureLeadingAndTrailingSlash(baseRule);
    return new Override(baseRule, isDisable, includeSubdirs);
  }

  static fromFileRule(fileRule: string): Override {
    const isDisable = fileRule.startsWith('!');
    let baseRule = isDisable ? fileRule.substring(1) : fileRule;
    const includeSubdirs = baseRule.endsWith('*');
    baseRule = includeSubdirs
      ? baseRule.substring(0, baseRule.length - 1)
      : baseRule;
    return new Override(baseRule, isDisable, includeSubdirs);
  }

  conflictsWith(other: Override): boolean {
    if (this.baseRule === other.baseRule) {
      return (
        this.includeSubdirs !== other.includeSubdirs ||
        this.isDisable !== other.isDisable
      );
    }
    return false;
  }

  isEqualTo(other: Override): boolean {
    return (
      this.baseRule === other.baseRule &&
      this.includeSubdirs === other.includeSubdirs &&
      this.isDisable === other.isDisable
    );
  }

  asRegex(): RegExp {
    return globToRegex(`${this.baseRule}${this.includeSubdirs ? '*' : ''}`);
  }

  isChildOf(parent: Override) {
    if (!parent.includeSubdirs) {
      return false;
    }
    return parent.asRegex().test(this.baseRule);
  }

  output(): string {
    return `${this.isDisable ? '!' : ''}${this.baseRule}${this.includeSubdirs ? '*' : ''}`;
  }

  matchesPath(path: string) {
    return this.asRegex().test(path);
  }
}

const ensureLeadingAndTrailingSlash = function (dirPath: string): string {
  let result = dirPath.replace(/\\/g, '/');
  if (result.charAt(0) !== '/') {
    result = '/' + result;
  }
  if (result.charAt(result.length - 1) !== '/') {
    result = result + '/';
  }
  return result;
};

function globToRegex(glob: string): RegExp {
  const regexString = glob
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/(\/?)\*/g, '($1.*)?');

  return new RegExp(`^${regexString}$`);
}

export class SkillEnablementManager {
  private configFilePath: string;
  private configDir: string;
  private enabledSkillNamesOverride: string[];

  constructor(configDir: string, enabledSkillNames?: string[]) {
    this.configDir = configDir;
    this.configFilePath = path.join(configDir, 'skill-enablement.json');
    this.enabledSkillNamesOverride =
      enabledSkillNames?.map((name) => name.toLowerCase()) ?? [];
  }

  validateSkillOverrides(skills: Skill[]) {
    for (const name of this.enabledSkillNamesOverride) {
      if (name === 'none') continue;
      if (
        !skills.some(
          (skill) => skill.config.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        console.error(`Skill not found: ${name}`);
      }
    }
  }

  isEnabled(skillName: string, currentPath: string): boolean {
    if (
      this.enabledSkillNamesOverride.length === 1 &&
      this.enabledSkillNamesOverride[0] === 'none'
    ) {
      return false;
    }

    if (this.enabledSkillNamesOverride.length > 0) {
      return this.enabledSkillNamesOverride.includes(skillName.toLowerCase());
    }

    const config = this.readConfig();
    const skillConfig = config[skillName];
    let enabled = true;
    const allOverrides = skillConfig?.overrides ?? [];
    for (const rule of allOverrides) {
      const override = Override.fromFileRule(rule);
      if (override.matchesPath(ensureLeadingAndTrailingSlash(currentPath))) {
        enabled = !override.isDisable;
      }
    }
    return enabled;
  }

  readConfig(): AllSkillsEnablementConfig {
    try {
      const content = fs.readFileSync(this.configFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return {};
      }
      console.error('Error reading skill enablement config:', error);
      return {};
    }
  }

  writeConfig(config: AllSkillsEnablementConfig): void {
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2));
  }

  enable(skillName: string, includeSubdirs: boolean, scopePath: string): void {
    const config = this.readConfig();
    if (!config[skillName]) {
      config[skillName] = { overrides: [] };
    }
    const override = Override.fromInput(scopePath, includeSubdirs);
    const overrides = config[skillName].overrides.filter((rule) => {
      const fileOverride = Override.fromFileRule(rule);
      if (
        fileOverride.conflictsWith(override) ||
        fileOverride.isEqualTo(override)
      ) {
        return false;
      }
      return !fileOverride.isChildOf(override);
    });
    overrides.push(override.output());
    config[skillName].overrides = overrides;
    this.writeConfig(config);
  }

  disable(skillName: string, includeSubdirs: boolean, scopePath: string): void {
    const config = this.readConfig();
    if (!config[skillName]) {
      config[skillName] = { overrides: [] };
    }
    const override = Override.fromInput(`!${scopePath}`, includeSubdirs);
    const overrides = config[skillName].overrides.filter((rule) => {
      const fileOverride = Override.fromFileRule(rule);
      if (
        fileOverride.conflictsWith(override) ||
        fileOverride.isEqualTo(override)
      ) {
        return false;
      }
      return !fileOverride.isChildOf(override);
    });
    overrides.push(override.output());
    config[skillName].overrides = overrides;
    this.writeConfig(config);
  }

  remove(skillName: string): void {
    const config = this.readConfig();
    delete config[skillName];
    this.writeConfig(config);
  }
}
