/**
 * @license
 * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import type express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

type JsonObject = Record<string, unknown>;

type JsonUpdater<T> = (current: T) => Promise<T> | T;

type NamedContentBody =
  | { ok: true; name: string; content: string }
  | { ok: false; error: string };

type McpBody =
  | { ok: true; name: string; config: JsonObject }
  | { ok: false; error: string };

type HookCreateBody =
  | { ok: true; section: string; group: unknown }
  | { ok: false; error: string };

type HookUpdateBody = { ok: true; group: unknown } | { ok: false; error: string };

type ScheduleCreateBody =
  | {
      ok: true;
      name: string;
      description: string;
      schedule: JsonObject;
      payload: JsonObject;
    }
  | { ok: false; error: string };

type ScheduleUpdateBody =
  | { ok: true; name?: string; schedule?: JsonObject; payload?: JsonObject }
  | { ok: false; error: string };

export type WebUiMutationsOptions = {
  expressApp: express.Express;
  settingsPath: string;
  schedulePath: string;
  normalizeName: (value: string) => string;
  resolveWithinPapert: (relativePath: string) => string;
  isPlainObject: (value: unknown) => value is JsonObject;
  updateJson: <T>(filePath: string, fallback: T, updater: JsonUpdater<T>) => Promise<T>;
};

export function registerWebUiMutationRoutes(
  options: WebUiMutationsOptions,
): void {
  const {
    expressApp,
    settingsPath,
    schedulePath,
    normalizeName,
    resolveWithinPapert,
    isPlainObject,
    updateJson,
  } = options;

  const parseAllowedBody = (
    body: unknown,
    allowedKeys: string[],
  ): { ok: true; value: JsonObject } | { ok: false; error: string } => {
    if (!isPlainObject(body)) {
      return { ok: false, error: 'Invalid JSON payload.' };
    }
    const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));
    if (unknownKeys.length > 0) {
      return { ok: false, error: `Unknown field(s): ${unknownKeys.join(', ')}` };
    }
    return { ok: true, value: body };
  };

  const parseNamedContentBody = (
    body: unknown,
    fallbackName?: string,
  ): NamedContentBody => {
    const parsed = parseAllowedBody(body, ['name', 'content']);
    if (!parsed.ok) {
      return parsed;
    }
    const nameValue =
      typeof parsed.value['name'] === 'string' ? parsed.value['name'] : fallbackName;
    if (!nameValue || !nameValue.trim()) {
      return { ok: false, error: 'name is required.' };
    }
    const normalizedName = normalizeName(nameValue);
    if (!normalizedName) {
      return { ok: false, error: 'name is required.' };
    }
    const contentValue = parsed.value['content'];
    if (contentValue !== undefined && typeof contentValue !== 'string') {
      return { ok: false, error: 'content must be a string.' };
    }
    return {
      ok: true,
      name: normalizedName,
      content: typeof contentValue === 'string' ? contentValue : '',
    };
  };

  const parseMcpBody = (body: unknown, fallbackName?: string): McpBody => {
    const parsed = parseAllowedBody(body, ['name', 'config']);
    if (!parsed.ok) {
      return parsed;
    }
    const nameValue =
      typeof parsed.value['name'] === 'string' ? parsed.value['name'] : fallbackName;
    if (!nameValue || !nameValue.trim()) {
      return { ok: false, error: 'name is required.' };
    }
    const normalizedName = normalizeName(nameValue);
    if (!normalizedName) {
      return { ok: false, error: 'name is required.' };
    }
    const configValue = parsed.value['config'];
    if (configValue !== undefined && !isPlainObject(configValue)) {
      return { ok: false, error: 'config must be an object.' };
    }
    return {
      ok: true,
      name: normalizedName,
      config: isPlainObject(configValue) ? configValue : {},
    };
  };

  const parseHookCreateBody = (body: unknown): HookCreateBody => {
    const parsed = parseAllowedBody(body, ['section', 'group']);
    if (!parsed.ok) {
      return parsed;
    }
    const sectionValue = parsed.value['section'];
    if (typeof sectionValue !== 'string' || !sectionValue.trim()) {
      return { ok: false, error: 'section is required.' };
    }
    if (parsed.value['group'] === undefined) {
      return { ok: false, error: 'group is required.' };
    }
    return { ok: true, section: sectionValue, group: parsed.value['group'] };
  };

  const parseHookUpdateBody = (body: unknown): HookUpdateBody => {
    const parsed = parseAllowedBody(body, ['group']);
    if (!parsed.ok) {
      return parsed;
    }
    if (parsed.value['group'] === undefined) {
      return { ok: false, error: 'group is required.' };
    }
    return { ok: true, group: parsed.value['group'] };
  };

  const parseScheduleCreateBody = (body: unknown): ScheduleCreateBody => {
    const parsed = parseAllowedBody(body, ['name', 'description', 'schedule', 'payload']);
    if (!parsed.ok) {
      return parsed;
    }
    const nameValue = parsed.value['name'];
    if (typeof nameValue !== 'string' || !nameValue.trim()) {
      return { ok: false, error: 'name is required.' };
    }
    const descriptionValue = parsed.value['description'];
    if (descriptionValue !== undefined && typeof descriptionValue !== 'string') {
      return { ok: false, error: 'description must be a string.' };
    }
    const scheduleValue = parsed.value['schedule'];
    if (!isPlainObject(scheduleValue)) {
      return { ok: false, error: 'schedule must be an object.' };
    }
    const payloadValue = parsed.value['payload'];
    if (payloadValue !== undefined && !isPlainObject(payloadValue)) {
      return { ok: false, error: 'payload must be an object.' };
    }
    return {
      ok: true,
      name: nameValue.trim(),
      description: typeof descriptionValue === 'string' ? descriptionValue : '',
      schedule: scheduleValue,
      payload: isPlainObject(payloadValue) ? payloadValue : {},
    };
  };

  const parseScheduleUpdateBody = (body: unknown): ScheduleUpdateBody => {
    const parsed = parseAllowedBody(body, ['name', 'schedule', 'payload']);
    if (!parsed.ok) {
      return parsed;
    }
    const nameValue = parsed.value['name'];
    if (nameValue !== undefined && (typeof nameValue !== 'string' || !nameValue.trim())) {
      return { ok: false, error: 'name must be a non-empty string.' };
    }
    const scheduleValue = parsed.value['schedule'];
    if (scheduleValue !== undefined && !isPlainObject(scheduleValue)) {
      return { ok: false, error: 'schedule must be an object.' };
    }
    const payloadValue = parsed.value['payload'];
    if (payloadValue !== undefined && !isPlainObject(payloadValue)) {
      return { ok: false, error: 'payload must be an object.' };
    }
    return {
      ok: true,
      name: typeof nameValue === 'string' ? nameValue.trim() : undefined,
      schedule: isPlainObject(scheduleValue) ? scheduleValue : undefined,
      payload: isPlainObject(payloadValue) ? payloadValue : undefined,
    };
  };

  const writeFileForType = async (
    type: string,
    id: string,
    name: string,
    content: string,
  ) => {
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
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const plugins = new Set((settings['plugins'] as string[] | undefined) ?? []);
        if (hasRename) {
          const oldPath = path.join(dir, `${id}.mjs`);
          plugins.delete(oldPath);
        }
        plugins.add(filePath);
        settings['plugins'] = Array.from(plugins);
        return settings;
      });
      return;
    }
    throw new Error('Unsupported type');
  };

  expressApp.post('/api/v1/webui/agents', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('agents', '', parsed.name, parsed.content);
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save agent', error);
      return res.status(500).json({ error: 'Failed to save agent' });
    }
  });

  expressApp.put('/api/v1/webui/agents/:id', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('agents', req.params.id, parsed.name, parsed.content);
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
      const parsed = parseNamedContentBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('skills', '', parsed.name, parsed.content);
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save skill', error);
      return res.status(500).json({ error: 'Failed to save skill' });
    }
  });

  expressApp.put('/api/v1/webui/skills/:id', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('skills', req.params.id, parsed.name, parsed.content);
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
      const parsed = parseNamedContentBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('tools', '', parsed.name, parsed.content);
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save tool', error);
      return res.status(500).json({ error: 'Failed to save tool' });
    }
  });

  expressApp.put('/api/v1/webui/tools/:id', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('tools', req.params.id, parsed.name, parsed.content);
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
      const parsed = parseNamedContentBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('custom-tools', '', parsed.name, parsed.content);
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save custom tool', error);
      return res.status(500).json({ error: 'Failed to save custom tool' });
    }
  });

  expressApp.put('/api/v1/webui/custom-tools/:id', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('custom-tools', req.params.id, parsed.name, parsed.content);
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
      const parsed = parseNamedContentBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('plugins', '', parsed.name, parsed.content);
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save plugin', error);
      return res.status(500).json({ error: 'Failed to save plugin' });
    }
  });

  expressApp.put('/api/v1/webui/plugins/:id', async (req, res) => {
    try {
      const parsed = parseNamedContentBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await writeFileForType('plugins', req.params.id, parsed.name, parsed.content);
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
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const plugins = (settings['plugins'] as string[] | undefined) ?? [];
        settings['plugins'] = plugins.filter((entry) => entry !== filePath);
        return settings;
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to delete plugin', error);
      return res.status(500).json({ error: 'Failed to delete plugin' });
    }
  });

  expressApp.post('/api/v1/webui/mcps', async (req, res) => {
    try {
      const parsed = parseMcpBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        settings['mcpServers'] = {
          ...(settings['mcpServers'] as JsonObject | undefined),
          [parsed.name]: parsed.config,
        };
        return settings;
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to save MCP', error);
      return res.status(500).json({ error: 'Failed to save MCP' });
    }
  });

  expressApp.put('/api/v1/webui/mcps/:id', async (req, res) => {
    try {
      const parsed = parseMcpBody(req.body, req.params.id);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const mcpServers = {
          ...(settings['mcpServers'] as JsonObject | undefined),
        };
        delete mcpServers[req.params.id];
        mcpServers[parsed.name] = parsed.config;
        settings['mcpServers'] = mcpServers;
        return settings;
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to update MCP', error);
      return res.status(500).json({ error: 'Failed to update MCP' });
    }
  });

  expressApp.delete('/api/v1/webui/mcps/:id', async (req, res) => {
    try {
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const mcpServers = {
          ...(settings['mcpServers'] as JsonObject | undefined),
        };
        delete mcpServers[req.params.id];
        settings['mcpServers'] = mcpServers;
        return settings;
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to delete MCP', error);
      return res.status(500).json({ error: 'Failed to delete MCP' });
    }
  });

  expressApp.post('/api/v1/webui/hooks', async (req, res) => {
    try {
      const parsed = parseHookCreateBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const hooks = { ...(settings['hooks'] as JsonObject | undefined) };
        const groups = Array.isArray(hooks[parsed.section])
          ? [...(hooks[parsed.section] as unknown[])]
          : [];
        groups.push(parsed.group);
        hooks[parsed.section] = groups;
        settings['hooks'] = hooks;
        return settings;
      });
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
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ error: 'index must be a non-negative integer.' });
      }
      const parsed = parseHookUpdateBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const hooks = { ...(settings['hooks'] as JsonObject | undefined) };
        const groups = Array.isArray(hooks[section])
          ? [...(hooks[section] as unknown[])]
          : [];
        groups[index] = parsed.group;
        hooks[section] = groups;
        settings['hooks'] = hooks;
        return settings;
      });
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
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ error: 'index must be a non-negative integer.' });
      }
      await updateJson(settingsPath, {} as JsonObject, (settings) => {
        const hooks = { ...(settings['hooks'] as JsonObject | undefined) };
        const groups = Array.isArray(hooks[section])
          ? [...(hooks[section] as unknown[])]
          : [];
        groups.splice(index, 1);
        hooks[section] = groups;
        settings['hooks'] = hooks;
        return settings;
      });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to delete hook', error);
      return res.status(500).json({ error: 'Failed to delete hook' });
    }
  });

  expressApp.post('/api/v1/webui/schedules', async (req, res) => {
    try {
      const parsed = parseScheduleCreateBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      const now = Date.now();
      const job = {
        id: uuidv4(),
        name: parsed.name,
        description: parsed.description,
        enabled: true,
        createdAtMs: now,
        updatedAtMs: now,
        schedule: parsed.schedule,
        payload: parsed.payload,
        state: {},
      };
      await updateJson(
        schedulePath,
        { version: 1, jobs: [] as JsonObject[] },
        (store) => ({
          ...store,
          jobs: [...(store.jobs as JsonObject[]), job],
        }),
      );
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to add schedule', error);
      return res.status(500).json({ error: 'Failed to add schedule' });
    }
  });

  expressApp.put('/api/v1/webui/schedules/:id', async (req, res) => {
    try {
      const parsed = parseScheduleUpdateBody(req.body);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      let found = false;
      await updateJson(
        schedulePath,
        { version: 1, jobs: [] as JsonObject[] },
        (store) => {
          const jobs = (store.jobs as JsonObject[]) ?? [];
          const idx = jobs.findIndex((job) => job['id'] === req.params.id);
          if (idx === -1) {
            return store;
          }
          found = true;
          jobs[idx] = {
            ...jobs[idx],
            name: parsed.name ?? jobs[idx]['name'],
            schedule: parsed.schedule ?? jobs[idx]['schedule'],
            payload: parsed.payload ?? jobs[idx]['payload'],
            updatedAtMs: Date.now(),
          };
          return { ...store, jobs };
        },
      );
      if (!found) return res.status(404).json({ error: 'Not found' });
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to update schedule', error);
      return res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  expressApp.delete('/api/v1/webui/schedules/:id', async (req, res) => {
    try {
      await updateJson(
        schedulePath,
        { version: 1, jobs: [] as JsonObject[] },
        (store) => {
          const jobs = (store.jobs as JsonObject[]) ?? [];
          return { ...store, jobs: jobs.filter((job) => job['id'] !== req.params.id) };
        },
      );
      return res.status(204).end();
    } catch (error) {
      logger.error('[WebUI] Failed to delete schedule', error);
      return res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });
}
