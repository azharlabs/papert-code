import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { query } from '@papert-code/sdk-typescript';
import 'dotenv/config';
import { randomUUID } from 'crypto';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// ... (imports)

const app = express();
const PORT = 3000;

// Database Setup
let db: any;
(async () => {
  db = await open({
    filename: 'projects.db',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      timestamp INTEGER,
      files TEXT,
      logs TEXT,
      chatHistory TEXT,
      prdText TEXT
    )
  `);
})();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logging middleware
// app.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//   next();
// });

// Helper to read files recursively
async function readFilesRecursively(dir: string, baseDir: string = dir): Promise<{ path: string, content: string }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: { path: string, content: string }[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const subFiles = await readFilesRecursively(fullPath, baseDir);
      files.push(...subFiles);
    } else {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        files.push({ path: relativePath, content });
      } catch (e) {
        console.warn(`Failed to read file ${relativePath}:`, e);
      }
    }
  }
  return files;
}

// Helper to write files
async function writeFiles(dir: string, files: { path: string, content: string }[]) {
  for (const file of files) {
    const fullPath = path.join(dir, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content);
  }
}

const resolvePapertExecutable = () => {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const distCli = path.join(repoRoot, 'dist', 'cli.js');
  if (existsSync(distCli)) {
    return distCli;
  }
  const tsCli = path.join(repoRoot, 'packages', 'cli', 'src', 'index.ts');
  return `tsx:${tsCli}`;
};

type SendEvent = (type: string, data: any) => void;

type PendingApproval = {
  runId: string;
  decide: (decision: 'allow' | 'deny') => void;
  timeout: NodeJS.Timeout;
};

const pendingApprovals = new Map<string, PendingApproval>();

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const sendModelOutput = (
  sendEvent: SendEvent,
  kind: 'model' | 'thinking' | 'delta',
  text: string,
) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  sendEvent('model_output', { kind, text: trimmed });
};

const describeToolUse = (
  toolName: string,
  input: Record<string, unknown> | null | undefined,
  cwd: string,
) => {
  if (!input || typeof input !== 'object') {
    return `${toolName} ${safeStringify(input)}`;
  }

  const filePath =
    (input.file_path as string | undefined) ||
    (input.path as string | undefined) ||
    (input.filePath as string | undefined);

  if (typeof filePath === 'string') {
    const relativePath = path.relative(cwd, filePath);
    const displayPath =
      relativePath && !relativePath.startsWith('..')
        ? relativePath
        : filePath;
    return `${toolName} ${displayPath}`;
  }

  if (toolName === 'run_shell_command') {
    const command = input.command;
    if (typeof command === 'string') {
      return `${toolName} ${command}`;
    }
  }

  return `${toolName} ${safeStringify(input)}`;
};

const emitGeneratedFiles = (sendEvent: SendEvent, files: { path: string }[]) => {
  sendEvent('log', `Generated ${files.length} files.`);
  const maxFiles = 50;
  files.slice(0, maxFiles).forEach((file) => {
    sendEvent('log', `+ ${file.path}`);
  });
  if (files.length > maxFiles) {
    sendEvent('log', `...and ${files.length - maxFiles} more files.`);
  }
};

// Helper to capture logs and stream response
async function streamResponse(
  res: express.Response,
  action: (sendEvent: SendEvent) => Promise<any>,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;

  const sendEvent: SendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  // Monkey-patch stdout/stderr to capture logs
  const captureLog = (chunk: any) => {
    const str = chunk.toString();
    sendEvent('log', str);
    return true;
  };

  process.stdout.write = (chunk: any, encoding?: any, cb?: any) => {
    captureLog(chunk);
    return originalStdout.apply(process.stdout, [chunk, encoding, cb]);
  };

  process.stderr.write = (chunk: any, encoding?: any, cb?: any) => {
    captureLog(chunk);
    return originalStderr.apply(process.stderr, [chunk, encoding, cb]);
  };

  try {
    const result = await action(sendEvent);
    sendEvent('result', result);
  } catch (error: any) {
    console.error('Action failed:', error);
    sendEvent('error', error.message);
  } finally {
    // Restore stdout/stderr
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    res.end();
  }
}

const requestToolApproval = (
  sendEvent: SendEvent,
  runId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  suggestions: unknown,
  signal: AbortSignal,
) =>
  new Promise<{ behavior: 'allow'; updatedInput: Record<string, unknown> } | { behavior: 'deny'; message: string }>(
    (resolve) => {
      const requestId = randomUUID();
      const timeout = setTimeout(() => {
        pendingApprovals.delete(requestId);
        resolve({ behavior: 'deny', message: 'Approval timed out.' });
      }, 25000);

      const decide = (decision: 'allow' | 'deny') => {
        if (decision === 'allow') {
          resolve({ behavior: 'allow', updatedInput: toolInput });
        } else {
          resolve({ behavior: 'deny', message: 'Denied by user.' });
        }
      };

      pendingApprovals.set(requestId, { runId, decide, timeout });
      sendEvent('log', `Approval needed for ${toolName}`);
      sendEvent('permission_request', {
        requestId,
        runId,
        toolName,
        input: toolInput,
        suggestions,
      });

      const onAbort = () => {
        clearTimeout(timeout);
        pendingApprovals.delete(requestId);
        resolve({ behavior: 'deny', message: 'Approval canceled.' });
      };

      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    },
  );

// --- Project API Endpoints ---

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db.all('SELECT id, name, timestamp FROM projects ORDER BY timestamp DESC');
    res.json(projects);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await db.get('SELECT * FROM projects WHERE id = ?', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Parse JSON fields
    project.files = JSON.parse(project.files || '[]');
    project.logs = JSON.parse(project.logs || '[]');
    project.chatHistory = JSON.parse(project.chatHistory || '[]');
    
    res.json(project);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { id, name, timestamp, files, logs, chatHistory, prdText } = req.body;
  try {
    await db.run(`
      INSERT OR REPLACE INTO projects (id, name, timestamp, files, logs, chatHistory, prdText)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      name, 
      timestamp, 
      JSON.stringify(files), 
      JSON.stringify(logs), 
      JSON.stringify(chatHistory), 
      prdText
    ]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM projects WHERE id = ?', req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/projects/:id', async (req, res) => {
  const { name } = req.body;
  try {
    await db.run('UPDATE projects SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/approve-tool', (req, res) => {
  const { requestId, decision, runId } = req.body || {};

  if (!requestId || !decision || !runId) {
    return res.status(400).json({ error: 'requestId, decision, and runId are required.' });
  }

  const pending = pendingApprovals.get(requestId);
  if (!pending) {
    return res.status(404).json({ error: 'Approval request not found.' });
  }
  if (pending.runId !== runId) {
    return res.status(400).json({ error: 'Approval run mismatch.' });
  }

  clearTimeout(pending.timeout);
  pendingApprovals.delete(requestId);
  pending.decide(decision === 'allow' ? 'allow' : 'deny');

  return res.json({ success: true });
});

app.post('/api/generate', async (req, res) => {
  const { prompt, autoApprove = true, runId } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  await streamResponse(res, async (sendEvent) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papercode-'));
    console.log(`Generating in temp dir: ${tempDir}`);

    const q = query({
      prompt,
      options: {
        cwd: tempDir,
        model: 'gpt-5.2',
        skillsPath: path.join(process.cwd(), 'skills'),
        permissionMode: autoApprove ? 'yolo' : 'default',
        authType: 'openai',
        pathToPapertExecutable: resolvePapertExecutable(),
        includePartialMessages: true,
        canUseTool: autoApprove
        ? undefined
        : (toolName, input, { suggestions, signal }) =>
            requestToolApproval(
              sendEvent,
              runId || tempDir,
              toolName,
              input,
              suggestions,
              signal,
            ),
      },
    });

    let resultError: string | null = null;
    for await (const message of q) {
      if (message?.type === 'assistant') {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === 'text' && block.text?.trim()) {
              sendModelOutput(sendEvent, 'model', block.text);
            }
            if (block?.type === 'thinking' && block.thinking?.trim()) {
              sendModelOutput(sendEvent, 'thinking', block.thinking);
            }
            if (block?.type === 'tool_use') {
              sendEvent(
                'log',
                `tool: ${describeToolUse(block.name, block.input, tempDir)}`,
              );
            }
            if (block?.type === 'tool_result' && block.is_error) {
              const errorDetails =
                typeof block.content === 'string'
                  ? block.content
                  : safeStringify(block.content);
              sendEvent(
                'log',
                `tool_error: ${block.tool_use_id} ${errorDetails}`,
              );
            }
          }
        }
      }
      if (message?.type === 'stream_event') {
        const event = message.event;
        if (
          event?.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text?.trim()
        ) {
          sendModelOutput(sendEvent, 'delta', event.delta.text);
        }
        if (
          event?.type === 'content_block_delta' &&
          event.delta?.type === 'thinking_delta' &&
          event.delta.thinking?.trim()
        ) {
          sendModelOutput(sendEvent, 'thinking', event.delta.thinking);
        }
      }
      if (message.type === 'result') {
        if (message.is_error) {
          resultError = message.error?.message || 'Generation failed.';
        }
        break;
      }
    }

    if (resultError) {
      throw new Error(resultError);
    }

    const files = await readFilesRecursively(tempDir);
    const previewable = files.some(f => f.path.endsWith('.html') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || f.path === 'package.json');
    emitGeneratedFiles(sendEvent, files);

    return { files, previewable };
    // } finally {
    //   try {
    //     await fs.rm(tempDir, { recursive: true, force: true });
    //   } catch (e) {
    //     console.error('Cleanup failed:', e);
    //   }
    // }
  });
});

app.post('/api/refine', async (req, res) => {
  const { prompt, files, autoApprove = true, runId } = req.body;
  if (!prompt || !files) {
    return res.status(400).json({ error: 'Prompt and files are required' });
  }

  await streamResponse(res, async (sendEvent) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papercode-refine-'));
    console.log(`Refining in temp dir: ${tempDir}`);

    try {
      await writeFiles(tempDir, files);

      const q = query({
        prompt,
        options: {
          cwd: tempDir,
          model: 'gpt-5.2',
          skillsPath: path.join(process.cwd(), 'skills'),
          permissionMode: autoApprove ? 'yolo' : 'default',
          authType: 'openai',
          pathToPapertExecutable: resolvePapertExecutable(),
          includePartialMessages: true,
          canUseTool: autoApprove
            ? undefined
            : (toolName, input, { suggestions, signal }) =>
                requestToolApproval(
                  sendEvent,
                  runId || tempDir,
                  toolName,
                  input,
                  suggestions,
                  signal,
                ),
        },
      });

      let resultError: string | null = null;
      for await (const message of q) {
        if (message?.type === 'assistant') {
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block?.type === 'text' && block.text?.trim()) {
                sendModelOutput(sendEvent, 'model', block.text);
              }
              if (block?.type === 'thinking' && block.thinking?.trim()) {
                sendModelOutput(sendEvent, 'thinking', block.thinking);
              }
              if (block?.type === 'tool_use') {
                sendEvent(
                  'log',
                  `tool: ${describeToolUse(block.name, block.input, tempDir)}`,
                );
              }
              if (block?.type === 'tool_result' && block.is_error) {
                const errorDetails =
                  typeof block.content === 'string'
                    ? block.content
                    : safeStringify(block.content);
                sendEvent(
                  'log',
                  `tool_error: ${block.tool_use_id} ${errorDetails}`,
                );
              }
            }
          }
        }
        if (message?.type === 'stream_event') {
          const event = message.event;
          if (
            event?.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text?.trim()
          ) {
            sendModelOutput(sendEvent, 'delta', event.delta.text);
          }
          if (
            event?.type === 'content_block_delta' &&
            event.delta?.type === 'thinking_delta' &&
            event.delta.thinking?.trim()
          ) {
            sendModelOutput(sendEvent, 'thinking', event.delta.thinking);
          }
        }
        if (message.type === 'result') {
          if (message.is_error) {
            resultError = message.error?.message || 'Refinement failed.';
          }
          break;
        }
      }

      if (resultError) {
        throw new Error(resultError);
      }

      const newFiles = await readFilesRecursively(tempDir);
      emitGeneratedFiles(sendEvent, newFiles);
      return { files: newFiles };
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
