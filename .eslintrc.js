module.exports = {
  extends: [
    '@medic',
    // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/strict-type-checked.ts
    'plugin:@typescript-eslint/strict-type-checked',
    // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/stylistic-type-checked.ts
    'plugin:@typescript-eslint/stylistic-type-checked',
  ],
  env: {
    node: true
  },
  ignorePatterns: [
    '.eslintrc.js',
    'nyc.config.js',
    'dist/',
    'node_modules'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'node', 'promise'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': ['error'],
    '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
    '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
    'array-bracket-newline': ['error', 'consistent'],
    'array-callback-return': ['error', { 'allowImplicit': true }],
    'arrow-spacing': ['error', { before: true, after: true }],
    'brace-style': ['error', '1tbs'],
    'comma-spacing': ['error', { 'before': false, 'after': true }],
    'comma-style': ['error', 'last'],
    'default-param-last': 'error',
    'dot-location': ['error', 'property'],
    'dot-notation': ['error', { 'allowKeywords': true }],
    'func-call-spacing': ['error', 'never'],
    'func-style': ['error', 'expression'],
    'function-call-argument-newline': ['error', 'consistent'],
    'function-paren-newline': ['error', 'consistent'],
    'implicit-arrow-linebreak': ['error', 'beside'],
    'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'linebreak-style': ['error', 'unix'],
    'lines-between-class-members': ['error', 'always', { 'exceptAfterSingleLine': true }],
    'new-parens': 'error',
    'no-alert': 'error',
    'no-else-return': 'error',
    'no-extra-bind': 'error',
    'no-lone-blocks': 'error',
    'no-nested-ternary': 'error',
    'no-undef-init': 'error',
    'no-useless-rename': 'error',
    'no-whitespace-before-property': 'error',
    'node/no-exports-assign': 'error',
    'rest-spread-spacing': ['error', 'never'],
    'semi-spacing': ['error', { 'before': false, 'after': true }],
    'semi-style': ['error', 'last'],
    'template-curly-spacing': 'error',
  },
  overrides: [
    {
      files: ['**/test/**'],
      rules: {
        '@typescript-eslint/no-unused-expressions': ['off'],
      }
    }
  ]
};
