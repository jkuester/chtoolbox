module.exports = {
  require: 'test/utils/base.ts',
  'node-option': [
    'import=tsx',
    'import=./test/utils/nyc-esm-hook-loader.js',
    // Since mocha 11.7, when Node reports `process.features.require_module` mocha loads spec files
    // with CommonJS `require()` instead of dynamic `import()`. Under tsx that produces a *second*
    // instance of test/utils/base.ts, so the root `afterEach` resets a different sinon sandbox than
    // the specs stub against and call-history leaks between tests (specs pass alone, fail in the
    // full suite). Disabling require(esm) restores mocha's import-first loading and a single
    // base.ts instance. Remove only if mocha stops branching on require_module.
    'no-experimental-require-module'
  ]
};
