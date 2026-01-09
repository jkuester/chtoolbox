import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/lib.ts', 'src/index.ts'],
  format: ['cjs', 'esm'],
  define: {
    // Can remove this if/when we sort out the import.meta issues for TDG
    'import.meta': '{}'
  }
});
