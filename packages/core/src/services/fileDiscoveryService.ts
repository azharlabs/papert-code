/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import type { PapertIgnoreFilter } from '../utils/papertIgnoreParser.js';
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { PapertIgnoreParser } from '../utils/papertIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import ignore from 'ignore';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectPapertIgnore?: boolean;
}

export interface FileDiscoveryServiceOptions {
  customIgnoreFilePaths?: string[];
}

export interface FilterReport {
  filteredPaths: string[];
  gitIgnoredCount: number;
  papertIgnoredCount: number;
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private papertIgnoreFilter: PapertIgnoreFilter | null = null;
  private projectRoot: string;
  private customIgnoreMatcher = ignore();
  private hasCustomIgnorePatterns = false;

  constructor(projectRoot: string, options: FileDiscoveryServiceOptions = {}) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      this.gitIgnoreFilter = new GitIgnoreParser(this.projectRoot);
    }
    this.papertIgnoreFilter = new PapertIgnoreParser(this.projectRoot);
    this.loadCustomIgnorePatterns(options.customIgnoreFilePaths || []);
  }

  private loadCustomIgnorePatterns(customIgnoreFilePaths: string[]): void {
    for (const filePath of customIgnoreFilePaths) {
      const resolvedPath = path.resolve(this.projectRoot, filePath);
      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        const patterns = content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('#'));
        if (patterns.length > 0) {
          this.customIgnoreMatcher.add(patterns);
          this.hasCustomIgnorePatterns = true;
        }
      } catch {
        // Ignore missing or unreadable custom ignore files.
      }
    }
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(
    filePaths: string[],
    options: FilterFilesOptions = {
      respectGitIgnore: true,
      respectPapertIgnore: true,
    },
  ): string[] {
    return filePaths.filter((filePath) => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      if (options.respectPapertIgnore && this.shouldPapertIgnoreFile(filePath)) {
        return false;
      }
      if (this.shouldCustomIgnoreFile(filePath)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filters a list of file paths based on git ignore rules and returns a report
   * with counts of ignored files.
   */
  filterFilesWithReport(
    filePaths: string[],
    opts: FilterFilesOptions = {
      respectGitIgnore: true,
      respectPapertIgnore: true,
    },
  ): FilterReport {
    const filteredPaths: string[] = [];
    let gitIgnoredCount = 0;
    let papertIgnoredCount = 0;

    for (const filePath of filePaths) {
      if (opts.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        gitIgnoredCount++;
        continue;
      }

      if (opts.respectPapertIgnore && this.shouldPapertIgnoreFile(filePath)) {
        papertIgnoredCount++;
        continue;
      }

      if (this.shouldCustomIgnoreFile(filePath)) {
        continue;
      }

      filteredPaths.push(filePath);
    }

    return {
      filteredPaths,
      gitIgnoredCount,
      papertIgnoredCount,
    };
  }

  /**
   * Checks if a single file should be git-ignored
   */
  shouldGitIgnoreFile(filePath: string): boolean {
    if (this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  shouldCustomIgnoreFile(filePath: string): boolean {
    if (!this.hasCustomIgnorePatterns) {
      return false;
    }

    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    const resolved = path.resolve(this.projectRoot, filePath);
    const relativePath = path.relative(this.projectRoot, resolved);
    if (!relativePath || relativePath.startsWith('..')) {
      return false;
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');
    return this.customIgnoreMatcher.ignores(normalizedPath);
  }

  /**
   * Checks if a single file should be papert-ignored
   */
  shouldPapertIgnoreFile(filePath: string): boolean {
    if (this.papertIgnoreFilter) {
      return this.papertIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    const {
      respectGitIgnore = true,
      respectPapertIgnore: respectPapertIgnore = true,
    } = options;

    if (respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
      return true;
    }
    if (respectPapertIgnore && this.shouldPapertIgnoreFile(filePath)) {
      return true;
    }
    if (this.shouldCustomIgnoreFile(filePath)) {
      return true;
    }
    return false;
  }

  /**
   * Returns loaded patterns from .papertignore
   */
  getPapertIgnorePatterns(): string[] {
    return this.papertIgnoreFilter?.getPatterns() ?? [];
  }
}
