/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';

import type { AgentCard, Message } from '@a2a-js/sdk';
import type { TaskStore } from '@a2a-js/sdk/server';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  DefaultExecutionEventBus,
  type AgentExecutionEvent,
} from '@a2a-js/sdk/server';
import { A2AExpressApp } from '@a2a-js/sdk/server/express'; // Import server components
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type { AgentSettings } from '../types.js';
import { GCSTaskStore, NoOpTaskStore } from '../persistence/gcs.js';
import { CoderAgentExecutor } from '../agent/executor.js';
import { requestStorage } from './requestStorage.js';
import { loadConfig, loadEnvironment, setTargetDir } from '../config/config.js';
import { loadSettings } from '../config/settings.js';
import { loadExtensions } from '../config/extension.js';
import { commandRegistry } from '../commands/command-registry.js';
import { debugLogger } from '@papert-code/papert-code-core';
import type { Command, CommandArgument } from '../commands/types.js';
import { GitService } from '@papert-code/papert-code-core';
import { RemoteSessionStore, type RemoteAuthConfig } from './remoteAuth.js';
import { createRemoteAuthMiddleware, createRemoteRouter } from './remoteRoutes.js';
import { createShareRouter } from './shareRoutes.js';
import { apiReference } from '@scalar/express-api-reference';
import { getWebUiHtml } from './webUi.js';
import { ShareStore } from './shareStore.js';
import { Storage } from '@papert-code/papert-code-core';
import { REMOTE_CONTROL_OPENAPI_SPEC } from './openapi.js';

type CommandResponse = {
  name: string;
  description: string;
  arguments: CommandArgument[];
  subCommands: CommandResponse[];
};

const coderAgentCard: AgentCard = {
  name: 'Papert Code Agent',
  description:
    'An agent that generates code based on natural language instructions and streams file outputs.',
  url: 'http://localhost:41242/',
  provider: {
    organization: 'Papert',
    url: 'https://papert.dev',
  },
  protocolVersion: '0.3.0',
  version: '0.0.2', // Incremented version
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  securitySchemes: undefined,
  security: undefined,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'code_generation',
      name: 'Code Generation',
      description:
        'Generates code snippets or complete files based on user requests, streaming the results.',
      tags: ['code', 'development', 'programming'],
      examples: [
        'Write a python function to calculate fibonacci numbers.',
        'Create an HTML file with a basic button that alerts "Hello!" when clicked.',
      ],
      inputModes: ['text'],
      outputModes: ['text'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};

export function updateCoderAgentCardUrl(port: number) {
  coderAgentCard.url = `http://localhost:${port}/`;
}

async function handleExecuteCommand(
  req: express.Request,
  res: express.Response,
  context: {
    config: Awaited<ReturnType<typeof loadConfig>>;
    git: GitService | undefined;
    agentExecutor: CoderAgentExecutor;
  },
) {
  logger.info('[CoreAgent] Received /executeCommand request: ', req.body);
  const { command, args } = req.body;
  try {
    if (typeof command !== 'string') {
      return res.status(400).json({ error: 'Invalid "command" field.' });
    }

    if (args && !Array.isArray(args)) {
      return res.status(400).json({ error: '"args" field must be an array.' });
    }

    const commandToExecute = commandRegistry.get(command);

    if (commandToExecute?.requiresWorkspace) {
      if (!process.env['CODER_AGENT_WORKSPACE_PATH']) {
        return res.status(400).json({
          error: `Command "${command}" requires a workspace, but CODER_AGENT_WORKSPACE_PATH is not set.`,
        });
      }
    }

    if (!commandToExecute) {
      return res.status(404).json({ error: `Command not found: ${command}` });
    }

    if (commandToExecute.streaming) {
      const eventBus = new DefaultExecutionEventBus();
      res.setHeader('Content-Type', 'text/event-stream');
      const eventHandler = (event: AgentExecutionEvent) => {
        const jsonRpcResponse = {
          jsonrpc: '2.0',
          id: 'taskId' in event ? event.taskId : (event as Message).messageId,
          result: event,
        };
        res.write(`data: ${JSON.stringify(jsonRpcResponse)}\n`);
      };
      eventBus.on('event', eventHandler);

      await commandToExecute.execute({ ...context, eventBus }, args ?? []);

      eventBus.off('event', eventHandler);
      eventBus.finished();
      return res.end(); // Explicit return for streaming path
    } else {
      const result = await commandToExecute.execute(context, args ?? []);
      logger.info('[CoreAgent] Sending /executeCommand response: ', result);
      return res.status(200).json(result);
    }
  } catch (e) {
    logger.error(
      `Error executing /executeCommand: ${command} with args: ${JSON.stringify(
        args,
      )}`,
      e,
    );
    const errorMessage =
      e instanceof Error ? e.message : 'Unknown error executing command';
    return res.status(500).json({ error: errorMessage });
  }
}

export async function createApp() {
  try {
    // Load the server configuration once on startup.
    const workspaceRoot = setTargetDir(undefined);
    loadEnvironment();
    const settings = loadSettings(workspaceRoot);
    const extensions = loadExtensions(workspaceRoot);
    const config = await loadConfig(settings, extensions, 'a2a-server');

    const remoteAuth: RemoteAuthConfig = {
      enabled: process.env['PAPERT_REMOTE_ENABLED'] === '1',
      serverToken: process.env['PAPERT_REMOTE_SERVER_TOKEN'],
      sessionTtlMs: Number(process.env['PAPERT_REMOTE_SESSION_TTL_MS'] ?? 60_000),
    };

    const remoteSessions = new RemoteSessionStore(remoteAuth);
    const webUiEnabled = process.env['PAPERT_WEB_UI_ENABLED'] === '1';
    const shareDir =
      process.env['PAPERT_SHARE_DIR'] ??
      path.join(Storage.getGlobalPapertDir(), 'shares');
    const shareStore = new ShareStore(shareDir);

    let git: GitService | undefined;
    if (config.getCheckpointingEnabled()) {
      git = new GitService(config.getTargetDir(), config.storage);
      await git.initialize();
    }

    // loadEnvironment() is called within getConfig now
    const bucketName = process.env['GCS_BUCKET_NAME'];
    let taskStoreForExecutor: TaskStore;
    let taskStoreForHandler: TaskStore;

    if (bucketName) {
      logger.info(`Using GCSTaskStore with bucket: ${bucketName}`);
      const gcsTaskStore = new GCSTaskStore(bucketName);
      taskStoreForExecutor = gcsTaskStore;
      taskStoreForHandler = new NoOpTaskStore(gcsTaskStore);
    } else {
      logger.info('Using InMemoryTaskStore');
      const inMemoryTaskStore = new InMemoryTaskStore();
      taskStoreForExecutor = inMemoryTaskStore;
      taskStoreForHandler = inMemoryTaskStore;
    }

    const agentExecutor = new CoderAgentExecutor(taskStoreForExecutor);

    const context = { config, git, agentExecutor };

    const storage = new Storage(workspaceRoot);
    const papertDir = storage.getPapertDir();
    const settingsPath = storage.getWorkspaceSettingsPath();
    const schedulePath = path.join(papertDir, 'schedule', 'jobs.json');
    const webUiStatePath = path.join(papertDir, 'webui', 'state.json');

    const normalizeName = (value: string) =>
      value.trim().replace(/[^a-zA-Z0-9._-]/g, '-');

    const resolveWithinPapert = (relativePath: string) => {
      const base = path.resolve(papertDir) + path.sep;
      const resolved = path.resolve(papertDir, relativePath);
      if (!resolved.startsWith(base)) {
        throw new Error('Invalid path');
      }
      return resolved;
    };

    const readText = async (filePath: string) => {
      return fs.readFile(filePath, 'utf8');
    };

    const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    const writeJson = async (filePath: string, data: unknown) => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    };

    const readDescription = async (filePath: string) => {
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const lines = raw.split('\n');
        const line = lines.find((value) => value.trim().length > 0) ?? '';
        return line.replace(/^[#/*\\s-]+/, '').trim();
      } catch {
        return '';
      }
    };

    const formatEveryMs = (ms: number) => {
      if (!Number.isFinite(ms)) return '';
      if (ms % 86_400_000 === 0) return `${ms / 86_400_000}d`;
      if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
      if (ms % 60_000 === 0) return `${ms / 60_000}m`;
      if (ms % 1_000 === 0) return `${ms / 1_000}s`;
      return `${ms}ms`;
    };

    const listFiles = async (dirPath: string, ext: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
          .map((entry) => entry.name);
      } catch {
        return [];
      }
    };

    const listDirs = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      } catch {
        return [];
      }
    };

    const requestHandler = new DefaultRequestHandler(
      coderAgentCard,
      taskStoreForHandler,
      agentExecutor,
    );

    let expressApp = express();
    expressApp.use((req, res, next) => {
      requestStorage.run({ req }, next);
    });

    // Remote driving control plane.
    // This is intentionally mounted before A2A routes so it can protect them.
    expressApp.use(
      createRemoteRouter({
        auth: remoteAuth,
        sessions: remoteSessions,
        workspaceRoot,
      }),
    );

    const docsEnabled = process.env['PAPERT_REMOTE_DOCS_ENABLED'] === '1';

    if (docsEnabled) {
      expressApp.get('/openapi.json', (_req, res) => {
        res.status(200).json(REMOTE_CONTROL_OPENAPI_SPEC);
      });

      expressApp.use(
        '/docs',
        apiReference({
          // Scalar's express-api-reference expects the OpenAPI document under `content`.
          // (Older examples used `spec: { content }`, but that no longer matches the
          // current HtmlRenderingConfiguration type.)
          content: REMOTE_CONTROL_OPENAPI_SPEC,
        }),
      );
    }

    if (webUiEnabled) {
      expressApp.get('/', async (_req, res) => {
        const initialWebUiState = await readJson<unknown>(webUiStatePath, null);
        res
          .status(200)
          .setHeader('content-type', 'text/html; charset=utf-8')
          .setHeader('cache-control', 'no-store');
        res.send(
          getWebUiHtml(
            process.env['PAPERT_WEB_UI_ALLOW_EMPTY_TOKEN'] === '1',
            process.env['PAPERT_WEB_UI_DESKTOP_MODE'] === '1',
            workspaceRoot,
            initialWebUiState,
          ),
        );
      });
    }

    expressApp.use(
      createShareRouter({
        store: shareStore,
        token:
          process.env['PAPERT_SHARE_TOKEN'] ||
          process.env['PAPERT_REMOTE_SERVER_TOKEN'],
        publicBaseUrl: process.env['PAPERT_SHARE_PUBLIC_URL_BASE'],
      }),
    );

    // Remote auth/lock enforcement for all non-control-plane requests.
    expressApp.use(
      createRemoteAuthMiddleware({
        auth: remoteAuth,
        sessions: remoteSessions,
        workspaceRoot,
      }),
    );

    expressApp.use(express.json({ limit: '15mb' }));
    const appBuilder = new A2AExpressApp(requestHandler);
    expressApp = appBuilder.setupRoutes(expressApp, '');

    expressApp.get('/api/v1/webui/catalog', async (_req, res) => {
      try {
        const agentsDir = resolveWithinPapert('agents');
        const skillsDir = resolveWithinPapert('skills');
        const toolsDir = resolveWithinPapert('tools');
        const customToolsDir = resolveWithinPapert('custom-tools');
        const pluginsDir = resolveWithinPapert('plugins');

        const agentFiles = await listFiles(agentsDir, '.md');
        const agents = await Promise.all(
          agentFiles.map(async (file) => ({
            id: path.basename(file, '.md'),
            name: path.basename(file, '.md'),
            detail:
              (await readDescription(path.join(agentsDir, file))) ||
              'No description yet.',
            tag: 'agent',
          })),
        );

        const skillDirs = await listDirs(skillsDir);
        const skills = await Promise.all(
          skillDirs.map(async (dir) => ({
            id: dir,
            name: dir,
            detail:
              (await readDescription(path.join(skillsDir, dir, 'SKILL.md'))) ||
              'No description yet.',
            tag: 'skill',
          })),
        );

        const toolFiles = await listFiles(toolsDir, '.mjs');
        const tools = await Promise.all(
          toolFiles.map(async (file) => ({
            id: path.basename(file, '.mjs'),
            name: path.basename(file, '.mjs'),
            detail:
              (await readDescription(path.join(toolsDir, file))) ||
              'No description yet.',
            tag: 'tool',
          })),
        );

        const customToolFiles = await listFiles(customToolsDir, '.mjs');
        const customTools = await Promise.all(
          customToolFiles.map(async (file) => ({
            id: path.basename(file, '.mjs'),
            name: path.basename(file, '.mjs'),
            detail:
              (await readDescription(path.join(customToolsDir, file))) ||
              'No description yet.',
            tag: 'custom',
          })),
        );

        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const mcpServers = (settings['mcpServers'] || {}) as Record<string, unknown>;
        const mcps = Object.entries(mcpServers).map(([name, config]) => {
          const cfg = config as Record<string, unknown>;
          const detail =
            (Array.isArray(cfg['command']) ? cfg['command'].join(' ') : cfg['command']) ||
            cfg['url'] ||
            cfg['httpUrl'] ||
            'configured';
          return { id: name, name, detail: String(detail), tag: 'mcp', config };
        });

        const pluginFiles = await listFiles(pluginsDir, '.mjs');
        const pluginPaths = (settings['plugins'] as string[] | undefined) ?? [];
        const plugins = pluginFiles.map((file) => {
          const fullPath = path.join(pluginsDir, file);
          const enabled = pluginPaths.includes(fullPath);
          return {
            id: path.basename(file, '.mjs'),
            name: path.basename(file, '.mjs'),
            detail: enabled ? 'Enabled' : 'Disabled',
            tag: enabled ? 'enabled' : 'disabled',
          };
        });

        const hooksConfig = (settings['hooks'] || {}) as Record<string, unknown>;
        const hooks: { id: string; name: string; detail: string; tag: string; group: unknown }[] = [];
        Object.entries(hooksConfig).forEach(([section, value]) => {
          const groups = Array.isArray(value) ? value : [];
          groups.forEach((group, index) => {
            const matcher = (group as { matcher?: string }).matcher ?? '.*';
            hooks.push({
              id: `${section}:${index}`,
              name: `${section} #${index + 1}`,
              detail: `matcher: ${matcher}`,
              tag: 'hook',
              group,
            });
          });
        });

        const scheduleStore = await readJson(
          schedulePath,
          { version: 1, jobs: [] as Record<string, unknown>[] },
        );
        const jobs = Array.isArray(scheduleStore.jobs) ? scheduleStore.jobs : [];
        const schedules = jobs.map((job) => {
          const schedule = job['schedule'] as Record<string, unknown> | undefined;
          let when = '';
          if (schedule?.['kind'] === 'every') {
            when = formatEveryMs(Number(schedule['everyMs']));
          } else if (schedule?.['kind'] === 'cron') {
            when = String(schedule['expr'] || '');
          } else if (schedule?.['kind'] === 'at') {
            when = new Date(Number(schedule['atMs'] || 0)).toISOString();
          }
          const payload = (job['payload'] || {}) as Record<string, unknown>;
          const targetType = String(payload['targetType'] || '');
          const targetName = String(payload['targetName'] || '');
          const targetValue = targetType && targetName ? `${targetType}:${targetName}` : '';
          const detail = `${when} - ${targetName || 'target'}`;
          return {
            id: job['id'],
            name: job['name'],
            detail,
            status: job['enabled'] === false ? 'disabled' : 'enabled',
            schedule,
            payload,
            when,
            targetValue,
          };
        });

        const targets = {
          tools: tools.map((tool) => tool.name),
          agents: agents.map((agent) => agent.name),
          mcps: mcps.map((mcp) => mcp.name),
        };
        const general = (settings['general'] || {}) as Record<string, unknown>;
        const releaseChannel =
          typeof general['releaseChannel'] === 'string'
            ? general['releaseChannel']
            : 'stable';

        const checkpointDir = path.join(workspaceRoot, '.gemini', 'checkpoints');
        const checkpointFiles = await listFiles(checkpointDir, '.json');
        const rewindPoints = await Promise.all(
          checkpointFiles.map(async (fileName) => {
            const id = path.basename(fileName, '.json');
            const fullPath = path.join(checkpointDir, fileName);
            const stat = await fs.stat(fullPath);
            let toolName = 'unknown';
            let restoreType = 'chat-only';
            try {
              const parsed = JSON.parse(await readText(fullPath)) as Record<string, unknown>;
              const toolCall = parsed['toolCall'] as Record<string, unknown> | undefined;
              if (typeof toolCall?.['name'] === 'string') {
                toolName = toolCall['name'] as string;
              }
              if (typeof parsed['commitHash'] === 'string' && parsed['commitHash']) {
                restoreType = 'file+chat';
              }
            } catch {
              // Keep fallback values for malformed checkpoints.
            }
            return {
              id,
              name: id,
              toolName,
              restoreType,
              detail: `${toolName} · ${restoreType} · ${new Date(stat.mtimeMs).toISOString()}`,
              updatedAt: stat.mtimeMs,
            };
          }),
        );
        rewindPoints.sort((a, b) => b.updatedAt - a.updatedAt);

        return res.status(200).json({
          agents,
          skills,
          tools,
          customTools,
          plugins,
          hooks,
          mcps,
          schedules,
          targets,
          rewindPoints,
          releaseChannel,
        });
      } catch (error) {
        logger.error('[WebUI] Failed to build catalog', error);
        return res.status(500).json({ error: 'Failed to load catalog' });
      }
    });

    expressApp.get('/api/v1/webui/state', async (_req, res) => {
      const state = await readJson<unknown>(webUiStatePath, null);
      res.status(200).json({ state });
    });

    expressApp.put('/api/v1/webui/state', async (req, res) => {
      try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
          return res.status(400).json({ error: 'Invalid state payload' });
        }
        await writeJson(webUiStatePath, body);
        return res.status(204).end();
      } catch (error) {
        logger.error('[CoreAgent] Failed to save web UI state', error);
        return res.status(500).json({ error: 'Failed to save state' });
      }
    });

    expressApp.post('/api/v1/webui/tool-approval', async (req, res) => {
      try {
        const taskId =
          typeof req.body?.taskId === 'string' ? req.body.taskId.trim() : '';
        const contextId =
          typeof req.body?.contextId === 'string'
            ? req.body.contextId.trim()
            : '';
        const callId =
          typeof req.body?.callId === 'string' ? req.body.callId.trim() : '';
        const outcome =
          typeof req.body?.outcome === 'string' ? req.body.outcome.trim() : '';
        const newContent =
          typeof req.body?.newContent === 'string' ? req.body.newContent : undefined;

        if (!taskId || !callId || !outcome) {
          return res.status(400).json({ error: 'taskId, callId, and outcome are required' });
        }

        logger.info(
          `[WebUI] Tool approval request: task=${taskId}, context=${contextId || 'n/a'}, callId=${callId}, outcome=${outcome}`,
        );

        const approvalResult = await agentExecutor.confirmToolCallResolved(
          taskId,
          callId,
          outcome,
          newContent,
          contextId || undefined,
        );
        if (!approvalResult.accepted) {
          logger.warn(
            `[WebUI] Tool approval rejected: task=${taskId}, context=${contextId || 'n/a'}, callId=${callId}, outcome=${outcome}`,
          );
          return res.status(409).json({ error: 'Tool approval not accepted for this task/call' });
        }
        logger.info(
          `[WebUI] Tool approval accepted: task=${approvalResult.taskId || taskId}, context=${approvalResult.contextId || contextId || 'n/a'}, callId=${callId}, outcome=${outcome}`,
        );
        return res.status(200).json({
          accepted: true,
          taskId: approvalResult.taskId || taskId,
          contextId: approvalResult.contextId || contextId || '',
        });
      } catch (error) {
        logger.error('[WebUI] Failed to submit tool approval', error);
        return res.status(500).json({ error: 'Failed to submit tool approval' });
      }
    });

    expressApp.get('/api/v1/webui/pending-approvals', async (req, res) => {
      try {
        const taskId =
          typeof req.query?.['taskId'] === 'string'
            ? req.query['taskId'].trim()
            : '';
        const contextId =
          typeof req.query?.['contextId'] === 'string'
            ? req.query['contextId'].trim()
            : '';
        if (!taskId && !contextId) {
          return res
            .status(400)
            .json({ error: 'taskId or contextId is required' });
        }
        const pending = agentExecutor.getPendingApprovals(taskId, contextId || undefined);
        if (!pending) {
          return res.status(404).json({ error: 'Task not found' });
        }
        return res.status(200).json(pending);
      } catch (error) {
        logger.error('[WebUI] Failed to read pending approvals', error);
        return res.status(500).json({ error: 'Failed to read pending approvals' });
      }
    });

    expressApp.get('/api/v1/webui/pending-approvals/all', async (_req, res) => {
      try {
        return res.status(200).json({
          tasks: agentExecutor.getAllPendingApprovals(),
        });
      } catch (error) {
        logger.error('[WebUI] Failed to read all pending approvals', error);
        return res.status(500).json({ error: 'Failed to read all pending approvals' });
      }
    });

    expressApp.get('/api/v1/webui/task-feed', async (req, res) => {
      try {
        const taskId =
          typeof req.query?.['taskId'] === 'string'
            ? req.query['taskId'].trim()
            : '';
        const contextId =
          typeof req.query?.['contextId'] === 'string'
            ? req.query['contextId'].trim()
            : '';
        const sinceRaw =
          typeof req.query?.['since'] === 'string'
            ? req.query['since'].trim()
            : '';
        const sinceSeq = sinceRaw ? Number(sinceRaw) : -1;
        if (!taskId && !contextId) {
          return res
            .status(400)
            .json({ error: 'taskId or contextId is required' });
        }
        const feed = agentExecutor.getTaskTextFeed(
          taskId,
          contextId || undefined,
          Number.isFinite(sinceSeq) ? sinceSeq : -1,
        );
        if (!feed) {
          return res.status(404).json({ error: 'Task not found' });
        }
        return res.status(200).json(feed);
      } catch (error) {
        logger.error('[WebUI] Failed to read task feed', error);
        return res.status(500).json({ error: 'Failed to read task feed' });
      }
    });

    expressApp.get('/api/v1/webui/content/:type/:id', async (req, res) => {
      try {
        const type = req.params.type;
        const id = req.params.id;
        if (type === 'agents') {
          const filePath = resolveWithinPapert(path.join('agents', `${id}.md`));
          return res.status(200).json({ content: await readText(filePath) });
        }
        if (type === 'skills') {
          const filePath = resolveWithinPapert(path.join('skills', id, 'SKILL.md'));
          return res.status(200).json({ content: await readText(filePath) });
        }
        if (type === 'tools') {
          const filePath = resolveWithinPapert(path.join('tools', `${id}.mjs`));
          return res.status(200).json({ content: await readText(filePath) });
        }
        if (type === 'custom-tools') {
          const filePath = resolveWithinPapert(path.join('custom-tools', `${id}.mjs`));
          return res.status(200).json({ content: await readText(filePath) });
        }
        if (type === 'plugins') {
          const filePath = resolveWithinPapert(path.join('plugins', `${id}.mjs`));
          return res.status(200).json({ content: await readText(filePath) });
        }
        if (type === 'mcps') {
          const settings = await readJson(settingsPath, {} as Record<string, unknown>);
          const mcpServers = (settings['mcpServers'] || {}) as Record<string, unknown>;
          const config = mcpServers[id] ?? {};
          return res.status(200).json({ content: JSON.stringify(config, null, 2) });
        }
        if (type === 'hooks') {
          const settings = await readJson(settingsPath, {} as Record<string, unknown>);
          const hooks = (settings['hooks'] || {}) as Record<string, unknown>;
          const [section, rawIndex] = id.split(':');
          const index = Number(rawIndex);
          const groups = Array.isArray(hooks[section]) ? (hooks[section] as unknown[]) : [];
          const group = groups[index] ?? {};
          return res.status(200).json({ content: JSON.stringify(group, null, 2) });
        }
        return res.status(400).json({ error: 'Unsupported content type' });
      } catch (error) {
        logger.error('[WebUI] Failed to load content', error);
        return res.status(500).json({ error: 'Failed to load content' });
      }
    });

    expressApp.put('/api/v1/webui/release-channel', async (req, res) => {
      try {
        const requested = String(req.body?.releaseChannel || '').trim();
        if (!['stable', 'preview', 'nightly'].includes(requested)) {
          return res.status(400).json({ error: 'Invalid release channel' });
        }
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const general = (settings['general'] || {}) as Record<string, unknown>;
        general['releaseChannel'] = requested;
        settings['general'] = general;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update release channel', error);
        return res.status(500).json({ error: 'Failed to update release channel' });
      }
    });

    const writeFileForType = async (type: string, id: string, name: string, content: string) => {
      const safeName = normalizeName(name || id);
      const hasRename = id && safeName && id !== safeName;
      if (type === 'agents') {
        const dir = resolveWithinPapert('agents');
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${safeName}.md`);
        await fs.writeFile(filePath, content, 'utf8');
        if (hasRename) {
          const oldPath = path.join(dir, `${id}.md`);
          if (fsSync.existsSync(oldPath)) await fs.unlink(oldPath);
        }
        return;
      }
      if (type === 'skills') {
        const dir = resolveWithinPapert(path.join('skills', safeName));
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, 'SKILL.md');
        await fs.writeFile(filePath, content, 'utf8');
        if (hasRename) {
          const oldDir = resolveWithinPapert(path.join('skills', id));
          if (fsSync.existsSync(oldDir)) await fs.rm(oldDir, { recursive: true, force: true });
        }
        return;
      }
      if (type === 'tools') {
        const dir = resolveWithinPapert('tools');
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${safeName}.mjs`);
        await fs.writeFile(filePath, content, 'utf8');
        if (hasRename) {
          const oldPath = path.join(dir, `${id}.mjs`);
          if (fsSync.existsSync(oldPath)) await fs.unlink(oldPath);
        }
        return;
      }
      if (type === 'custom-tools') {
        const dir = resolveWithinPapert('custom-tools');
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${safeName}.mjs`);
        await fs.writeFile(filePath, content, 'utf8');
        if (hasRename) {
          const oldPath = path.join(dir, `${id}.mjs`);
          if (fsSync.existsSync(oldPath)) await fs.unlink(oldPath);
        }
        return;
      }
      if (type === 'plugins') {
        const dir = resolveWithinPapert('plugins');
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${safeName}.mjs`);
        await fs.writeFile(filePath, content, 'utf8');
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const plugins = new Set((settings['plugins'] as string[] | undefined) ?? []);
        if (hasRename) {
          const oldPath = path.join(dir, `${id}.mjs`);
          plugins.delete(oldPath);
        }
        plugins.add(filePath);
        settings['plugins'] = Array.from(plugins);
        await writeJson(settingsPath, settings);
        return;
      }
      throw new Error('Unsupported type');
    };

    expressApp.post('/api/v1/webui/agents', async (req, res) => {
      try {
        await writeFileForType('agents', '', req.body.name, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save agent', error);
        return res.status(500).json({ error: 'Failed to save agent' });
      }
    });

    expressApp.put('/api/v1/webui/agents/:id', async (req, res) => {
      try {
        await writeFileForType('agents', req.params.id, req.body.name ?? req.params.id, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update agent', error);
        return res.status(500).json({ error: 'Failed to update agent' });
      }
    });

    expressApp.delete('/api/v1/webui/agents/:id', async (req, res) => {
      try {
        const filePath = resolveWithinPapert(path.join('agents', `${req.params.id}.md`));
        if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete agent', error);
        return res.status(500).json({ error: 'Failed to delete agent' });
      }
    });

    expressApp.post('/api/v1/webui/skills', async (req, res) => {
      try {
        await writeFileForType('skills', '', req.body.name, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save skill', error);
        return res.status(500).json({ error: 'Failed to save skill' });
      }
    });

    expressApp.put('/api/v1/webui/skills/:id', async (req, res) => {
      try {
        await writeFileForType('skills', req.params.id, req.body.name ?? req.params.id, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update skill', error);
        return res.status(500).json({ error: 'Failed to update skill' });
      }
    });

    expressApp.delete('/api/v1/webui/skills/:id', async (req, res) => {
      try {
        const dirPath = resolveWithinPapert(path.join('skills', req.params.id));
        if (fsSync.existsSync(dirPath)) await fs.rm(dirPath, { recursive: true, force: true });
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete skill', error);
        return res.status(500).json({ error: 'Failed to delete skill' });
      }
    });

    expressApp.post('/api/v1/webui/tools', async (req, res) => {
      try {
        await writeFileForType('tools', '', req.body.name, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save tool', error);
        return res.status(500).json({ error: 'Failed to save tool' });
      }
    });

    expressApp.put('/api/v1/webui/tools/:id', async (req, res) => {
      try {
        await writeFileForType('tools', req.params.id, req.body.name ?? req.params.id, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update tool', error);
        return res.status(500).json({ error: 'Failed to update tool' });
      }
    });

    expressApp.delete('/api/v1/webui/tools/:id', async (req, res) => {
      try {
        const filePath = resolveWithinPapert(path.join('tools', `${req.params.id}.mjs`));
        if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete tool', error);
        return res.status(500).json({ error: 'Failed to delete tool' });
      }
    });

    expressApp.post('/api/v1/webui/custom-tools', async (req, res) => {
      try {
        await writeFileForType('custom-tools', '', req.body.name, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save custom tool', error);
        return res.status(500).json({ error: 'Failed to save custom tool' });
      }
    });

    expressApp.put('/api/v1/webui/custom-tools/:id', async (req, res) => {
      try {
        await writeFileForType('custom-tools', req.params.id, req.body.name ?? req.params.id, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update custom tool', error);
        return res.status(500).json({ error: 'Failed to update custom tool' });
      }
    });

    expressApp.delete('/api/v1/webui/custom-tools/:id', async (req, res) => {
      try {
        const filePath = resolveWithinPapert(path.join('custom-tools', `${req.params.id}.mjs`));
        if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete custom tool', error);
        return res.status(500).json({ error: 'Failed to delete custom tool' });
      }
    });

    expressApp.post('/api/v1/webui/plugins', async (req, res) => {
      try {
        await writeFileForType('plugins', '', req.body.name, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save plugin', error);
        return res.status(500).json({ error: 'Failed to save plugin' });
      }
    });

    expressApp.put('/api/v1/webui/plugins/:id', async (req, res) => {
      try {
        await writeFileForType('plugins', req.params.id, req.body.name ?? req.params.id, req.body.content ?? '');
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update plugin', error);
        return res.status(500).json({ error: 'Failed to update plugin' });
      }
    });

    expressApp.delete('/api/v1/webui/plugins/:id', async (req, res) => {
      try {
        const filePath = resolveWithinPapert(path.join('plugins', `${req.params.id}.mjs`));
        if (fsSync.existsSync(filePath)) await fs.unlink(filePath);
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const plugins = (settings['plugins'] as string[] | undefined) ?? [];
        settings['plugins'] = plugins.filter((entry) => entry !== filePath);
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete plugin', error);
        return res.status(500).json({ error: 'Failed to delete plugin' });
      }
    });

    expressApp.post('/api/v1/webui/mcps', async (req, res) => {
      try {
        const name = normalizeName(req.body.name ?? '');
        const config = req.body.config ?? {};
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        settings['mcpServers'] = { ...(settings['mcpServers'] as Record<string, unknown> | undefined), [name]: config };
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save MCP', error);
        return res.status(500).json({ error: 'Failed to save MCP' });
      }
    });

    expressApp.put('/api/v1/webui/mcps/:id', async (req, res) => {
      try {
        const name = normalizeName(req.body.name ?? req.params.id);
        const config = req.body.config ?? {};
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const mcpServers = { ...(settings['mcpServers'] as Record<string, unknown> | undefined) };
        delete mcpServers[req.params.id];
        mcpServers[name] = config;
        settings['mcpServers'] = mcpServers;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update MCP', error);
        return res.status(500).json({ error: 'Failed to update MCP' });
      }
    });

    expressApp.delete('/api/v1/webui/mcps/:id', async (req, res) => {
      try {
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const mcpServers = { ...(settings['mcpServers'] as Record<string, unknown> | undefined) };
        delete mcpServers[req.params.id];
        settings['mcpServers'] = mcpServers;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete MCP', error);
        return res.status(500).json({ error: 'Failed to delete MCP' });
      }
    });

    expressApp.post('/api/v1/webui/hooks', async (req, res) => {
      try {
        const section = req.body.section;
        const group = req.body.group;
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const hooks = { ...(settings['hooks'] as Record<string, unknown> | undefined) };
        const groups = Array.isArray(hooks[section]) ? [...(hooks[section] as unknown[])] : [];
        groups.push(group);
        hooks[section] = groups;
        settings['hooks'] = hooks;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to save hook', error);
        return res.status(500).json({ error: 'Failed to save hook' });
      }
    });

    expressApp.put('/api/v1/webui/hooks/:section/:index', async (req, res) => {
      try {
        const section = req.params.section;
        const index = Number(req.params.index);
        const group = req.body.group;
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const hooks = { ...(settings['hooks'] as Record<string, unknown> | undefined) };
        const groups = Array.isArray(hooks[section]) ? [...(hooks[section] as unknown[])] : [];
        groups[index] = group;
        hooks[section] = groups;
        settings['hooks'] = hooks;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update hook', error);
        return res.status(500).json({ error: 'Failed to update hook' });
      }
    });

    expressApp.delete('/api/v1/webui/hooks/:section/:index', async (req, res) => {
      try {
        const section = req.params.section;
        const index = Number(req.params.index);
        const settings = await readJson(settingsPath, {} as Record<string, unknown>);
        const hooks = { ...(settings['hooks'] as Record<string, unknown> | undefined) };
        const groups = Array.isArray(hooks[section]) ? [...(hooks[section] as unknown[])] : [];
        groups.splice(index, 1);
        hooks[section] = groups;
        settings['hooks'] = hooks;
        await writeJson(settingsPath, settings);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete hook', error);
        return res.status(500).json({ error: 'Failed to delete hook' });
      }
    });

    const readScheduleStore = async () =>
      readJson(schedulePath, { version: 1, jobs: [] as Record<string, unknown>[] });

    expressApp.post('/api/v1/webui/schedules', async (req, res) => {
      try {
        const store = await readScheduleStore();
        const now = Date.now();
        const job = {
          id: uuidv4(),
          name: req.body.name,
          description: req.body.description,
          enabled: true,
          createdAtMs: now,
          updatedAtMs: now,
          schedule: req.body.schedule,
          payload: req.body.payload ?? {},
          state: {},
        };
        store.jobs = [...(store.jobs as Record<string, unknown>[]), job];
        await writeJson(schedulePath, store);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to add schedule', error);
        return res.status(500).json({ error: 'Failed to add schedule' });
      }
    });

    expressApp.put('/api/v1/webui/schedules/:id', async (req, res) => {
      try {
        const store = await readScheduleStore();
        const jobs = (store.jobs as Record<string, unknown>[]) ?? [];
        const idx = jobs.findIndex((job) => job['id'] === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        const updated = {
          ...jobs[idx],
          name: req.body.name ?? jobs[idx]['name'],
          schedule: req.body.schedule ?? jobs[idx]['schedule'],
          payload: req.body.payload ?? jobs[idx]['payload'],
          updatedAtMs: Date.now(),
        };
        jobs[idx] = updated;
        store.jobs = jobs;
        await writeJson(schedulePath, store);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to update schedule', error);
        return res.status(500).json({ error: 'Failed to update schedule' });
      }
    });

    expressApp.delete('/api/v1/webui/schedules/:id', async (req, res) => {
      try {
        const store = await readScheduleStore();
        const jobs = (store.jobs as Record<string, unknown>[]) ?? [];
        store.jobs = jobs.filter((job) => job['id'] !== req.params.id);
        await writeJson(schedulePath, store);
        return res.status(204).end();
      } catch (error) {
        logger.error('[WebUI] Failed to delete schedule', error);
        return res.status(500).json({ error: 'Failed to delete schedule' });
      }
    });

    expressApp.post('/tasks', async (req, res) => {
      try {
        const taskId = uuidv4();
        const agentSettings = req.body.agentSettings as
          | AgentSettings
          | undefined;
        const contextId = req.body.contextId || uuidv4();
        const wrapper = await agentExecutor.createTask(
          taskId,
          contextId,
          agentSettings,
        );
        await taskStoreForExecutor.save(wrapper.toSDKTask());
        res.status(201).json(wrapper.id);
      } catch (error) {
        logger.error('[CoreAgent] Error creating task:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown error creating task';
        res.status(500).send({ error: errorMessage });
      }
    });

    expressApp.post('/executeCommand', (req, res) => {
      void handleExecuteCommand(req, res, context);
    });

    expressApp.get('/listCommands', (req, res) => {
      try {
        const transformCommand = (
          command: Command,
          visited: string[],
        ): CommandResponse | undefined => {
          const commandName = command.name;
          if (visited.includes(commandName)) {
            debugLogger.warn(
              `Command ${commandName} already inserted in the response, skipping`,
            );
            return undefined;
          }

          return {
            name: command.name,
            description: command.description,
            arguments: command.arguments ?? [],
            subCommands: (command.subCommands ?? [])
              .map((subCommand) =>
                transformCommand(subCommand, visited.concat(commandName)),
              )
              .filter(
                (subCommand): subCommand is CommandResponse => !!subCommand,
              ),
          };
        };

        const commands = commandRegistry
          .getAllCommands()
          .filter((command) => command.topLevel)
          .map((command) => transformCommand(command, []));

        return res.status(200).json({ commands });
      } catch (e) {
        logger.error('Error executing /listCommands:', e);
        const errorMessage =
          e instanceof Error ? e.message : 'Unknown error listing commands';
        return res.status(500).json({ error: errorMessage });
      }
    });

    expressApp.get('/tasks/metadata', async (req, res) => {
      // This endpoint is only meaningful if the task store is in-memory.
      if (!(taskStoreForExecutor instanceof InMemoryTaskStore)) {
        res.status(501).send({
          error:
            'Listing all task metadata is only supported when using InMemoryTaskStore.',
        });
      }
      try {
        const wrappers = agentExecutor.getAllTasks();
        if (wrappers && wrappers.length > 0) {
          const tasksMetadata = await Promise.all(
            wrappers.map((wrapper) => wrapper.task.getMetadata()),
          );
          res.status(200).json(tasksMetadata);
        } else {
          res.status(204).send();
        }
      } catch (error) {
        logger.error('[CoreAgent] Error getting all task metadata:', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unknown error getting task metadata';
        res.status(500).send({ error: errorMessage });
      }
    });

    expressApp.get('/tasks/:taskId/metadata', async (req, res) => {
      const taskId = req.params.taskId;
      let wrapper = agentExecutor.getTask(taskId);
      if (!wrapper) {
        const sdkTask = await taskStoreForExecutor.load(taskId);
        if (sdkTask) {
          wrapper = await agentExecutor.reconstruct(sdkTask);
        }
      }
      if (!wrapper) {
        res.status(404).send({ error: 'Task not found' });
        return;
      }
      res.json({ metadata: await wrapper.task.getMetadata() });
    });
    return expressApp;
  } catch (error) {
    logger.error('[CoreAgent] Error during startup:', error);
    process.exit(1);
  }
}

export async function main() {
  try {
    const expressApp = await createApp();
    const port = process.env['CODER_AGENT_PORT'] || 0;

    const server = expressApp.listen(port, () => {
      const address = server.address();
      let actualPort;
      if (process.env['CODER_AGENT_PORT']) {
        actualPort = process.env['CODER_AGENT_PORT'];
      } else if (address && typeof address !== 'string') {
        actualPort = address.port;
      } else {
        throw new Error('[Core Agent] Could not find port number.');
      }
      updateCoderAgentCardUrl(Number(actualPort));
      logger.info(
        `[CoreAgent] Agent Server started on http://localhost:${actualPort}`,
      );
      logger.info(
        `[CoreAgent] Agent Card: http://localhost:${actualPort}/.well-known/agent-card.json`,
      );
      logger.info('[CoreAgent] Press Ctrl+C to stop the server');
    });
  } catch (error) {
    logger.error('[CoreAgent] Error during startup:', error);
    process.exit(1);
  }
}
