import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createProgrammaticCliArgs, createPapertAgent } from '@papert-code/papert-code/api';
import { AuthType } from '@papert-code/papert-code-core';
import 'dotenv/config';

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

// Helper to capture logs and stream response
async function streamResponse(res: express.Response, action: () => Promise<any>) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;

  const sendEvent = (type: string, data: any) => {
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
    const result = await action();
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

app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  await streamResponse(res, async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papercode-'));
    console.log(`Generating in temp dir: ${tempDir}`);

    // try {
    const agent = await createPapertAgent({
      cliArgs: createProgrammaticCliArgs({
        model: 'gemini-3-pro-preview',
        outputFormat: 'text',
        approvalMode: 'yolo',
      }),
      workspaceDir: tempDir,
    });

    await agent.runPrompt(prompt, {
      authType: AuthType.USE_OPENAI,
      promptId: `gen-${Date.now()}`,
    });

    const files = await readFilesRecursively(tempDir);
    const previewable = files.some(f => f.path.endsWith('.html') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx') || f.path === 'package.json');

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
  const { prompt, files } = req.body;
  if (!prompt || !files) {
    return res.status(400).json({ error: 'Prompt and files are required' });
  }

  await streamResponse(res, async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papercode-refine-'));
    console.log(`Refining in temp dir: ${tempDir}`);

    try {
      await writeFiles(tempDir, files);

      const agent = await createPapertAgent({
        cliArgs: createProgrammaticCliArgs({
          model: 'gemini-2.0-flash-exp',
          outputFormat: 'text',
          approvalMode: 'yolo',
        }),
        workspaceDir: tempDir,
      });

      await agent.runPrompt(prompt, {
        authType: AuthType.USE_OPENAI,
        promptId: `refine-${Date.now()}`,
      });

      const newFiles = await readFilesRecursively(tempDir);
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
