/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandModule } from 'yargs';

interface MigrateArgs {
  fromGemini?: boolean;
  dryRun?: boolean;
}

export interface FileMigrationResult {
  filePath: string;
  replacements: number;
  legacyVariables: string[];
}

export interface GeminiEnvMigrationResult {
  dryRun: boolean;
  scannedFiles: string[];
  updatedFiles: FileMigrationResult[];
  totalReplacements: number;
}

const GEMINI_TO_PAPERT_ENV_MAP: Readonly<Record<string, string>> = {
  GEMINI_CLI_NO_RELAUNCH: 'PAPERT_CLI_NO_RELAUNCH',
  GEMINI_CLI_TRUSTED_FOLDERS_PATH: 'PAPERT_CLI_TRUSTED_FOLDERS_PATH',
  GEMINI_SANDBOX: 'PAPERT_SANDBOX',
  GEMINI_SANDBOX_IMAGE: 'PAPERT_SANDBOX_IMAGE',
  GEMINI_SANDBOX_PROXY_COMMAND: 'PAPERT_SANDBOX_PROXY_COMMAND',
  GEMINI_TELEMETRY_ENABLED: 'PAPERT_TELEMETRY_ENABLED',
  GEMINI_TELEMETRY_LOG_PROMPTS: 'PAPERT_TELEMETRY_LOG_PROMPTS',
  GEMINI_TELEMETRY_OTLP_ENDPOINT: 'PAPERT_TELEMETRY_OTLP_ENDPOINT',
  GEMINI_TELEMETRY_OTLP_PROTOCOL: 'PAPERT_TELEMETRY_OTLP_PROTOCOL',
  GEMINI_TELEMETRY_OUTFILE: 'PAPERT_TELEMETRY_OUTFILE',
  GEMINI_TELEMETRY_TARGET: 'PAPERT_TELEMETRY_TARGET',
  GEMINI_TELEMETRY_USE_COLLECTOR: 'PAPERT_TELEMETRY_USE_COLLECTOR',
  GEMINI_YOLO_MODE: 'PAPERT_YOLO_MODE',
};

const CANDIDATE_FILES = [
  '.env',
  '.papert/.env',
  '.papert/settings.json',
  '.papert/settings.local.json',
  '.papert/hooks.json',
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteLegacyGeminiEnvNames(content: string): {
  updatedContent: string;
  replacements: number;
  legacyVariables: string[];
} {
  let updatedContent = content;
  let replacements = 0;
  const legacyVariables: string[] = [];

  for (const [legacyName, canonicalName] of Object.entries(
    GEMINI_TO_PAPERT_ENV_MAP,
  )) {
    const pattern = new RegExp(`\\b${escapeRegExp(legacyName)}\\b`, 'g');
    const matches = updatedContent.match(pattern);
    if (!matches) {
      continue;
    }
    replacements += matches.length;
    legacyVariables.push(legacyName);
    updatedContent = updatedContent.replaceAll(pattern, canonicalName);
  }

  return { updatedContent, replacements, legacyVariables };
}

function discoverMigrationTargets(rootDir: string): string[] {
  const targets = new Set<string>();

  for (const relativePath of CANDIDATE_FILES) {
    const absolutePath = path.join(rootDir, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      targets.add(absolutePath);
    }
  }

  const workflowsDir = path.join(rootDir, '.github', 'workflows');
  if (fs.existsSync(workflowsDir) && fs.statSync(workflowsDir).isDirectory()) {
    for (const fileName of fs.readdirSync(workflowsDir)) {
      if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
        continue;
      }
      const absolutePath = path.join(workflowsDir, fileName);
      if (fs.statSync(absolutePath).isFile()) {
        targets.add(absolutePath);
      }
    }
  }

  return [...targets];
}

export function migrateGeminiEnvNames(
  rootDir: string,
  options: { dryRun?: boolean } = {},
): GeminiEnvMigrationResult {
  const dryRun = options.dryRun ?? false;
  const scannedFiles = discoverMigrationTargets(rootDir);
  const updatedFiles: FileMigrationResult[] = [];

  for (const filePath of scannedFiles) {
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const { updatedContent, replacements, legacyVariables } =
      rewriteLegacyGeminiEnvNames(originalContent);

    if (replacements === 0) {
      continue;
    }

    if (!dryRun) {
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
    }

    updatedFiles.push({
      filePath,
      replacements,
      legacyVariables,
    });
  }

  const totalReplacements = updatedFiles.reduce(
    (sum, fileResult) => sum + fileResult.replacements,
    0,
  );

  return {
    dryRun,
    scannedFiles,
    updatedFiles,
    totalReplacements,
  };
}

function printMigrationResult(result: GeminiEnvMigrationResult, cwd: string) {
  if (result.updatedFiles.length === 0) {
    console.log('No legacy GEMINI_* env references found in migration targets.');
    return;
  }

  for (const fileResult of result.updatedFiles) {
    const relativePath = path.relative(cwd, fileResult.filePath) || '.';
    const vars = fileResult.legacyVariables.join(', ');
    const prefix = result.dryRun ? '[dry-run] ' : '';
    console.log(
      `${prefix}Updated ${relativePath} (${fileResult.replacements} replacements: ${vars})`,
    );
  }

  const summaryPrefix = result.dryRun ? '[dry-run] ' : '';
  console.log(
    `${summaryPrefix}Migration complete. ${result.updatedFiles.length} file(s) updated, ${result.totalReplacements} replacement(s).`,
  );
}

export const migrateCommand: CommandModule = {
  command: 'migrate',
  describe: 'Migrate legacy Gemini-named configuration usage to Papert naming',
  builder: (yargs) =>
    yargs
      .option('from-gemini', {
        describe: 'Rewrite legacy GEMINI_* env usage to PAPERT_* names',
        type: 'boolean',
        default: false,
      })
      .option('dry-run', {
        describe: 'Show planned changes without writing files',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    const args = argv as unknown as MigrateArgs;

    if (!args.fromGemini) {
      console.log(
        'Usage: papert migrate --from-gemini [--dry-run]\n\nRewrites legacy GEMINI_* environment variable names in project config files to PAPERT_* names.',
      );
      return;
    }

    const result = migrateGeminiEnvNames(process.cwd(), {
      dryRun: args.dryRun,
    });
    printMigrationResult(result, process.cwd());
  },
};

