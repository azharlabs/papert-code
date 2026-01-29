/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Storage } from '../config/storage.js';

export interface LspDetectContext {
  filePath: string;
  projectRoot: string;
}

export interface LspCommandResolution {
  command: string[];
  source: 'path' | 'install';
}

export interface BuiltInLspServer {
  id: string;
  label: string;
  extensions: string[];
  command: string[];
  env?: Record<string, string>;
  initialization?: unknown;
  detect?: (context: LspDetectContext) => Promise<boolean> | boolean;
  npm?: {
    packages: string[];
  };
  installHint?: string;
}

const NPM_PACKAGES_DIR = path.join(Storage.getGlobalLspDir(), 'npm');

function normalizeExtension(ext: string): string {
  if (!ext) return ext;
  return ext.startsWith('.') ? ext : `.${ext}`;
}

function ensureDirExists(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function splitPathList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(path.delimiter).filter(Boolean);
}

function getExecutableCandidates(command: string): string[] {
  if (process.platform !== 'win32') return [command];
  const extensions = ['.exe', '.cmd', '.bat', ''];
  if (path.extname(command)) return [command];
  return extensions.map((ext) => `${command}${ext}`);
}

function findExecutableInDir(command: string, dir: string): string | null {
  const candidates = getExecutableCandidates(command);
  for (const candidate of candidates) {
    const fullPath = path.join(dir, candidate);
    try {
      if (fs.statSync(fullPath).isFile()) {
        return fullPath;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function findExecutable(command: string): string | null {
  if (!command) return null;
  if (path.isAbsolute(command)) {
    return fs.existsSync(command) ? command : null;
  }
  const pathEntries = splitPathList(process.env['PATH']);
  for (const entry of pathEntries) {
    const resolved = findExecutableInDir(command, entry);
    if (resolved) return resolved;
  }
  return null;
}

function getNpmBinDir(): string {
  return path.join(NPM_PACKAGES_DIR, 'node_modules', '.bin');
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
      windowsHide: true,
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      }
    });
  });
}

async function installNpmPackages(packages: string[]): Promise<boolean> {
  const npm = findExecutable('npm');
  if (!npm) return false;
  ensureDirExists(NPM_PACKAGES_DIR);
  const args = [
    'install',
    '--no-fund',
    '--no-audit',
    '--prefix',
    NPM_PACKAGES_DIR,
    ...packages,
  ];
  await runCommand(npm, args, NPM_PACKAGES_DIR);
  return true;
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findUp(
  startDir: string,
  stopDir: string,
  candidates: string[],
): string | null {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopDir);

  while (true) {
    for (const candidate of candidates) {
      const target = path.join(current, candidate);
      if (fileExists(target)) return target;
    }
    if (current === stop) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function hasProjectFile(
  context: LspDetectContext,
  candidates: string[],
): boolean {
  const startDir = path.dirname(context.filePath);
  return !!findUp(startDir, context.projectRoot, candidates);
}

export const BUILTIN_LSP_SERVERS: BuiltInLspServer[] = [
  {
    id: 'deno',
    label: 'Deno',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
    command: ['deno', 'lsp'],
    detect: (context) =>
      hasProjectFile(context, ['deno.json', 'deno.jsonc']),
    installHint: 'Install Deno and ensure `deno` is on PATH.',
  },
  {
    id: 'typescript',
    label: 'TypeScript/JavaScript',
    extensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.mts',
      '.cts',
    ],
    command: ['typescript-language-server', '--stdio'],
    npm: {
      packages: ['typescript', 'typescript-language-server'],
    },
    installHint:
      'npm install -g typescript typescript-language-server',
  },
  {
    id: 'astro',
    label: 'Astro',
    extensions: ['.astro'],
    command: ['astro-ls', '--stdio'],
    npm: {
      packages: ['@astrojs/language-server', 'typescript'],
    },
    installHint: 'npm install -g @astrojs/language-server typescript',
  },
  {
    id: 'vue',
    label: 'Vue',
    extensions: ['.vue'],
    command: ['vue-language-server', '--stdio'],
    npm: {
      packages: ['@vue/language-server'],
    },
    installHint: 'npm install -g @vue/language-server',
  },
  {
    id: 'svelte',
    label: 'Svelte',
    extensions: ['.svelte'],
    command: ['svelteserver', '--stdio'],
    npm: {
      packages: ['svelte-language-server'],
    },
    installHint: 'npm install -g svelte-language-server',
  },
  {
    id: 'bash',
    label: 'Bash',
    extensions: ['.sh', '.bash', '.zsh', '.ksh'],
    command: ['bash-language-server', 'start'],
    npm: {
      packages: ['bash-language-server'],
    },
    installHint: 'npm install -g bash-language-server',
  },
  {
    id: 'yaml-ls',
    label: 'YAML',
    extensions: ['.yaml', '.yml'],
    command: ['yaml-language-server', '--stdio'],
    npm: {
      packages: ['yaml-language-server'],
    },
    installHint: 'npm install -g yaml-language-server',
  },
  {
    id: 'pyright',
    label: 'Pyright',
    extensions: ['.py', '.pyi'],
    command: ['pyright-langserver', '--stdio'],
    npm: {
      packages: ['pyright'],
    },
    installHint: 'npm install -g pyright',
  },
  {
    id: 'php-intelephense',
    label: 'PHP Intelephense',
    extensions: ['.php'],
    command: ['intelephense', '--stdio'],
    npm: {
      packages: ['intelephense'],
    },
    installHint: 'npm install -g intelephense',
  },
  {
    id: 'gopls',
    label: 'Go',
    extensions: ['.go'],
    command: ['gopls'],
    installHint: 'Install gopls via `go install golang.org/x/tools/gopls@latest`.',
  },
  {
    id: 'rust-analyzer',
    label: 'Rust',
    extensions: ['.rs'],
    command: ['rust-analyzer'],
    installHint: 'Install rust-analyzer and ensure it is on PATH.',
  },
  {
    id: 'clangd',
    label: 'C/C++ (clangd)',
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
    ],
    command: ['clangd', '--stdio'],
    installHint: 'Install clangd and ensure it is on PATH.',
  },
  {
    id: 'prisma',
    label: 'Prisma',
    extensions: ['.prisma'],
    command: ['prisma-language-server', '--stdio'],
    installHint: 'Install Prisma language server and ensure it is on PATH.',
  },
  {
    id: 'dart',
    label: 'Dart',
    extensions: ['.dart'],
    command: ['dart', 'language-server', '--stdio'],
    installHint: 'Install Dart SDK and ensure `dart` is on PATH.',
  },
  {
    id: 'ruby-lsp',
    label: 'Ruby LSP',
    extensions: ['.rb', '.rake', '.gemspec', '.ru'],
    command: ['ruby-lsp'],
    installHint: 'Install ruby-lsp via `gem install ruby-lsp`.',
  },
];

export function getBuiltInLspServers(): BuiltInLspServer[] {
  return BUILTIN_LSP_SERVERS.map((server) => ({
    ...server,
    extensions: server.extensions.map(normalizeExtension),
  }));
}

export async function resolveBuiltInCommand(
  server: BuiltInLspServer,
  allowInstall: boolean,
): Promise<LspCommandResolution | null> {
  const binDir = getNpmBinDir();
  const commandName = server.command[0];

  const pathExecutable = findExecutable(commandName);
  if (pathExecutable) {
    return {
      command: [pathExecutable, ...server.command.slice(1)],
      source: 'path',
    };
  }

  const localExecutable = findExecutableInDir(commandName, binDir);
  if (localExecutable) {
    return {
      command: [localExecutable, ...server.command.slice(1)],
      source: 'install',
    };
  }

  if (allowInstall && server.npm) {
    await installNpmPackages(server.npm.packages);
    const installedExecutable = findExecutableInDir(commandName, binDir);
    if (installedExecutable) {
      return {
        command: [installedExecutable, ...server.command.slice(1)],
        source: 'install',
      };
    }
  }

  return null;
}

export function getLspInstallRoot(): string {
  return Storage.getGlobalLspDir();
}
