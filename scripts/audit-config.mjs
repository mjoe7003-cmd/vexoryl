import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const secretPatterns = [
  /(?:sk-[A-Za-z0-9_-]{20,}|sb_(?:secret|service_role)_[A-Za-z0-9_-]{12,})/,
  /(?:MUX_TOKEN_SECRET|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY)\s*[:=]\s*['"][^'"\n]{12,}['"]/,
];
const ignored = new Set(['node_modules', 'dist', '.git']);
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.sql', '.md', '.env.example']);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if ([...extensions].some((extension) => entry.name.endsWith(extension))) result.push(path);
  }
  return result;
}

const findings = [];
for (const file of await files(root)) {
  const source = await readFile(file, 'utf8');
  for (const pattern of secretPatterns) if (pattern.test(source)) findings.push(relative(root, file));
}
if (findings.length) {
  console.error(`Credential-shaped values found in: ${[...new Set(findings)].join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Configuration audit passed: no credential-shaped literals found in source or templates.');
}