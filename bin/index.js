#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This file is a shim for running the TS directly as a bin script. It automatically applies the
 * --experimental-strip-types and --no-warnings=ExperimentalWarning (to suppress the warnings) flags to the node
 * process.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '..', 'src', 'index.ts');

const result = spawnSync(
  'node',
  [
    '--experimental-strip-types',
    '--no-warnings=ExperimentalWarning',
    entry,
    ...process.argv.slice(2)
  ],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 0);
