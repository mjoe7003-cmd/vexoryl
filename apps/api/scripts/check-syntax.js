import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await javascriptFiles(path));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

const files = await javascriptFiles(fileURLToPath(new URL('../src', import.meta.url)));
await Promise.all(files.map((file) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Syntax check failed: ${file}`)));
})));
console.log(`Checked ${files.length} API JavaScript files.`);