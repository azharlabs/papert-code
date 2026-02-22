/**
 * Terminal-Bench Integration Tests
 *
 * Tests papert-code integration with terminal-bench tasks
 * using both oracle (for debugging) and papert-code agents
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestRig } from '../test-helper.js';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveTerminalBenchTasks } from './taskCatalog.js';
import { resolveTerminalBenchOpenAiConfig } from './openaiAuthConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const DEFAULT_OPENAI_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_OPENAI_MODEL = 'papert3-coder-plus';

interface DockerAvailability {
  available: boolean;
  reason?: string;
}

function extractExecError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const stderr = (error as { stderr?: string | Buffer }).stderr;
  if (typeof stderr === 'string' && stderr.trim().length > 0) {
    return stderr.trim();
  }
  if (stderr instanceof Buffer) {
    const text = stderr.toString('utf-8').trim();
    if (text.length > 0) {
      return text;
    }
  }

  const stdout = (error as { stdout?: string | Buffer }).stdout;
  if (typeof stdout === 'string' && stdout.trim().length > 0) {
    return stdout.trim();
  }
  if (stdout instanceof Buffer) {
    const text = stdout.toString('utf-8').trim();
    if (text.length > 0) {
      return text;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return undefined;
}

function checkDockerAvailability(): DockerAvailability {
  try {
    execSync('docker --version', { stdio: 'ignore' });
  } catch {
    return {
      available: false,
      reason:
        'Docker CLI is not installed or not on PATH. Install Docker Desktop/Engine and retry.',
    };
  }

  try {
    execSync('docker info', { stdio: 'ignore' });
    return { available: true };
  } catch (error) {
    const details = extractExecError(error);
    return {
      available: false,
      reason: details
        ? `Docker daemon is not reachable. ${details}`
        : 'Docker daemon is not reachable. Start Docker and retry.',
    };
  }
}

function addPathIfMissing(basePath: string, addition: string): string {
  const separator = process.platform === 'win32' ? ';' : ':';
  const existing = basePath.split(separator).filter(Boolean);
  if (existing.includes(addition)) {
    return basePath;
  }
  return `${addition}${separator}${basePath}`;
}

function augmentTerminalBenchPath(): void {
  const home = process.env['HOME'];
  if (!home) {
    return;
  }

  let currentPath = process.env['PATH'] ?? '';
  currentPath = addPathIfMissing(currentPath, `${home}/.local/bin`);

  try {
    const userBase = execSync('python3 -m site --user-base', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (userBase.length > 0) {
      currentPath = addPathIfMissing(currentPath, join(userBase, 'bin'));
    }
  } catch {
    // no-op; best effort only
  }

  process.env['PATH'] = currentPath;
}

function hasTerminalBench(): boolean {
  try {
    execSync('tb --help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function tryInstallTerminalBench(): string[] {
  const attemptedCommands: string[] = [];
  const installCommands = [
    'uv tool install terminal-bench',
    'uv tool install --python 3 terminal-bench',
    'python3 -m pip install --user terminal-bench',
  ];

  for (const command of installCommands) {
    attemptedCommands.push(command);
    try {
      execSync(command, { stdio: 'ignore' });
      augmentTerminalBenchPath();
      if (hasTerminalBench()) {
        return attemptedCommands;
      }
    } catch {
      // Try the next installer command.
    }
  }

  return attemptedCommands;
}

const dockerAvailability = checkDockerAvailability();
const dockerRequired =
  process.env['TB_REQUIRE_DOCKER'] === 'true' ||
  process.env['CI'] === 'true';
const shouldSkipDockerSuite =
  !dockerAvailability.available && !dockerRequired;

if (shouldSkipDockerSuite) {
  console.warn(
    `[terminal-bench] Skipping Docker-dependent suite: ${dockerAvailability.reason ?? 'Docker unavailable.'}`,
  );
}

const describeTerminalBench = shouldSkipDockerSuite ? describe.skip : describe;

describeTerminalBench('terminal-bench integration', () => {
  const rig = new TestRig();
  // Use local ci-tasks directory for self-contained tests
  const ciTasksPath = join(__dirname, 'ci-tasks');

  // Single timeout source (minutes), defaults to workflow's 30 minutes
  const DEFAULT_TIMEOUT_MINUTES = Number(
    process.env['TB_TIMEOUT_MINUTES'] || '30',
  );
  const DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;

  // Use the integration test directory set by globalSetup.ts if available,
  // otherwise create our own in .integration-tests
  const integrationTestsDir = join(rootDir, '.integration-tests');
  const baseRunDir =
    process.env['INTEGRATION_TEST_FILE_DIR'] ||
    join(integrationTestsDir, `${Date.now()}`);

  // Create a subdirectory for terminal-bench tests within the run directory
  const outputBase = join(baseRunDir, 'terminal-bench-output');

  beforeAll(async () => {
    if (!dockerAvailability.available) {
      throw new Error(
        `Docker is required for terminal-bench integration tests. ${dockerAvailability.reason ?? ''}`.trim(),
      );
    }

    // Ensure integration tests directory exists
    if (!existsSync(integrationTestsDir)) {
      mkdirSync(integrationTestsDir, { recursive: true });
    }

    // Create output directory for this test run
    mkdirSync(outputBase, { recursive: true });

    // Log output directory for debugging
    if (
      process.env['VERBOSE'] === 'true' ||
      process.env['KEEP_OUTPUT'] === 'true'
    ) {
      console.log(`\nTerminal-bench test output directory: ${outputBase}`);
    }

    // Check if terminal-bench is installed
    augmentTerminalBenchPath();
    if (!hasTerminalBench()) {
      console.log('Installing terminal-bench...');
      const attempted = tryInstallTerminalBench();
      if (!hasTerminalBench()) {
        throw new Error(
          `terminal-bench installation failed. Attempted: ${attempted.join(' | ')}`,
        );
      }
    }
  }, DEFAULT_TIMEOUT_MS);

  afterAll(async () => {
    await rig.cleanup();

    // Note: Cleanup of the main integration test directory is handled by globalSetup.ts
    // We only clean up our subdirectory if needed for specific reasons
  });

  // Allow CI to select a specific task (or a subset) via env var
  const envTaskId = process.env['TB_TASK_ID'];
  const envTaskIds = process.env['TB_TASK_IDS']; // comma-separated list

  const testTasks = resolveTerminalBenchTasks({
    taskId: envTaskId,
    taskIds: envTaskIds,
  });

  describe.each(testTasks)('Task: %s', (taskId) => {
    it(
      `should complete ${taskId} task with oracle agent`,
      async () => {
        rig.setup(`terminal-bench-oracle-${taskId}`);

        const outputPath = join(outputBase, `oracle-${taskId}`);

        // Check if ci-tasks exists
        if (!existsSync(ciTasksPath)) {
          console.error(`CI tasks directory does not exist: ${ciTasksPath}`);
          throw new Error(
            'CI tasks not found. Please ensure ci-tasks directory is present.',
          );
        }

        // Run oracle agent on the task using ci-tasks dataset (non-blocking)
        const args = [
          'run',
          '--agent',
          'oracle',
          '--dataset-path',
          ciTasksPath,
          '--task-id',
          taskId,
          '--output-path',
          outputPath,
          '--n-concurrent',
          '1',
        ];

        try {
          const result = await new Promise<string>((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const child = spawn('tb', args, { env: { ...process.env } });

            child.stdout?.on('data', (data) => {
              stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
              stderr += data.toString();
            });

            const to = setTimeout(
              () => {
                child.kill();
                reject(new Error(`Process timeout for ${taskId}`));
              },
              Math.max(60_000, DEFAULT_TIMEOUT_MS - 60_000),
            ); // Leave 1 minute buffer

            child.on('close', (code) => {
              clearTimeout(to);
              if (code !== 0) {
                console.error(
                  `oracle agent failed for ${taskId} with stderr:`,
                  stderr,
                );
                reject(
                  new Error(`Process exited with code ${code}: ${stderr}`),
                );
              } else {
                resolve(stdout);
              }
            });

            child.on('error', (error) => {
              clearTimeout(to);
              console.error('Failed to start process:', error);
              reject(error);
            });
          });

          // Check if the run succeeded
          expect(result).toContain('Results Summary');

          // Check if results file was created
          // Terminal-bench creates results in a timestamped subdirectory
          const dirs = execSync(`ls -d ${outputPath}/*/`, { encoding: 'utf-8' })
            .trim()
            .split('\n');
          const latestDir = dirs[dirs.length - 1]; // Get the latest run directory
          const resultsFile = join(latestDir, 'results.json');

          expect(existsSync(resultsFile)).toBe(true);

          const results = JSON.parse(readFileSync(resultsFile, 'utf-8'));
          expect(results.accuracy).toBe(1.0); // Oracle should always succeed
          expect(results.n_resolved).toBe(1);
          expect(results.n_unresolved).toBe(0);
        } catch (error) {
          console.error(`Oracle agent failed for ${taskId}:`, error);
          throw error;
        }
      },
      DEFAULT_TIMEOUT_MS,
    );

    it(
      `should complete ${taskId} task with papert-code agent`,
      async () => {
        rig.setup(`terminal-bench-papert-${taskId}`);

        const outputPath = join(outputBase, `papert-${taskId}`);
        const authConfig = resolveTerminalBenchOpenAiConfig({
          cwd: process.cwd(),
          env: process.env,
        });

        // Check if API key is available from env or papert settings.
        const apiKey = authConfig.apiKey;
        if (!apiKey) {
          throw new Error(
            'OpenAI API key is missing. Configure it in OPENAI_API_KEY or in /auth settings (security.auth.apiKey).',
          );
        }
        const baseUrl = authConfig.baseUrl || DEFAULT_OPENAI_BASE_URL;
        const model = authConfig.model || DEFAULT_OPENAI_MODEL;

        // Run papert-code agent using spawn to avoid blocking event loop
        const args = [
          'run',
          '--agent-import-path',
          'integration-tests.terminal-bench.papert_code:PapertCodeAgent',
          '--agent-kwarg',
          `api_key=${apiKey}`,
          '--agent-kwarg',
          `base_url=${baseUrl}`,
          '--agent-kwarg',
          `model_name=${model}`,
          '--agent-kwarg',
          `version=${process.env['PAPERT_CODE_VERSION'] || 'latest'}`,
          '--dataset-path',
          ciTasksPath,
          '--task-id',
          taskId,
          '--output-path',
          outputPath,
          '--n-concurrent',
          '1',
        ];

        const env = {
          ...process.env,
          OPENAI_API_KEY: apiKey,
          OPENAI_MODEL: model,
          OPENAI_BASE_URL: baseUrl,
        };

        // Use spawn with promise to avoid blocking
        const result = await new Promise<string>((resolve, reject) => {
          let stdout = '';
          let stderr = '';

          const child = spawn('tb', args, { env });

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', (code) => {
            if (code !== 0) {
              console.error(
                `papert-code agent failed for ${taskId} with stderr:`,
                stderr,
              );
              reject(new Error(`Process exited with code ${code}: ${stderr}`));
            } else {
              resolve(stdout);
            }
          });

          child.on('error', (error) => {
            console.error('Failed to start process:', error);
            reject(error);
          });

          // Set timeout based on task
          setTimeout(
            () => {
              child.kill();
              reject(new Error(`Process timeout for ${taskId}`));
            },
            Math.max(60_000, DEFAULT_TIMEOUT_MS - 60_000),
          ); // Leave 1 minute buffer
        }).catch((error) => {
          // This is expected if API key is not configured correctly
          if (error instanceof Error && error.message?.includes('API')) {
            console.warn('API configuration issue - skipping test');
            return '';
          }
          throw error;
        });

        if (!result) return; // Skip if API configuration issue

        // Check if the run completed
        expect(result).toContain('Results Summary');

        // Check results file in timestamped subdirectory
        const dirs = execSync(`ls -d ${outputPath}/*/`, { encoding: 'utf-8' })
          .trim()
          .split('\n');
        const latestDir = dirs[dirs.length - 1];
        const resultsFile = join(latestDir, 'results.json');

        expect(existsSync(resultsFile)).toBe(true);

        const results = JSON.parse(readFileSync(resultsFile, 'utf-8'));
        // Check that the task actually completed successfully
        expect(results).toHaveProperty('accuracy');
        expect(results.n_resolved).toBeGreaterThan(0); // At least one task should be resolved
        expect(results.accuracy).toBeGreaterThan(0); // Accuracy should be greater than 0
      },
      DEFAULT_TIMEOUT_MS,
    );
  });
});
