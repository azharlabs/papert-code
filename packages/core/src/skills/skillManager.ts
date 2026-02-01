/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '../config/storage.js';
import { type SkillDefinition, loadSkillsFromDir } from './skillLoader.js';
import { debugLogger } from '../utils/debugLogger.js';

export { type SkillDefinition };

export class SkillManager {
  private skills: SkillDefinition[] = [];
  private activeSkillNames: Set<string> = new Set();
  private adminSkillsEnabled = true;

  clearSkills(): void {
    this.skills = [];
  }

  setAdminSettings(enabled: boolean): void {
    this.adminSkillsEnabled = enabled;
  }

  isAdminEnabled(): boolean {
    return this.adminSkillsEnabled;
  }

  async discoverSkills(storage: Storage): Promise<void> {
    this.clearSkills();

    await this.discoverBuiltinSkills();

    const userSkills = await loadSkillsFromDir(Storage.getUserSkillsDir());
    this.addSkillsWithPrecedence(userSkills);

    const projectSkills = await loadSkillsFromDir(
      storage.getProjectSkillsDir(),
    );
    this.addSkillsWithPrecedence(projectSkills);
  }

  private async discoverBuiltinSkills(): Promise<void> {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const builtinDir = path.join(__dirname, 'builtin');

    const builtinSkills = await loadSkillsFromDir(builtinDir);
    for (const skill of builtinSkills) {
      skill.isBuiltin = true;
    }
    this.addSkillsWithPrecedence(builtinSkills);
  }

  private addSkillsWithPrecedence(newSkills: SkillDefinition[]): void {
    const skillMap = new Map<string, SkillDefinition>(
      this.skills.map((s) => [s.name, s]),
    );

    for (const newSkill of newSkills) {
      const existingSkill = skillMap.get(newSkill.name);
      if (existingSkill && existingSkill.location !== newSkill.location) {
        if (existingSkill.isBuiltin) {
          debugLogger.warn(
            `Skill "${newSkill.name}" from "${newSkill.location}" is overriding the built-in skill.`,
          );
        } else {
          debugLogger.warn(
            `Skill conflict detected: "${newSkill.name}" from "${newSkill.location}" is overriding the same skill from "${existingSkill.location}".`,
          );
        }
      }
      skillMap.set(newSkill.name, newSkill);
    }

    this.skills = Array.from(skillMap.values());
  }

  getSkills(): SkillDefinition[] {
    return this.skills.filter((s) => !s.disabled);
  }

  getDisplayableSkills(): SkillDefinition[] {
    return this.skills.filter((s) => !s.disabled && !s.isBuiltin);
  }

  getAllSkills(): SkillDefinition[] {
    return this.skills;
  }

  filterSkills(predicate: (skill: SkillDefinition) => boolean): void {
    this.skills = this.skills.filter(predicate);
  }

  setDisabledSkills(disabledNames: string[]): void {
    const lowercaseDisabledNames = disabledNames.map((n) => n.toLowerCase());
    for (const skill of this.skills) {
      skill.disabled = lowercaseDisabledNames.includes(
        skill.name.toLowerCase(),
      );
    }
  }

  getSkill(name: string): SkillDefinition | null {
    const lowercaseName = name.toLowerCase();
    return (
      this.skills.find((s) => s.name.toLowerCase() === lowercaseName) ?? null
    );
  }

  activateSkill(name: string): void {
    this.activeSkillNames.add(name);
  }

  isSkillActive(name: string): boolean {
    return this.activeSkillNames.has(name);
  }
}
