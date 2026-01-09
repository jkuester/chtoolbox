import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/lib.ts', 'src/index.ts'],
  format: ['cjs', 'esm'],
});
