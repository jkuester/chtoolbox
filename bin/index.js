#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const tsxPath = fileURLToPath(import.meta.resolve('tsx'));

/**
 * This file is a shim for running the TS directly as a bin script.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '..', 'src', 'index.ts');

const result = spawnSync(
  'node',
  [
    '--import',
    tsxPath,
    entry,
    ...process.argv.slice(2)
  ],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 0);
