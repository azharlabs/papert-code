#!/usr/bin/env node

/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const BUILTIN_LOADER_PATH = path.join(
  ROOT,
  'packages/cli/src/services/BuiltinCommandLoader.ts',
);
const COMMANDS_DOC_PATH = path.join(ROOT, 'docs/cli/commands.md');

const SECTION_START = '<!-- BEGIN AUTO-GENERATED BUILTIN COMMAND INDEX -->';
const SECTION_END = '<!-- END AUTO-GENERATED BUILTIN COMMAND INDEX -->';

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function parseImportedCommandFiles(source) {
  const commandFilesBySymbol = new Map();
  const importRegex =
    /import\s*\{([^}]+)\}\s*from\s*'\.\.\/ui\/commands\/([^']+)\.js';/g;

  for (const match of source.matchAll(importRegex)) {
    const symbols = match[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const relativeFilePath = `packages/cli/src/ui/commands/${match[2]}.ts`;

    for (const symbol of symbols) {
      commandFilesBySymbol.set(symbol, relativeFilePath);
    }
  }

  return commandFilesBySymbol;
}

function parseBuiltinCommandSymbols(source) {
  const arrayMatch = source.match(
    /const allDefinitions:[\s\S]*?=\s*\[([\s\S]*?)\];/,
  );
  if (!arrayMatch) {
    throw new Error('Failed to locate allDefinitions array in BuiltinCommandLoader.ts');
  }

  const symbols = new Set();
  const symbolRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  for (const match of arrayMatch[1].matchAll(symbolRegex)) {
    const symbol = match[1];
    if (symbol.endsWith('Command') || symbol === 'ideCommand' || symbol === 'restoreCommand') {
      symbols.add(symbol);
    }
  }

  return [...symbols];
}

function extractCommandNameFromFile(source, symbol) {
  const exportedSymbolNameRegex = new RegExp(
    `export\\s+const\\s+${symbol}\\b[\\s\\S]*?name\\s*:\\s*'([^']+)'`,
  );
  const symbolMatch = source.match(exportedSymbolNameRegex);
  if (symbolMatch) {
    return symbolMatch[1];
  }

  const fallbackNameMatch = source.match(/name\s*:\s*'([^']+)'/);
  if (fallbackNameMatch) {
    return fallbackNameMatch[1];
  }

  return null;
}

function fallbackCommandName(symbol) {
  const specialCases = {
    quitConfirmCommand: 'quit-confirm',
    terminalSetupCommand: 'terminal-setup',
    ideCommand: 'ide',
    restoreCommand: 'restore',
  };

  if (specialCases[symbol]) {
    return specialCases[symbol];
  }

  if (symbol.endsWith('Command')) {
    return toKebabCase(symbol.slice(0, -'Command'.length));
  }

  return toKebabCase(symbol);
}

export async function getBuiltinSlashCommandNames({
  loaderSource,
  fileReader,
}) {
  const commandFilesBySymbol = parseImportedCommandFiles(loaderSource);
  const symbols = parseBuiltinCommandSymbols(loaderSource);

  const names = new Set();
  for (const symbol of symbols) {
    const relativeFilePath = commandFilesBySymbol.get(symbol);
    let name = null;

    if (relativeFilePath) {
      const fileSource = await fileReader(relativeFilePath);
      name = extractCommandNameFromFile(fileSource, symbol);
    }

    if (!name) {
      name = fallbackCommandName(symbol);
    }

    names.add(name);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

export function renderCommandIndexSection(commandNames) {
  const lines = [
    SECTION_START,
    '',
    '### Built-in Slash Command Index (Auto-Generated)',
    '',
    'The list below is generated from `packages/cli/src/services/BuiltinCommandLoader.ts`.',
    'Do not edit manually. Run `npm run docs:commands:sync` to refresh.',
    '',
    ...commandNames.map((name) => `- \`/${name}\``),
    '',
    SECTION_END,
  ];

  return `${lines.join('\n')}\n`;
}

export function upsertGeneratedSection(docContent, generatedSection) {
  const escapedStart = SECTION_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = SECTION_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`, 'm');

  if (sectionRegex.test(docContent)) {
    return docContent.replace(sectionRegex, generatedSection);
  }

  return `${generatedSection}\n${docContent}`;
}

export async function generateParityArtifacts() {
  const loaderSource = await fs.readFile(BUILTIN_LOADER_PATH, 'utf8');
  const names = await getBuiltinSlashCommandNames({
    loaderSource,
    fileReader: async (relativeFilePath) => {
      const absolutePath = path.join(ROOT, relativeFilePath);
      const candidatePaths = [absolutePath];
      if (relativeFilePath.endsWith('.ts')) {
        candidatePaths.push(absolutePath.replace(/\.ts$/, '.tsx'));
      }

      let lastError;
      for (const candidatePath of candidatePaths) {
        try {
          return await fs.readFile(candidatePath, 'utf8');
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    },
  });

  const generatedSection = renderCommandIndexSection(names);
  const existingDoc = await fs.readFile(COMMANDS_DOC_PATH, 'utf8');
  const updatedDoc = upsertGeneratedSection(existingDoc, generatedSection);

  return {
    names,
    generatedSection,
    existingDoc,
    updatedDoc,
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeMode = args.has('--write');
  const checkMode = args.has('--check');

  if (!writeMode && !checkMode) {
    console.error('Usage: node scripts/command-doc-parity.mjs --write | --check');
    process.exit(1);
  }

  const { names, existingDoc, updatedDoc } = await generateParityArtifacts();

  if (writeMode) {
    await fs.writeFile(COMMANDS_DOC_PATH, updatedDoc, 'utf8');
    console.log(`Updated docs/cli/commands.md with ${names.length} built-in commands.`);
    return;
  }

  if (existingDoc !== updatedDoc) {
    console.error('Built-in command docs are out of date.');
    console.error('Run: npm run docs:commands:sync');
    process.exit(1);
  }

  console.log(`Built-in command docs are in sync (${names.length} commands).`);
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
