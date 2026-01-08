import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/lib.ts', 'src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  target: 'node20',
  platform: 'node',

  // Bundle ESM-only packages so they work in CJS
  noExternal: [
    'effect',
    '@effect/cli',
    '@effect/platform',
    '@effect/platform-node',
  ],

  // Keep Node.js built-ins and CJS-compatible deps external
  external: [
    /^node:/,
    'pouchdb-core',
    'pouchdb-adapter-http',
    'pouchdb-mapreduce',
  ],
});
