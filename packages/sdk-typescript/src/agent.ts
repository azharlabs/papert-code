import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

type ApprovalMode = 'default' | 'yolo' | 'auto-edit';

export interface PapertAgentOptions {
  /**
   * Path to the papert-code CLI entrypoint. Defaults to the package entry
   * resolved from Node (equivalent to `require.resolve('@papert-code/papert-code')`).
   */
  cliBinaryPath?: string;
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

function resolveCliBinary(customPath?: string): string {
  if (customPath) return customPath;

  // Use the module location when available (works in ESM/CJS after build).
  let moduleDir: string;
  try {
     
    const url = new URL(import.meta.url);
    moduleDir = path.dirname(url.pathname);
  } catch {
    // Fallback for older runtimes/tooling that lack import.meta.url
    const syntheticModuleUrl = new URL(
      'file:///papert-sdk-agent-entrypoint.js',
    );
    moduleDir = path.dirname(syntheticModuleUrl.pathname);
  }

  const require = createRequire(moduleDir);

  // Try resolving the installed CLI first.
  try {
    const resolved = require.resolve('@papert-code/papert-code');
    return path.resolve(resolved);
  } catch {
    // Fallback: use monorepo-relative CLI dist (../../cli/dist/index.js from dist folder)
    const fallback = path.resolve(
      moduleDir,
      '..',
      '..',
      'cli',
      'dist',
      'index.js',
    );
    return fallback;
  }
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
    const args = [
      cliBinary,
      '--prompt',
      prompt,
      ...baseArgs,
      ...(defaultExtraArgs || []),
      ...(options?.extraArgs || []),
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('node', args, {
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
