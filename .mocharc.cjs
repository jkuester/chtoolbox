module.exports = {
  require: 'test/utils/base.ts',
  'node-option': [
    'import=tsx',
    'import=./test/utils/nyc-esm-hook-loader.js'
  ]
};
