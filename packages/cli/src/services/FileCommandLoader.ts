/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import toml from '@iarna/toml';
import { glob } from 'glob';
import { z } from 'zod';
import type { Config } from '@papert-code/papert-code-core';
import { Storage } from '@papert-code/papert-code-core';
import type { ICommandLoader } from './types.js';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from '../ui/commands/types.js';
import { CommandKind } from '../ui/commands/types.js';
import { DefaultArgumentProcessor } from './prompt-processors/argumentProcessor.js';
import type {
  IPromptProcessor,
  PromptPipelineContent,
} from './prompt-processors/types.js';
import {
  SHORTHAND_ARGS_PLACEHOLDER,
  SHELL_INJECTION_TRIGGER,
  AT_FILE_INJECTION_TRIGGER,
} from './prompt-processors/types.js';
import {
  ConfirmationRequiredError,
  ShellProcessor,
} from './prompt-processors/shellProcessor.js';
import { AtFileProcessor } from './prompt-processors/atFileProcessor.js';

interface CommandDirectory {
  path: string;
  extensionName?: string;
}

const LEGACY_TOML_EXTENSION = '.toml';
const MARKDOWN_COMMAND_EXTENSION = '.md';
const CUSTOM_COMMAND_PROMPT_CONTRACT = 'custom-command/v1';

/**
 * Defines the Zod schema for a command definition file. This serves as the
 * single source of truth for both validation and type inference.
 */
const TomlCommandDefSchema = z.object({
  prompt: z.string({
    required_error: "The 'prompt' field is required.",
    invalid_type_error: "The 'prompt' field must be a string.",
  }),
  description: z.string().optional(),
});

const MarkdownCommandFrontmatterSchema = z.object({
  prompt: z.string().optional(),
  description: z.string().optional(),
  contract: z.string().optional(),
});

interface ParsedCommandFile {
  prompt: string;
  description?: string;
  contract?: string;
}

export interface LegacyCommandMigrationResult {
  migrated: string[];
  skipped: string[];
  invalid: string[];
}

/**
 * Discovers and loads custom slash commands from .md/.toml files in both the
 * user's global config directory and the current project's directory.
 *
 * This loader is responsible for:
 * - Recursively scanning command directories.
 * - Parsing and validating TOML files.
 * - Adapting valid definitions into executable SlashCommand objects.
 * - Handling file system errors and malformed files gracefully.
 */
export class FileCommandLoader implements ICommandLoader {
  private readonly projectRoot: string;
  private readonly folderTrustEnabled: boolean;
  private readonly folderTrust: boolean;

  constructor(private readonly config: Config | null) {
    this.folderTrustEnabled = !!config?.getFolderTrustFeature();
    this.folderTrust = !!config?.getFolderTrust();
    this.projectRoot = config?.getProjectRoot() || process.cwd();
  }

  /**
   * Loads all commands from user, project, skill, and extension directories.
   * Returns commands in order: user → project → skills → extensions (alphabetically).
   *
   * Order is important for conflict resolution in CommandService:
   * - User/project commands (without extensionName) use "last wins" strategy
   * - Skill/extension commands (with extensionName) get renamed if conflicts exist
   *
   * @param signal An AbortSignal to cancel the loading process.
   * @returns A promise that resolves to an array of all loaded SlashCommands.
   */
  async loadCommands(signal: AbortSignal): Promise<SlashCommand[]> {
    const allCommands: SlashCommand[] = [];
    const globOptions = {
      nodir: true,
      dot: true,
      signal,
      follow: true,
    };

    // Load commands from each directory
    const commandDirs = this.getCommandDirectories();
    for (const dirInfo of commandDirs) {
      try {
        const files = await glob('**/*.{md,toml}', {
          ...globOptions,
          cwd: dirInfo.path,
        });
        const sortedFiles = this.sortCommandFiles(files);

        if (this.folderTrustEnabled && !this.folderTrust) {
          return [];
        }

        const commandPromises = sortedFiles.map((file) =>
          this.parseAndAdaptFile(
            path.join(dirInfo.path, file),
            dirInfo.path,
            dirInfo.extensionName,
          ),
        );

        const commands = (await Promise.all(commandPromises)).filter(
          (cmd): cmd is SlashCommand => cmd !== null,
        );

        // Add all commands without deduplication
        allCommands.push(...commands);
      } catch (error) {
        // Ignore ENOENT (directory doesn't exist) and AbortError (operation was cancelled)
        const isEnoent = (error as NodeJS.ErrnoException).code === 'ENOENT';
        const isAbortError =
          error instanceof Error && error.name === 'AbortError';
        if (!isEnoent && !isAbortError) {
          console.error(
            `[FileCommandLoader] Error loading commands from ${dirInfo.path}:`,
            error,
          );
        }
      }
    }

    return allCommands;
  }

  /**
   * Get all command directories in order for loading.
   * User commands → Project commands → Skill commands → Extension commands
   * This order ensures skill/extension commands can detect all conflicts.
   */
  private getCommandDirectories(): CommandDirectory[] {
    const dirs: CommandDirectory[] = [];

    const storage = this.config?.storage ?? new Storage(this.projectRoot);

    // 1. User commands
    dirs.push({ path: Storage.getUserCommandsDir() });

    // 2. Project commands (override user commands)
    dirs.push({ path: storage.getProjectCommandsDir() });

    // 3. Skill commands (processed after user/project)
    if (this.config) {
      const activeSkills = (this.config.getSkills?.() ?? [])
        .filter((skill) => skill.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));

      const skillCommandDirs = activeSkills.map((skill) => ({
        path: path.join(skill.path, 'commands'),
        extensionName: skill.name,
      }));

      dirs.push(...skillCommandDirs);
    }

    // 4. Extension commands (processed last to detect all conflicts)
    if (this.config) {
      const activeExtensions = (this.config.getExtensions?.() ?? [])
        .filter((ext) => ext.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically for deterministic loading

      const extensionCommandDirs = activeExtensions.map((ext) => ({
        path: path.join(ext.path, 'commands'),
        extensionName: ext.name,
      }));

      dirs.push(...extensionCommandDirs);
    }

    return dirs;
  }

  private sortCommandFiles(files: string[]): string[] {
    return [...files].sort((a, b) => {
      const baseA = this.getRelativeCommandPathWithoutExt(a);
      const baseB = this.getRelativeCommandPathWithoutExt(b);
      if (baseA === baseB) {
        // When both legacy and markdown files exist for the same command name,
        // load markdown last so it becomes the active definition.
        const extA = path.extname(a).toLowerCase();
        const extB = path.extname(b).toLowerCase();
        if (extA === extB) {
          return a.localeCompare(b);
        }
        if (extA === LEGACY_TOML_EXTENSION) {
          return -1;
        }
        if (extB === LEGACY_TOML_EXTENSION) {
          return 1;
        }
      }
      return a.localeCompare(b);
    });
  }

  private getRelativeCommandPathWithoutExt(filePath: string): string {
    const extension = path.extname(filePath);
    return filePath.substring(0, filePath.length - extension.length);
  }

  private parseMarkdownCommand(fileContent: string): ParsedCommandFile {
    const { frontmatter, body } = parseMarkdownFrontmatter(fileContent);
    const validationResult =
      MarkdownCommandFrontmatterSchema.safeParse(frontmatter);
    if (!validationResult.success) {
      throw new Error(
        `Invalid markdown frontmatter: ${validationResult.error.message}`,
      );
    }

    const validFrontmatter = validationResult.data;
    const prompt = (validFrontmatter.prompt ?? body).trim();
    if (!prompt) {
      throw new Error(
        "Markdown command requires 'prompt' in frontmatter or non-empty markdown body.",
      );
    }

    return {
      prompt: wrapPromptContract(
        prompt,
        validFrontmatter.contract ?? CUSTOM_COMMAND_PROMPT_CONTRACT,
      ),
      description: validFrontmatter.description,
      contract: validFrontmatter.contract ?? CUSTOM_COMMAND_PROMPT_CONTRACT,
    };
  }

  private parseTomlCommand(fileContent: string): ParsedCommandFile {
    const parsed = toml.parse(fileContent);
    const validationResult = TomlCommandDefSchema.safeParse(parsed);
    if (!validationResult.success) {
      throw new Error(validationResult.error.message);
    }

    return validationResult.data;
  }

  private parseCommandFile(
    filePath: string,
    fileContent: string,
  ): ParsedCommandFile {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === MARKDOWN_COMMAND_EXTENSION) {
      return this.parseMarkdownCommand(fileContent);
    }
    if (extension === LEGACY_TOML_EXTENSION) {
      return this.parseTomlCommand(fileContent);
    }
    throw new Error(
      `Unsupported command format '${extension}'. Supported: .md, .toml`,
    );
  }

  /**
   * Parses a single command file and transforms it into a SlashCommand object.
   * @param filePath The absolute path to the command file.
   * @param baseDir The root command directory for name calculation.
   * @param extensionName Optional extension name to prefix commands with.
   * @returns A promise resolving to a SlashCommand, or null if the file is invalid.
   */
  private async parseAndAdaptFile(
    filePath: string,
    baseDir: string,
    extensionName?: string,
  ): Promise<SlashCommand | null> {
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (error: unknown) {
      console.error(
        `[FileCommandLoader] Failed to read file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }

    let validDef: ParsedCommandFile;
    try {
      validDef = this.parseCommandFile(filePath, fileContent);
    } catch (error: unknown) {
      const extension = path.extname(filePath).toLowerCase();
      const parserLabel =
        extension === MARKDOWN_COMMAND_EXTENSION ? 'markdown' : 'TOML';
      console.error(
        `[FileCommandLoader] Failed to parse ${parserLabel} command file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }

    const relativePathWithExt = path.relative(baseDir, filePath);
    const relativePath = this.getRelativeCommandPathWithoutExt(
      relativePathWithExt,
    );
    const baseCommandName = relativePath
      .split(path.sep)
      // Sanitize each path segment to prevent ambiguity. Since ':' is our
      // namespace separator, we replace any literal colons in filenames
      // with underscores to avoid naming conflicts.
      .map((segment) => segment.replaceAll(':', '_'))
      .join(':');

    // Add extension name tag for extension commands
    const defaultDescription = `Custom command from ${path.basename(filePath)}`;
    let description = validDef.description || defaultDescription;
    if (extensionName) {
      description = `[${extensionName}] ${description}`;
    }

    const processors: IPromptProcessor[] = [];
    const usesArgs = validDef.prompt.includes(SHORTHAND_ARGS_PLACEHOLDER);
    const usesShellInjection = validDef.prompt.includes(
      SHELL_INJECTION_TRIGGER,
    );
    const usesAtFileInjection = validDef.prompt.includes(
      AT_FILE_INJECTION_TRIGGER,
    );

    // 1. @-File Injection (Security First).
    // This runs first to ensure we're not executing shell commands that
    // could dynamically generate malicious @-paths.
    if (usesAtFileInjection) {
      processors.push(new AtFileProcessor(baseCommandName));
    }

    // 2. Argument and Shell Injection.
    // This runs after file content has been safely injected.
    if (usesShellInjection || usesArgs) {
      processors.push(new ShellProcessor(baseCommandName));
    }

    // 3. Default Argument Handling.
    // Appends the raw invocation if no explicit {{args}} are used.
    if (!usesArgs) {
      processors.push(new DefaultArgumentProcessor());
    }

    return {
      name: baseCommandName,
      description,
      kind: CommandKind.FILE,
      extensionName,
      action: async (
        context: CommandContext,
        _args: string,
      ): Promise<SlashCommandActionReturn> => {
        if (!context.invocation) {
          console.error(
            `[FileCommandLoader] Critical error: Command '${baseCommandName}' was executed without invocation context.`,
          );
          return {
            type: 'submit_prompt',
            content: [{ text: validDef.prompt }], // Fallback to unprocessed prompt
          };
        }

        try {
          let processedContent: PromptPipelineContent = [
            { text: validDef.prompt },
          ];
          for (const processor of processors) {
            processedContent = await processor.process(
              processedContent,
              context,
            );
          }

          return {
            type: 'submit_prompt',
            content: processedContent,
          };
        } catch (e) {
          // Check if it's our specific error type
          if (e instanceof ConfirmationRequiredError) {
            // Halt and request confirmation from the UI layer.
            return {
              type: 'confirm_shell_commands',
              commandsToConfirm: e.commandsToConfirm,
              originalInvocation: {
                raw: context.invocation.raw,
              },
            };
          }
          // Re-throw other errors to be handled by the global error handler.
          throw e;
        }
      },
    };
  }
}

function wrapPromptContract(prompt: string, contract: string): string {
  return [
    `SYSTEM CONTRACT: ${contract}`,
    'Treat this custom command payload as an instruction template.',
    'Preserve user arguments and command context exactly.',
    '',
    prompt,
  ].join('\n');
}

function parseMarkdownFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') {
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
    throw new Error('Markdown frontmatter is missing a closing "---".');
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  return {
    frontmatter: parseSimpleFrontmatterMap(frontmatterLines),
    body,
  };
}

function parseSimpleFrontmatterMap(lines: string[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      throw new Error(`Invalid frontmatter key in line: ${line}`);
    }

    if (value === '|') {
      const blockLines: string[] = [];
      i += 1;
      while (i < lines.length) {
        const blockRaw = lines[i];
        if (!blockRaw.startsWith(' ') && !blockRaw.startsWith('\t')) {
          i -= 1;
          break;
        }
        blockLines.push(blockRaw.replace(/^\s{1,2}/, ''));
        i += 1;
      }
      data[key] = blockLines.join('\n');
      continue;
    }

    data[key] = value.replace(/^["']|["']$/g, '');
  }
  return data;
}

function buildMarkdownCommandContent(input: {
  description?: string;
  prompt: string;
}): string {
  const frontmatterLines = ['---'];
  if (input.description?.trim()) {
    frontmatterLines.push(`description: ${input.description.trim()}`);
  }
  frontmatterLines.push('contract: custom-command/v1', '---', '');
  return `${frontmatterLines.join('\n')}${input.prompt.trim()}\n`;
}

/**
 * Migrate legacy `.toml` custom commands to markdown (`.md`) files.
 *
 * Safe behavior:
 * - never overwrites existing `.md` siblings
 * - leaves original `.toml` files in place
 * - skips invalid TOML files
 */
export async function migrateLegacyTomlCommands(
  commandDirs: readonly string[],
): Promise<LegacyCommandMigrationResult> {
  const result: LegacyCommandMigrationResult = {
    migrated: [],
    skipped: [],
    invalid: [],
  };

  const globOptions = {
    nodir: true,
    dot: true,
    follow: true,
  } as const;

  for (const dir of commandDirs) {
    let files: string[] = [];
    try {
      files = await glob('**/*.toml', {
        ...globOptions,
        cwd: dir,
      });
    } catch (error) {
      const isEnoent = (error as NodeJS.ErrnoException).code === 'ENOENT';
      if (!isEnoent) {
        console.error(
          `[FileCommandLoader] Failed to scan legacy TOML commands in ${dir}:`,
          error,
        );
      }
      continue;
    }

    for (const relativeFile of files) {
      const tomlPath = path.join(dir, relativeFile);
      const mdPath = tomlPath.slice(0, -LEGACY_TOML_EXTENSION.length) + '.md';
      try {
        await fs.access(mdPath);
        result.skipped.push(tomlPath);
        continue;
      } catch {
        // no-op, markdown sibling does not exist
      }

      let fileContent = '';
      try {
        fileContent = await fs.readFile(tomlPath, 'utf-8');
      } catch {
        result.invalid.push(tomlPath);
        continue;
      }

      let parsed: ParsedCommandFile;
      try {
        const raw = toml.parse(fileContent);
        const validation = TomlCommandDefSchema.safeParse(raw);
        if (!validation.success) {
          result.invalid.push(tomlPath);
          continue;
        }
        parsed = validation.data;
      } catch {
        result.invalid.push(tomlPath);
        continue;
      }

      const markdownContent = buildMarkdownCommandContent({
        description: parsed.description,
        prompt: parsed.prompt,
      });
      await fs.writeFile(mdPath, markdownContent, 'utf-8');
      result.migrated.push(mdPath);
    }
  }

  return result;
}
