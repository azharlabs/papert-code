/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

export interface FormatterConfig {
  disabled?: boolean;
  command?: string[];
  environment?: Record<string, string>;
  extensions?: string[];
}

export interface FormatterSettings {
  enabled?: boolean;
  formatAfterWrite?: boolean;
  formatAfterApply?: boolean;
  formatters?: Record<string, FormatterConfig>;
}

export interface FormatterContext {
  getTargetDir(): string;
  getFormatterSettings(): FormatterSettings | undefined;
  getDebugMode(): boolean;
}

export type FormatTrigger = 'write' | 'apply';

export interface FormatResult {
  ran: boolean;
  changed: boolean;
  formatterNames: string[];
  errors: string[];
  formattedContent?: string;
}

interface FormatterInfo {
  name: string;
  command: string[];
  environment?: Record<string, string>;
  extensions: string[];
  enabled: (context: FormatterContext) => Promise<boolean>;
}

const FORMATTER_CACHE = new WeakMap<FormatterContext, FormatterRegistry>();

function getRegistry(context: FormatterContext): FormatterRegistry {
  const existing = FORMATTER_CACHE.get(context);
  if (existing) {
    return existing;
  }
  const registry = new FormatterRegistry(context);
  FORMATTER_CACHE.set(context, registry);
  return registry;
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = spawnSync(checker, [command], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function findUp(startDir: string, fileName: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function findUpAny(startDir: string, fileNames: string[]): string | null {
  for (const name of fileNames) {
    const found = findUp(startDir, name);
    if (found) {
      return found;
    }
  }
  return null;
}

function hasPackageDependency(startDir: string, dependency: string): boolean {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf8');
        const json = JSON.parse(content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };
        if (
          json.dependencies?.[dependency] ||
          json.devDependencies?.[dependency] ||
          json.peerDependencies?.[dependency]
        ) {
          return true;
        }
      } catch {
        // Ignore malformed package.json files.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return false;
    }
    current = parent;
  }
}

function hasComposerDependency(startDir: string, dependency: string): boolean {
  const composerPath = findUp(startDir, 'composer.json');
  if (!composerPath) {
    return false;
  }
  try {
    const content = fs.readFileSync(composerPath, 'utf8');
    const json = JSON.parse(content) as {
      require?: Record<string, string>;
      'require-dev'?: Record<string, string>;
    };
    return Boolean(json.require?.[dependency] || json['require-dev']?.[dependency]);
  } catch {
    return false;
  }
}

function hasPyprojectToolSection(startDir: string, toolName: string): boolean {
  const pyprojectPath = findUp(startDir, 'pyproject.toml');
  if (!pyprojectPath) {
    return false;
  }
  try {
    const content = fs.readFileSync(pyprojectPath, 'utf8');
    return content.includes(`[tool.${toolName}]`);
  } catch {
    return false;
  }
}

function hasRuffConfig(startDir: string): boolean {
  const ruffConfig = findUpAny(startDir, ['ruff.toml', '.ruff.toml']);
  if (ruffConfig) {
    return true;
  }
  return hasPyprojectToolSection(startDir, 'ruff');
}

function getBuiltinFormatters(): FormatterInfo[] {
  const prettierExtensions = [
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.vue',
    '.svelte',
    '.json',
    '.jsonc',
    '.yaml',
    '.yml',
    '.toml',
    '.xml',
    '.md',
    '.mdx',
    '.graphql',
    '.gql',
  ];

  return [
    {
      name: 'gofmt',
      command: ['gofmt', '-w', '$FILE'],
      extensions: ['.go'],
      enabled: async () => commandExists('gofmt'),
    },
    {
      name: 'mix',
      command: ['mix', 'format', '$FILE'],
      extensions: ['.ex', '.exs', '.eex', '.heex', '.leex', '.neex', '.sface'],
      enabled: async () => commandExists('mix'),
    },
    {
      name: 'prettier',
      command: ['npx', '--no-install', 'prettier', '--write', '$FILE'],
      extensions: prettierExtensions,
      enabled: async (context) =>
        hasPackageDependency(context.getTargetDir(), 'prettier'),
    },
    {
      name: 'biome',
      command: ['npx', '--no-install', '@biomejs/biome', 'check', '--write', '$FILE'],
      extensions: prettierExtensions,
      enabled: async (context) =>
        Boolean(findUpAny(context.getTargetDir(), ['biome.json', 'biome.jsonc'])),
    },
    {
      name: 'zig',
      command: ['zig', 'fmt', '$FILE'],
      extensions: ['.zig', '.zon'],
      enabled: async () => commandExists('zig'),
    },
    {
      name: 'clang-format',
      command: ['clang-format', '-i', '$FILE'],
      extensions: [
        '.c',
        '.cc',
        '.cpp',
        '.cxx',
        '.c++',
        '.h',
        '.hh',
        '.hpp',
        '.hxx',
        '.h++',
        '.ino',
        '.C',
        '.H',
      ],
      enabled: async (context) =>
        Boolean(findUp(context.getTargetDir(), '.clang-format')),
    },
    {
      name: 'ktlint',
      command: ['ktlint', '-F', '$FILE'],
      extensions: ['.kt', '.kts'],
      enabled: async () => commandExists('ktlint'),
    },
    {
      name: 'ruff',
      command: ['ruff', 'format', '$FILE'],
      extensions: ['.py', '.pyi'],
      enabled: async (context) => commandExists('ruff') && hasRuffConfig(context.getTargetDir()),
    },
    {
      name: 'rustfmt',
      command: ['rustfmt', '$FILE'],
      extensions: ['.rs'],
      enabled: async () => commandExists('rustfmt'),
    },
    {
      name: 'cargofmt',
      command: ['cargo', 'fmt', '--', '$FILE'],
      extensions: ['.rs'],
      enabled: async () => commandExists('cargo') && !commandExists('rustfmt'),
    },
    {
      name: 'uv',
      command: ['uv', 'format', '--', '$FILE'],
      extensions: ['.py', '.pyi'],
      enabled: async (context) =>
        commandExists('uv') && !(commandExists('ruff') && hasRuffConfig(context.getTargetDir())),
    },
    {
      name: 'rubocop',
      command: ['rubocop', '-A', '$FILE'],
      extensions: ['.rb', '.rake', '.gemspec', '.ru'],
      enabled: async () => commandExists('rubocop'),
    },
    {
      name: 'standardrb',
      command: ['standardrb', '--fix', '$FILE'],
      extensions: ['.rb', '.rake', '.gemspec', '.ru'],
      enabled: async () => commandExists('standardrb'),
    },
    {
      name: 'htmlbeautifier',
      command: ['htmlbeautifier', '$FILE'],
      extensions: ['.erb', '.html.erb'],
      enabled: async () => commandExists('htmlbeautifier'),
    },
    {
      name: 'air',
      command: ['air', 'format', '$FILE'],
      extensions: ['.R'],
      enabled: async () => commandExists('air'),
    },
    {
      name: 'dart',
      command: ['dart', 'format', '$FILE'],
      extensions: ['.dart'],
      enabled: async () => commandExists('dart'),
    },
    {
      name: 'ocamlformat',
      command: ['ocamlformat', '-i', '$FILE'],
      extensions: ['.ml', '.mli'],
      enabled: async (context) =>
        commandExists('ocamlformat') && Boolean(findUp(context.getTargetDir(), '.ocamlformat')),
    },
    {
      name: 'terraform',
      command: ['terraform', 'fmt', '$FILE'],
      extensions: ['.tf', '.tfvars'],
      enabled: async () => commandExists('terraform'),
    },
    {
      name: 'gleam',
      command: ['gleam', 'format', '$FILE'],
      extensions: ['.gleam'],
      enabled: async () => commandExists('gleam'),
    },
    {
      name: 'nixfmt',
      command: ['nixfmt', '$FILE'],
      extensions: ['.nix'],
      enabled: async () => commandExists('nixfmt'),
    },
    {
      name: 'shfmt',
      command: ['shfmt', '-w', '$FILE'],
      extensions: ['.sh', '.bash'],
      enabled: async () => commandExists('shfmt'),
    },
    {
      name: 'pint',
      command: ['php', 'vendor/bin/pint', '$FILE'],
      extensions: ['.php'],
      enabled: async (context) =>
        hasComposerDependency(context.getTargetDir(), 'laravel/pint'),
    },
  ];
}

class FormatterRegistry {
  private readonly formatters: Record<string, FormatterInfo> = {};
  private readonly enabledCache = new Map<string, boolean>();

  constructor(private readonly context: FormatterContext) {
    const settings = context.getFormatterSettings();
    if (settings?.enabled === false) {
      return;
    }

    for (const formatter of getBuiltinFormatters()) {
      this.formatters[formatter.name] = formatter;
    }

    const overrides = settings?.formatters ?? {};
    for (const [name, override] of Object.entries(overrides)) {
      if (override?.disabled) {
        delete this.formatters[name];
        continue;
      }
      const base = this.formatters[name];
      const merged: FormatterInfo = {
        name,
        command: override.command ?? base?.command ?? [],
        environment: {
          ...(base?.environment ?? {}),
          ...(override.environment ?? {}),
        },
        extensions: override.extensions ?? base?.extensions ?? [],
        enabled: base?.enabled ?? (async () => true),
      };

      if (merged.command.length === 0) {
        continue;
      }
      this.formatters[name] = merged;
    }
  }

  async getFormattersForExtension(ext: string): Promise<FormatterInfo[]> {
    const result: FormatterInfo[] = [];
    for (const formatter of Object.values(this.formatters)) {
      if (!formatter.extensions.includes(ext)) {
        continue;
      }
      const enabled = await this.isEnabled(formatter);
      if (enabled) {
        result.push(formatter);
      }
    }
    return result;
  }

  private async isEnabled(formatter: FormatterInfo): Promise<boolean> {
    if (this.enabledCache.has(formatter.name)) {
      return this.enabledCache.get(formatter.name) as boolean;
    }
    try {
      const enabled = await formatter.enabled(this.context);
      this.enabledCache.set(formatter.name, enabled);
      return enabled;
    } catch {
      this.enabledCache.set(formatter.name, false);
      return false;
    }
  }
}

function shouldRunForTrigger(settings: FormatterSettings | undefined, trigger: FormatTrigger): boolean {
  if (settings?.enabled === false) {
    return false;
  }
  if (trigger === 'write') {
    return settings?.formatAfterWrite ?? true;
  }
  return settings?.formatAfterApply ?? true;
}

function resolveCommand(command: string[], filePath: string): string[] {
  return command.map((part) => part.replace('$FILE', filePath));
}

async function runFormatter(
  formatter: FormatterInfo,
  context: FormatterContext,
  filePath: string,
): Promise<{ status: number | null; error?: Error } | null> {
  const command = resolveCommand(formatter.command, filePath);
  if (command.length === 0) {
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: context.getTargetDir(),
      env: {
        ...process.env,
        ...formatter.environment,
      },
      stdio: 'ignore',
    });

    child.on('error', (error) => {
      resolve({ status: null, error });
    });

    child.on('close', (code) => {
      resolve({ status: code });
    });
  });
}

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function formatFile(
  context: FormatterContext,
  filePath: string,
  trigger: FormatTrigger,
  preFormatContent?: string,
): Promise<FormatResult> {
  const settings = context.getFormatterSettings();
  if (!shouldRunForTrigger(settings, trigger)) {
    return {
      ran: false,
      changed: false,
      formatterNames: [],
      errors: [],
    };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!ext) {
    return {
      ran: false,
      changed: false,
      formatterNames: [],
      errors: [],
    };
  }

  const registry = getRegistry(context);
  const formatters = await registry.getFormattersForExtension(ext);
  if (formatters.length === 0) {
    return {
      ran: false,
      changed: false,
      formatterNames: [],
      errors: [],
    };
  }

  const originalContent = preFormatContent ?? (await readFileContent(filePath));
  const formatterNames: string[] = [];
  const errors: string[] = [];
  let ran = false;

  for (const formatter of formatters) {
    ran = true;
    formatterNames.push(formatter.name);
    const result = await runFormatter(formatter, context, filePath);
    if (!result) {
      continue;
    }
    if (result.error || (result.status !== null && result.status !== 0)) {
      if (context.getDebugMode()) {
        errors.push(
          `Formatter ${formatter.name} failed for ${filePath} with exit code ${result.status ?? 'unknown'}.`,
        );
      }
    }
  }

  if (!ran) {
    return {
      ran: false,
      changed: false,
      formatterNames: [],
      errors: [],
    };
  }

  const updatedContent = await readFileContent(filePath);
  const changed =
    originalContent !== null && updatedContent !== null
      ? originalContent !== updatedContent
      : false;

  return {
    ran,
    changed,
    formatterNames,
    errors,
    formattedContent: changed ? updatedContent ?? undefined : undefined,
  };
}

export function formatFileAfterWrite(
  context: FormatterContext,
  filePath: string,
  preFormatContent?: string,
): Promise<FormatResult> {
  return formatFile(context, filePath, 'write', preFormatContent);
}

export function formatFileAfterApply(
  context: FormatterContext,
  filePath: string,
  preFormatContent?: string,
): Promise<FormatResult> {
  return formatFile(context, filePath, 'apply', preFormatContent);
}
