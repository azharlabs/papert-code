import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, '..');
const docsRoot = path.resolve(siteRoot, '..');
const contentRoot = path.join(siteRoot, 'content');

const EXCLUDE_DIRS = new Set(['site']);
const EXCLUDE_FILES = new Set(['.DS_Store']);
const ALLOWED_FILE_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
]);

async function copyDir(src, dest, root = src) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDE_FILES.has(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const relPath = path.relative(root, srcPath);
    const firstSeg = relPath.split(path.sep)[0];
    if (EXCLUDE_DIRS.has(firstSeg)) {
      continue;
    }

    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, root);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
        continue;
      }
      await fs.copyFile(srcPath, destPath);
    }
  }
}

await fs.rm(contentRoot, { recursive: true, force: true });
await copyDir(docsRoot, contentRoot);

console.log(`Synced docs content to ${contentRoot}`);
