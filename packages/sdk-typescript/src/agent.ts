import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { findNativeCliPath, prepareSpawnInfo } from './utils/cliPath.js';

type ApprovalMode = 'default' | 'yolo' | 'auto-edit';
const SKILLS_PATHS_ENV = 'PAPERT_CODE_SKILLS_PATHS';

export interface PapertAgentOptions {
  /**
   * Path to the papert-code CLI entrypoint. Defaults to the package entry
   * resolved from Node (equivalent to `require.resolve('@papert-code/papert-code')`).
   */
  cliBinaryPath?: string;
  /**
   * Additional skill directories to load (same behavior as query()/createClient()).
   */
  skillsPath?: string | string[];
  /**
   * CLI arguments to seed the agent with (mirrors CLI flags).
   */
  cliArgs?: {
    model?: string;
    approvalMode?: ApprovalMode;
    baseUrl?: string;
    apiKey?: string;
    cwd?: string;
    extraArgs?: string[];
  };
}

export interface RunPromptOptions {
  /**
   * Additional CLI flags to append just for this prompt.
   */
  extraArgs?: string[];
  /**
   * AbortSignal to terminate the underlying process.
   */
  signal?: AbortSignal;
}

export interface PapertAgent {
  runPrompt: (
    prompt: string,
    options?: RunPromptOptions,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>;
}

function parseSkillsPathList(raw: string): string[] {
  const separator = new RegExp(`[${path.delimiter},]`);
  return raw.split(separator).map((entry) => entry.trim()).filter(Boolean);
}

function normalizeSkillsPaths(
  skillsPath: string | string[] | undefined,
  existingValue: string | undefined,
): string | undefined {
  const paths: string[] = [];
  if (existingValue) {
    paths.push(...parseSkillsPathList(existingValue));
  }
  if (skillsPath) {
    if (Array.isArray(skillsPath)) {
      paths.push(...skillsPath);
    } else {
      paths.push(skillsPath);
    }
  }
  const normalized = paths.map((entry) => entry.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return undefined;
  }
  return Array.from(new Set(normalized)).join(path.delimiter);
}

function resolveCliBinary(customPath?: string): string {
  if (customPath) return customPath;

  // Reuse the same robust auto-detection path used by query()/ProcessTransport.
  return findNativeCliPath();
}

/**
 * Lightweight programmatic wrapper around the papert-code CLI.
 *
 * Example:
 * const agent = await createPapertAgent({
 *   cliArgs: { model: 'gemini-3-pro', approvalMode: 'auto_edit' },
 * });
 * const result = await agent.runPrompt('Summarize outstanding TODOs');
 */
export async function createPapertAgent(
  options: PapertAgentOptions = {},
): Promise<PapertAgent> {
  const cliBinary = resolveCliBinary(options.cliBinaryPath);
  const {
    model,
    approvalMode,
    baseUrl,
    apiKey,
    cwd,
    extraArgs: defaultExtraArgs = [],
  } = options.cliArgs || {};
  const { skillsPath } = options;

  const baseArgs: string[] = [];
  if (model) {
    baseArgs.push('--model', model);
  }
  if (approvalMode) {
    baseArgs.push('--approval-mode', approvalMode);
  }
  if (baseUrl) {
    baseArgs.push('--openai-base-url', baseUrl);
  }

  const baseEnvOverrides: Record<string, string> = {};
  if (apiKey) {
    baseEnvOverrides['OPENAI_API_KEY'] = apiKey;
  }

  const runPrompt = async (
    prompt: string,
    options?: RunPromptOptions,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
    const env = { ...process.env, ...baseEnvOverrides };
    const skillsPaths = normalizeSkillsPaths(
      skillsPath,
      env[SKILLS_PATHS_ENV],
    );
    if (skillsPaths) {
      env[SKILLS_PATHS_ENV] = skillsPaths;
    }
    const spawnInfo = prepareSpawnInfo(cliBinary);
    const args = [
      ...spawnInfo.args,
      '--prompt',
      prompt,
      ...baseArgs,
      ...(defaultExtraArgs || []),
      ...(options?.extraArgs || []),
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(spawnInfo.command, args, {
        cwd: cwd || process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (options?.signal) {
        if (options.signal.aborted) {
          child.kill('SIGTERM');
        } else {
          options.signal.addEventListener('abort', () => {
            child.kill('SIGTERM');
          });
        }
      }

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });
    });
  };

  return { runPrompt };
}
