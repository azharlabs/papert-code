/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import type { Part, PartListUnion } from '@google/genai';
import type { Config } from '../config/config.js';
import { Storage } from '../config/storage.js';
import { partListUnionToString } from '../core/geminiRequest.js';
import type { WorkspaceContext } from '../utils/workspaceContext.js';
import { safeJsonStringify } from '../utils/safeJsonStringify.js';
import type { ToolResult, ToolResultDisplay } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
} from './tools.js';

type ToolParams = Record<string, unknown>;

export interface CustomToolContext {
  config: Config;
  toolName: string;
  toolPath: string;
  toolDirectory: string;
  projectRoot: string;
  workspaceContext: WorkspaceContext;
  sessionId: string;
  abortSignal: AbortSignal;
}

export type CustomToolExecuteResult =
  | ToolResult
  | ToolResultDisplay
  | PartListUnion
  | string
  | number
  | boolean
  | null
  | undefined;

export interface CustomToolDefinition {
  description: string;
  parametersJsonSchema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  args?: Record<string, unknown>;
  displayName?: string;
  isOutputMarkdown?: boolean;
  canUpdateOutput?: boolean;
  execute: (
    args: ToolParams,
    context: CustomToolContext,
  ) => Promise<CustomToolExecuteResult> | CustomToolExecuteResult;
}

export interface CustomToolSpec {
  name: string;
  sourcePath: string;
  definition: CustomToolDefinition;
}

const TOOL_FILE_GLOBS = ['*.{js,ts,mjs,cjs,tsx}'];

export function defineTool(definition: CustomToolDefinition): CustomToolDefinition {
  return definition;
}

function isCustomToolDefinition(value: unknown): value is CustomToolDefinition {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as CustomToolDefinition;
  return typeof maybe.description === 'string' && typeof maybe.execute === 'function';
}

function resolveParameterSchema(definition: CustomToolDefinition): Record<string, unknown> {
  if (definition.parametersJsonSchema && typeof definition.parametersJsonSchema === 'object') {
    return definition.parametersJsonSchema;
  }
  if (definition.parameters && typeof definition.parameters === 'object') {
    return definition.parameters;
  }
  if (definition.args && typeof definition.args === 'object') {
    return definition.args;
  }
  return { type: 'object', properties: {} };
}

function normalizeReturnDisplay(value: unknown): ToolResultDisplay {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if ('fileDiff' in value || 'ansiOutput' in value) {
      return value as ToolResultDisplay;
    }
    if ('type' in value) {
      const typeValue = (value as { type?: string }).type;
      if (typeValue === 'todo_list' || typeValue === 'plan_summary' || typeValue === 'task_execution') {
        return value as ToolResultDisplay;
      }
    }
  }
  return safeJsonStringify(value ?? '');
}

function toPartListUnion(value: unknown): PartListUnion {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value as PartListUnion;
  if (value && typeof value === 'object' && 'text' in value) {
    return [value as Part];
  }
  return safeJsonStringify(value ?? '');
}

function normalizeCustomToolResult(value: CustomToolExecuteResult): ToolResult {
  if (value && typeof value === 'object' && 'llmContent' in value && 'returnDisplay' in value) {
    return value as ToolResult;
  }

  const llmContent = toPartListUnion(value);
  const returnDisplay = normalizeReturnDisplay(value);

  return {
    llmContent,
    returnDisplay,
  };
}

class LocalCustomToolInvocation extends BaseToolInvocation<ToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    private readonly toolName: string,
    private readonly toolPath: string,
    private readonly executeFn: CustomToolDefinition['execute'],
    params: ToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return partListUnionToString(toPartListUnion(this.params));
  }

  async execute(
    signal: AbortSignal,
    _updateOutput?: (output: ToolResultDisplay) => void,
  ): Promise<ToolResult> {
    const context: CustomToolContext = {
      config: this.config,
      toolName: this.toolName,
      toolPath: this.toolPath,
      toolDirectory: path.dirname(this.toolPath),
      projectRoot: this.config.getProjectRoot(),
      workspaceContext: this.config.getWorkspaceContext(),
      sessionId: this.config.getSessionId(),
      abortSignal: signal,
    };

    const result = await this.executeFn(this.params, context);
    return normalizeCustomToolResult(result);
  }
}

export class LocalCustomTool extends BaseDeclarativeTool<ToolParams, ToolResult> {
  private readonly executeFn: CustomToolDefinition['execute'];
  private readonly sourcePath: string;
  private readonly config: Config;

  constructor(
    config: Config,
    name: string,
    definition: CustomToolDefinition,
    sourcePath: string,
  ) {
    const parameterSchema = resolveParameterSchema(definition);
    super(
      name,
      definition.displayName ?? name,
      definition.description,
      Kind.Other,
      parameterSchema,
      definition.isOutputMarkdown ?? false,
      definition.canUpdateOutput ?? false,
    );
    this.executeFn = definition.execute;
    this.sourcePath = sourcePath;
    this.config = config;
  }

  protected createInvocation(params: ToolParams): ToolInvocation<ToolParams, ToolResult> {
    return new LocalCustomToolInvocation(
      this.config,
      this.name,
      this.sourcePath,
      this.executeFn,
      params,
    );
  }
}

async function discoverToolsInDirectory(directory: string): Promise<CustomToolSpec[]> {
  const matches = await glob(TOOL_FILE_GLOBS, {
    cwd: directory,
    absolute: true,
    nodir: true,
    dot: true,
  });

  const specs: CustomToolSpec[] = [];
  for (const filePath of matches.sort()) {
    const baseName = path.basename(filePath, path.extname(filePath));
    try {
      const stats = await fs.stat(filePath);
      const specifier = `${pathToFileURL(filePath).toString()}?mtime=${stats.mtimeMs}`;
      const mod = (await import(specifier)) as Record<string, unknown>;

      for (const [exportName, exportValue] of Object.entries(mod)) {
        if (!isCustomToolDefinition(exportValue)) continue;
        const name =
          exportName === 'default' ? baseName : `${baseName}_${exportName}`;
        specs.push({ name, sourcePath: filePath, definition: exportValue });
      }
    } catch (error) {
      console.warn(`Failed to load custom tool file ${filePath}:`, error);
    }
  }

  return specs;
}

export async function discoverLocalCustomTools(config: Config): Promise<CustomToolSpec[]> {
  const specs: CustomToolSpec[] = [];
  const projectRoot = config.getProjectRoot();
  const projectToolsDirs = [
    path.join(projectRoot, '.papert', 'tools'),
    path.join(projectRoot, '.papert', 'tool'),
  ];

  const globalToolsDir = path.join(Storage.getGlobalPapertDir(), 'tools');
  const globalToolsDirAlt = path.join(Storage.getGlobalPapertDir(), 'tool');

  if (config.isTrustedFolder()) {
    for (const dir of projectToolsDirs) {
      try {
        const dirStats = await fs.stat(dir);
        if (!dirStats.isDirectory()) continue;
        specs.push(...(await discoverToolsInDirectory(dir)));
      } catch {
        // Ignore missing or inaccessible project tool directories
      }
    }
  }

  for (const dir of [globalToolsDir, globalToolsDirAlt]) {
    try {
      const dirStats = await fs.stat(dir);
      if (!dirStats.isDirectory()) continue;
      specs.push(...(await discoverToolsInDirectory(dir)));
    } catch {
      // Ignore missing or inaccessible global tool directories
    }
  }

  return specs;
}
