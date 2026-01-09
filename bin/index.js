#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcEntry = resolve(__dirname, '..', 'src', 'index.ts');

// If src/index.ts exists, we're in a local clone - use tsx to run TypeScript directly
// Otherwise, we're installed from npm - run the compiled dist/index.mjs
if (existsSync(srcEntry)) {
  const { spawnSync } = await import('node:child_process');
  const tsxPath = fileURLToPath(import.meta.resolve('tsx'));

  const result = spawnSync(
    'node',
    [
      '--import',
      tsxPath,
      srcEntry,
      ...process.argv.slice(2)
    ],
    { stdio: 'inherit' }
  );

  process.exit(result.status ?? 0);
} else {
  await import('../dist/index.mjs');
}
